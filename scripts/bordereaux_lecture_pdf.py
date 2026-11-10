#!/usr/bin/env python3
"""
Lecture des montants dans les bordereaux PDF → `bordereaux`.

POURQUOI. Sur 6 879 bordereaux en base, UN SEUL porte un montant. Le scan ne
lit que le nom du fichier : il sait qu'un relevé VIVIUM de mai 2026 existe, pas
ce qu'il contient. Tout ce qui dépend des chiffres — rapprochement avec les
virements de commissions, primes et commissions sur le contrat du client,
suivi des relevés manquants — travaille donc sur du vide.

CE QUE DISENT LES DEUX DOCUMENTS, et c'est la règle métier donnée par Ludovic
le 10/11/2026 :

  RCP — relevé de compte producteur. C'est CE QUE DYNASSUR REÇOIT. Il prouve
        que le client a payé, et la commission n'est acquise qu'à ce
        moment-là. C'est donc LUI, et lui seul, qu'on rapproche du virement.

  BQT — bordereau de quittancement à terme. C'est CE QUE LE CLIENT DOIT PAYER
        pour la période. Une attente, pas un encaissement : il sert à poser la
        prime et sa période sur le contrat du client, jamais à constater un
        paiement.

Ce script lit les TOTAUX, pas le détail ligne à ligne. Le détail par police
(qui alimentera `quittances`) est un second étage, et il ne sert à rien tant
que les totaux ne tombent pas juste.

CE QU'IL EXTRAIT, et où ça va :

  Sur un RELEVÉ (RCP) :
    report de solde            → paiement_precedent
    totaux hors report, débit  → total_debit   ET montant
    totaux hors report, crédit → total_credit
    solde final SIGNÉ          → net   (+ = reçu par Dynassur, − = payé)

  Sur un BORDEREAU (BQT) :
    total des primes           → montant
    (ni report, ni solde : un bordereau ne règle rien)

  Dans les deux cas :
    cumul commissions          → commission
    communication structurée   → communication
    date du document           → date_cloture
    nombre de lignes           → nb_polices

LA COMMUNICATION STRUCTURÉE EST LE VRAI GAIN. Un montant peut coïncider par
hasard — deux compagnies qui versent 1 240,00 € le même mois, et le
rapprochement se trompe sans rien dire. Une communication structurée, non :
elle porte un modulo 97 et désigne un relevé précis. 462 transactions en
portent une.

CE QU'IL NE FAIT PAS, ET NE DOIT JAMAIS FAIRE :
  - aucun fichier n'est renommé, déplacé ni supprimé. Que des GET vers Graph ;
  - aucune ligne n'est supprimée en base ;
  - `transaction_id` n'est JAMAIS envoyé. Lire un montant n'est pas rapprocher,
    et mélanger les deux ferait d'une lecture ratée un lien faux.

Variables d'environnement :
  ANTHROPIC_API_KEY                                 clé API Claude
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET
  SUPABASE_URL, SUPABASE_SERVICE_KEY                voir scripts/_env.py
  DRY_RUN=1        lit et affiche, n'écrit rien
  ANNEES=2026      années à traiter, séparées par des virgules (défaut 2026)
  ECHANTILLON=50   nombre de bordereaux par passage ; 0 = tous
  RELIRE=1         reprendre aussi ceux qui portent déjà un montant
  MODELE_CLAUDE    défaut claude-haiku-5-5
"""
import base64
import datetime
import json
import os
import re
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
ECHANTILLON = int(os.environ.get("ECHANTILLON", "50") or 0)
RELIRE = os.environ.get("RELIRE", "") == "1"
ANNEES = [a.strip() for a in os.environ.get("ANNEES", "2026").split(",") if a.strip()]
# TYPE=RCP ou BQT restreint le lot. Sert à éprouver un genre de document à
# part : l'ordre naturel (année puis mois décroissants) a donné douze BQT
# d'affilée au premier essai, et le solde — qui n'existe que sur un relevé —
# n'avait donc jamais été lu une seule fois.
TYPE = os.environ.get("TYPE", "").strip().upper()

