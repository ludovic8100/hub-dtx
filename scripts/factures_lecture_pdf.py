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
  1. choisit les lignes a reprendre (sans montant, montant aberrant, ou SANS
     DATE — 4 722 factures sur 7 588 au 04/11/2026, qui portent l'ancienne
     convention de nommage et ne peuvent donc pas etre rapprochees) ;
  2. telecharge le PDF depuis SharePoint — en LECTURE SEULE ;
  3. le fait lire par Claude, qui renvoie un JSON contraint par schema ;
  4. ecrit fournisseur, date, montant et numero dans `factures_achat`. Le
     fournisseur et le numero etaient extraits puis jetes jusqu'au 04/11/2026,
     faute de colonnes pour les recevoir — ce sont pourtant eux qui permettront
     de renommer les fichiers depuis la base.

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
  FILTRE_DOSSIER   restreint a un dossier, ex. « _DYNASSUR/ACHATS/2025 »
  SEUIL_ABERRANT   montant au-dela duquel une valeur est jugee fausse (1000000)
  ECRASER=1        ecrire aussi quand la base porte deja un montant different
"""
import base64
import json
import os
import re
import sys
import unicodedata
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
# 100 000 etait trop bas : 127 factures entre 100 k€ et 1 M€ sont legitimes
# (une facture DTX de 105 000 € a ete rejetee a tort au premier essai), quand
# les 71 au-dessus du million viennent toutes d'un horodatage mal lu.
SEUIL_ABERRANT = float(os.environ.get("SEUIL_ABERRANT", "1000000"))

#: Restreint le lot a un dossier SharePoint, par exemple « _DYNASSUR/ACHATS/2025 ».
#  Le chemin n'est pas stocke en base (la colonne `chemin` est vide sur 5 508
#  lignes sur 5 509), mais l'URL le contient en entier : on filtre dessus.
FILTRE_DOSSIER = os.environ.get("FILTRE_DOSSIER", "").strip()
ECRASER = os.environ.get("ECRASER") == "1"
# Une requete Claude accepte 32 Mo ; au-dela on passe son tour plutot que
# d'echouer. Les factures depassant 20 Mo sont des scans tres lourds, rares.
TAILLE_MAX = 20 * 1024 * 1024

CONSIGNE = """Tu lis une facture d'achat belge. Extrais uniquement ce que le document montre.

Regles :
- `montant` est le TOTAL A PAYER, TVA comprise, en euros. Pas le hors taxes, pas la TVA seule.
- Pour une note de credit, mets le montant en POSITIF et `note_de_credit` a true.
- `date_facture` est la date d'emission de la facture, pas l'echeance.
- `tva_fournisseur` est le numero de TVA de l'EMETTEUR. Une facture belge le
  porte obligatoirement. C'est la cle la plus sure pour identifier une
  entreprise : deux societes peuvent s'appeler pareil, aucune ne partage son
  numero. Rends-le sous la forme BE0123456789, sans points ni espaces.
- `fournisseur` est celui qui EMET la facture, pas le destinataire.
- `destinataire` est celui A QUI la facture est adressee : le nom qui figure
  dans le bloc « client », « facture a », « bill to », « livre a ». C'est
  souvent Dynassur, DTX, LODE, Hexagroup — mais PAS toujours, et c'est tout
  l'interet de le lire : un fichier range dans le dossier d'une societe peut
  etre adresse a quelqu'un d'autre. Recopie ce qui est ecrit, sans corriger.
  Pour un ticket de caisse sans client nomme, mets null.
- `tva_destinataire` est le n° TVA du CLIENT, s'il figure sur la facture.
- Si une information est absente ou illisible, mets null. N'invente rien,
  ne deduis pas un montant a partir d'un numero de document."""

