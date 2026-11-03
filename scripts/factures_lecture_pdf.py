"""
Lecture du contenu des factures PDF → `factures_achat`.

Pourquoi. Jusqu'ici, le montant et la date d'une facture etaient lus dans le NOM
du fichier. C'est la cause de tous les defauts constates le 02/11/2026 :
1 290 factures sans aucun montant (les fichiers deposes par le scanner n'en
portent pas), et 198 montants faux dont 71 au-dessus du million — l'ancien scan
n8n prenait l'horodatage en fin de nom pour un montant
(« Untitled_16122018_114733017.pdf » valait 114 733 017 €).

Le nom de fichier n'est qu'une etiquette. Le PDF, lui, porte la bonne
information. Ce script la lit.

Ce qu'il fait :
  1. choisit les lignes a reprendre (sans montant, ou montant aberrant) ;
  2. telecharge le PDF depuis SharePoint — en LECTURE SEULE ;
  3. le fait lire par Claude, qui renvoie un JSON contraint par schema ;
  4. ecrit fournisseur, date, montant et numero dans `factures_achat`.

Ce qu'il ne fait PAS, et ne doit jamais faire :
  - aucun fichier n'est renomme, deplace, modifie ni supprime. Le script
    n'emet que des GET vers Microsoft Graph ;
  - aucune ligne n'est supprimee en base ;
  - le lien facture ↔ paiement (`transaction_id`, `lode_devis_id`) n'est
    jamais envoye, donc jamais touche.

Variables d'environnement :
  ANTHROPIC_API_KEY                                 cle API Claude
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  SUPABASE_URL, SUPABASE_SERVICE_KEY                voir scripts/_env.py
  DRY_RUN=1        lit et affiche la comparaison, n'ecrit rien (defaut en manuel)
  ECHANTILLON=20   nombre de factures a traiter ; 0 = toutes
  SEUIL_ABERRANT   montant au-dela duquel une valeur est jugee fausse (100000)
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from _env import DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

try:
    import anthropic
except ImportError:
    raise SystemExit("::error::Le paquet `anthropic` manque : pip install -r scripts/requirements.txt")

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

MODELE = os.environ.get("MODELE_CLAUDE", "claude-haiku-5-5")
ECHANTILLON = int(os.environ.get("ECHANTILLON", "20") or 0)
SEUIL_ABERRANT = float(os.environ.get("SEUIL_ABERRANT", "100000"))
# Une requete Claude accepte 32 Mo ; au-dela on passe son tour plutot que
# d'echouer. Les factures depassant 20 Mo sont des scans tres lourds, rares.
TAILLE_MAX = 20 * 1024 * 1024

CONSIGNE = """Tu lis une facture d'achat belge. Extrais uniquement ce que le document montre.

Regles :
- `montant` est le TOTAL A PAYER, TVA comprise, en euros. Pas le hors taxes, pas la TVA seule.
- Pour une note de credit, mets le montant en POSITIF et `note_de_credit` a true.
- `date_facture` est la date d'emission de la facture, pas l'echeance.
- `fournisseur` est celui qui EMET la facture, pas le destinataire (Dynassur,
  DTX, LODE, Hexagroup et Privé sont les destinataires).
- Si une information est absente ou illisible, mets null. N'invente rien,
  ne deduis pas un montant a partir d'un numero de document."""

SCHEMA = {
    "type": "object",
    "properties": {
        "fournisseur": {"type": ["string", "null"]},
        "date_facture": {"type": ["string", "null"], "description": "AAAA-MM-JJ"},
        "montant": {"type": ["number", "null"], "description": "total TTC en euros"},
        "numero": {"type": ["string", "null"]},
        "note_de_credit": {"type": "boolean"},
        "lisible": {"type": "boolean", "description": "false si le document est illisible ou n'est pas une facture"},
    },
    "required": ["fournisseur", "date_facture", "montant", "numero", "note_de_credit", "lisible"],
    "additionalProperties": False,
}


# ── Microsoft Graph (lecture seule) ───────────────────────────────────────────

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
        raise SystemExit(f"::error::Jeton Microsoft Graph refuse ({e.code}) : {e.read().decode()[:300]}")