# 20 Mo, et la borne vient de l'API, pas d'une intuition : une requête est
# plafonnée à 32 Mo et le base64 gonfle le fichier d'un tiers. 20 Mo de PDF
# font environ 26,7 Mo encodés — ça passe, 25 Mo ne passeraient pas.
#
# La limite précédente (12 Mo) écartait un scan DKV de 17,7 Mo, qui était
# retéléchargé à chaque passage pour être rejeté à chaque fois.
TAILLE_MAX = int(os.environ.get("TAILLE_MAX", str(20 * 1024 * 1024)))


# ══════════════════════════════════════════════════════════════════════════
# DEUX GENRES DE DOCUMENT, DEUX EXTRACTIONS. Ne pas les mélanger.
#
# C'est l'erreur du 10/11, et elle est instructive : j'avais écrit UNE consigne
# pour les deux, avec le repère « une commission vaut 5 à 25 % des primes ».
# C'est vrai sur un bordereau de quittancement. C'est FAUX sur un relevé de
# compte : sur le relevé VIVIUM 05-2026, les totaux hors report valent 11 739,67
# au débit et le cumul des commissions 11 592,12 — soit 98,7 %. Le débit d'un
# relevé n'est pas « les primes », ce sont les mouvements du mois.
#
# Résultat mesuré : les RCP sont passés de lisibles à 4 lus sur 12, instables
# d'un passage à l'autre, et mon garde-fou de taux criait au loup sur des
# documents parfaitement normaux. Un repère juste appliqué hors de son domaine
# fait plus de dégâts qu'une absence de repère.
# ══════════════════════════════════════════════════════════════════════════

_COMMUN = {
    "periode": {"type": ["string", "null"],
                "description": "Période du document au format AAAA-MM, ex. 2026-05"},
    "date_document": {"type": ["string", "null"], "description": "Date d'édition, AAAA-MM-JJ"},
    "compte_producteur": {"type": ["string", "null"],
                          "description": "Numéro de compte producteur / d'agent du courtier"},
    "commissions_periode": {"type": ["number", "null"],
                            "description": "Cumul des commissions de la PÉRIODE (du mois), tel "
                                           "qu'imprimé. Pas le cumul annuel."},
    "communication_structuree": {
        "type": ["string", "null"],
        "description": "Communication structurée de paiement, forme 000/0000/00000, souvent "
                       "entre +++ ou ***. Beaucoup de compagnies n'en impriment aucune : "
                       "null dans ce cas, ne la déduis jamais d'un autre numéro.",
    },
    "nb_lignes": {"type": ["integer", "null"],
                  "description": "Nombre de lignes de détail"},
    "lisible": {"type": "boolean",
                "description": "false si le document est illisible ou n'est pas un bordereau"},
}

SCHEMA_RCP = {
    "type": "object",
    "properties": {
        **_COMMUN,
        "type_document": {
            "anyOf": [{"type": "string", "enum": ["RCP", "BQT"]}, {"type": "null"}],
            "description": "RCP si c'est bien un relevé de compte ; BQT si le document est en "
                           "réalité un bordereau de quittancement malgré ce qu'on t'a annoncé.",
        },
        "report_solde": {"type": ["number", "null"],
                         "description": "Report du solde de la période précédente. Libellés vus : "
                                        "« Report solde », « REPORT DU MOIS PRECEDENT »."},
        "total_debit": {"type": ["number", "null"],
                        "description": "Ligne de totaux, colonne DÉBIT, HORS report. "
                                       "⚠️ Cette ligne n'est pas toujours étiquetée : chez "
                                       "certaines compagnies ce sont deux montants nus juste "
                                       "avant le bloc du solde."},
        "total_credit": {"type": ["number", "null"],
                         "description": "Ligne de totaux, colonne CRÉDIT, hors report."},
        "solde_net": {
            "type": ["number", "null"],
            "description": "Solde final du relevé, SIGNÉ du point de vue du COURTIER : positif "
                           "si la compagnie verse au courtier, négatif si le courtier doit "
                           "payer la compagnie. Les libellés changent d'une compagnie à "
                           "l'autre : « En notre faveur / En votre faveur » (où « notre » est "
                           "la compagnie qui édite), « en faveur de la compagnie / du "
                           "producteur », « En faveur de la Cie / En votre faveur ». Ne te fie "
                           "pas au mot : raisonne sur QUI doit payer QUI.",
        },
    },
    "required": ["type_document", "periode", "date_document", "compte_producteur",
                 "report_solde", "total_debit", "total_credit", "solde_net",
                 "commissions_periode", "communication_structuree", "nb_lignes", "lisible"],
    "additionalProperties": False,
}