SCHEMA = {
    "type": "object",
    "properties": {
        "fournisseur": {"type": ["string", "null"]},
        "tva_fournisseur": {"type": ["string", "null"],
                            "description": "n° TVA de l'EMETTEUR, ex. BE0123456789 ; null si absent"},
        "date_facture": {"type": ["string", "null"], "description": "AAAA-MM-JJ"},
        "montant": {"type": ["number", "null"], "description": "total TTC en euros"},
        "destinataire": {"type": ["string", "null"],
                         "description": "nom du CLIENT facture, tel qu'ecrit ; null si aucun"},
        "tva_destinataire": {"type": ["string", "null"],
                             "description": "n° TVA du CLIENT, ex. BE0123456789 ; null si absent"},
        "numero": {"type": ["string", "null"]},
        "note_de_credit": {"type": "boolean"},
        "lisible": {"type": "boolean", "description": "false si le document est illisible ou n'est pas une facture"},
    },
    "required": ["fournisseur", "tva_fournisseur", "date_facture", "montant",
                 "destinataire", "tva_destinataire", "numero", "note_de_credit",
                 "lisible"],
    "additionalProperties": False,
}


# ── Le destinataire : la facture dit a qui elle est adressee ─────────────────
#
# Jusqu'ici la societe d'une facture venait du DOSSIER. Un fichier mal range
# produisait une facture attribuee a la mauvaise societe, et depuis le
# renommage un nom de fichier qui AFFIRME cette erreur : « 20250120 -
# DYNASSUR - RETIF LIEGE » pour une facture adressee a un particulier.
#
# Un nom de fichier faux est pire qu'un nom moche. Un nom moche coute une
# recherche ; un nom faux clot la question.

SOCIETES_REF = {
    "DYNASSUR":  ("BE0677519858", ("DYNASSUR",)),
    "DTX":       ("BE0780791404", ("DTX",)),
    "LODE":      ("BE1010062582", ("LODE",)),
    "HEXAGROUP": ("BE1019092589", ("HEXAGROUP", "HEXA GROUP")),
}


def sans_accent(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t or "")
                   if unicodedata.category(c) != "Mn")


def normaliser_tva(brut: str) -> str:
    t = re.sub(r"[^0-9A-Za-z]", "", brut or "").upper()
    if not re.fullmatch(r"(BE)?0?\d{9,10}", t or ""):
        return ""
    if not t.startswith("BE"):
        t = "BE" + t
    if len(t) == 11:                       # BE + 9 chiffres : le zero initial manque
        t = "BE0" + t[2:]
    return t


def destinataire_etranger(societe, nom, tva):
    """La facture est-elle adressee a quelqu'un d'autre que la societe du dossier ?

    Ne rend True que lorsqu'on est SUR. Un doute ne vaut pas une alerte :
    signaler a tort des factures justes, c'est apprendre a ignorer les
    signalements — et alors les vraies passent aussi.
    """
    ref = SOCIETES_REF.get((societe or "").upper())
    if not ref:
        return False, ""                   # PRIVE, HOL : pas de personne morale
    bce, noms = ref

    # Le n° TVA tranche seul quand il est la : deux societes peuvent porter le
    # meme nom, aucune ne partage son numero.
    t = normaliser_tva(tva)
    if t:
        return (t != bce), (f"adressee au n° TVA {t}, pas a {societe}" if t != bce else "")

    if not nom or not nom.strip():
        return False, ""                   # ticket de caisse : aucun client nomme
    hay = sans_accent(nom).upper()
    if any(n in hay for n in noms):
        return False, ""
    return True, f"adressee a « {nom.strip()[:80]} », pas a {societe}"


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


