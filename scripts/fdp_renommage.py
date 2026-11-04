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
from io import BytesIO

from pypdf import PdfReader

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


# ── Lire le document plutot que son nom ──────────────────────────────────────
#
# « Etabli en novembre mais valable pour octobre, c'est note dedans. »
#
# Le nom d'un fichier est un ouï-dire : quelqu'un l'a tape, parfois de travers
# (« Audreay Lapaille », « Van Muyder »), parfois en confondant la date
# d'edition et la periode couverte. La fiche, elle, porte les deux en clair.
# C'est donc elle qui decide, et le nom ne sert plus que de secours.
#
# Aucun modele n'est appele : le texte du PDF suffit, une expression reguliere
# le lit. Zero jeton, et le meme resultat a chaque passage.

MOTIF_PERIODE = re.compile(
    r"P[ée]riode\s*:?\s*(?:(\d{2})/(\d{2})/(\d{4}))?\s*[-–—]\s*(\d{2})/(\d{2})/(\d{4})")


def telecharger(jeton, sid, item_id):
    """Le contenu du fichier. Lecture seule : rien n'est ecrit dans SharePoint."""
    url = f"{GRAPH}/sites/{sid}/drive/items/{item_id}/content"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + jeton})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.read()
    except Exception:                                   # noqa: BLE001
        return None


def texte_pdf(octets):
    """Les deux premieres pages suffisent : l'entete y est."""
    try:
        lecteur = PdfReader(BytesIO(octets))
        return " ".join((p.extract_text() or "") for p in lecteur.pages[:2])
    except Exception:                                   # noqa: BLE001
        return ""


def periode_du_pdf(texte):
    """(annee, mois) de la periode COUVERTE, lue dans la fiche."""
    m = MOTIF_PERIODE.search(texte or "")
    if not m:
        return None, None
    # Le debut quand il est la, sinon la fin : certaines pieces n'ont qu'une
    # borne (« Periode - 30/11/2025 »).
    mois, annee = (m.group(2), m.group(3)) if m.group(2) else (m.group(5), m.group(6))
    if not (annee and mois and "01" <= mois <= "12"):
        return None, None
    return annee, mois


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


def analyser(nom, codes, texte=""):
    """(nouveau_nom, motif) — nouveau_nom None quand on ne sait pas.

    L'ordre compte : la FICHE d'abord, son nom ensuite. Le nom ne sert que
    lorsque le document est muet (fiche scannee sans couche texte).
    """
    if CONFORME.match(nom):
        return None, "deja conforme"

    base = nom[:-4] if nom.lower().endswith(".pdf") else nom
    hay = sans_accent(base).upper()
    hay_pdf = sans_accent(texte or "").upper()

    # ── Qui ──────────────────────────────────────────────────────────────
    du_pdf = sorted(par_le_nom(hay_pdf, codes)) if hay_pdf else []
    du_nom = []
    for m in re.findall(r"[A-Z]{2,4}", hay):
        m = ALIAS.get(m, m)
        if m in codes and m != "FDP":
            du_nom.append(m)
    du_nom = sorted(set(du_nom)) or sorted(par_le_nom(hay, codes))

    if len(du_pdf) > 1:
        return None, "plusieurs employes reconnus dans la fiche : " + ", ".join(du_pdf)
    if du_pdf and du_nom and du_pdf != du_nom:
        # Le nom du fichier designe quelqu'un d'autre que la fiche. Ce n'est
        # pas une coquille a corriger en silence : c'est peut-etre une fiche
        # rangee sous le mauvais employe.
        return None, (f"la fiche est au nom de {du_pdf[0]}, le fichier dit "
                      + ", ".join(du_nom))
    trouve = du_pdf or du_nom
    if not trouve:
        return None, "ni trigramme ni nom complet reconnu"
    if len(trouve) > 1:
        return None, "plusieurs trigrammes possibles : " + ", ".join(trouve)
    code = trouve[0]

    # ── Quand ────────────────────────────────────────────────────────────
    annee, mois = periode_du_pdf(texte)
    if not annee:
        annee, mois, motif = lire_periode(base, hay)
        if not annee:
            return None, motif

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

    conformes, a_faire, a_verifier, muets = 0, [], [], 0
    for i, (it, chemin) in enumerate(fichiers, 1):
        if CONFORME.match(it["name"]):
            conformes += 1
            continue
        if i % 50 == 0:
            print(f"  … {i}/{len(fichiers)}", flush=True)
        octets = telecharger(jeton, sid, it["id"])
        texte = texte_pdf(octets) if octets else ""
        if not texte.strip():
            muets += 1
        nouveau, motif = analyser(it["name"], codes, texte)
        if nouveau:
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
    if muets:
        print(f"Sans couche texte : {muets} (le nom du fichier a servi de secours)")
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
