"""
Inventaire des dossiers clients SharePoint, avant toute fusion.

CE SCRIPT N'ECRIT RIEN. Il ne contient aucune fonction d'ecriture : ni PATCH,
ni POST, ni DELETE. C'est volontaire et verifiable en lisant le fichier. Il
produit un CSV que l'on relit avant qu'un seul dossier ne bouge.

LE PROBLEME

Les memes clients ont un dossier a DEUX endroits :

    dynassur.sharepoint.com/sites/ADMINISTRATION  →  CLIENTS/
    dynassur.sharepoint.com/sites/DYNASSUR        →  DATA_CLIENT/

BERTHOLET Christelle, Maryse et Jean-Louis sont aux deux. Ce n'est donc pas un
deplacement mais une FUSION : on ne peut pas deplacer un dossier vers un
emplacement ou son homonyme existe deja.

LA REGLE DE RENOMMAGE (decidee le 05/11/2026)

Le `/00` est un reliquat de Qlik. On le supprime, et la racine passe sur
5 chiffres :

    1105/00   →  01105 - DE PAEPE Caroline
    15/01     →  00015-01 - RAEPSAET Stephanie
    11        →  00011 - DEVOS Chloe
    11/00     →  00011-00 - CONTORNO Giancarlo

LA DERNIERE LIGNE EST TOUT L'INTERET DU GARDE-FOU. 63 clients n'ont aucun
suffixe. Supprimer le `/00` de leur homonyme les ferait tomber au meme
endroit — DEVOS Chloe et CONTORNO Giancarlo dans un seul dossier. Quand la
suppression du `/00` ecrase quelqu'un, le `-00` est conserve.

Sans ce garde-fou : 63 clients ecrases. En supprimant TOUS les suffixes et pas
seulement `/00` : 892 clients dans 97 dossiers — la racine `15` reunirait
80 personnes sans aucun rapport. Mesure, pas suppose.

Le suffixe `(DB78257)` est retire : il est constant, il ne distingue rien.

CE QUE L'INVENTAIRE REPOND

  - combien de dossiers de chaque cote, et combien sont dans les deux ;
  - pour les doubles, lequel a ete modifie le plus recemment ;
  - COMBIEN DE FICHIERS SERAIENT REELLEMENT ECRASES, et combien n'existent que
    d'un seul cote ;
  - quels dossiers ne correspondent a aucun client de la base ;
  - quels clients n'ont de dossier nulle part ;
  - le nouveau nom calcule pour chacun, et les collisions residuelles.

LA FUSION DECIDEE : DYNASSUR GAGNE, MAIS FICHIER PAR FICHIER

Consigne du 05/11/2026 : « tu gardes les fichiers que tu deplaces et tu ecrases
les existants ». Applique au niveau du FICHIER, pas du dossier.

La nuance n'est pas cosmetique. Ecraser au niveau du dossier reviendrait a
supprimer le dossier d'ADMINISTRATION puis a y poser celui de DYNASSUR : tout
fichier qui n'existe QUE dans ADMINISTRATION disparaitrait. Ce sont les plus
anciens, donc possiblement les seules copies.

Fichier par fichier, le resultat est identique pour ce qui existe des deux
cotes, et rien d'autre n'est perdu.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   application Azure
  SUPABASE_URL, SUPABASE_SERVICE_KEY                      voir scripts/_env.py
  SORTIE                 chemin du CSV (defaut : inventaire_dossiers.csv)
  FICHIERS=0             n'inspecte que les dossiers, sans descendre dedans
                         (rapide ; le decompte des conflits est alors absent)
"""
import csv
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from _env import SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

GRAPH = "https://graph.microsoft.com/v1.0"

# Les deux arborescences. La premiere est la destination retenue.
EMPLACEMENTS = [
    ("ADMINISTRATION", "dynassur.sharepoint.com:/sites/ADMINISTRATION", "CLIENTS"),
    ("DYNASSUR", "dynassur.sharepoint.com:/sites/DYNASSUR", "DATA_CLIENT"),
]

SORTIE = os.environ.get("SORTIE", "inventaire_dossiers.csv")
FICHIERS = os.environ.get("FICHIERS", "1").strip() not in ("0", "", "non")

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

INTERDITS = r'[\\/:*?"<>|#%{}~&]'


# ── Microsoft Graph, en lecture seule ────────────────────────────────────────

def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=30) as r:
            return json.loads(r.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"::error::Jeton Microsoft Graph refuse ({e.code}) : "
                         f"{e.read().decode()[:400]}")