# Le dossier FACTURES ne contient pas que des factures d'achat. L'echantillon
# du 03/11 l'a montre : 18 des 20 premiers fichiers etaient des fiches de paie,
# des avis de remboursement ou des releves. Mesure en base : 373 des 1 290
# lignes sans montant sont des fiches de paie. Les envoyer a la lecture coute
# de l'argent pour un refus garanti, et prendrait le risque qu'un montant de
# salaire finisse en montant de facture.
# L'essai du 04/11 a lu 13 documents sur 15 pour s'entendre repondre « ce n'est
# pas une facture » : notes de frais, extraits ING et CBC, documents Partena.
# Chacun coute un appel API pour rien. Sur les 4 722 factures sans date, environ
# 780 sont dans ce cas.
#
# Les motifs restent volontairement prudents : mieux vaut lire un document de
# trop que d'ecarter une vraie facture. « nf » n'est reconnu qu'isole, pour ne
# pas ecarter « Confort NF » ou un fournisseur dont le nom contient ces lettres.
HORS_FACTURES = ("fiche de paie", "fiche_de_paie", "avis de remboursement",
                 "releve", "relevé", "extrait de compte", "coda",
                 "note de frais", "note_de_frais", "decompte", "dcompte",
                 "décompte", "secretariat social", "secrétariat social")

#: Motifs a mot entier, pour ceux que la simple inclusion rendrait trop larges.
#
# « partena » a ete essaye puis RETIRE : Partena facture ses services de
# secretariat social, et « I0738 - Partena Asi EUR 347,50.pdf » est une vraie
# facture d'achat. L'exclure en bloc aurait fait sauter 616 documents dont une
# part est bien a rapprocher. Les bulletins de paie de Partena sont deja pris
# par « fiche de paie » et « decompte » ; les rares qui passent coutent un
# appel pour s'entendre dire que ce n'est pas une facture, ce qui est le bon
# sens de l'erreur.
HORS_FACTURES_MOTIFS = re.compile(
    r"(?:^|[^a-z0-9])nf(?:[^a-z0-9]|$)", re.IGNORECASE)


def est_hors_facture(nom: str) -> bool:
    bas = (nom or "").lower()
    return (any(mot in bas for mot in HORS_FACTURES)
            or bool(HORS_FACTURES_MOTIFS.search(nom or "")))


# Un montant egal a une annee ronde (2020, 2026) ou a un numero de piece
# (202403) ne vient pas d'une facture : il vient du NOM du fichier, ou le
# lecteur a pris un millesime ou une reference pour une somme.
#   « I0881 - ... - Contrat 0729355225 - 06 07 2020.pdf »  ->  2020 EUR
#   « C056-2 - NF202403 EUR 502,89.pdf »                   ->  202403 EUR
# Ces valeurs sont sous le seuil d'aberration, donc elles passaient pour
# normales et la facture n'etait jamais relue.
def montant_suspect(valeur) -> bool:
    if valeur is None:
        return False
    try:
        v = float(valeur)
    except (TypeError, ValueError):
        return True
    if v >= SEUIL_ABERRANT:
        return True
    if v != int(v):
        return False                       # un montant a centimes est credible
    entier = int(v)
    if 1990 <= entier <= 2035:             # une annee
        return True
    if 199001 <= entier <= 203512:         # AAAAMM, un numero de piece
        return True
    return False


