"""
Fusion des dossiers clients : DYNASSUR/DATA_CLIENT → ADMINISTRATION/CLIENTS.

AUCUN RENOMMAGE ICI. Les dossiers gardent leur nom actuel. La regle de
nommage (01105 - DE PAEPE Caroline) est un second chantier, volontairement
separe : deplacer et renommer en meme temps, c'est ne plus savoir laquelle des
deux operations a casse quelque chose.

POURQUOI CE N'EST PAS UN DEPLACEMENT

ADMINISTRATION et DYNASSUR sont deux SITES, donc deux espaces de stockage
distincts. Microsoft Graph ne deplace pas entre deux espaces : PATCH avec un
parentReference d'un autre drive echoue. Il faut COPIER puis supprimer la
source.

Ce script ne fait que la copie. La suppression de DATA_CLIENT est un second
geste, a declencher separement une fois la copie verifiee. Tant qu'elle n'a
pas eu lieu, rien n'est perdu : les deux arborescences coexistent, comme
aujourd'hui.

LA REGLE DE CONFLIT

Consigne du 05/11/2026 : « tu gardes les fichiers que tu deplaces et tu
ecrases les existants ». DYNASSUR gagne, applique au FICHIER et non au
dossier.

  - dossier absent d'ADMINISTRATION  → copie entiere, rien a arbitrer ;
  - dossier present des deux cotes   → copie fichier par fichier, avec
    conflictBehavior=replace. Ce qui existe des deux cotes prend la version
    DYNASSUR ; ce qui n'existe que dans ADMINISTRATION reste intact.

La nuance n'est pas cosmetique. Copier le dossier entier avec replace au
niveau du DOSSIER ne remplace pas son contenu : Graph refuse ou duplique.
Et supprimer d'abord le dossier d'ADMINISTRATION perdrait tout fichier qui
n'existe que la — les plus anciens, donc possiblement les seules copies.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   application Azure
  DRY_RUN=1          (defaut) liste ce qui serait copie, ne copie rien
  LOT                nombre maximum de dossiers traites ; 0 = tous
  DEPUIS             reprendre a partir de ce nom de dossier (reprise sur
                     incident, sans tout refaire)
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from _env import DRY_RUN, banniere

GRAPH = "https://graph.microsoft.com/v1.0"
SOURCE = ("dynassur.sharepoint.com:/sites/DYNASSUR", "DATA_CLIENT")
CIBLE = ("dynassur.sharepoint.com:/sites/ADMINISTRATION", "CLIENTS")

LOT = int(os.environ.get("LOT", "0") or 0)
DEPUIS = os.environ.get("DEPUIS", "").strip()

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()


# ── Microsoft Graph ──────────────────────────────────────────────────────────

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


def drive_id(jeton: str, site: str) -> str:
    sid = lire(jeton, f"{GRAPH}/sites/{site}")["id"]
    return lire(jeton, f"{GRAPH}/sites/{sid}/drive")["id"]


def item_par_chemin(jeton: str, did: str, chemin: str) -> dict | None:
    url = f"{GRAPH}/drives/{did}/root:/{urllib.parse.quote(chemin)}"
    try:
        return lire(jeton, url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def enfants(jeton: str, did: str, item_id: str) -> list:
    url = (f"{GRAPH}/drives/{did}/items/{item_id}/children"
           "?$top=200&$select=id,name,folder,file,size")
    sortie = []
    while url:
        page = lire(jeton, url)
        sortie.extend(page.get("value", []))
        url = page.get("@odata.nextLink")
    return sortie


def copier(jeton: str, did_src: str, item_id: str,
           did_dst: str, parent_id: str, nom: str) -> str:
    """POST /copy. Asynchrone : Graph rend 202 et une URL de suivi.

    conflictBehavior=replace : la version DYNASSUR ecrase celle qui porte le
    meme nom au meme endroit. C'est la consigne, appliquee au fichier."""
    corps = json.dumps({
        "parentReference": {"driveId": did_dst, "id": parent_id},
        "name": nom,
        "@microsoft.graph.conflictBehavior": "replace",
    }).encode()
    req = urllib.request.Request(
        f"{GRAPH}/drives/{did_src}/items/{item_id}/copy",
        data=corps, method="POST",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get("Location", "")


def attendre(url: str, limite: int = 180) -> str:
    """Suit une copie jusqu'a son terme. Sans jeton : l'URL de suivi est
    pre-autorisee. On n'attend pas indefiniment — une copie bloquee ne doit
    pas figer la totalite du traitement."""
    if not url:
        return "inconnu"
    debut = time.time()
    while time.time() - debut < limite:
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                etat = json.loads(r.read().decode())
        except urllib.error.HTTPError:
            return "erreur"
        s = etat.get("status", "")
        if s == "completed":
            return "ok"
        if s == "failed":
            return "echec : " + str(etat.get("error", ""))[:120]
        time.sleep(2)
    return "delai depasse"


def creer_dossier(jeton: str, did: str, parent_id: str, nom: str) -> str:
    corps = json.dumps({
        "name": nom, "folder": {},
        "@microsoft.graph.conflictBehavior": "fail",
    }).encode()
    req = urllib.request.Request(
        f"{GRAPH}/drives/{did}/items/{parent_id}/children",
        data=corps, method="POST",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())["id"]


# ── Fusion ───────────────────────────────────────────────────────────────────

def fusionner(jeton, did_src, src, did_dst, dst, chemin, stats):
    """Recursif. Un dossier absent de la cible est copie en bloc ; un dossier
    present est descendu, fichier par fichier."""
    presents = {e["name"]: e for e in enfants(jeton, did_dst, dst["id"])}

    for item in enfants(jeton, did_src, src["id"]):
        nom = item["name"]
        ici = f"{chemin}/{nom}"
        jumeau = presents.get(nom)

        if "folder" in item:
            if jumeau is None:
                stats["dossiers_copies"] += 1
                print(f"  + dossier  {ici}")
                if not DRY_RUN:
                    etat = attendre(copier(jeton, did_src, item["id"],
                                           did_dst, dst["id"], nom))
                    if etat != "ok":
                        print(f"    ::warning::copie de {ici} : {etat}")
                        stats["erreurs"] += 1
            else:
                fusionner(jeton, did_src, item, did_dst, jumeau, ici, stats)
            continue

        if jumeau is None:
            stats["fichiers_apportes"] += 1
            print(f"  + fichier  {ici}")
        else:
            stats["fichiers_ecrases"] += 1
            print(f"  ~ ecrase   {ici}")
        if not DRY_RUN:
            etat = attendre(copier(jeton, did_src, item["id"],
                                   did_dst, dst["id"], nom))
            if etat != "ok":
                print(f"    ::warning::copie de {ici} : {etat}")
                stats["erreurs"] += 1


def main() -> int:
    banniere("Fusion des dossiers clients vers ADMINISTRATION/CLIENTS")
    print("MODE : " + ("ESSAI A BLANC — rien n'est copie" if DRY_RUN else "COPIE REELLE"))
    print("La source DATA_CLIENT n'est JAMAIS supprimee par ce script.\n")

    if not (TENANT and CLIENT and SECRET):
        raise SystemExit("::error::GRAPH_TENANT_ID / CLIENT_ID / CLIENT_SECRET manquants.")

    jeton = jeton_graph()
    did_src = drive_id(jeton, SOURCE[0])
    did_dst = drive_id(jeton, CIBLE[0])

    racine_src = item_par_chemin(jeton, did_src, SOURCE[1])
    racine_dst = item_par_chemin(jeton, did_dst, CIBLE[1])
    if not racine_src:
        raise SystemExit(f"::error::{SOURCE[1]} introuvable sur le site source.")
    if not racine_dst:
        raise SystemExit(f"::error::{CIBLE[1]} introuvable sur le site cible.")

    dossiers = sorted((e for e in enfants(jeton, did_src, racine_src["id"]) if "folder" in e),
                      key=lambda e: e["name"])
    if DEPUIS:
        dossiers = [d for d in dossiers if d["name"] >= DEPUIS]
    if LOT:
        dossiers = dossiers[:LOT]

    print(f"Dossiers a traiter : {len(dossiers)}\n")
    cibles = {e["name"]: e for e in enfants(jeton, did_dst, racine_dst["id"])}

    stats = {"dossiers_copies": 0, "fichiers_apportes": 0,
             "fichiers_ecrases": 0, "erreurs": 0, "clients_fusionnes": 0}

    for i, d in enumerate(dossiers, 1):
        nom = d["name"]
        jumeau = cibles.get(nom)
        if jumeau is None:
            stats["dossiers_copies"] += 1
            print(f"[{i}/{len(dossiers)}] {nom} — absent de la cible, copie en bloc")
            if not DRY_RUN:
                etat = attendre(copier(jeton, did_src, d["id"],
                                       did_dst, racine_dst["id"], nom))
                if etat != "ok":
                    print(f"  ::warning::{nom} : {etat}")
                    stats["erreurs"] += 1
        else:
            stats["clients_fusionnes"] += 1
            print(f"[{i}/{len(dossiers)}] {nom} — present des deux cotes, fusion")
            fusionner(jeton, did_src, d, did_dst, jumeau, nom, stats)

    print("\n── Bilan ──")
    print(f"  Dossiers copies en bloc      : {stats['dossiers_copies']}")
    print(f"  Dossiers fusionnes           : {stats['clients_fusionnes']}")
    print(f"  Fichiers apportes            : {stats['fichiers_apportes']}")
    print(f"  Fichiers ecrases (DYNASSUR)  : {stats['fichiers_ecrases']}")
    print(f"  Erreurs                      : {stats['erreurs']}")
    if DRY_RUN:
        print("\nEssai a blanc : aucune copie effectuee.")
    print("DATA_CLIENT est intact. Sa suppression est un geste separe.")
    return 1 if stats["erreurs"] else 0


if __name__ == "__main__":
    sys.exit(main())
