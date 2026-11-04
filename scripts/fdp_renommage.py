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


def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials"}).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, corps)) as r:
        return json.load(r)["access_token"]


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


def parcourir(jeton, item_id, chemin):
    """Tous les PDF du dossier et de ses sous-dossiers."""
    suite = f"/sites/{SITE}:/drive/items/{item_id}/children?$top=200"
    while suite:
        rep = graph(jeton, "GET", suite)
        for it in rep.get("value", []):
            if "folder" in it:
                yield from parcourir(jeton, it["id"], f"{chemin}/{it['name']}")
            elif it["name"].lower().endswith(".pdf"):
                yield it, chemin
        suite = rep.get("@odata.nextLink")


def sans_accent(t):
    return "".join(c for c in unicodedata.normalize("NFD", t)
                   if unicodedata.category(c) != "Mn")


def analyser(nom, codes):
    """(nouveau_nom, motif) — nouveau_nom None quand on ne sait pas."""
    if CONFORME.match(nom):
        return None, "deja conforme"

    base = nom[:-4] if nom.lower().endswith(".pdf") else nom
    hay = sans_accent(base).upper()

    # Le trigramme : un mot isole du nom, qui existe dans la base.
    trouve = [m for m in re.findall(r"[A-Z]{2,4}", hay) if m in codes]
    # « FDP » n'est pas un employe meme s'il ressemble a un trigramme.
    trouve = [m for m in trouve if m != "FDP"]
    if not trouve:
        return None, "aucun trigramme connu dans le nom"
    if len(set(trouve)) > 1:
        return None, "plusieurs trigrammes possibles : " + ", ".join(sorted(set(trouve)))
    code = trouve[0]

    # La periode : AAAAMM ou AAAA.MM ou AAAA-MM dans le nom.
    m = re.search(r"(20\d{2})[.\-_/]?(0[1-9]|1[0-2])", base)
    if not m:
        return None, "aucune periode lisible dans le nom"
    annee, mois = m.group(1), m.group(2)

    return f"{annee}.{mois} - {code}.pdf", ""


def main():
    banniere("Fiches de paie — renommage")
    if not (TENANT and CLIENT and SECRET):
        raise SystemExit("GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET manquants.")

    jeton = jeton_graph()
    codes = codes_employes()
    print(f"{len(codes)} trigramme(s) connu(s) en base.\n")

    racine = graph(jeton, "GET", f"/sites/{SITE}:/drive/root:/{urllib.parse.quote(DOSSIER)}")
    fichiers = list(parcourir(jeton, racine["id"], DOSSIER))
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
            graph(jeton, "PATCH", f"/sites/{SITE}:/drive/items/{it['id']}",
                  {"name": nouveau})
        faits += 1

    print(f"\n{faits} renomme(s)" + (" — ESSAI A BLANC, rien n'a change." if DRY_RUN else "."))


if __name__ == "__main__":
    main()