def lire(jeton: str, url: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def site_id(jeton: str, site: str) -> str:
    return lire(jeton, f"{GRAPH}/sites/{site}")["id"]


def dossiers_enfants(jeton: str, sid: str, chemin: str) -> list:
    """Les sous-dossiers directs de `chemin`. Pagine : Graph rend 200 par appel
    et une arborescence client en compte des milliers."""
    url = (f"{GRAPH}/sites/{sid}/drive/root:/{urllib.parse.quote(chemin)}:/children"
           "?$top=200&$select=id,name,folder,lastModifiedDateTime,webUrl")
    sortie = []
    while url:
        try:
            page = lire(jeton, url)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"::error::Lecture de « {chemin} » refusee ({e.code}) : "
                             f"{e.read().decode()[:300]}")
        for item in page.get("value", []):
            if "folder" in item:
                sortie.append(item)
        url = page.get("@odata.nextLink")
    return sortie


def arbre_fichiers(jeton: str, sid: str, item_id: str, prefixe: str = "") -> dict:
    """Chemin relatif → taille, pour tout le sous-arbre d'un dossier client.

    Le chemin sert de cle de comparaison entre les deux emplacements : deux
    fichiers « CREDITS/offre.pdf » sont le meme document, meme si leurs
    identifiants SharePoint different."""
    sortie = {}
    url = (f"{GRAPH}/sites/{sid}/drive/items/{item_id}/children"
           "?$top=200&$select=id,name,folder,file,size,lastModifiedDateTime")
    while url:
        try:
            page = lire(jeton, url)
        except urllib.error.HTTPError:
            return sortie            # un dossier illisible ne doit pas tout arreter
        for it in page.get("value", []):
            chemin = f"{prefixe}{it['name']}"
            if "folder" in it:
                sortie.update(arbre_fichiers(jeton, sid, it["id"], chemin + "/"))
            else:
                sortie[chemin] = (it.get("size", 0), it.get("lastModifiedDateTime", ""))
        url = page.get("@odata.nextLink")
    return sortie


# ── Base ─────────────────────────────────────────────────────────────────────

def clients_supabase() -> list:
    """Tous les clients porteurs d'un dossier. Pagine : PostgREST plafonne."""
    sortie, debut, pas = [], 0, 1000
    while True:
        url = (f"{SUPABASE_URL}/rest/v1/clients"
               "?select=dossier,nom,prenom&dossier=not.is.null"
               f"&order=dossier&offset={debut}&limit={pas}")
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            lot = json.loads(r.read().decode())
        sortie.extend(lot)
        if len(lot) < pas:
            return sortie
        debut += pas


# ── La regle de nommage ──────────────────────────────────────────────────────

def nom_sharepoint_actuel(dossier: str) -> str:
    """Le prefixe tel qu'il existe aujourd'hui : le dossier sans la barre.
    1105/00 → 110500, 69/00 → 6900. Verifie sur un dossier court, c'est la
    qu'une regle de remplissage a zero aurait casse."""
    return dossier.replace("/", "")


def cle_cible(dossier: str) -> str:
    """La cle du nouveau nom, AVANT resolution des collisions."""
    racine, _, suffixe = dossier.partition("/")
    base = racine.zfill(5)
    if not suffixe or suffixe == "00":
        return base
    return f"{base}-{suffixe}"


def resoudre_collisions(clients: list) -> dict:
    """dossier → cle definitive.

    Quand deux clients visent la meme cle, celui qui porte `/00` garde son
    `-00`. L'autre n'a pas de suffixe a montrer, il garde la cle nue. C'est
    deterministe, et ca ne depend pas de l'ordre de lecture."""
    par_cle = {}
    for c in clients:
        par_cle.setdefault(cle_cible(c["dossier"]), []).append(c["dossier"])

    final = {}
    for cle, lot in par_cle.items():
        if len(lot) == 1:
            final[lot[0]] = cle
            continue
        for d in lot:
            racine, _, suffixe = d.partition("/")
            final[d] = f"{racine.zfill(5)}-{suffixe}" if suffixe else cle
    return final


def nettoyer(texte: str) -> str:
    t = re.sub(INTERDITS, " ", texte or "")
    return re.sub(r"\s+", " ", t).strip()


def nom_cible(cle: str, nom: str, prenom: str) -> str:
    return nettoyer(f"{cle} - {nom} {prenom or ''}")


# ── Inventaire ───────────────────────────────────────────────────────────────

