#!/usr/bin/env python3
"""
Renommage des bordereaux BQT/RCP dans SharePoint, depuis le contenu du PDF.

L'ÉQUIVALENT DE CE QUI EXISTE POUR LES FACTURES. Demandé par Ludovic le
10/11/2026 : « tu dois faire un équivalent pour BORDEREAUX. Je les place dans
le dossier BORDEREAUX et tu fais de même que pour les factures. »

CE QUE ÇA RÈGLE. `bordereaux_sharepoint.py` ne lit QUE le nom du fichier : un
bordereau mal nommé n'entre jamais en base. Jusqu'au 01/11 c'était un workflow
n8n qui renommait ; il est arrêté, et depuis, un fichier déposé sous son nom
d'origine (« 3110202600145235.pdf ») reste invisible pour toujours.

CE QUE ÇA RÈGLE AUSSI, ET QUI EST PIRE. La colonne `compagnie` de la table
`bordereaux` contient aujourd'hui ALLIANZ sous vingt orthographes, VIVIUM sous
vingt-cinq, des fautes de frappe (« VIIVIUM », « ERUOP ASSISTANCE ») et même
« aaaaaaaaaaaa » — tout cela vient de noms tapés à la main. Ce script ne
laisse pas le modèle inventer un nom : il doit CHOISIR dans la liste des 33
compagnies du référentiel, sinon le fichier n'est pas renommé.

Le nom produit, celui qu'attend le scan :

    AAAA.MM - TYPE - COMPAGNIE - NUMERO.pdf
    2026.10 - BQT - AXA Belgium - 3145235.pdf

LA RÈGLE QUI TIENT TOUT, reprise mot pour mot des factures : on ne renomme que
lorsqu'on est sûr. Type, compagnie, année, mois et numéro doivent être lus.
Sinon le fichier GARDE SON NOM et part dans la liste des illisibles.

    Un fichier au vilain nom coûte une recherche.
    Un fichier au MAUVAIS nom est introuvable.

C'est précisément ce que l'ancien workflow faisait mal : quand il échouait, il
écrivait son échec DANS le nom (« NON SPÉCIFIÉ DANS LE TEXTE FOURNI »), ce qui
donne à un échec l'apparence d'un succès. Personne ne revient dessus.

Ce qu'il ne fait PAS, et ne doit jamais faire :
  - aucun fichier n'est déplacé ni supprimé. La seule écriture est un
    changement de nom, et elle est refusée en environnement de test ;
  - aucune ligne n'est écrite en base. C'est le scan qui le fait, après, à
    partir du nom — le sens de lecture reste celui d'aujourd'hui.

Variables d'environnement :
  ANTHROPIC_API_KEY                                 clé API Claude
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  SUPABASE_URL, SUPABASE_SERVICE_KEY                voir scripts/_env.py
  APP_ENV            production (défaut) | test
  DRY_RUN=1          affiche les renommages, n'en fait aucun
  BORDEREAUX_RACINE  dossier de départ (défaut BORDEREAUX)
  LOT                nombre maximum de fichiers à traiter ; 0 = tous
  MODELE_CLAUDE      défaut claude-haiku-5-5
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import (APP_ENV, DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere,
                  refuser_ecriture_sharepoint)

try:
    import anthropic
except ImportError:
    raise SystemExit("::error::Le paquet `anthropic` manque : pip install -r scripts/requirements.txt")

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
RACINE = os.environ.get("BORDEREAUX_RACINE", "BORDEREAUX").strip("/")
LOT = int(os.environ.get("LOT", "0") or 0)
MODELE = os.environ.get("MODELE_CLAUDE", "claude-haiku-5-5")

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

# Un bordereau dépasse rarement quelques centaines de kilo-octets. Au-delà,
# c'est un scan d'une liasse entière : on ne l'envoie pas au modèle.
TAILLE_MAX = int(os.environ.get("TAILLE_MAX", str(12 * 1024 * 1024)))

INTERDITS = r'[\\/:*?"<>|#%{}~&]'

# La convention attendue par bordereaux_sharepoint.py. Un fichier qui la suit
# DÉJÀ n'est pas touché : le renommage ne doit pas défaire un nom correct.
RE_NOM = re.compile(
    r"^(?P<annee>20\d{2})[.\-_](?P<mois>0[1-9]|1[0-2])\s*-\s*"
    r"(?P<type>[A-Za-z]{3})\s*-\s*(?P<reste>.+?)\s*$")

TYPES = {"BQT", "RCP"}


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


def site_id(jeton: str) -> str:
    req = urllib.request.Request(f"{GRAPH}/sites/{SITE}",
                                 headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["id"]


def enfants(jeton: str, sid: str, chemin: str):
    """Les enfants d'un dossier, en suivant la pagination. Graph rend 200
    entrées par page et personne ne s'en aperçoit tant que le dossier est
    petit — c'est le genre d'oubli qui fait rater les plus anciens."""
    url = (f"{GRAPH}/sites/{sid}/drive/root:/{urllib.parse.quote(chemin)}:"
           f"/children?$top=200&$select=id,name,size,folder,file")
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.loads(r.read().decode())
        for e in page.get("value", []):
            yield e
        url = page.get("@odata.nextLink")


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


def renommer_fichier(jeton: str, sid: str, item_id: str, nouveau: str):
    """PATCH Graph. C'est la SEULE écriture de ce script dans SharePoint :
    un changement de nom. Jamais de déplacement, jamais de suppression.

    En TEST elle ne part pas — `APP_ENV=test` n'isole que la base de données,
    pas SharePoint, et renommer de vrais documents depuis un environnement de
    test serait exactement le piège constaté le 07/11."""
    if refuser_ecriture_sharepoint(f"{item_id} -> {nouveau}"):
        return {"name": nouveau, "ignore_en_test": True}
    corps = json.dumps({"name": nouveau}).encode()
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{item_id}",
        data=corps, method="PATCH",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


# ── Référentiel des compagnies ────────────────────────────────────────────

def supabase(methode: str, chemin: str, charge=None):
    url = f"{SUPABASE_URL}/rest/v1/{chemin}"
    data = json.dumps(charge).encode() if charge is not None else None
    req = urllib.request.Request(url, data=data, method=methode, headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        brut = r.read().decode()
    return json.loads(brut) if brut else []


def compagnies_connues() -> list[str]:
    """Les noms du référentiel, et RIEN d'autre.

    C'est le garde-fou central. Laisser le modèle écrire le nom qu'il lit sur
    le document, c'est reproduire exactement le désordre actuel : 33 compagnies
    réelles, plusieurs centaines d'orthographes en base."""
    lignes = supabase("GET", "compagnies?select=nom&actif=is.true&order=nom")
    noms = [l["nom"] for l in lignes if l.get("nom")]
    if not noms:
        raise SystemExit("::error::Aucune compagnie active en base : "
                         "impossible de contraindre la lecture.")
    return noms


