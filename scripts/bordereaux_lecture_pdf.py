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

  report de solde            → paiement_precedent
  totaux hors report, débit  → total_debit     (primes dues à la compagnie)
  totaux hors report, crédit → total_credit    (commissions et encaissements)
  solde final SIGNÉ          → net   (+ = reçu par Dynassur, − = payé)
  cumul commissions          → commission
  communication structurée   → communication   ← la clé de rapprochement
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

# Un relevé de compte producteur dépasse rarement quelques mégaoctets. Au-delà,
# c'est une liasse scannée : on ne l'envoie pas, on la signale.
TAILLE_MAX = int(os.environ.get("TAILLE_MAX", str(12 * 1024 * 1024)))


SCHEMA = {
    "type": "object",
    "properties": {
        # ⚠️ PAS `{"type": ["string","null"], "enum": [...]}` : l'API refuse
        # (« Enum value 'RCP' does not match declared type »), le script bascule
        # alors sur la consigne libre — et le modèle répond « Bordereau Quittance
        # à terme » au lieu de « BQT ». Mesuré le 10/11 : les cinq écarts
        # « type lu ≠ nom du fichier » du premier essai venaient de là, pas des
        # documents. `anyOf` exprime la même chose et passe.
        "type_document": {
            "anyOf": [{"type": "string", "enum": ["RCP", "BQT"]}, {"type": "null"}],
            "description": "RCP = relevé de compte producteur (ce que le courtier reçoit). "
                           "BQT = bordereau de quittancement à terme (ce que les clients doivent).",
        },
        "periode": {"type": ["string", "null"],
                    "description": "Période du document au format AAAA-MM, ex. 2026-05"},
        "date_document": {"type": ["string", "null"], "description": "Date d'édition, AAAA-MM-JJ"},
        "compte_producteur": {"type": ["string", "null"],
                              "description": "Numéro de compte producteur du courtier, ex. 065610"},
        "report_solde": {"type": ["number", "null"],
                         "description": "Report de solde de la période précédente, en euros"},
        "total_primes": {
            "type": ["number", "null"],
            "description": "TOTAL DES PRIMES de la période, c'est-à-dire ce que les clients "
                           "doivent payer. Sur un bordereau de quittancement, c'est le total "
                           "de la colonne des primes (libellés vus : « Prime Totale », "
                           "« TOTAL »). Sur un relevé de compte, c'est la colonne DÉBIT de la "
                           "ligne de totaux. null si le document n'en présente aucun.",
        },
        "total_debit": {"type": ["number", "null"],
                        "description": "Ligne de totaux, colonne DÉBIT, si le document en a une. "
                                       "⚠️ Cette ligne n'est PAS toujours étiquetée : chez "
                                       "certaines compagnies ce sont deux montants nus, placés "
                                       "juste avant le bloc du solde."},
        "total_credit": {"type": ["number", "null"],
                         "description": "Ligne de totaux, colonne CRÉDIT, même remarque."},
        "solde_net": {
            "type": ["number", "null"],
            "description": "Solde final, SIGNÉ du point de vue du COURTIER : positif si le solde "
                           "est en faveur du COURTIER (la compagnie lui verse), négatif s'il "
                           "est en faveur de la COMPAGNIE (le courtier doit payer). "
                           "LES LIBELLÉS CHANGENT D'UNE COMPAGNIE À L'AUTRE, et même d'un "
                           "document à l'autre chez la même : « En notre faveur / En votre "
                           "faveur » (où « notre » = la compagnie qui édite), « en faveur de la "
                           "compagnie / du producteur », « En faveur de la Cie / En votre "
                           "faveur ». Ne te fie pas au mot : raisonne sur QUI doit payer QUI. "
                           "null si le document ne présente AUCUN solde — c'est le cas d'un "
                           "bordereau de quittancement, qui liste des primes dues et ne règle "
                           "rien.",
        },
        "commissions_periode": {"type": ["number", "null"],
                                "description": "Cumul des commissions de la période (du mois)"},
        "communication_structuree": {
            "type": ["string", "null"],
            "description": "Communication structurée de paiement, chiffres et barres obliques "
                           "uniquement, ex. 410/1065/61088. null si absente.",
        },
        "nb_lignes": {"type": ["integer", "null"],
                      "description": "Nombre de lignes de détail (polices / opérations)"},
        "lisible": {"type": "boolean",
                    "description": "false si le document est illisible ou n'est pas un bordereau"},
    },
    "required": ["type_document", "periode", "date_document", "compte_producteur",
                 "report_solde", "total_primes", "total_debit", "total_credit", "solde_net",
                 "commissions_periode", "communication_structuree", "nb_lignes", "lisible"],
    "additionalProperties": False,
}