SCHEMA_BQT = {
    "type": "object",
    "properties": {
        **_COMMUN,
        "type_document": {
            "anyOf": [{"type": "string", "enum": ["RCP", "BQT"]}, {"type": "null"}],
            "description": "BQT si c'est bien un bordereau de quittancement ; RCP si le "
                           "document est en réalité un relevé de compte malgré ce qu'on t'a "
                           "annoncé.",
        },
        "total_primes": {
            "type": ["number", "null"],
            "description": "TOTAL DES PRIMES de la période : ce que les clients doivent payer, "
                           "taxes comprises. Libellés vus : « Prime Totale », « TOTAL ». "
                           "La commission en est une fraction, de l'ordre de 5 à 25 % : si le "
                           "nombre que tu donnes ici est proche de la commission, tu as "
                           "confondu deux colonnes.",
        },
    },
    "required": ["type_document", "periode", "date_document", "compte_producteur",
                 "total_primes", "commissions_periode", "communication_structuree",
                 "nb_lignes", "lisible"],
    "additionalProperties": False,
}

_PREAMBULE = """Ce PDF est un document de compte d'un courtier d'assurance belge.

Relève UNIQUEMENT les totaux et l'en-tête. N'additionne rien toi-même : reprends
les nombres tels qu'ils sont IMPRIMÉS.

⚠️ LES LIBELLÉS VARIENT D'UNE COMPAGNIE À L'AUTRE, et parfois d'un document à
l'autre chez la même compagnie. Certains documents posent leur ligne de totaux
SANS AUCUN LIBELLÉ — deux montants nus. Ne cherche donc pas un mot précis :
cherche ce que chaque nombre SIGNIFIE à sa place dans le document.

Beaucoup de documents sont des images scannées sans couche de texte : lis-les
comme une image, le résultat attendu est le même.

Les montants belges s'écrivent « 10.845,19 » : point pour les milliers, virgule
pour les décimales. Rends 10845.19.

Si une valeur n'est pas imprimée, mets null — JAMAIS zéro. Un zéro se lit comme
une mesure ; il n'est juste que s'il est réellement imprimé. N'invente aucun
nombre."""

CONSIGNE_RCP = _PREAMBULE + """

Ce document devrait être un RELEVÉ DE COMPTE PRODUCTEUR : la compagnie
récapitule le mois écoulé et solde le compte du courtier. Il porte un report de
solde, des écritures en débit et crédit, et un solde final.

⚠️ Sur ce genre de document, le total au débit n'est PAS « le total des
primes » : ce sont les mouvements du mois. Il peut être très proche du cumul des
commissions, et c'est normal — ne corrige rien pour les écarter l'un de l'autre.

Le signe du solde est le seul endroit où tu dois raisonner plutôt que recopier."""

CONSIGNE_BQT = _PREAMBULE + """

Ce document devrait être un BORDEREAU DE QUITTANCEMENT : la liste de ce que les
clients DOIVENT payer pour la période. Vu aussi sous les titres « bordereau de
commissions » ou « état récapitulatif des invitations à payer ».

Il ne règle rien : il n'a donc normalement ni report de solde, ni solde final.
Ce qu'on en attend, c'est le total des primes et le total des commissions."""

_schema_accepte = True


# ── Microsoft Graph (lecture seule) ───────────────────────────────────────

def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=30) as r:
        return json.loads(r.read().decode())["access_token"]