def main() -> int:
    banniere("Inventaire des dossiers clients SharePoint")
    print("LECTURE SEULE — aucun dossier n'est deplace, renomme ni supprime.\n")

    if not (TENANT and CLIENT and SECRET):
        raise SystemExit("::error::GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET manquants.")

    jeton = jeton_graph()

    clients = clients_supabase()
    print(f"Clients en base : {len(clients)}")
    cles = resoudre_collisions(clients)
    exceptions = sum(1 for d, c in cles.items() if c != cle_cible(d))
    print(f"Collisions resolues par conservation du suffixe : {exceptions}")

    # dossier SharePoint attendu → client
    par_prefixe = {}
    for c in clients:
        par_prefixe.setdefault(nom_sharepoint_actuel(c["dossier"]), []).append(c)

    trouves = {}       # emplacement → {prefixe: item}
    orphelins = {}     # emplacement → [noms sans client correspondant]
    sites = {}

    for libelle, site, racine in EMPLACEMENTS:
        sid = sites[libelle] = site_id(jeton, site)
        enfants = dossiers_enfants(jeton, sid, racine)
        print(f"\n{libelle}/{racine} : {len(enfants)} dossiers")
        trouves[libelle], orphelins[libelle] = {}, []
        for item in enfants:
            m = re.match(r"^\s*(\d+)\b", item["name"])
            prefixe = m.group(1) if m else None
            if prefixe and prefixe in par_prefixe:
                trouves[libelle][prefixe] = item
            else:
                orphelins[libelle].append(item["name"])
        print(f"  rattaches a un client : {len(trouves[libelle])}")
        print(f"  sans client correspondant : {len(orphelins[libelle])}")

    a, b = EMPLACEMENTS[0][0], EMPLACEMENTS[1][0]
    sid_a, sid_b = sites[a], sites[b]
    communs = set(trouves[a]) & set(trouves[b])
    print(f"\nPresents aux DEUX endroits : {len(communs)}")
    print(f"Seulement dans {a} : {len(set(trouves[a]) - set(trouves[b]))}")
    print(f"Seulement dans {b} : {len(set(trouves[b]) - set(trouves[a]))}")

    # ── Ce que la fusion ecraserait reellement ───────────────────────────
    conflits = {}          # prefixe → (ecrases, apportes, conserves)
    if FICHIERS and communs:
        print(f"\nComparaison fichier par fichier sur {len(communs)} dossiers communs…")
        tot_ecrases = tot_apportes = tot_conserves = 0
        for i, prefixe in enumerate(sorted(communs), 1):
            fa = arbre_fichiers(jeton, sid_a, trouves[a][prefixe]["id"])
            fb = arbre_fichiers(jeton, sid_b, trouves[b][prefixe]["id"])
            # DYNASSUR (b) gagne sur ce qui existe des deux cotes.
            ecrases = sorted(set(fa) & set(fb))
            apportes = sorted(set(fb) - set(fa))
            conserves = sorted(set(fa) - set(fb))
            conflits[prefixe] = (ecrases, apportes, conserves)
            tot_ecrases += len(ecrases)
            tot_apportes += len(apportes)
            tot_conserves += len(conserves)
            if i % 100 == 0:
                print(f"  {i}/{len(communs)} dossiers compares…", flush=True)
        print(f"\n  Fichiers ECRASES (presents des deux cotes, DYNASSUR gagne) : {tot_ecrases}")
        print(f"  Fichiers APPORTES (seulement dans {b}) : {tot_apportes}")
        print(f"  Fichiers CONSERVES (seulement dans {a}, perdus si on ecrasait")
        print(f"    au niveau du dossier au lieu du fichier) : {tot_conserves}")

    sans_dossier = [c for c in clients
                    if nom_sharepoint_actuel(c["dossier"]) not in trouves[a]
                    and nom_sharepoint_actuel(c["dossier"]) not in trouves[b]]
    print(f"Clients sans aucun dossier : {len(sans_dossier)}")

    with open(SORTIE, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["dossier", "nom", "prenom", "nouveau_nom",
                    f"dans_{a}", f"dans_{b}", "modifie_" + a, "modifie_" + b,
                    "present_aux_deux", "suffixe_conserve",
                    "fichiers_ecrases", "fichiers_apportes", "fichiers_conserves"])
        for c in sorted(clients, key=lambda x: cles[x["dossier"]]):
            p = nom_sharepoint_actuel(c["dossier"])
            ia, ib = trouves[a].get(p), trouves[b].get(p)
            w.writerow([
                c["dossier"], c["nom"], c.get("prenom") or "",
                nom_cible(cles[c["dossier"]], c["nom"], c.get("prenom")),
                ia["name"] if ia else "", ib["name"] if ib else "",
                (ia or {}).get("lastModifiedDateTime", ""),
                (ib or {}).get("lastModifiedDateTime", ""),
                "oui" if (ia and ib) else "",
                "oui" if cles[c["dossier"]] != cle_cible(c["dossier"]) else "",
                len(conflits.get(p, ([], [], []))[0]),
                len(conflits.get(p, ([], [], []))[1]),
                len(conflits.get(p, ([], [], []))[2]),
            ])
        for libelle in (a, b):
            for nom in sorted(orphelins[libelle]):
                w.writerow(["", "", "", "", nom if libelle == a else "",
                            nom if libelle == b else "", "", "", "", "ORPHELIN",
                            "", "", ""])

    print(f"\nCSV ecrit : {SORTIE}")
    print("Rien n'a ete modifie dans SharePoint.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