CONSIGNE = """Ce PDF est un document de compte d'un courtier d'assurance belge.

Il est d'un de ces deux genres, et c'est la première chose à déterminer :

  RCP — un RELEVÉ DE COMPTE : la compagnie récapitule le mois écoulé et solde le
        compte du courtier. Il porte un report de solde, des écritures en débit
        et crédit, et un solde final.
  BQT — un BORDEREAU DE QUITTANCEMENT : la liste de ce que les clients DOIVENT
        payer pour la période à venir. Vu aussi sous les titres « bordereau de
        commissions » ou « état récapitulatif des invitations à payer ». Il ne
        règle rien et n'a donc normalement pas de solde.

Relève UNIQUEMENT les totaux et l'en-tête. N'additionne rien toi-même : reprends
les nombres tels qu'ils sont IMPRIMÉS.

⚠️ LES LIBELLÉS VARIENT D'UNE COMPAGNIE À L'AUTRE, et parfois d'un document à
l'autre chez la même compagnie. Certains documents posent leur ligne de totaux
SANS AUCUN LIBELLÉ — deux montants nus avant le bloc du solde. Ne cherche donc
pas un mot précis : cherche ce que chaque nombre SIGNIFIE à sa place dans le
document.

Attention au signe du solde, c'est le seul endroit où tu dois raisonner plutôt
que recopier. Un relevé est écrit du point de vue de la compagnie qui l'édite :
ce qui est « en sa faveur » est à payer PAR le courtier (donc négatif), ce qui
est en faveur « du producteur », « de l'agent » ou « vôtre » est versé AU
courtier (donc positif).

Beaucoup de documents sont des images scannées sans texte : lis-les comme une
image, le résultat attendu est le même.

Les montants belges s'écrivent « 10.845,19 » : point pour les milliers, virgule
pour les décimales. Rends 10845.19.

Si une valeur n'est pas imprimée, mets null. N'invente jamais un nombre."""

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
    chemin = (f"bordereaux?select=id,nom_fichier,type,annee,mois,compagnie,"
              f"sharepoint_item_id,net&annee=in.({annees}){filtre}"
              f"&sharepoint_item_id=not.is.null"
              f"&order=annee.desc,mois.desc,nom_fichier.asc")
    if ECHANTILLON:
        chemin += f"&limit={ECHANTILLON}"
    return supabase("GET", chemin) or []


# ── Lecture ───────────────────────────────────────────────────────────────

def lire_bordereau(client, pdf: bytes) -> dict | None:
    global _schema_accepte

    document = {"type": "document", "source": {
        "type": "base64", "media_type": "application/pdf",
        "data": base64.b64encode(pdf).decode(),
    }}

    def appeler(avec_schema: bool):
        consigne = CONSIGNE if avec_schema else (
            CONSIGNE + "\n\nRéponds uniquement par un objet JSON, sans texte autour, avec les"
            " clés : type_document, periode, date_document, compte_producteur, report_solde,"
            " total_primes, total_debit, total_credit, solde_net, commissions_periode,"
            " communication_structuree, nb_lignes, lisible."
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

        lu = lire_bordereau(client, pdf)
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