# ── Lecture du PDF ────────────────────────────────────────────────────────

CONSIGNE = """Tu lis un document envoyé par une compagnie d'assurance belge à son courtier.

Il s'agit soit d'un BORDEREAU DE QUITTANCES (BQT) : une liste de primes à encaisser ou encaissées,
soit d'un RELEVÉ DE COMPTE PRODUCTEUR (RCP) : un décompte de commissions qui accompagne un paiement.

Extrais uniquement ce que le document montre.
- `type` vaut BQT ou RCP. Si tu hésites, réponds lisible = false.
- `compagnie` DOIT être exactement l'une des valeurs de la liste fournie. Si le document vient
  d'une compagnie qui n'y figure pas, réponds lisible = false — n'écris jamais un nom qui n'est
  pas dans la liste, même s'il te paraît évident.
- `annee` et `mois` sont ceux de la PÉRIODE du document, pas la date d'impression.
- `numero` est le numéro de producteur ou de bordereau imprimé sur le document ; garde-le tel
  quel, tirets compris. S'il n'y en a pas, réponds lisible = false.
- Ne déduis rien. Un document dont une seule de ces valeurs manque est lisible = false."""

SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["BQT", "RCP"]},
        "compagnie": {"type": "string"},
        "annee": {"type": "integer"},
        "mois": {"type": "integer"},
        "numero": {"type": "string"},
        "lisible": {"type": "boolean",
                    "description": "false si le document est illisible, n'est pas un bordereau, "
                                   "ou si une valeur manque"},
    },
    "required": ["lisible"],
    "additionalProperties": False,
}

_schema_accepte = True


def lire_bordereau(client, pdf: bytes, noms: list[str]) -> dict | None:
    global _schema_accepte

    document = {"type": "document", "source": {
        "type": "base64", "media_type": "application/pdf",
        "data": base64.b64encode(pdf).decode(),
    }}
    liste = "\n".join(f"- {n}" for n in noms)
    texte = f"{CONSIGNE}\n\nCompagnies autorisées :\n{liste}"

    def appeler(avec_schema: bool):
        consigne = texte if avec_schema else (
            texte + "\n\nRéponds uniquement par un objet JSON, sans texte autour, "
                    "avec les clés : type, compagnie, annee, mois, numero, lisible.")
        options = {"effort": "low"}
        if avec_schema:
            schema = dict(SCHEMA)
            schema["properties"] = dict(SCHEMA["properties"])
            schema["properties"]["compagnie"] = {"type": "string", "enum": noms}
            options["format"] = {"type": "json_schema", "schema": schema}
        return client.messages.create(
            model=MODELE, max_tokens=512, output_config=options,
            messages=[{"role": "user", "content": [document, {"type": "text", "text": consigne}]}],
        )

    if _schema_accepte:
        try:
            reponse = appeler(True)
        except anthropic.BadRequestError as e:
            print(f"    schéma refusé par l'API, repli sur une consigne JSON : {e}", flush=True)
            _schema_accepte = False
            reponse = appeler(False)
    else:
        reponse = appeler(False)

    if reponse.stop_reason == "refusal":
        print("    lecture refusée par le modèle", flush=True)
        return None
    for bloc in reponse.content:
        if bloc.type != "text":
            continue
        brut = bloc.text.strip()
        try:
            return json.loads(brut)
        except json.JSONDecodeError:
            debut, fin = brut.find("{"), brut.rfind("}")
            if debut >= 0 and fin > debut:
                try:
                    return json.loads(brut[debut:fin + 1])
                except json.JSONDecodeError:
                    pass
    return None