def a_reprendre():
    """Les factures d'achat dont la base ne sait pas dire l'essentiel.

    Trois cas, et le troisieme est le plus gros :

    - montant absent ;
    - montant manifestement faux (au-dela du seuil, ou qui est en realite une
      annee ou un numero de piece — voir montant_suspect) ;
    - FOURNISSEUR absent. Sans lui, impossible de renommer le fichier depuis
      la base — et le renommage est ce qui permet de retrouver une facture en
      naviguant dans le dossier ;
    - DATE absente. 4 722 factures d'achat sur 7 588 au 04/11/2026, soit 62 %.
      Elles portent l'ancienne convention de nommage (« I0881 - Nubeo EUR
      139,65.pdf »), qui ne contient aucune date. Sans date, le rapprochement
      bancaire ne peut rien en faire : c'est la cause principale du retard.
      Le code plus bas savait deja remplir la date depuis le PDF — ces lignes
      n'etaient simplement jamais choisies.
    """
    filtre = (f"or=(montant.is.null,montant.gte.{int(SEUIL_ABERRANT)},"
              f"date_facture.is.null,fournisseur.is.null,lu_le.is.null)")
    if FILTRE_DOSSIER:
        filtre += "&url=like.*" + urllib.parse.quote(FILTRE_DOSSIER, safe="") + "*"
    lignes = supabase(
        "GET",
        f"factures_achat?select=id,fichier_id,nom,societe,montant,date_facture,"
        f"fournisseur,numero,tva_fournisseur,destinataire,tva_destinataire,"
        f"a_verifier,nom_origine,lu_le"
                # « nullsfirst » et non « nullslast » : les factures SANS date passent en
        # tete. Ce sont elles qui bloquent le rapprochement, et avec l'ancien
        # tri un lot de 15 n'en atteignait aucune — l'essai du 04/11 n'a lu que
        # des lignes deja datees.
        f"&sens=eq.achat&fichier_id=like.01*&{filtre}&order=date_facture.asc.nullsfirst"
        + (f"&limit={5 * ECHANTILLON}" if ECHANTILLON else ""),
    ) or []
    gardees = [l for l in lignes if not est_hors_facture(l.get("nom"))]
    ecartees = len(lignes) - len(gardees)
    if ecartees:
        print(f"{ecartees} document(s) ecarte(s) : ce ne sont pas des factures d'achat "
              f"(fiches de paie, releves, avis).")
    return gardees[:ECHANTILLON] if ECHANTILLON else gardees


# ── Lecture par Claude ────────────────────────────────────────────────────────

#: Mis a False si l'API refuse le schema ; on retombe alors sur une consigne
#  JSON en clair, pour qu'un lot de 1 500 factures ne tombe pas sur un detail
#  de schema.
_schema_accepte = True


def normaliser_reponse(valeur):
    """Ramene la reponse du modele a un objet, ou None.

    Le 04/11/2026, a la 202e facture d'un lot de 839, le modele a renvoye une
    LISTE au lieu d'un objet — probablement une facture portant plusieurs
    documents. L'appelant a fait `.get()` dessus et tout le lot est tombe, 637
    factures avant la fin.

    Une facture bancale ne doit pas tuer un lot. On prend le premier objet
    exploitable d'une liste, et on rend None pour tout le reste : la facture est
    alors comptee illisible, et le lot continue.
    """
    if isinstance(valeur, dict):
        return valeur
    if isinstance(valeur, list):
        for element in valeur:
            if isinstance(element, dict):
                return element
    return None


