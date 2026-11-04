"""
Renommage des fiches de paie dans SharePoint.

Dossier : COMPTA/DETAILS_EMPLOYES/FDP (et ses sous-dossiers par annee).
Nom vise : « AAAA.MM - CODE.pdf », ex. « 2026.02 - GGO.pdf ».

LE CODE N'EST PAS DEVINE. C'est `collaborateurs.code` — la meme table qui
porte deja GGO pour Gregory Godfroid, LDE pour Ludovic Detilloux. Un trigramme
absent de cette table n'est pas invente : le fichier part dans la liste a
verifier. Inventer un code, ce serait creer un employe qui n'existe pas.

LA PERIODE VIENT DU NOM, pas du contenu. Un nom qui porte une date
(« 20251028_FDP LDE.pdf ») donne 2025.10. Un nom qui n'en porte pas est
signale, jamais devine : une fiche de paie classee dans le mauvais mois est
une fiche introuvable au moment du controle.

Ce script ne fait qu'une chose dans SharePoint : changer un nom. Jamais de
deplacement, jamais de suppression. Les fichiers deja conformes sont ignores.

Les suffixes sont conserves : « 2025.12 - FBL - ecocheque.pdf » reste tel
quel, c'est une piece distincte de la fiche du mois.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  DRY_RUN=1   affiche les renommages, n'en fait aucun (defaut)
  LOT         nombre maximum de renommages ; 0 = tous
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from _env import DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
DOSSIER = "COMPTA/DETAILS_EMPLOYES/FDP"
LOT = int(os.environ.get("LOT", "0") or 0)

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

CONFORME = re.compile(r"^(\d{4})\.(\d{2}) - ([A-Z]{2,4})(\s-\s.+)?\.pdf$", re.I)

# LA PERIODE COUVERTE, PAS LE MOIS D'EDITION. « 2026.08 - PFQ.pdf » porte
# « Periode 01/08/2026 - 31/08/2026, Etablie le 07/09/2026 » : le nom suit le
# mois travaille, pas celui ou le secretariat social a edite le document.
# Le nom de mois ecrit dans le fichier est donc la meilleure source, et il
# l'emporte sur la date en tete, qui est une date d'edition.
MOIS = {"JANV": 1, "JAN": 1, "FEVR": 2, "FEV": 2, "MARS": 3, "MAR": 3,
        "AVRIL": 4, "AVR": 4, "MAI": 5, "JUIN": 6, "JUIL": 7,
        "AOUT": 8, "AOU": 8, "SEPT": 9, "SEP": 9, "OCTO": 10, "OCT": 10,
        "NOVE": 11, "NOV": 11, "DECE": 12, "DEC": 12}
# Les cles les plus longues d'abord : JUIN et JUIL doivent se distinguer.
MOIS_TRI = sorted(MOIS, key=len, reverse=True)
MOTIF_MOIS = re.compile(
    r"\b(JANVIER|JANV|FEVRIER|FEVR|MARS|AVRIL|AVR|MAI|JUIN|JUILLET|JUIL|AOUT|"
    r"SEPTEMBRE|SEPT|OCTOBRE|OCTO|NOVEMBRER|NOVEMBRE|NOVE|DECEMBRE|DECE)\.?\s*"
    r"(\d{4}|\d{2})\b")
MOTIF_MM_AAAA = re.compile(r"\b(0[1-9]|1[0-2])[.\-_](20\d{2})\b")
MOTIF_AAAA_MM = re.compile(r"\b(20\d{2})[.\-_]?(0[1-9]|1[0-2])\b")
MOTIF_DATE_TETE = re.compile(r"^(20\d{2})(0[1-9]|1[0-2])[0-3]\d")

# Une fiche de paie mensuelle et une prime de fin d'annee sont deux pieces
# distinctes : le qualificatif doit survivre au renommage, sinon deux fichiers
# du meme mois se marchent dessus.
QUALIFS = [
    (re.compile(r"PRIME.{0,4}FIN D.ANN", re.I),  "prime de fin d'année"),
    (re.compile(r"CONG[EÉ] PAY", re.I),          "congé payé"),
    (re.compile(r"P[EÉ]CULE", re.I),             "pécule de vacances"),
    (re.compile(r"[EÉ]CO.?CH[EÈ]QUE", re.I),     "écochèque"),
    (re.compile(r"\b13[EÈ]? MOIS\b", re.I),      "13e mois"),
    (re.compile(r"\bSOLDE\b", re.I),            "solde"),
]

# Trigrammes mal tapes rencontres dans les noms existants. Une faute de frappe
# n'est pas un employe : on la corrige, on ne cree pas de fiche.
# PQF : PFQ mal tape. LDU : ancien code de Ludovic Detilloux, devenu LDE —
# lu dans la fiche elle-meme (« DETILLOUX Ludovic », dirigeant, 01/2022).
ALIAS = {"PQF": "PFQ", "LDU": "LDE"}


def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials"}).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, corps)) as r:
        return json.load(r)["access_token"]


def site_id(jeton) -> str:
    """L'identifiant du site. Les chemins Graph se construisent dessus, pas
    sur « dynassur.sharepoint.com:/sites/… » : deux « : » dans une URL et
    Graph refuse le segment."""
    return graph(jeton, "GET", f"/sites/{SITE}")["id"]


def graph(jeton, methode, chemin, charge=None):
    url = chemin if chemin.startswith("http") else GRAPH + chemin
    donnees = json.dumps(charge).encode() if charge is not None else None
    req = urllib.request.Request(url, donnees, method=methode)
    req.add_header("Authorization", "Bearer " + jeton)
    if donnees:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            brut = r.read()
            return json.loads(brut) if brut else {}
    except urllib.error.HTTPError as e:
        # Un refus muet coute des heures. On remonte ce que Graph a dit.
        raise SystemExit(f"Graph {methode} {chemin} → {e.code} {e.read()[:400]!r}")


def codes_employes():
    """Les trigrammes connus, depuis la base. La base fait foi."""
    url = (SUPABASE_URL.rstrip("/") + "/rest/v1/collaborateurs"
           "?select=code,nom_complet&code=not.is.null")
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_SERVICE_KEY)
    req.add_header("Authorization", "Bearer " + SUPABASE_SERVICE_KEY)
    with urllib.request.urlopen(req) as r:
        lignes = json.load(r)
    return {l["code"].upper(): l.get("nom_complet") or "" for l in lignes if l.get("code")}


def enfants(jeton, sid, chemin):
    """Les elements d'un dossier, pagination suivie. Parcours PAR CHEMIN,
    comme le scan des factures : c'est la forme qui tourne en production."""
    url = f"/sites/{sid}/drive/root:/{urllib.parse.quote(chemin)}:/children?$top=200"
    while url:
        page = graph(jeton, "GET", url)
        for el in page.get("value", []):
            yield el
        url = page.get("@odata.nextLink")