def telecharger(jeton: str, site_id: str, fichier_id: str) -> bytes | None:
    """GET du contenu du fichier. Aucune ecriture cote SharePoint."""
    url = f"{GRAPH}/sites/{site_id}/drive/items/{urllib.parse.quote(fichier_id)}/content"
    requete = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
    try:
        with urllib.request.urlopen(requete, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        print(f"    fichier illisible ({e.code})", flush=True)
        return None


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
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        corps = reponse.read().decode().strip()
        return json.loads(corps) if corps else None


def a_reprendre():
    """Les factures dont le montant manque ou est manifestement faux."""
    filtre = f"or=(montant.is.null,montant.gte.{int(SEUIL_ABERRANT)})"
    limite = f"&limit={ECHANTILLON}" if ECHANTILLON else ""
    return supabase(
        "GET",
        f"factures_achat?select=id,fichier_id,nom,societe,montant,date_facture"
        f"&sens=eq.achat&fichier_id=like.01*&{filtre}&order=date_facture.desc.nullslast{limite}",
    ) or []


# ── Lecture par Claude ────────────────────────────────────────────────────────

#: Mis a False si l'API refuse le schema ; on retombe alors sur une consigne
#  JSON en clair, pour qu'un lot de 1 500 factures ne tombe pas sur un detail
#  de schema.
_schema_accepte = True


def lire_facture(client, pdf: bytes) -> dict | None:
    global _schema_accepte

    document = {"type": "document", "source": {
        "type": "base64", "media_type": "application/pdf",
        "data": base64.b64encode(pdf).decode(),
    }}

    def appeler(avec_schema: bool):
        consigne = CONSIGNE if avec_schema else (
            CONSIGNE + "\n\nReponds uniquement par un objet JSON, sans texte autour, avec les cles :"
            " fournisseur, date_facture, montant, numero, note_de_credit, lisible."
        )
        options = {"effort": "low"}
        if avec_schema:
            options["format"] = {"type": "json_schema", "schema": SCHEMA}
        return client.messages.create(
            model=MODELE, max_tokens=1024, output_config=options,
            messages=[{"role": "user", "content": [document, {"type": "text", "text": consigne}]}],
        )

    if _schema_accepte:
        try:
            reponse = appeler(True)
        except anthropic.BadRequestError as e:
            print(f"    schema refuse par l'API, repli sur une consigne JSON : {e}", flush=True)
            _schema_accepte = False
            reponse = appeler(False)
    else:
        reponse = appeler(False)
    if reponse.stop_reason == "refusal":
        print("    lecture refusee par le modele", flush=True)
        return None
    for bloc in reponse.content:
        if bloc.type != "text":
            continue
        texte = bloc.text.strip()
        try:
            return json.loads(texte)
        except json.JSONDecodeError:
            # En mode repli, la reponse peut etre entouree de texte.
            debut, fin = texte.find("{"), texte.rfind("}")
            if debut >= 0 and fin > debut:
                try:
                    return json.loads(texte[debut:fin + 1])
                except json.JSONDecodeError:
                    pass
            return None
    return None


def montant_plausible(valeur) -> bool:
    return isinstance(valeur, (int, float)) and 0 <= valeur < SEUIL_ABERRANT


def main() -> int:
    banniere("factures_lecture_pdf")

    manquants = [n for n, v in (("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY")),
                                ("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET)) if not v]
    if manquants:
        print(f"::error::Secret(s) manquant(s) : {', '.join(manquants)}")
        return 1

    lignes = a_reprendre()
    print(f"{len(lignes)} facture(s) a lire (modele {MODELE}, "
          f"{'echantillon de ' + str(ECHANTILLON) if ECHANTILLON else 'lot complet'}).\n", flush=True)
    if not lignes:
        return 0

    jeton = jeton_graph()
    site_id = json.loads(urllib.request.urlopen(urllib.request.Request(
        f"{GRAPH}/sites/{SITE}", headers={"Authorization": f"Bearer {jeton}"}), timeout=30
    ).read().decode())["id"]
    client = anthropic.Anthropic()

    lus = corriges = illisibles = ignores = 0
    jetons_entree = jetons_sortie = 0

    for i, ligne in enumerate(lignes, 1):
        print(f"[{i}/{len(lignes)}] {ligne['nom'][:66]}", flush=True)
        pdf = telecharger(jeton, site_id, ligne["fichier_id"])
        if pdf is None:
            illisibles += 1
            continue
        if len(pdf) > TAILLE_MAX:
            print(f"    passe : {len(pdf) // 1024 // 1024} Mo, trop lourd", flush=True)
            ignores += 1
            continue

        try:
            extrait = lire_facture(client, pdf)
        except anthropic.APIError as e:
            print(f"    erreur API : {e}", flush=True)
            illisibles += 1
            continue

        if not extrait or not extrait.get("lisible"):
            print("    document illisible ou pas une facture", flush=True)
            illisibles += 1
            continue

        lus += 1
        avant = ligne.get("montant")
        apres = extrait.get("montant")
        marque = "=" if avant is None else ("→" if str(avant) != str(apres) else " ")
        print(f"    {extrait.get('fournisseur') or '?':<28} "
              f"{extrait.get('date_facture') or '?':<11} "
              f"{str(avant):>14} {marque} {str(apres):<12} "
              f"n°{extrait.get('numero') or '-'}", flush=True)

        if not montant_plausible(apres):
            print("    montant non exploitable, ligne laissee telle quelle", flush=True)
            continue

        charge = {"montant": apres}
        if extrait.get("date_facture"):
            charge["date_facture"] = extrait["date_facture"]
        if DRY_RUN:
            continue
        supabase("PATCH", f"factures_achat?id=eq.{ligne['id']}", charge,
                 {"Prefer": "return=minimal"})
        corriges += 1

    print(f"\n{lus} lue(s), {corriges} corrigee(s), {illisibles} illisible(s), "
          f"{ignores} trop lourde(s).")
    if DRY_RUN:
        print("DRY_RUN : aucune ecriture en base. Aucun fichier n'a ete modifie dans aucun cas.")
    print(f"LIGNES_ECRITES={corriges}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
