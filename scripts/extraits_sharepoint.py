"""
Les extraits de compte PDF comme seconde source des mouvements bancaires.

Ponto ne remonte pas avant 2025 — avant le 28/03/2025 pour DTX. Toutes les
factures anterieures etaient donc condamnees a rester sans paiement, quelle
que soit la qualite du rapprochement.

Les extraits, eux, sont archives dans COMPTA/EXTRAITS/<SOCIETE>/<annee>/<BANQUE>/
depuis 2017, et les PDF portent une couche texte. Une expression reguliere
suffit a les lire : AUCUN MODELE N'EST APPELE, zero jeton, et le meme
resultat a chaque passage.

Forme d'une ligne CBC/KBC :

    197 02-12-2024   02-12   8,98 - VIREMENT INSTANTANE VERS  BE43 1910 5142
    3201 BANQUIER BENEFICIAIRE: CREGBEBBXXX PARTENA 117623142112 A 07.37 HEURES

    <releve> <date> <valeur> <montant> <+|-> <libelle>

LA REGLE QUI TIENT TOUT : on n'ecrit que ce qu'on a lu. Une ligne dont le
montant, la date ou le sens ne se lisent pas n'est pas devinee — elle est
comptee comme illisible et signalee. Un mouvement invente fausserait un solde.

Deduplication : `cle_extrait` = IBAN|releve|rang. Stable d'une relecture a
l'autre, y compris quand deux lignes du meme jour portent le meme montant.
Les lignes deja connues de Ponto sur la meme periode ne sont PAS ecrasees :
voir CHEVAUCHEMENT plus bas.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  SUPABASE_URL, SUPABASE_SERVICE_KEY
  DRY_RUN=1          inventorie et analyse, n'ecrit rien (defaut)
  FILTRE_DOSSIER     restreint, ex. « DYNASSUR/2024 »
  LOT                nombre maximum d'extraits a traiter ; 0 = tous
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
RACINE = "COMPTA/EXTRAITS"
FILTRE_DOSSIER = os.environ.get("FILTRE_DOSSIER", "").strip()
LOT = int(os.environ.get("LOT", "0") or 0)

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

# Le pied de page se repete a chaque page et parasite le texte. On le retire
# avant d'analyser, sinon il se glisse dans le libelle du dernier mouvement.
PIED = re.compile(
    r"\d{4}-\d{2}-\d{2}-[\d.]+\w*\s+\d+\s+IBAN\s+[A-Z]{2}[\d ]+\w*\s+EUR\s+BIC\s+\w+.*?"
    r"releve?\s+\d+\s*/\s*\d+", re.I | re.S)
PIED2 = re.compile(r"CBC Banque SA[^|]*?Societe du groupe KBC", re.I | re.S)

MOUVEMENT = re.compile(
    r"(?P<releve>\d{1,4})\s+"
    r"(?P<date>\d{2}-\d{2}-\d{4})\s+"
    r"(?P<valeur>\d{2}-\d{2})\s+"
    r"(?P<montant>\d[\d\s .]*,\d{2})\s*"
    r"(?P<sens>[+-])\s+"
    r"(?P<libelle>.*?)"
    r"(?=\s+\d{1,4}\s+\d{2}-\d{2}-\d{4}\s+\d{2}-\d{2}\s+\d[\d\s .]*,\d{2}\s*[+-]"
    r"|\s*Solde au\b|\s*$)",
    re.S)

IBAN_ENTETE = re.compile(r"IBAN\s+([A-Z]{2}[\dA-Z ]{14,30}?)\s+EUR", re.I)
IBAN_LIBELLE = re.compile(r"\b([A-Z]{2}\d{2}(?:[ \u00a0]?\d{4}){2,7}(?:[ \u00a0]?\d{1,3})?)(?![\dA-Z])")
CONTREPARTIE = re.compile(
    r"BANQUIER\s+(?:BENEFICIAIRE|DONNEUR D'ORDRE)\s*:\s*\S+\s+(?P<nom>.+?)"
    r"(?=\s+(?:REFERENCE|REF\.|COMM|COMMUNICATION|A \d{2}\.\d{2} HEURES|V\.REF)|$)",
    re.I | re.S)
CREANCIER = re.compile(r"CREANCIER\s*:\s*(?P<nom>.+?)(?=\s+REF\.|\s+REFERENCE|$)", re.I | re.S)
BANCONTACT = re.compile(
    r"PAIEMENT PAR BANCONTACT.*?HEURES\s+(?P<nom>.+?)(?=\s+AVEC CARTE|$)", re.I | re.S)


def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials"}).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, corps), timeout=30) as r:
        return json.load(r)["access_token"]


def graph(jeton, methode, chemin, charge=None):
    url = chemin if chemin.startswith("http") else GRAPH + chemin
    donnees = json.dumps(charge).encode() if charge is not None else None
    req = urllib.request.Request(url, donnees, method=methode)
    req.add_header("Authorization", "Bearer " + jeton)
    if donnees:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            brut = r.read()
            return json.loads(brut) if brut else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"::error::Graph {methode} {chemin} -> {e.code} {e.read()[:300]!r}")


def site_id(jeton) -> str:
    return graph(jeton, "GET", f"/sites/{SITE}")["id"]


def enfants(jeton, sid, chemin):
    url = f"/sites/{sid}/drive/root:/{urllib.parse.quote(chemin)}:/children?$top=200"
    while url:
        page = graph(jeton, "GET", url)
        for el in page.get("value", []):
            yield el
        url = page.get("@odata.nextLink")


def parcourir(jeton, sid, racine):
    a_visiter = [racine]
    while a_visiter:
        chemin = a_visiter.pop()
        for el in enfants(jeton, sid, chemin):
            if "folder" in el:
                a_visiter.append(f"{chemin}/{el['name']}")
            elif el["name"].lower().endswith(".pdf"):
                yield el, chemin


def telecharger(jeton, sid, item_id):
    url = f"{GRAPH}/sites/{sid}/drive/items/{item_id}/content"
    req = urllib.request.Request(url, headers={"Authorization": "Bearer " + jeton})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except Exception:                                    # noqa: BLE001
        return None


def texte_pdf(octets):
    try:
        lecteur = PdfReader(BytesIO(octets))
        return " ".join((p.extract_text() or "") for p in lecteur.pages)
    except Exception:                                    # noqa: BLE001
        return ""


def iban_propre(brut):
    t = re.sub(r"[^0-9A-Z]", "", (brut or "").upper())
    # Un IBAN fait 15 a 34 caracteres. En dessous, c'est un fragment ;
    # au dessus, on a mordu sur le texte qui suit.
    return t if 15 <= len(t) <= 34 else None


def nombre(brut):
    """« 28 739,23 » -> 28739.23. Les espaces fines sont des separateurs."""
    t = re.sub(r"[\s .]", "", brut or "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def nettoyer(t):
    return re.sub(r"\s+", " ", (t or "")).strip()


def contrepartie(libelle):
    """(nom, iban) de l'autre partie. None quand le libelle ne les porte pas."""
    for motif in (CONTREPARTIE, CREANCIER, BANCONTACT):
        m = motif.search(libelle)
        if m:
            nom = " ".join(nettoyer(m.group("nom")).split()[:6])[:140]
            if nom:
                break
    else:
        nom = None
    m = IBAN_LIBELLE.search(libelle)
    return nom, iban_propre(m.group(1)) if m else None