def parcourir(jeton, sid, racine):
    """Tous les PDF du dossier et de ses sous-dossiers."""
    a_visiter = [racine]
    while a_visiter:
        chemin = a_visiter.pop()
        for el in enfants(jeton, sid, chemin):
            if "folder" in el:
                a_visiter.append(f"{chemin}/{el['name']}")
            elif el["name"].lower().endswith(".pdf"):
                yield el, chemin


def sans_accent(t):
    return "".join(c for c in unicodedata.normalize("NFD", t)
                   if unicodedata.category(c) != "Mn")


def lire_periode(base, hay):
    """(annee, mois, motif). Le nom de mois gagne : c'est la periode couverte.

    La date en tete d'un nom (« 20251114_… ») est la date d'EDITION. Une fiche
    d'octobre editee le 14 novembre porterait 2025.11 — un mois faux. Elle ne
    sert donc jamais seule.
    """
    m = MOTIF_MOIS.search(hay)
    if m:
        mot = m.group(1)
        mois = next((MOIS[c] for c in MOIS_TRI if mot.startswith(c)), None)
        if not mois:
            return None, None, "mois illisible : " + mot
        an = int(m.group(2))
        if an < 100:
            an += 2000
        if 2015 <= an <= 2035:
            return f"{an:04d}", f"{mois:02d}", ""

    m = MOTIF_MM_AAAA.search(base)
    if m:
        return m.group(2), m.group(1), ""

    # « 2025.11 - … » : deja le format cible. En revanche « 20251114… » est une
    # date d'edition : on l'ecarte avant de chercher.
    sans_tete = base[8:] if MOTIF_DATE_TETE.match(base) else base
    m = MOTIF_AAAA_MM.search(sans_tete)
    if m:
        return m.group(1), m.group(2), ""

    if MOTIF_DATE_TETE.match(base):
        return None, None, ("date d'edition seule (" + base[:8] + ") : "
                            "le mois de la periode n'est pas dans le nom")
    if any(m.search(base) for m, _ in QUALIFS):
        return None, None, ("document annuel (prime, pecule, conge paye) : "
                            "le nom ne porte pas de mois")
    return None, None, "aucune periode lisible dans le nom"


def par_le_nom(hay, codes):
    """Le trigramme deduit du NOM COMPLET ecrit dans le fichier.

    « I0064 - Fiche de paie Ludovic Detilloux.pdf » ne porte pas de trigramme,
    mais il porte mieux : le nom entier. On exige que TOUS les mots du nom
    officiel soient presents — « Detilloux » seul ne suffirait pas a trancher
    entre deux Detilloux, et deux employes ne doivent jamais se confondre.
    """
    gagnants = set()
    for code, complet in codes.items():
        mots = [m for m in re.split(r"[^A-Z]+", sans_accent(complet or "").upper()) if len(m) >= 3]
        if len(mots) >= 2 and all(m in hay for m in mots):
            gagnants.add(code)
    return gagnants


