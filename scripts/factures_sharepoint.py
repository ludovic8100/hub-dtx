"""
Scan du dossier SharePoint COMPTA/FACTURES → table `factures_achat`.

Remplace le workflow n8n « Rapprochement Factures ↔ Transactions »
(`hmL5WFBknLUfDwGw`), qui n'existe plus dans l'instance n8n et dont la dernière
écriture en base remonte au 20/10/2026 à 09:45. Sans lui, la comptabilité ne
reçoit plus aucun document : c'est la seule source de `factures_achat`.

Ce que le script fait :
  1. jeton Microsoft Graph (client_credentials, application « Hub DTX - Sharepoint ») ;
  2. parcours récursif de COMPTA/FACTURES, pagination comprise ;
  3. lecture de la société, du sens, du montant et de la date dans le chemin et le nom ;
  4. upsert dans `factures_achat` sur `fichier_id` (identifiant Graph de l'élément) ;
  5. suppression des lignes dont le fichier a disparu — avec deux garde-fous.

Ce qu'il ne fait PAS :
  - il ne touche jamais à `transactions` ni au lien facture ↔ paiement
    (`transaction_id`, `lode_devis_id` ne sont pas envoyés, donc préservés) ;
  - il ne renomme ni ne déplace aucun fichier : c'est le rôle d'un autre traitement.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   application Azure
  SUPABASE_URL, SUPABASE_SERVICE_KEY                      voir scripts/_env.py
  APP_ENV            production (défaut) | test
  DRY_RUN=1          parcourt et affiche, n'écrit rien
  FACTURES_RACINE    dossier de départ (défaut COMPTA/FACTURES)
  PURGE=0            désactive la suppression des lignes orphelines
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import APP_ENV, DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
RACINE = os.environ.get("FACTURES_RACINE", "COMPTA/FACTURES").strip("/")
PURGE = os.environ.get("PURGE", "1") != "0"

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

# Le parcours complet ramène plusieurs milliers d'éléments : on ne purge pas si
# le scan en a vu nettement moins que ce que porte la base. Un scan interrompu à
# mi-course ne doit pas vider la comptabilité.
SEUIL_PURGE = 0.80


# ── Microsoft Graph ───────────────────────────────────────────────────────────

def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT,
        "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=30) as r:
            return json.loads(r.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:500]
        raise SystemExit(
            f"::error::Jeton Microsoft Graph refusé ({e.code}). Vérifie GRAPH_TENANT_ID, "
            f"GRAPH_CLIENT_ID et surtout GRAPH_CLIENT_SECRET (la « Valeur » du secret, "
            f"pas son « ID »).\n{detail}"
        )


def graph(url: str, jeton: str) -> dict:
    if not url.startswith("http"):
        url = f"{GRAPH}{url}"
    requete = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return json.loads(reponse.read().decode())


def enfants(jeton: str, site_id: str, chemin: str):
    """Les éléments d'un dossier, pagination Graph suivie jusqu'au bout."""
    cible = urllib.parse.quote(chemin)
    url = f"/sites/{site_id}/drive/root:/{cible}:/children?$top=200"
    while url:
        page = graph(url, jeton)
        for element in page.get("value", []):
            yield element
        url = page.get("@odata.nextLink")


# ── Lecture du chemin et du nom ───────────────────────────────────────────────

# Première date plausible trouvée dans le nom : « 20261019 - … », mais aussi
# « NF - LLO - 20260610 - … » où elle n'est pas en tête.
RE_DATE = re.compile(r"(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)")

# Montant collé à un euro, dans un sens ou dans l'autre :
# « 132,70€ », « 1.683,18 € », « € 672,00 », « 300€ ».
RE_MONTANT = re.compile(
    r"€\s*(?P<avant>\d[\d. ]*(?:,\d{1,2})?)"
    r"|(?P<apres>\d[\d. ]*(?:,\d{1,2})?)\s*€"
)


def lire_date(nom: str):
    m = RE_DATE.search(nom)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def lire_montant(nom: str):
    """Le dernier montant du nom — par convention il est en fin de libellé."""
    brut = None
    for m in RE_MONTANT.finditer(nom):
        brut = m.group("avant") or m.group("apres")
    if not brut:
        return None
    # « 1.683,18 » → « 1683.18 » ; le point et l'espace séparent les milliers.
    nettoye = brut.replace(" ", "").replace(".", "").replace(",", ".").rstrip(".")
    try:
        valeur = float(nettoye)
    except ValueError:
        return None
    # Un montant à sept chiffres vient forcément d'une lecture ratée.
    return valeur if 0 <= valeur < 1_000_000 else None


# Le préfixe « _ » ne suffit pas à désigner une société : COMPTA/FACTURES porte
# aussi des dossiers fournisseurs ainsi nommés (_TRADEIFY, _TOPSTEP, _FUNDEDNEXT).
# Sans cette liste, 35 fichiers partaient dans des sociétés inventées.
SOCIETES = {"DYNASSUR", "DTX", "LODE", "HEXAGROUP", "PRIVE", "HOL"}


def lire_societe(segments, nom=""):
    """Société du document : d'abord le dossier _SOCIETE, sinon le nom du fichier.

    Les fichiers rangés sous un dossier fournisseur gardent la société dans leur
    nom (« 20260413 - DTX - TRADEIFY HOLDINGS, CORP. - … ») : on la récupère là
    plutôt que de les laisser de côté.
    """
    for segment in segments:
        if segment.startswith("_") and segment[1:].upper() in SOCIETES:
            return segment[1:].upper()
    champs = [c.strip().upper() for c in nom.split(" - ")]
    for champ in champs[:3]:
        if champ in SOCIETES:
            return champ
    return None


def lire_sens(segments):
    return "vente" if any(s.upper() == "VENTES" for s in segments) else "achat"


# ── Supabase ──────────────────────────────────────────────────────────────────

def supabase(methode: str, chemin: str, charge=None, entetes=None):
    requete = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{chemin}",
        data=json.dumps(charge).encode() if charge is not None else None,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            **(entetes or {}),
        },
        method=methode,
    )
    with urllib.request.urlopen(requete, timeout=120) as reponse:
        corps = reponse.read().decode().strip()
        return json.loads(corps) if corps else None


def upsert(lignes):
    """Upsert par paquets sur la contrainte unique `fichier_id`.

    Deux règles tiennent la casse :

    - seules les colonnes envoyées sont écrasées. `transaction_id` et
      `lode_devis_id` ne figurent jamais dans la charge : le rapprochement
      facture ↔ paiement survit à chaque passage ;
    - une valeur absente n'est pas envoyée du tout. Près de 5 000 fichiers
      portent l'ancienne convention de nommage, sans date lisible ; envoyer
      `null` effacerait les dates déjà présentes en base. Les lignes sont donc
      groupées par jeu de colonnes renseignées, PostgREST exigeant des clés
      identiques au sein d'un même envoi.
    """
    groupes = {}
    for ligne in lignes:
        charge = {cle: valeur for cle, valeur in ligne.items() if valeur is not None}
        groupes.setdefault(tuple(sorted(charge)), []).append(charge)

    ecrites = 0
    for colonnes, paquet_complet in sorted(groupes.items(), key=lambda g: -len(g[1])):
        omises = {"montant", "date_facture"} - set(colonnes)
        detail = f" (sans {', '.join(sorted(omises))}, préservé en base)" if omises else ""
        print(f"  {len(paquet_complet)} ligne(s){detail}", flush=True)
        for debut in range(0, len(paquet_complet), 500):
            paquet = paquet_complet[debut:debut + 500]
            supabase(
                "POST",
                "factures_achat?on_conflict=fichier_id",
                paquet,
                {"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            ecrites += len(paquet)
    return ecrites


def ids_en_base():
    """Les fichier_id d'origine SharePoint déjà connus, et ceux qu'on ne purge jamais."""
    connus, proteges = set(), set()
    pas, debut = 1000, 0
    while True:
        page = supabase(
            "GET",
            f"factures_achat?select=fichier_id,transaction_id,lode_devis_id"
            f"&offset={debut}&limit={pas}",
        ) or []
        for ligne in page:
            fid = ligne["fichier_id"]
            if not fid.startswith("01"):      # notes de frais du Hub, pas SharePoint
                continue
            connus.add(fid)
            if ligne.get("transaction_id") or ligne.get("lode_devis_id"):
                proteges.add(fid)
        if len(page) < pas:
            return connus, proteges
        debut += pas


def purger(a_supprimer):
    supprimees = 0
    liste = sorted(a_supprimer)
    for debut in range(0, len(liste), 100):
        paquet = liste[debut:debut + 100]
        filtre = ",".join(urllib.parse.quote(f, safe="") for f in paquet)
        supabase("DELETE", f"factures_achat?fichier_id=in.({filtre})",
                 entetes={"Prefer": "return=minimal"})
        supprimees += len(paquet)
    return supprimees


# ── Parcours ──────────────────────────────────────────────────────────────────

def parcourir(jeton: str, site_id: str):
    """Descente en profondeur depuis la racine. Renvoie (lignes, nb_dossiers)."""
    lignes, dossiers, a_visiter = [], 0, [RACINE]
    ignores = {}
    while a_visiter:
        chemin = a_visiter.pop()
        dossiers += 1
        try:
            elements = list(enfants(jeton, site_id, chemin))
        except urllib.error.HTTPError as e:
            # Un dossier illisible ne doit pas faire tomber le scan entier, mais
            # il doit se voir : sans ça on purgerait ce qu'on n'a pas su lire.
            raise SystemExit(f"::error::Dossier « {chemin} » illisible ({e.code}). "
                             f"Scan interrompu pour ne pas purger à l'aveugle.")

        for element in elements:
            nom = element.get("name", "")
            sous_chemin = f"{chemin}/{nom}"
            if "folder" in element:
                a_visiter.append(sous_chemin)
                continue

            relatif = sous_chemin[len(RACINE):].strip("/").split("/")
            societe = lire_societe(relatif, nom)
            if not societe:
                # Ni le dossier ni le nom ne nomment une société connue : on ne
                # devine pas, mais on le dit — un fichier ignoré en silence est
                # un fichier perdu pour la comptabilité.
                ignores.setdefault("/".join(relatif[:-1]) or "(racine)", []).append(nom)
                continue

            lignes.append({
                "fichier_id": element["id"],
                "nom": nom,
                "societe": societe,
                "sens": lire_sens(relatif),
                "montant": lire_montant(nom),
                "date_facture": lire_date(nom),
                "url": f"{element.get('webUrl', '')}?web=1",
            })

        if dossiers % 25 == 0:
            print(f"  {dossiers} dossiers parcourus, {len(lignes)} fichiers", flush=True)

    return lignes, dossiers, ignores


def main() -> int:
    banniere("factures_sharepoint")

    manquants = [n for n, v in (("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET)) if not v]
    if manquants:
        print(f"::error::Secret(s) manquant(s) : {', '.join(manquants)}")
        return 1
    if not DRY_RUN and not SUPABASE_SERVICE_KEY:
        print("::error::SUPABASE_SERVICE_KEY manquante (requise hors DRY_RUN)")
        return 1

    jeton = jeton_graph()
    site_id = graph(f"/sites/{SITE}", jeton)["id"]
    print(f"Site ouvert. Racine : {RACINE}", flush=True)

    lignes, dossiers, ignores = parcourir(jeton, site_id)
    print(f"\n{len(lignes)} fichiers dans {dossiers} dossiers.")

    par_societe = {}
    for ligne in lignes:
        cle = (ligne["societe"], ligne["sens"])
        par_societe[cle] = par_societe.get(cle, 0) + 1
    for (societe, sens), nombre in sorted(par_societe.items()):
        print(f"  {societe:<12} {sens:<6} {nombre:>5}")

    if ignores:
        total = sum(len(v) for v in ignores.values())
        print(f"\n{total} fichier(s) sans societe identifiable, non importe(s) :")
        for dossier, noms in sorted(ignores.items(), key=lambda d: -len(d[1])):
            print(f"  {dossier:<24} {len(noms):>4}   ex. {noms[0][:60]}")

    sans_montant = sum(1 for l in lignes if l["montant"] is None)
    sans_date = sum(1 for l in lignes if l["date_facture"] is None)
    print(f"\nLecture des noms : {len(lignes) - sans_montant} montants, "
          f"{len(lignes) - sans_date} dates. "
          f"({sans_montant} sans montant, {sans_date} sans date)")

    if DRY_RUN:
        print("\nDRY_RUN : rien n'a été écrit.")
        for exemple in lignes[:5]:
            print(f"  {exemple['societe']:<10} {exemple['sens']:<6} "
                  f"{str(exemple['date_facture']):<11} {str(exemple['montant']):>10}  {exemple['nom'][:70]}")
        return 0

    print("\nÉcriture dans factures_achat…", flush=True)
    ecrites = upsert(lignes)

    if not PURGE:
        print(f"\n{ecrites} lignes écrites. Purge désactivée.")
        return 0

    connus, proteges = ids_en_base()
    vus = {l["fichier_id"] for l in lignes}
    if connus and len(vus) < len(connus) * SEUIL_PURGE:
        print(f"::warning::Purge annulée : {len(vus)} fichiers vus pour {len(connus)} "
              f"en base (seuil {SEUIL_PURGE:.0%}). Scan probablement incomplet.")
        print(f"\n{ecrites} lignes écrites, 0 supprimée.")
        return 0

    orphelines = connus - vus - proteges
    supprimees = purger(orphelines) if orphelines else 0
    retenues = len((connus - vus) & proteges)
    if retenues:
        print(f"  {retenues} ligne(s) orpheline(s) conservée(s) : rattachées à un paiement.")

    print(f"\n{ecrites} lignes écrites, {supprimees} supprimée(s).")
    print(f"LIGNES_ECRITES={ecrites}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
