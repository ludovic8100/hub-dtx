"""
Scan du dossier SharePoint BORDEREAUX → table `bordereaux`.

Remplace le workflow n8n « Bordereaux BQT/RCP → Supabase » (`9mVOQPAN2fI5z9um`),
arrêté avec les autres. Dernière écriture en base : 20/10/2026. Depuis, plus
aucun relevé n'entre — septembre n'a que 18 relevés et octobre 1, non pas parce
que les compagnies en envoient moins, mais parce que personne ne les indexe.

Sans cette indexation, les deux chantiers qui suivent travaillent sur des
données qui s'arrêtent en octobre : le rapprochement des relevés avec les
virements de commissions, et le suivi des factures manquantes.

Convention de nommage, fixée par le renommage automatique en amont :

    AAAA.MM - TYPE - COMPAGNIE - NUMERO.pdf
    2026.09 - RCP - CARES - 20149.pdf
    2026.10 - BQT - AXA - 3145235.pdf

TYPE vaut RCP (relevé de compte producteur, accompagne un paiement) ou BQT
(quittancement à terme, arrive environ deux mois AVANT le paiement et sert à
réclamer les primes aux clients). Les deux n'ont pas le même usage : voir
CLAUDE.md.

Ce que le script fait :
  1. jeton Microsoft Graph (client_credentials, application « Hub DTX - Sharepoint ») ;
  2. parcours du dossier BORDEREAUX, pagination comprise ;
  3. lecture de la période, du type, de la compagnie et du numéro dans le nom ;
  4. rattachement à `compagnies` quand le nom correspond à une compagnie connue
     ou à l'un de ses alias ;
  5. upsert dans `bordereaux` sur `sharepoint_item_id`.

L'ancrage sur l'identifiant SharePoint, et non sur le nom, est délibéré : le
renommage automatique corrige régulièrement le nom d'un bordereau (« DYNASSUR »
— le courtier — devient « AXA » — la compagnie). Ancrée sur le nom,
l'indexation créait une nouvelle ligne à chaque correction et laissait
l'ancienne derrière elle : 70 lignes fantômes au 03/11/2026, dont un même
document compté trois fois. L'identifiant, lui, survit au renommage.

Ce qu'il ne fait PAS, et c'est délibéré :
  - il n'envoie JAMAIS `montant`, `commission`, `net`, `solde_releve`,
    `paiement_precedent`, `date_cloture`, `extrait_le` ni `transaction_id`.
    Ces colonnes sont le fruit de la lecture des PDF et du rapprochement
    bancaire ; un scan qui les réécrirait effacerait ce travail à chaque
    passage ;
  - il ne supprime rien par défaut (PURGE=1 pour l'activer). Un relevé porte
    un montant extrait et un lien vers un virement : le perdre coûte cher, et
    un fichier simplement déplacé dans SharePoint n'est pas un fichier disparu.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   application Azure
  SUPABASE_URL, SUPABASE_SERVICE_KEY                      voir scripts/_env.py
  APP_ENV             production (défaut) | test
  DRY_RUN=1           parcourt et affiche, n'écrit rien
  BORDEREAUX_RACINE   dossier de départ (défaut BORDEREAUX)
  PURGE=1             supprime les lignes dont le fichier a disparu (défaut : non)
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from _env import APP_ENV, DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
RACINE = os.environ.get("BORDEREAUX_RACINE", "BORDEREAUX").strip("/")
PURGE = os.environ.get("PURGE", "0") == "1"

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

# Même garde-fou que pour les factures : un scan interrompu à mi-course ne doit
# pas vider la table. On ne purge que si le scan a vu au moins 80 % de ce que
# porte la base.
SEUIL_PURGE = 0.80

TYPES = {"RCP", "BQT"}


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


# ── Lecture du nom de fichier ─────────────────────────────────────────────────

# « 2026.09 - RCP - CARES - 20149.pdf ». Le numéro peut contenir des tirets
# (« CARDIF - 16-4 »), donc on prend tout ce qui reste après le troisième
# séparateur et on découpe le dernier champ seulement s'il est purement
# numérique.
RE_NOM = re.compile(
    r"^(?P<annee>20\d{2})[.\-_](?P<mois>0[1-9]|1[0-2])\s*-\s*"
    r"(?P<type>[A-Za-z]{3})\s*-\s*(?P<reste>.+?)\s*$"
)


def lire_nom(nom: str):
    """(annee, mois, type, compagnie, numero) — ou None si le nom ne suit pas
    la convention. On ne devine pas : un fichier mal nommé est signalé, pas
    inventé."""
    base = nom[:-4] if nom.lower().endswith(".pdf") else nom
    m = RE_NOM.match(base)
    if not m:
        return None
    type_doc = m.group("type").upper()
    if type_doc not in TYPES:
        return None

    reste = m.group("reste")
    champs = [c.strip() for c in reste.split(" - ")]
    # Le dernier champ est le numéro de document quand il est numérique ;
    # sinon tout le reste est le nom de la compagnie.
    if len(champs) >= 2 and re.fullmatch(r"[0-9]+", champs[-1]):
        numero = champs[-1]
        compagnie = " - ".join(champs[:-1])
    else:
        numero = ""
        compagnie = reste
    return m.group("annee"), m.group("mois"), type_doc, compagnie.strip(), numero


def cle(annee: str, mois: str, type_doc: str, compagnie: str, numero: str) -> str:
    """Clé de déduplication — même forme que celle posée par l'ancien workflow,
    pour que le scan retrouve les 4 687 lignes existantes au lieu de les
    dupliquer."""
    morceaux = [annee, mois, type_doc, compagnie]
    if numero:
        morceaux.append(numero)
    return "-".join(morceaux)


def normaliser(texte: str) -> str:
    """Pour comparer des noms de compagnie : sans accent, sans ponctuation,
    en majuscules."""
    sans_accent = "".join(
        c for c in unicodedata.normalize("NFD", texte or "")
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^A-Z0-9]", "", sans_accent.upper())


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


def table_compagnies():
    """Nom normalisé → id, en couvrant les alias. Permet de rattacher le relevé
    à la bonne compagnie sans dépendre de l'orthographe du nom de fichier."""
    index = {}
    for ligne in supabase("GET", "compagnies?select=id,nom") or []:
        index[normaliser(ligne["nom"])] = ligne["id"]
    for ligne in supabase("GET", "compagnies_alias?select=compagnie_id,libelle") or []:
        index.setdefault(normaliser(ligne["libelle"]), ligne["compagnie_id"])
    index.pop("", None)
    return index