def analyser(texte):
    """(iban_du_compte, [mouvements], nb_illisibles)."""
    m = IBAN_ENTETE.search(texte)
    compte = iban_propre(m.group(1)) if m else None

    propre = PIED.sub(" ", texte)
    propre = PIED2.sub(" ", propre)

    mouvements, illisibles, rang = [], 0, {}
    for m in MOUVEMENT.finditer(propre):
        montant = nombre(m.group("montant"))
        if montant is None or montant <= 0:
            illisibles += 1
            continue
        try:
            j, mo, a = m.group("date").split("-")
            date = f"{a}-{mo}-{j}"
        except ValueError:
            illisibles += 1
            continue
        releve = m.group("releve")
        rang[releve] = rang.get(releve, 0) + 1
        libelle = nettoyer(m.group("libelle"))
        nom, iban = contrepartie(libelle)
        mouvements.append({
            "releve": releve, "rang": rang[releve],
            "date_execution": date,
            "montant": montant if m.group("sens") == "+" else -montant,
            "contrepartie_nom": nom, "contrepartie_iban": iban,
            "description": libelle[:900],
        })
    return compte, mouvements, illisibles


# ── Supabase ─────────────────────────────────────────────────────────────────

def supabase(methode, chemin, charge=None, entetes=None):
    url = SUPABASE_URL.rstrip("/") + "/rest/v1/" + chemin
    donnees = json.dumps(charge).encode() if charge is not None else None
    req = urllib.request.Request(url, donnees, method=methode)
    req.add_header("apikey", SUPABASE_SERVICE_KEY)
    req.add_header("Authorization", "Bearer " + SUPABASE_SERVICE_KEY)
    req.add_header("Content-Type", "application/json")
    for k, v in (entetes or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            brut = r.read()
            return json.loads(brut) if brut else None
    except urllib.error.HTTPError as e:
        raise SystemExit(f"::error::Supabase {methode} {chemin[:60]} -> {e.code} "
                         f"{e.read().decode()[:300]}")


def comptes_connus():
    """IBAN -> id de compte. Un extrait d'un compte inconnu n'est pas importe :
    on ne devine pas a quelle societe il appartient."""
    lignes = supabase("GET", "comptes_bancaires?select=id,iban&iban=not.is.null") or []
    return {iban_propre(l["iban"]): l["id"] for l in lignes if l.get("iban")}


def periodes_ponto():
    """Par compte, la premiere et la derniere date vues par Ponto.

    CHEVAUCHEMENT : sur une periode deja couverte par Ponto, les lignes
    d'extrait ne sont PAS importees. Ponto porte un identifiant bancaire par
    operation, l'extrait non : garder les deux produirait des doublons qu'on
    ne saurait plus distinguer, et chaque solde serait compte deux fois.
    """
    lignes = supabase("GET", "transactions?select=compte_id,date_execution"
                             "&origine=eq.ponto&order=date_execution.asc") or []
    bornes = {}
    for l in lignes:
        c, d = l["compte_id"], l["date_execution"]
        if c not in bornes:
            bornes[c] = [d, d]
        else:
            bornes[c][1] = d
    return bornes


def main() -> int:
    banniere("Extraits de compte")
    if not (TENANT and CLIENT and SECRET):
        raise SystemExit("::error::GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET manquants.")

    jeton = jeton_graph()
    sid = site_id(jeton)
    comptes = comptes_connus()
    bornes = periodes_ponto()
    print(f"{len(comptes)} compte(s) bancaire(s) connu(s) en base.\n", flush=True)

    fichiers = [(it, ch) for it, ch in parcourir(jeton, sid, RACINE)
                if not FILTRE_DOSSIER or FILTRE_DOSSIER in ch]
    fichiers.sort(key=lambda x: x[1] + x[0]["name"])
    print(f"{len(fichiers)} extrait(s) PDF dans {RACINE}"
          + (f" filtre sur « {FILTRE_DOSSIER} »" if FILTRE_DOSSIER else "") + "\n", flush=True)

    total_lignes = total_ecrites = total_illisibles = 0
    muets, inconnus, couverts = [], {}, 0

    for i, (it, chemin) in enumerate(fichiers, 1):
        if LOT and i > LOT:
            print(f"\nLot de {LOT} atteint, arret.")
            break
        octets = telecharger(jeton, sid, it["id"])
        texte = texte_pdf(octets) if octets else ""
        if not texte.strip():
            muets.append(f"{chemin}/{it['name']}")
            continue

        compte_iban, mouvements, illisibles = analyser(texte)
        total_lignes += len(mouvements)
        total_illisibles += illisibles

        if not compte_iban or compte_iban not in comptes:
            inconnus.setdefault(compte_iban or "illisible", []).append(it["name"])
            continue
        compte_id = comptes[compte_iban]

        # On n'ecrit pas sur une periode que Ponto couvre deja.
        debut, fin = bornes.get(compte_id, (None, None))
        a_ecrire = [m for m in mouvements
                    if not (debut and fin and debut <= m["date_execution"] <= fin)]
        couverts += len(mouvements) - len(a_ecrire)
        if not a_ecrire:
            continue

        charge = [{
            "compte_id": compte_id,
            "date_execution": m["date_execution"],
            "date_valeur": m["date_execution"],
            "montant": m["montant"],
            "devise": "EUR",
            "contrepartie_nom": m["contrepartie_nom"],
            "contrepartie_iban": m["contrepartie_iban"],
            "description": m["description"],
            "origine": "extrait",
            "cle_extrait": f"{compte_iban}|{m['releve']}|{m['rang']}",
        } for m in a_ecrire]

        if i <= 3 or i % 25 == 0:
            print(f"  [{i}/{len(fichiers)}] {it['name'][:58]} — {len(mouvements)} ligne(s), "
                  f"{len(a_ecrire)} a ecrire", flush=True)

        if not DRY_RUN:
            for d in range(0, len(charge), 200):
                supabase("POST", "transactions?on_conflict=cle_extrait", charge[d:d + 200],
                         {"Prefer": "resolution=merge-duplicates,return=minimal"})
        total_ecrites += len(charge)

    print(f"\n{total_lignes} mouvement(s) lu(s), {total_ecrites} "
          f"{'a ecrire' if DRY_RUN else 'ecrit(s)'}, {couverts} deja couvert(s) par Ponto, "
          f"{total_illisibles} ligne(s) illisible(s).")
    if muets:
        print(f"\n{len(muets)} extrait(s) sans couche texte (scan) :")
        for x in muets[:10]:
            print(f"  {x}")
    if inconnus:
        print(f"\n{len(inconnus)} IBAN non rattache(s) a un compte du Hub :")
        for iban, noms in list(inconnus.items())[:10]:
            print(f"  {iban} — {len(noms)} extrait(s), ex. {noms[0][:50]}")
    if DRY_RUN:
        print("\nESSAI A BLANC : rien n'a ete ecrit.")
    print(f"LIGNES_ECRITES={total_ecrites}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