def analyser(nom, codes):
    """(nouveau_nom, motif) — nouveau_nom None quand on ne sait pas."""
    if CONFORME.match(nom):
        return None, "deja conforme"

    base = nom[:-4] if nom.lower().endswith(".pdf") else nom
    hay = sans_accent(base).upper()

    # Le trigramme : un mot isole du nom, qui existe dans la base.
    trouve = []
    for m in re.findall(r"[A-Z]{2,4}", hay):
        m = ALIAS.get(m, m)
        if m in codes and m != "FDP":
            trouve.append(m)
    if not trouve:
        trouve = sorted(par_le_nom(hay, codes))
    if not trouve:
        return None, "ni trigramme ni nom complet reconnu dans le nom"
    if len(set(trouve)) > 1:
        return None, "plusieurs trigrammes possibles : " + ", ".join(sorted(set(trouve)))
    code = trouve[0]

    annee, mois, motif = lire_periode(base, hay)
    if not annee:
        return None, motif

    # Le qualificatif distingue deux pieces du meme mois.
    qualif = next((q for motif_q, q in QUALIFS if motif_q.search(base)), None)
    suffixe = f" - {qualif}" if qualif else ""

    return f"{annee}.{mois} - {code}{suffixe}.pdf", ""


def main():
    banniere("Fiches de paie — renommage")
    if not (TENANT and CLIENT and SECRET):
        raise SystemExit("GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET manquants.")

    jeton = jeton_graph()
    codes = codes_employes()
    print(f"{len(codes)} trigramme(s) connu(s) en base.\n")

    sid = site_id(jeton)
    fichiers = list(parcourir(jeton, sid, DOSSIER))
    print(f"{len(fichiers)} PDF dans {DOSSIER} et ses sous-dossiers.\n")

    conformes, a_faire, a_verifier = 0, [], []
    for it, chemin in fichiers:
        nouveau, motif = analyser(it["name"], codes)
        if motif == "deja conforme":
            conformes += 1
        elif nouveau:
            a_faire.append((it, chemin, nouveau))
        else:
            a_verifier.append((it, chemin, motif))

    # DEUX FICHIERS NE PEUVENT PAS PORTER LE MEME NOM. Trois fiches visent
    # « 2023.08 - TJA.pdf » : des corrections ou des doublons. Renommer la
    # premiere et echouer sur les suivantes laisserait le dossier a moitie
    # traite, sans dire lesquelles. On les ecarte toutes, et on les nomme.
    pris = {}
    for it, chemin in fichiers:
        if CONFORME.match(it["name"]):
            pris.setdefault(it["name"].lower(), []).append(it["name"])
    for it, chemin, nouveau_nom in a_faire:
        pris.setdefault(nouveau_nom.lower(), []).append(it["name"])

    garde = []
    for it, chemin, nouveau_nom in a_faire:
        concurrents = pris.get(nouveau_nom.lower(), [])
        if len(concurrents) > 1:
            autres = [c for c in concurrents if c != it["name"]]
            a_verifier.append((it, chemin,
                               f"« {nouveau_nom} » serait aussi le nom de : "
                               + ", ".join(sorted(autres)[:3])))
        else:
            garde.append((it, chemin, nouveau_nom))
    a_faire = garde

    print(f"Deja conformes : {conformes}")
    print(f"Renommables    : {len(a_faire)}")
    print(f"A verifier     : {len(a_verifier)}\n")

    if a_verifier:
        print("── A VERIFIER (aucun renommage) " + "─" * 40)
        for it, chemin, motif in sorted(a_verifier, key=lambda x: x[1] + x[0]["name"]):
            print(f"  {chemin}/{it['name']}\n      → {motif}")
        print()

    if a_faire:
        print("── RENOMMAGES " + "─" * 58)
    faits = 0
    for it, chemin, nouveau in sorted(a_faire, key=lambda x: x[2]):
        if LOT and faits >= LOT:
            print(f"\nLot de {LOT} atteint, arret.")
            break
        print(f"  {chemin}/\n      {it['name']}\n   →  {nouveau}")
        if not DRY_RUN:
            graph(jeton, "PATCH", f"/sites/{sid}/drive/items/{it['id']}",
                  {"name": nouveau})
        faits += 1

    print(f"\n{faits} renomme(s)" + (" — ESSAI A BLANC, rien n'a change." if DRY_RUN else "."))


if __name__ == "__main__":
    main()
