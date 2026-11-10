#!/usr/bin/env python3
"""
Classement des factures déposées à la racine de COMPTA/FACTURES.

CE QUE ÇA CHANGE POUR LUDOVIC. Avant : il fallait choisir le bon dossier
(_DYNASSUR/ACHATS/2026, _LODE/ACHATS/2026…) avant de déposer. Maintenant : on
dépose à la racine, et le document est rangé tout seul.

POURQUOI C'EST SÛR — ET MÊME PLUS SÛR QU'AVANT. La société d'une facture n'a
jamais dû venir du dossier : c'est le PDF qui dit à qui il est adressé. C'est
déjà la règle de `factures_lecture_pdf.py`, qui marque `a_verifier` quand le
destinataire ne correspond pas au dossier choisi. Ici, le dossier DÉCOULE du
destinataire : il ne peut plus y avoir de désaccord entre les deux.

⚠️ CE QU'ON PERD, ET IL FAUT LE SAVOIR. Ce contrôle de cohérence devient
circulaire : le dossier venant du document, il ne peut plus contredire le
document. Le filet de sécurité disparaît, et c'est le prix du dépôt unique.
On le compense par la seule chose qui ne ment pas :

    LE NUMÉRO DE TVA TRANCHE SEUL. Deux sociétés peuvent porter le même nom,
    aucune ne partage son numéro d'entreprise.

Un document dont le destinataire n'est pas établi avec certitude n'est PAS
rangé au hasard : il part dans `_A_TRIER`, avec son nom d'origine, et quelqu'un
tranche. PRIVE et HOL n'ont pas de personne morale identifiable sur une
facture : elles finissent donc toujours dans `_A_TRIER`, et c'est volontaire.

Ce que ce script fait, et rien d'autre :
  1. liste les PDF posés DIRECTEMENT à la racine de COMPTA/FACTURES ;
  2. lit chacun avec le même lecteur que la chaîne existante ;
  3. le déplace dans `_<SOCIETE>/ACHATS/<année>` quand la société est sûre,
     sinon dans `_A_TRIER`.

Il ne renomme pas : c'est `factures_renommage.py` qui le fait, après, depuis
la base. Le sens de lecture ne change pas — la base fait foi, le nom en
découle.

Variables d'environnement :
  ANTHROPIC_API_KEY, GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  APP_ENV            production (défaut) | test
  DRY_RUN=1          affiche les déplacements, n'en fait aucun
  LOT                nombre maximum de fichiers ; 0 = tous
  TAILLE_MAX         octets au-delà desquels on ne lit pas (défaut 12 Mo)
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import APP_ENV, DRY_RUN, banniere, refuser_ecriture_sharepoint
from factures_lecture_pdf import (SOCIETES_REF, lire_facture, normaliser_tva,
                                  sans_accent)

try:
    import anthropic
except ImportError:
    raise SystemExit("::error::Le paquet `anthropic` manque : pip install -r scripts/requirements.txt")

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
RACINE = os.environ.get("FACTURES_RACINE", "COMPTA/FACTURES").strip("/")
A_TRIER = "_A_TRIER"
LOT = int(os.environ.get("LOT", "0") or 0)
TAILLE_MAX = int(os.environ.get("TAILLE_MAX", str(12 * 1024 * 1024)))

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()


# ── Microsoft Graph ───────────────────────────────────────────────────────

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
        raise SystemExit(f"::error::Jeton Microsoft Graph refusé ({e.code}) : "
                         f"{e.read().decode()[:400]}")


def _get(jeton: str, url: str):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def site_id(jeton: str) -> str:
    return _get(jeton, f"{GRAPH}/sites/{SITE}")["id"]


def racine_enfants(jeton: str, sid: str):
    """Les enfants DIRECTS de la racine. On ne descend pas : les sous-dossiers
    `_SOCIETE` sont déjà traités par la chaîne existante, et les reparcourir
    ferait relire des milliers de documents déjà classés."""
    url = (f"{GRAPH}/sites/{sid}/drive/root:/{urllib.parse.quote(RACINE)}:"
           f"/children?$top=200&$select=id,name,size,folder,file")
    while url:
        page = _get(jeton, url)
        for e in page.get("value", []):
            yield e
        url = page.get("@odata.nextLink")


def dossier_id(jeton: str, sid: str, chemin: str) -> str | None:
    try:
        return _get(jeton, f"{GRAPH}/sites/{sid}/drive/root:/"
                           f"{urllib.parse.quote(chemin)}")["id"]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def creer_dossier(jeton: str, sid: str, parent_id: str, nom: str) -> str:
    corps = json.dumps({"name": nom, "folder": {},
                        "@microsoft.graph.conflictBehavior": "return"}).encode()
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{parent_id}/children",
        data=corps, method="POST",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())["id"]


def assurer_chemin(jeton: str, sid: str, chemin: str, cache: dict) -> str:
    """Rend l'identifiant du dossier, en le créant si besoin, segment par
    segment. Un dépôt en janvier ne doit pas échouer parce que le dossier de
    la nouvelle année n'existe pas encore."""
    if chemin in cache:
        return cache[chemin]
    existant = dossier_id(jeton, sid, chemin)
    if existant:
        cache[chemin] = existant
        return existant
    parent, _, feuille = chemin.rpartition("/")
    pid = assurer_chemin(jeton, sid, parent, cache) if parent else dossier_id(jeton, sid, RACINE)
    if refuser_ecriture_sharepoint(f"créer {chemin}"):
        cache[chemin] = "(test)"
        return cache[chemin]
    cache[chemin] = creer_dossier(jeton, sid, pid, feuille)
    return cache[chemin]