def documents_en_base():
    """Les identifiants SharePoint déjà connus, et ceux qu'on ne purge jamais :
    un relevé dont le montant a été extrait ou qui est rattaché à un virement
    représente du travail qu'un scan ne doit pas pouvoir détruire."""
    connus, proteges = set(), set()
    pas, debut = 1000, 0
    while True:
        page = supabase(
            "GET",
            f"bordereaux?select=sharepoint_item_id,montant,transaction_id"
            f"&offset={debut}&limit={pas}",
        ) or []
        for ligne in page:
            ident = ligne.get("sharepoint_item_id")
            if not ident:
                continue
            connus.add(ident)
            if ligne.get("montant") is not None or ligne.get("transaction_id"):
                proteges.add(ident)
        if len(page) < pas:
            return connus, proteges
        debut += pas


def upsert(lignes, deja_connus):
    """Upsert par paquets sur `sharepoint_item_id`.

    Deux règles tiennent la casse :

    - seules les colonnes d'identification du document sont envoyées. Les
      colonnes financières (montant, commission, net, solde_releve,
      paiement_precedent, date_cloture, extrait_le) et le lien
      `transaction_id` ne figurent jamais dans la charge : ils survivent donc
      à chaque passage ;
    - `cle_unique` n'est posée qu'à la CRÉATION. Les 4 617 clés déjà en base
      ont été fabriquées par l'ancien traitement, avec des règles de découpage
      que ce script ne reproduit pas à l'identique (« BT- 116263 »,
      « EUROP ASSITANCE -153582 », « TVM -7046484. - 1 »). Les réécrire
      changerait des clés qui servent ailleurs, pour rien. PostgREST exigeant
      des clés identiques au sein d'un même envoi, les lignes sont groupées
      par jeu de colonnes.
    """
    groupes = {}
    for ligne in lignes:
        charge = {cle: valeur for cle, valeur in ligne.items() if valeur is not None}
        if ligne["sharepoint_item_id"] in deja_connus:
            charge.pop("cle_unique", None)
        groupes.setdefault(tuple(sorted(charge)), []).append(charge)

    ecrites = 0
    for colonnes, paquet_complet in sorted(groupes.items(), key=lambda g: -len(g[1])):
        if "cle_unique" not in colonnes:
            print(f"  {len(paquet_complet)} ligne(s) déjà connue(s) "
                  f"(clé d'origine préservée)", flush=True)
        else:
            print(f"  {len(paquet_complet)} ligne(s) nouvelle(s)", flush=True)
        for debut in range(0, len(paquet_complet), 500):
            paquet = paquet_complet[debut:debut + 500]
            supabase(
                "POST",
                "bordereaux?on_conflict=sharepoint_item_id",
                paquet,
                {"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            ecrites += len(paquet)
    return ecrites


def purger(a_supprimer):
    supprimees = 0
    liste = sorted(a_supprimer)
    for debut in range(0, len(liste), 100):
        paquet = liste[debut:debut + 100]
        filtre = ",".join(urllib.parse.quote(k, safe="") for k in paquet)
        supabase("DELETE", f"bordereaux?sharepoint_item_id=in.({filtre})",
                 entetes={"Prefer": "return=minimal"})
        supprimees += len(paquet)
    return supprimees


# ── Parcours ──────────────────────────────────────────────────────────────────

def parcourir(jeton: str, site_id: str, compagnies: dict):
    """Descente depuis la racine BORDEREAUX. Renvoie (lignes, dossiers, ignores)."""
    lignes, dossiers, a_visiter = [], 0, [RACINE]
    ignores = []
    vues = set()

    while a_visiter:
        chemin = a_visiter.pop()
        dossiers += 1
        try:
            elements = list(enfants(jeton, site_id, chemin))
        except urllib.error.HTTPError as e:
            raise SystemExit(f"::error::Dossier « {chemin} » illisible ({e.code}). "
                             f"Scan interrompu pour ne pas conclure à l'aveugle.")

        for element in elements:
            nom = element.get("name", "")
            if "folder" in element:
                a_visiter.append(f"{chemin}/{nom}")
                continue
            if not nom.lower().endswith(".pdf"):
                continue

            lu = lire_nom(nom)
            if not lu:
                # Un fichier hors convention est signalé, jamais deviné : c'est
                # au renommage en amont de le corriger.
                ignores.append(nom)
                continue

            annee, mois, type_doc, compagnie, numero = lu
            ident = element["id"]
            if ident in vues:
                # Le même document vu deux fois dans le parcours (raccourci,
                # dossier visité deux fois) : PostgREST refuserait l'envoi.
                continue
            vues.add(ident)

            url = element.get("webUrl")
            lignes.append({
                "cle_unique": cle(annee, mois, type_doc, compagnie, numero),
                "nom_fichier": nom,
                "type": type_doc,
                "compagnie": compagnie,
                "compagnie_id": compagnies.get(normaliser(compagnie)),
                "mois": mois,
                "annee": int(annee),
                "sharepoint_item_id": ident,
                "url_sharepoint": url,
                "source": url,
            })

    return lignes, dossiers, ignores


def main() -> int:
    banniere("bordereaux-sharepoint")
    for nom, valeur in (("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                        ("GRAPH_CLIENT_SECRET", SECRET)):
        if not valeur:
            raise SystemExit(f"::error::{nom} manquant.")

    jeton = jeton_graph()
    site_id = graph(f"/sites/{SITE}", jeton)["id"]
    print(f"Site ADMINISTRATION résolu, dossier « {RACINE} »", flush=True)

    compagnies = {} if DRY_RUN and not SUPABASE_SERVICE_KEY else table_compagnies()
    if compagnies:
        print(f"{len(compagnies)} libellé(s) de compagnie connus (noms + alias)", flush=True)

    lignes, dossiers, ignores = parcourir(jeton, site_id, compagnies)
    rcp = sum(1 for l in lignes if l["type"] == "RCP")
    bqt = sum(1 for l in lignes if l["type"] == "BQT")
    sans_compagnie = sum(1 for l in lignes if not l["compagnie_id"])

    print(f"\n{dossiers} dossier(s) parcouru(s) — {len(lignes)} bordereau(x) : "
          f"{rcp} RCP, {bqt} BQT", flush=True)
    if sans_compagnie:
        print(f"  dont {sans_compagnie} sans compagnie reconnue en base "
              f"(indexés quand même, rattachables plus tard)", flush=True)
    if ignores:
        print(f"\n{len(ignores)} fichier(s) hors convention de nommage, non indexés :", flush=True)
        for nom in sorted(ignores)[:40]:
            print(f"  - {nom}", flush=True)
        if len(ignores) > 40:
            print(f"  … et {len(ignores) - 40} autre(s)", flush=True)

    if DRY_RUN:
        print("\nDRY_RUN : rien n'a été écrit.", flush=True)
        for ligne in lignes[:5]:
            print(f"  {ligne['cle_unique']}  ←  {ligne['nom_fichier']}", flush=True)
        print(f"LIGNES_ECRITES=0", flush=True)
        return 0

    if not lignes:
        raise SystemExit("::error::Aucun bordereau trouvé : scan suspect, rien n'est écrit.")

    connus, proteges = documents_en_base()
    print(f"\n{len(connus)} document(s) déjà en base", flush=True)
    ecrites = upsert(lignes, connus)
    nouvelles = len({l["sharepoint_item_id"] for l in lignes} - connus)
    print(f"{ecrites} ligne(s) écrite(s), dont {nouvelles} nouvelle(s)", flush=True)

    if PURGE:
        disparues = connus - {l["sharepoint_item_id"] for l in lignes} - proteges
        if connus and len(lignes) < len(connus) * SEUIL_PURGE:
            print(f"::warning::Purge annulée : le scan a vu {len(lignes)} documents "
                  f"pour {len(connus)} en base. Scan probablement incomplet.", flush=True)
        elif disparues:
            print(f"{purger(disparues)} ligne(s) supprimée(s) (fichier disparu)", flush=True)

    print(f"LIGNES_ECRITES={nouvelles}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