# ── Construction du nom ───────────────────────────────────────────────────

def nom_propre(lu: dict, noms: list[str]) -> str | None:
    """Rend le nom, ou None si une seule valeur manque. Pas de demi-mesure :
    un nom partiel est un mauvais nom."""
    if not lu or not lu.get("lisible"):
        return None
    t = str(lu.get("type", "")).upper().strip()
    compagnie = str(lu.get("compagnie", "")).strip()
    numero = str(lu.get("numero", "")).strip()
    try:
        annee = int(lu.get("annee"))
        mois = int(lu.get("mois"))
    except (TypeError, ValueError):
        return None

    if t not in TYPES or compagnie not in noms or not numero:
        return None
    if not (2000 <= annee <= 2100) or not (1 <= mois <= 12):
        return None

    compagnie = re.sub(INTERDITS, " ", compagnie)
    numero = re.sub(INTERDITS, " ", numero)
    compagnie = re.sub(r"\s+", " ", compagnie).strip()
    numero = re.sub(r"\s+", " ", numero).strip()
    return f"{annee}.{mois:02d} - {t} - {compagnie} - {numero}.pdf"


# ── Parcours ──────────────────────────────────────────────────────────────

def a_traiter(jeton: str, sid: str):
    """Tous les PDF de l'arbre BORDEREAUX dont le nom NE SUIT PAS la
    convention. Ceux qui la suivent déjà ne sont pas touchés."""
    a_visiter = [RACINE]
    while a_visiter:
        chemin = a_visiter.pop()
        try:
            for e in enfants(jeton, sid, chemin):
                if e.get("folder"):
                    a_visiter.append(f"{chemin}/{e['name']}")
                    continue
                nom = e.get("name", "")
                if not nom.lower().endswith(".pdf"):
                    continue
                if RE_NOM.match(nom[:-4]):
                    continue
                yield chemin, e
        except urllib.error.HTTPError as e:
            print(f"::warning::dossier « {chemin} » illisible ({e.code})", flush=True)


def main() -> int:
    banniere("bordereaux_renommage")
    manquants = [n for n, v in (("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY")),
                                ("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET),
                                ("SUPABASE_URL", SUPABASE_URL),
                                ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)) if not v]
    if manquants:
        print(f"::error::Variables manquantes : {', '.join(manquants)}")
        return 1

    noms = compagnies_connues()
    print(f"{len(noms)} compagnies au référentiel — aucune autre ne sera écrite", flush=True)

    jeton = jeton_graph()
    sid = site_id(jeton)
    print(f"Site ADMINISTRATION résolu, dossier « {RACINE} »", flush=True)

    client = anthropic.Anthropic()
    vus = renommes = illisibles = trop_gros = 0

    for chemin, e in a_traiter(jeton, sid):
        if LOT and vus >= LOT:
            print(f"Lot de {LOT} atteint — le reste sera pris au passage suivant", flush=True)
            break
        vus += 1
        nom = e["name"]
        print(f"  {chemin}/{nom}", flush=True)

        if (e.get("size") or 0) > TAILLE_MAX:
            trop_gros += 1
            print("    ignoré : trop volumineux pour une lecture", flush=True)
            continue

        pdf = telecharger(jeton, sid, e["id"])
        if not pdf:
            illisibles += 1
            continue

        lu = lire_bordereau(client, pdf, noms)
        nouveau = nom_propre(lu, noms)
        if not nouveau:
            illisibles += 1
            print("    NON RENOMMÉ — garde son nom d'origine", flush=True)
            continue

        if nouveau == nom:
            continue
        if DRY_RUN:
            print(f"    [essai] -> {nouveau}", flush=True)
            renommes += 1
            continue
        try:
            renommer_fichier(jeton, sid, e["id"], nouveau)
            renommes += 1
            print(f"    -> {nouveau}", flush=True)
        except urllib.error.HTTPError as err:
            illisibles += 1
            print(f"::warning::renommage refusé ({err.code}) : {err.read().decode()[:200]}",
                  flush=True)

    print(f"\n{vus} fichier(s) hors convention — {renommes} renommé(s), "
          f"{illisibles} laissé(s) tel(s) quel(s), {trop_gros} trop volumineux "
          f"[{APP_ENV}{' · essai' if DRY_RUN else ''}]", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