def site_id(jeton: str) -> str:
    req = urllib.request.Request(f"{GRAPH}/sites/{SITE}",
                                 headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["id"]


def telecharger(jeton: str, sid: str, item_id: str) -> bytes | None:
    """GET du contenu. La SEULE opération de ce script sur SharePoint."""
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{item_id}/content",
        headers={"Authorization": f"Bearer {jeton}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        print(f"    téléchargement impossible ({e.code})", flush=True)
        return None


# ── Supabase ──────────────────────────────────────────────────────────────

def supabase(methode: str, chemin: str, charge=None):
    url = f"{SUPABASE_URL}/rest/v1/{chemin}"
    entetes = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    data = json.dumps(charge).encode() if charge is not None else None
    req = urllib.request.Request(url, data=data, method=methode, headers=entetes)
    with urllib.request.urlopen(req, timeout=60) as r:
        brut = r.read().decode()
        return json.loads(brut) if brut else None


def a_lire() -> list[dict]:
    """Les bordereaux des années demandées dont le montant manque.

    L'ordre est volontaire : l'année la plus récente d'abord, puis le mois le
    plus récent. Si le passage est interrompu, ce qui est traité est ce qui
    sert — le rapprochement bancaire ne remonte pas avant 2025.
    """
    annees = ",".join(ANNEES)
    # CE QUI MARQUE « DÉJÀ LU », C'EST `extrait_le`, PAS `net`.
    #
    # Un BQT n'a pas de solde : il liste des primes dues et ne règle rien, donc
    # `net` y reste nul légitimement. Filtrer sur `net` ferait relire les mêmes
    # bordereaux de quittancement à chaque passage, indéfiniment, sans que rien
    # ne le signale.
    filtre = "" if RELIRE else "&extrait_le=is.null"
    if TYPE in ("RCP", "BQT"):
        filtre += f"&type=eq.{TYPE}"
    chemin = (f"bordereaux?select=id,nom_fichier,type,annee,mois,compagnie,"
              f"sharepoint_item_id,net&annee=in.({annees}){filtre}"
              f"&sharepoint_item_id=not.is.null"
              f"&order=annee.desc,mois.desc,nom_fichier.asc")
    if ECHANTILLON:
        chemin += f"&limit={ECHANTILLON}"
    return supabase("GET", chemin) or []


# ── Lecture ───────────────────────────────────────────────────────────────

def lire_bordereau(client, pdf: bytes, genre: str) -> dict | None:
    """`genre` vient du NOM du fichier, qui suit la convention et dit RCP ou BQT.
    Le modèle peut contredire cette annonce — c'est même utile, c'est comme ça
    qu'on a trouvé un BQT qui contenait un relevé — mais la consigne part de ce
    que le document est censé être."""
    global _schema_accepte

    schema = SCHEMA_BQT if genre == "BQT" else SCHEMA_RCP
    base = CONSIGNE_BQT if genre == "BQT" else CONSIGNE_RCP
    cles = ", ".join(schema["required"])

    document = {"type": "document", "source": {
        "type": "base64", "media_type": "application/pdf",
        "data": base64.b64encode(pdf).decode(),
    }}

    def appeler(avec_schema: bool):
        consigne = base if avec_schema else (
            base + "\n\nRéponds uniquement par un objet JSON, sans texte autour, avec les"
            f" clés : {cles}."
        )
        # EFFORT « medium », PAS « low ». Mesuré le 10/11 : à « low », le même
        # bordereau BALOISE lu deux fois donnait 40 742,74 de primes la
        # première fois et 7 314,95 la seconde — la valeur de la commission,
        # décalée d'une colonne. Un document lu deux fois doit donner deux
        # fois la même chose, sinon aucune des deux lectures ne vaut rien.
        options = {"effort": "medium"}
        if avec_schema:
            options["format"] = {"type": "json_schema", "schema": schema}
        return client.messages.create(
            model=MODELE, max_tokens=1024, output_config=options,
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
        texte = bloc.text.strip()
        try:
            return json.loads(texte)
        except json.JSONDecodeError:
            debut, fin = texte.find("{"), texte.rfind("}")
            if debut >= 0 and fin > debut:
                try:
                    return json.loads(texte[debut:fin + 1])
                except json.JSONDecodeError:
                    pass
            return None
    return None


RE_ISO = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
RE_PERIODE = re.compile(r"^(20\d{2})-(0[1-9]|1[0-2])$")
RE_COMM = re.compile(r"^(\d{3})/?(\d{4})/?(\d{5})$")


def modulo97(chiffres: str) -> bool:
    """Une communication structurée belge porte sa propre vérification : les
    deux derniers chiffres sont le reste de la division des dix premiers par
    97 (00 valant 97). C'est ce qui en fait une clé sûre — une faute de
    lecture d'un seul chiffre est détectée ici, pas trois étapes plus loin."""
    if len(chiffres) != 12 or not chiffres.isdigit():
        return False
    reste = int(chiffres[:10]) % 97
    return int(chiffres[10:]) == (reste or 97)


def communication_propre(brut: str | None) -> str | None:
    if not brut:
        return None
    chiffres = re.sub(r"\D", "", brut)
    if len(chiffres) != 12 or not modulo97(chiffres):
        return None
    return chiffres


def charge_utile(lu: dict, ligne: dict) -> dict | None:
    """Traduit la lecture en colonnes. Rend None si rien d'exploitable.

    Règle : on n'écrit que ce qui a été LU. Une valeur absente reste nulle —
    jamais zéro. Un zéro se lit comme une mesure, et un solde à zéro n'est pas
    la même chose qu'un solde qu'on n'a pas su lire.
    """
    if not lu or not lu.get("lisible"):
        return None

    charge: dict = {}

    for cle_lue, colonne in (("report_solde", "paiement_precedent"),
                             ("total_debit", "total_debit"),
                             ("total_primes", "montant"),
                             ("total_credit", "total_credit"),
                             ("solde_net", "net"),
                             ("commissions_periode", "commission"),
                             ("nb_lignes", "nb_polices")):
        valeur = lu.get(cle_lue)
        if isinstance(valeur, (int, float)):
            charge[colonne] = valeur

    # `montant` garde le sens qu'il a déjà en base sur la seule ligne remplie :
    # le total des primes. Un relevé de compte le porte dans sa colonne débit,
    # un bordereau de quittancement dans son total de primes — d'où le repli.
    for cle in ("total_primes", "total_debit"):
        if isinstance(lu.get(cle), (int, float)):
            charge["montant"] = lu[cle]
            break

    comm = communication_propre(lu.get("communication_structuree"))
    if comm:
        charge["communication"] = comm
    elif lu.get("communication_structuree"):
        print("    communication structurée rejetée (modulo 97) : "
              f"{lu['communication_structuree']!r}", flush=True)

    date = lu.get("date_document")
    if isinstance(date, str) and RE_ISO.match(date):
        charge["date_cloture"] = date

    if not charge:
        return None
    # PostgREST n'évalue pas `now()` : une chaîne « now() » partirait telle
    # quelle et serait refusée. L'horodatage est donc posé ici.
    charge["extrait_le"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return charge


def coherence(lu: dict, ligne: dict) -> list[str]:
    """Les écarts qu'on signale sans refuser l'écriture.

    Un désaccord entre le nom du fichier et le contenu du PDF n'est pas une
    raison de jeter la lecture : c'est une raison de la montrer. Le document
    a raison plus souvent que le nom, mais pas toujours, et c'est un humain
    qui tranche.
    """
    ecarts = []
    periode = lu.get("periode")
    if isinstance(periode, str) and RE_PERIODE.match(periode):
        attendu = f"{ligne['annee']}-{str(ligne['mois']).zfill(2)}"
        if periode != attendu:
            ecarts.append(f"période lue {periode} ≠ nom du fichier {attendu}")

    lu_type = lu.get("type_document")
    if lu_type and ligne.get("type") and lu_type != ligne["type"]:
        ecarts.append(f"type lu {lu_type} ≠ nom du fichier {ligne['type']}")

    net = lu.get("solde_net")
    if ligne.get("type") == "RCP" and isinstance(net, (int, float)) and net < 0:
        ecarts.append(f"RCP au solde négatif ({net:.2f}) — un relevé est normalement reçu")

    # LE TAUX DE COMMISSION DÉTECTE UNE COLONNE DÉCALÉE — SUR UN BQT SEULEMENT.
    #
    # Sur un bordereau de quittancement, la commission est une fraction des
    # primes ; au-delà de 40 %, ce sont deux colonnes confondues (vu le 10/11
    # sur un bordereau BALOISE : 89 %).
    #
    # ⚠️ Sur un RELEVÉ, ce contrôle est FAUX et crie au loup : le total au
    # débit n'est pas « les primes » mais les mouvements du mois, et il peut
    # être quasi égal au cumul des commissions. Sur le relevé VIVIUM 05-2026 :
    # 11 592,12 de commissions pour 11 739,67 au débit, soit 98,7 % — et le
    # document est parfaitement normal.
    if (ligne.get("type") or "").upper() != "BQT":
        return ecarts
    primes = lu.get("total_primes")
    comm = lu.get("commissions_periode")
    if isinstance(primes, (int, float)) and isinstance(comm, (int, float)) and primes > 0:
        taux = comm / primes
        if taux > 0.40:
            ecarts.append(f"taux de commission invraisemblable : {comm:.2f} sur {primes:.2f} "
                          f"= {taux:.0%} — colonnes probablement confondues")
    return ecarts


def main() -> int:
    banniere("bordereaux_lecture_pdf")
    manquants = [n for n, v in (("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY")),
                                ("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET),
                                ("SUPABASE_URL", SUPABASE_URL),
                                ("SUPABASE_SERVICE_KEY", SUPABASE_SERVICE_KEY)) if not v]
    if manquants:
        print(f"::error::Variables manquantes : {', '.join(manquants)}")
        return 1

    lignes = a_lire()
    print(f"{len(lignes)} bordereau(x) à lire — années {', '.join(ANNEES)}"
          f"{' · type ' + TYPE if TYPE else ''}"
          f"{' (relecture)' if RELIRE else ''}", flush=True)
    if not lignes:
        print("LIGNES_LUES=0", flush=True)
        return 0

    jeton = jeton_graph()
    sid = site_id(jeton)
    client = anthropic.Anthropic()

    lus = ecrits = illisibles = signales = 0
    for ligne in lignes:
        print(f"  {ligne['nom_fichier']}", flush=True)
        pdf = telecharger(jeton, sid, ligne["sharepoint_item_id"])
        if not pdf:
            illisibles += 1
            continue
        if len(pdf) > TAILLE_MAX:
            illisibles += 1
            print(f"    ignoré : {len(pdf) // 1024} Ko, au-delà de la limite de lecture",
                  flush=True)
            continue

        lu = lire_bordereau(client, pdf, (ligne.get("type") or "").upper())
        if not lu:
            illisibles += 1
            continue
        lus += 1

        for ecart in coherence(lu, ligne):
            signales += 1
            print(f"    ::warning::{ligne['nom_fichier']} — {ecart}", flush=True)

        charge = charge_utile(lu, ligne)
        if not charge:
            # Horodater quand même, sinon ce document repasse à chaque fois et
            # consomme le lot au détriment de ceux qui n'ont jamais été vus.
            # Il est signalé, pas oublié : `extrait_le` rempli et tout le reste
            # nul, c'est précisément la signature d'un document illisible.
            illisibles += 1
            print("    ::warning::aucun montant exploitable — document à regarder", flush=True)
            if not DRY_RUN:
                try:
                    supabase("PATCH", f"bordereaux?id=eq.{ligne['id']}",
                             {"extrait_le": datetime.datetime.now(
                                 datetime.timezone.utc).isoformat()})
                except urllib.error.HTTPError:
                    pass
            continue

        apercu = (f"{lu.get('type_document') or '?'} {lu.get('periode') or '?'} · "
                  f"primes {charge.get('montant', '—')} · "
                  f"commission {charge.get('commission', '—')} · "
                  f"solde {charge.get('net', '—')} · "
                  f"comm. {charge.get('communication', '—')}")
        if DRY_RUN:
            print(f"    [essai] {apercu}", flush=True)
            ecrits += 1
            continue
        try:
            supabase("PATCH", f"bordereaux?id=eq.{ligne['id']}", charge)
            ecrits += 1
            print(f"    {apercu}", flush=True)
        except urllib.error.HTTPError as e:
            print(f"::warning::écriture refusée ({e.code}) : {e.read().decode()[:200]}",
                  flush=True)

    print(f"\n{lus} lu(s), {ecrits} écrit(s), {illisibles} sans montant exploitable, "
          f"{signales} écart(s) signalé(s)"
          f"{' [essai]' if DRY_RUN else ''}", flush=True)
    print(f"LIGNES_LUES={ecrits}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