def lire_facture(client, pdf: bytes) -> dict | None:
    global _schema_accepte

    document = {"type": "document", "source": {
        "type": "base64", "media_type": "application/pdf",
        "data": base64.b64encode(pdf).decode(),
    }}

    def appeler(avec_schema: bool):
        consigne = CONSIGNE if avec_schema else (
            CONSIGNE + "\n\nReponds uniquement par un objet JSON, sans texte autour, avec les cles :"
            " fournisseur, tva_fournisseur, date_facture, montant, numero,"
            " note_de_credit, lisible."
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
            return normaliser_reponse(json.loads(texte))
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


RE_ISO = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
RE_BELGE = re.compile(r"^(0[1-9]|[12]\d|3[01])[-/](0[1-9]|1[0-2])[-/](20\d{2})$")


def normaliser_date(valeur):
    """Rend une date ISO, ou None. Le schema demande AAAA-MM-JJ ; le modele a
    renvoye « 13-10-2017 » sur une facture Belfius de 2017, et Postgres a
    refuse la ligne — emportant les 61 factures suivantes du lot. On convertit
    ce qu'on reconnait, on jette le reste plutot que de l'envoyer en base."""
    if not isinstance(valeur, str):
        return None
    v = valeur.strip()
    if RE_ISO.match(v):
        return v
    m = RE_BELGE.match(v)
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


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
    refusees = 0
    desaccords, dates_divergentes, mal_rangees = [], [], []
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
        except Exception as e:
            # Ceinture et bretelles. Un lot de 839 factures ne doit pas tomber
            # parce qu'une seule a surpris le lecteur : on la signale, on la
            # compte illisible, et on passe a la suivante.
            print(f"    erreur inattendue, facture ignoree : {type(e).__name__} : {e}", flush=True)
            illisibles += 1
            continue

        if not isinstance(extrait, dict) or not extrait.get("lisible"):
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

        # Un montant illisible ne doit pas faire jeter le reste : « 20250105 -
        # OPENAI - 60€.pdf » a rendu « OpenAI, LLC » et « n°34712550-0002 » avec
        # un montant inexploitable. Le fournisseur et le numero valent d'etre
        # gardes — c'est le montant seul qu'on laisse en l'etat.
        montant_exploitable = montant_plausible(apres)
        if not montant_exploitable:
            print("    montant non exploitable — fournisseur et numero conserves", flush=True)

        # Le MONTANT suit une regle prudente, trois cas dont un seul interdit
        # l'ecriture :
        #  - la base est vide            -> on remplit, c'est tout l'objet du script ;
        #  - la base porte un aberrant   -> on corrige, la valeur est fausse a coup sur ;
        #  - la base porte autre chose   -> on NE TRANCHE PAS. Ecraser 28,78 € par
        #    13,60 € sans que personne ne le voie serait la meme faute que celle
        #    qu'on repare : une donnee changee en silence.
        #
        # Cette regle ne vaut QUE pour le montant. Jusqu'au 04/11/2026 un
        # `continue` partait d'ici des que le montant en base etait deja juste —
        # c'est-a-dire dans la majorite des cas — et le fournisseur, le numero et
        # la TVA, qu'on venait pourtant de payer pour lire, etaient jetes avec.
        # On avait l'appel, on avait la reponse, et on n'en gardait rien.
        charge = {}
        if not montant_exploitable:
            pass                          # on ne touche pas au montant
        elif avant is None or montant_suspect(avant):
            charge["montant"] = apres
        elif abs(float(avant) - float(apres)) < 0.01:
            pass                          # deja juste : on n'y touche pas
        elif ECRASER:
            charge["montant"] = apres
        else:
            desaccords.append((ligne["nom"], float(avant), float(apres)))
            print("    DESACCORD de montant — laisse tel quel, a arbitrer", flush=True)

        # Le fournisseur et le numero etaient extraits puis JETES : la table
        # n'avait pas de colonnes pour les recevoir. Elles existent depuis le
        # 04/11/2026, et ce sont elles qui permettront de renommer le fichier
        # a partir de la base — jamais l'inverse.
        fournisseur = (extrait.get("fournisseur") or "").strip()
        if fournisseur and not ligne.get("fournisseur"):
            charge["fournisseur"] = fournisseur[:200]
        # BE 0123.456.789 / BE0123456789 / 0123456789 -> BE0123456789
        tva = re.sub(r"[^0-9A-Za-z]", "", (extrait.get("tva_fournisseur") or "")).upper()
        if re.fullmatch(r"(BE)?0?\d{9,10}", tva or ""):
            if not tva.startswith("BE"):
                tva = "BE" + tva
            if len(tva) == 11:                 # BE + 9 chiffres : le zero initial manque
                tva = "BE0" + tva[2:]
            if not ligne.get("tva_fournisseur"):
                charge["tva_fournisseur"] = tva
        numero = (extrait.get("numero") or "").strip()
        if numero and numero not in ("-", "n/a", "N/A") and not ligne.get("numero"):
            charge["numero"] = numero[:60]

        # A QUI la facture est adressee. On l'ecrit toujours, meme quand elle
        # concorde : c'est la preuve qu'on a verifie, et sans elle on relirait
        # le PDF a chaque passage.
        destinataire = (extrait.get("destinataire") or "").strip()
        tva_dest = normaliser_tva(extrait.get("tva_destinataire") or "")
        if destinataire:
            charge["destinataire"] = destinataire[:200]
        if tva_dest:
            charge["tva_destinataire"] = tva_dest

        etranger, motif = destinataire_etranger(ligne.get("societe"), destinataire, tva_dest)
        if etranger:
            charge["a_verifier"] = True
            charge["motif_verification"] = ("Mal rangee : " + motif)[:300]
            # Le nom du fichier affirme une societe qui n'est pas la bonne.
            # C'est le renommeur qui lui rendra son nom d'origine : il est le
            # seul a ecrire dans SharePoint, et ca doit le rester.
            mal_rangees.append((ligne["nom"], ligne.get("societe"), motif))
        # Meme regle pour la date que pour le montant : on comble un vide, on ne
        # remplace pas en silence. Les dates en base viennent du nom de fichier
        # et sont souvent justes a quelques jours pres ; les reecrire toutes
        # sans le dire serait exactement ce qu'on s'interdit pour les montants.
        date_pdf = normaliser_date(extrait.get("date_facture"))
        if date_pdf:
            if not ligne.get("date_facture"):
                charge["date_facture"] = date_pdf
            elif str(ligne["date_facture"]) != str(date_pdf):
                dates_divergentes.append((ligne["nom"], str(ligne["date_facture"]), date_pdf))
                if ECRASER:
                    charge["date_facture"] = date_pdf
        # TOUJOURS dater la lecture, meme quand elle n'apprend rien. Deduire
        # « lue » de fournisseur ou destinataire est faux : ces colonnes ont
        # le droit d'etre vides sur une facture parfaitement lue (un ticket
        # de caisse n'a pas de client nomme). On l'a appris en annoncant a
        # tort que PRIVE n'avait ete lu qu'a 19 %.
        charge["lu_le"] = "now()"

        if DRY_RUN:
            corriges += 1
            continue
        try:
            supabase("PATCH", f"factures_achat?id=eq.{ligne['id']}", charge,
                     {"Prefer": "return=minimal"})
        except urllib.error.HTTPError as e:
            # Un refus sur une ligne ne doit jamais emporter le lot entier :
            # c'est ce qui a coute 44 minutes et 61 factures le 03/11.
            print(f"    ECRITURE REFUSEE ({e.code}) : {e.read().decode()[:140]}", flush=True)
            refusees += 1
            continue
        corriges += 1

    print(f"\n{lus} lue(s), {corriges} {'a corriger' if DRY_RUN else 'corrigee(s)'}, "
          f"{illisibles} illisible(s), {ignores} trop lourde(s), "
          f"{refusees} refusee(s) en base, "
          f"{len(desaccords)} desaccord(s) de montant, "
          f"{len(dates_divergentes)} date(s) divergente(s), "
          f"{len(mal_rangees)} mal rangee(s).")

    if mal_rangees:
        print(f"\n{len(mal_rangees)} facture(s) adressee(s) a quelqu'un d'autre que la")
        print("societe de leur dossier. Marquees « a verifier » ; le renommage leur")
        print("rendra leur nom d'origine. A toi de les deplacer :")
        for nom, soc, motif in mal_rangees[:60]:
            print(f"  [{soc}] {nom[:60]}\n      {motif}")

    if desaccords:
        print(f"\n{len(desaccords)} facture(s) ou le PDF contredit la base. Rien n'a ete")
        print("ecrit sur celles-ci — elles demandent un arbitrage humain :")
        print(f"  {'base':>12} {'PDF':>12}   fichier")
        for nom, av, ap in desaccords[:40]:
            print(f"  {av:>12.2f} {ap:>12.2f}   {nom[:62]}")

    if dates_divergentes and not ECRASER:
        print(f"\n{len(dates_divergentes)} date(s) ou le PDF differe de la base "
              f"(celle-ci vient du nom de fichier). Conservees telles quelles ;")
        print("ECRASER=1 fait foi au PDF.")
        for nom, av, ap in dates_divergentes[:15]:
            print(f"  {av} -> {ap}   {nom[:58]}")
    if DRY_RUN:
        print("DRY_RUN : aucune ecriture en base. Aucun fichier n'a ete modifie dans aucun cas.")
    print(f"LIGNES_ECRITES={corriges}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