def telecharger(jeton: str, sid: str, item_id: str) -> bytes | None:
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{item_id}/content",
        headers={"Authorization": f"Bearer {jeton}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        print(f"    téléchargement refusé ({e.code})", flush=True)
        return None


def deplacer(jeton: str, sid: str, item_id: str, parent_id: str):
    """La seule écriture de ce script : un changement de dossier parent.
    Jamais de renommage — c'est le travail de `factures_renommage.py`, depuis
    la base. Jamais de suppression."""
    if refuser_ecriture_sharepoint(f"déplacer {item_id} -> {parent_id}"):
        return {"ignore_en_test": True}
    corps = json.dumps({"parentReference": {"id": parent_id}}).encode()
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{item_id}",
        data=corps, method="PATCH",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


# ── À qui cette facture est-elle adressée ? ───────────────────────────────

def societe_du_document(lu: dict) -> tuple[str | None, str]:
    """(code société, raison). None quand ce n'est pas certain.

    L'ordre compte : le numéro de TVA d'abord, le nom seulement ensuite et
    seulement s'il est sans ambiguïté."""
    if not lu or not lu.get("lisible"):
        return None, "document illisible"

    tva = normaliser_tva(lu.get("tva_destinataire") or "")
    if tva:
        for code, (bce, _) in SOCIETES_REF.items():
            if tva == bce:
                return code, f"n° TVA {tva}"
        return None, f"n° TVA {tva} : ce n'est aucune société du groupe"

    nom = sans_accent(str(lu.get("destinataire") or "")).upper()
    if not nom.strip():
        return None, "aucun destinataire lisible"

    trouves = [code for code, (_, noms) in SOCIETES_REF.items()
               if any(sans_accent(n).upper() in nom for n in noms)]
    if len(trouves) == 1:
        return trouves[0], f"nom « {lu.get('destinataire')} »"
    if len(trouves) > 1:
        return None, f"plusieurs sociétés reconnues dans « {lu.get('destinataire')} »"
    return None, f"destinataire « {lu.get('destinataire')} » hors groupe"


RE_ANNEE = re.compile(r"^(20\d{2})")


def annee_du_document(lu: dict) -> str | None:
    m = RE_ANNEE.match(str(lu.get("date_facture") or ""))
    return m.group(1) if m else None


# ── Programme ─────────────────────────────────────────────────────────────

def main() -> int:
    banniere("factures_classement")
    manquants = [n for n, v in (("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY")),
                                ("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET)) if not v]
    if manquants:
        print(f"::error::Variables manquantes : {', '.join(manquants)}")
        return 1

    jeton = jeton_graph()
    sid = site_id(jeton)
    print(f"Racine « {RACINE} » — on ne lit que ce qui est posé À LA RACINE", flush=True)

    client = anthropic.Anthropic()
    cache: dict[str, str] = {}
    vus = classes = a_trier = trop_gros = 0

    for e in list(racine_enfants(jeton, sid)):
        if e.get("folder"):
            continue
        nom = e.get("name", "")
        if not nom.lower().endswith(".pdf"):
            continue
        if LOT and vus >= LOT:
            print(f"Lot de {LOT} atteint — le reste au passage suivant", flush=True)
            break
        vus += 1
        print(f"  {nom}", flush=True)

        if (e.get("size") or 0) > TAILLE_MAX:
            trop_gros += 1
            print("    ignoré : trop volumineux pour une lecture", flush=True)
            continue

        pdf = telecharger(jeton, sid, e["id"])
        if not pdf:
            continue

        lu = lire_facture(client, pdf)
        code, raison = societe_du_document(lu)
        annee = annee_du_document(lu or {})

        if code and annee:
            cible = f"{RACINE}/_{code}/ACHATS/{annee}"
            classes += 1
        else:
            cible = f"{RACINE}/{A_TRIER}"
            a_trier += 1
            if code and not annee:
                raison = f"{raison}, mais aucune date lisible"

        print(f"    -> {cible}   ({raison})", flush=True)
        if DRY_RUN:
            continue
        try:
            pid = assurer_chemin(jeton, sid, cible, cache)
            deplacer(jeton, sid, e["id"], pid)
        except urllib.error.HTTPError as err:
            print(f"::warning::déplacement refusé ({err.code}) : "
                  f"{err.read().decode()[:200]}", flush=True)

    print(f"\n{vus} fichier(s) à la racine — {classes} classé(s), "
          f"{a_trier} dans {A_TRIER}, {trop_gros} trop volumineux "
          f"[{APP_ENV}{' · essai' if DRY_RUN else ''}]", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
