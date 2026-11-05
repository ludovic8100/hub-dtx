#!/usr/bin/env python3
"""
HUB DTX — Synchronisation clients BRIO (Qlik, table Preneur) -> Supabase.

Grain : 1 ligne par DOSSIER (= champ Qlik "Numéro"), en retenant le preneur
PRINCIPAL du dossier (NumeroUnique le plus bas, via FirstSortedValue).
Le dossier est reconstruit depuis "Numéro" en insérant "/" avant les 2 derniers
chiffres (800 -> 8/00 ; 59400 -> 594/00 ; 1201 -> 12/01).
Le nom complet "NOM Prénom" est scindé : la séquence de tokens en MAJUSCULES =
nom, le reste = prénom.

Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1 pour test sans écriture).
"""
import os, json, ssl, sys, urllib.request, datetime, unicodedata
from websocket import create_connection

QLIK_HOST   = os.environ.get("QLIK_HOST",  "h6las9b8umw8ppb.eu.qlikcloud.com")
QLIK_APP_ID = os.environ.get("QLIK_APP_ID","111414a5-e645-4397-8311-9bed88033407")
QLIK_KEY    = os.environ.get("QLIK_API_KEY", "")
from _env import SUPABASE_URL as SUPA_URL  # voir scripts/_env.py
SUPA_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
DRY_RUN     = os.environ.get("DRY_RUN") == "1"

# (expression Qlik triée sur le preneur principal, colonne Supabase, type)
FSV = lambda f: f"=FirstSortedValue([{f}], NumeroUnique)"
MEAS = [
    (FSV("Nom Prénom"),                "_nom_prenom",   "text"),
    (FSV("Email"),                     "email",         "text"),
    (FSV("Téléphone"),                 "gsm",           "text"),
    (FSV("Pr.Rue"),                    "rue",           "text"),
    (FSV("Pr.No rue"),                 "num_maison",    "text"),
    (FSV("Pr.Boîte"),                  "boite",         "text"),
    (FSV("Postcode"),                  "cp",            "text"),
    (FSV("Pr.Localité"),               "localite",      "text"),
    ("=Date(FirstSortedValue([Date_Naissance], NumeroUnique))", "date_naissance", "date"),
    (FSV("Etat civil"),                "etat_civil",    "text"),
    (FSV("Sexe"),                      "sexe",          "text"),
    (FSV("Gestionnaire (Preneurs)"),   "gestionnaire_nom", "text"),
    (FSV("Sous-agent (Preneurs)"),     "sa_nom",        "text"),
    (FSV("Classe"),                    "classe",        "text"),
    (FSV("OfficeIDPreneur"),           "bureau",        "text"),
]


def call(ws, method, handle, params, _id):
    ws.send(json.dumps({"jsonrpc": "2.0", "id": _id, "method": method, "handle": handle, "params": params}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == _id:
            if "error" in m:
                raise RuntimeError(f"{method}: {m['error']}")
            return m


def na(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().strip()


def dossier_from_numero(txt):
    s = (txt or "").strip().replace(".", "").replace(" ", "")
    if not s.isdigit():
        return None
    return (s[:-2] + "/" + s[-2:]) if len(s) >= 3 else s


SOC = {"SPRL", "SRL", "SA", "SCRL", "SCRI", "ASBL", "AISBL", "SPRLU", "BVBA", "NV",
       "SC", "SCS", "SNC", "SCOMM", "COMM", "SCA", "GIE", "SE", "SACS", "VOF"}


def split_nom(full):
    """ Brio = NOM Prénom. 3 cas :
        - société (suffixe juridique) -> tout en nom
        - préfixe MAJUSCULES suivi d'autre casse (NOM Prénom, VAN MUYLDER Michael)
        - sinon (tout majuscule ou tout en minuscule) -> 1er token = nom, reste = prénom """
    if not full:
        return (None, None)
    toks = full.split()
    if any(t.upper().strip(".") in SOC for t in toks):
        return (full.strip(), None)
    if len(toks) == 1:
        return (full.strip(), None)
    # préfixe en MAJUSCULES (gère les noms composés VAN MUYLDER)
    k = 0
    while k < len(toks) and toks[k] == toks[k].upper() and any(c.isalpha() for c in toks[k]):
        k += 1
    if 0 < k < len(toks):
        return (" ".join(toks[:k]), " ".join(toks[k:]) or None)
    # tout même casse -> convention Brio : nom d'abord, prénom ensuite
    return (toks[0], " ".join(toks[1:]) or None)


def qnum_to_date(qnum, txt=None):
    """Date depuis le numero de serie Qlik/Excel (epoque 1899-12-30), insensible
    a la locale. Corrige l'inversion jour/mois du parsing texte (Qlik sort ses
    dates en format americain M/J via =Date(...)). Fallback texte si pas de qNum."""
    try:
        if qnum is not None and str(qnum) not in ("NaN", ""):
            n = float(qnum)
            if n > 0:
                import datetime as _dt
                return (_dt.date(1899, 12, 30) + _dt.timedelta(days=int(round(n)))).isoformat()
    except (ValueError, TypeError):
        pass
    return parse_date(txt)


def parse_date(txt):
    if not txt:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(txt.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def extract():
    ws = create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",
                           header=[f"Authorization: Bearer {QLIK_KEY}"],
                           timeout=90, sslopt={"cert_reqs": ssl.CERT_NONE})
    _id = [0]
    def c(m, h, p):
        _id[0] += 1
        return call(ws, m, h, p, _id[0])
    doc = c("OpenDoc", -1, [QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    obj = c("CreateSessionObject", doc, [{
        "qInfo": {"qType": "cli"},
        "qHyperCubeDef": {
            "qDimensions": [{"qDef": {"qFieldDefs": ["Numéro"]}}],
            "qMeasures": [{"qDef": {"qDef": e}} for e, _, _ in MEAS],
            "qInitialDataFetch": [{"qTop": 0, "qLeft": 0, "qWidth": 1 + len(MEAS), "qHeight": 1}],
        },
    }])["result"]["qReturn"]["qHandle"]
    total = c("GetLayout", obj, [])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    W = 1 + len(MEAS)
    page = max(1, 10000 // W)
    out, top = [], 0
    while top < total:
        data = c("GetHyperCubeData", obj, ["/qHyperCubeDef", [{"qTop": top, "qLeft": 0, "qWidth": W, "qHeight": page}]])
        matrix = data["result"]["qDataPages"][0]["qMatrix"]
        if not matrix:
            break
        for row in matrix:
            dossier = dossier_from_numero(row[0].get("qText"))
            if not dossier:
                continue
            rec = {"dossier": dossier}
            for i, (_, col, kind) in enumerate(MEAS):
                v = (row[i + 1].get("qText") or "").strip()
                if kind == "date":
                    rec[col] = qnum_to_date(row[i + 1].get("qNum"), v)
                else:
                    rec[col] = v or None
            nom, prenom = split_nom(rec.pop("_nom_prenom"))
            rec["nom"], rec["prenom"] = (nom.upper() if nom else None), (prenom.upper() if prenom else None)
            out.append(rec)
        top += len(matrix)
    ws.close()
    return out


def load_code_map():
    """ nom de famille (normalisé) -> code, d'après la liste équipe du Hub.
        (la table collaborateurs n'étant pas peuplée) """
    return {
        "DETILLOUX": "LDE", "GODFROID": "GGO", "JAPSENNE": "TJA", "JASPENNE": "TJA",
        "FERNANDEZ": "PFQ", "QUIROGA": "PFQ", "TERRANA": "MTE", "HURARD": "BHU",
        "GINIS": "NGI", "BLAIRON": "FBL", "SIMONIS": "JFS", "MAMMO": "FMZ",
        "CEZAR": "ICE", "CEZASSUR": "ICE", "COCO": "DCO", "CARREA": "RCA",
        "MUYLDER": "MVM", "PESSER": "VPE", "MUNOZ": "LGM", "GAEN": "LGM",
        "BAUDELET": "OBA", "DESCLEZ": "RDE", "FICARROTTA": "RFI", "FICCAROTTA": "RFI",
        "HOMELINKS": "HML",
    }


def map_code(name, code_map):
    if not name:
        return None
    for tok in na(name).split():
        if len(tok) >= 4 and tok in code_map:
            return code_map[tok]
    return None


def charger_attributions():
    """Les dossiers reattribues DANS LE HUB, qui priment sur Brio.

    SANS CETTE LECTURE, LA REATTRIBUTION NE SERVIRAIT A RIEN. Cette synchro
    recalcule gestionnaire_code et sa_code a partir des NOMS venus de Brio, a
    chaque passage. Un gestionnaire remplace dans le Hub le soir reprenait donc
    ses clients le lendemain matin, sans que personne ne comprenne pourquoi.

    Une ligne retiree de clients_attribution rend simplement le dossier a Brio.
    """
    url = (f"{SUPA_URL}/rest/v1/clients_attribution"
           "?select=dossier,gestionnaire_code,sa_code")
    req = urllib.request.Request(url, headers={
        "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            lignes = json.loads(r.read().decode())
    except Exception as e:                      # noqa: BLE001
        # On prefere ARRETER : ecrire en ignorant les exceptions reecrirait en
        # silence des attributions decidees a la main.
        sys.exit(f"::error::Lecture de clients_attribution impossible ({e}). "
                 "Arret : poursuivre ecraserait les reattributions du Hub.")
    return {l["dossier"]: l for l in lignes}


def appliquer_attributions(rows, attributions):
    """Le Hub a le dernier mot sur les dossiers qu'il a reattribues."""
    touches = 0
    for r in rows:
        a = attributions.get(r.get("dossier"))
        if not a:
            continue
        if a.get("gestionnaire_code"):
            r["gestionnaire_code"] = a["gestionnaire_code"]
        if a.get("sa_code"):
            r["sa_code"] = a["sa_code"]
        touches += 1
    return touches


def upsert(rows):
    url = f"{SUPA_URL}/rest/v1/clients?on_conflict=dossier"
    headers = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
               "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=minimal"}
    B = 500
    for i in range(0, len(rows), B):
        batch = rows[i:i + B]
        req = urllib.request.Request(url, data=json.dumps(batch).encode(), headers=headers, method="POST")
        urllib.request.urlopen(req)
        print(f"  upsert {i + len(batch)}/{len(rows)}")


def main():
    if not QLIK_KEY:
        sys.exit("QLIK_API_KEY manquant")
    print("Extraction Preneur (preneur principal par dossier)…")
    rows = extract()
    print(f"  {len(rows)} dossiers clients")
    # mapping codes gestionnaire / sous-agent
    cm = load_code_map()
    mapped_g = mapped_s = 0
    for r in rows:
        r["gestionnaire_code"] = map_code(r.get("gestionnaire_nom"), cm)
        r["sa_code"] = map_code(r.get("sa_nom"), cm)
        mapped_g += bool(r["gestionnaire_code"]); mapped_s += bool(r["sa_code"])
    # Les reattributions du Hub ecrasent ce que Brio dit, et seulement pour
    # les dossiers concernes.
    if SUPA_KEY:
        attributions = charger_attributions()
        n = appliquer_attributions(rows, attributions)
        print(f"  reattributions du Hub respectees : {n}/{len(attributions)} dossier(s)")

    if DRY_RUN:
        print(f"  codes gestionnaire mappés : {mapped_g}/{len(rows)} | sous-agent : {mapped_s}/{len(rows)}")
        print("  Exemples (dossier | nom | prénom | cp | localité | gest -> code) :")
        for r in rows[:12]:
            print(f"   {r['dossier']:9} | {r.get('nom'):22} | {str(r.get('prenom'))[:14]:14} | {str(r.get('cp')):5} | {str(r.get('localite'))[:16]:16} | {str(r.get('gestionnaire_nom'))[:18]:18} -> {r.get('gestionnaire_code')}")
        print("DRY_RUN — aucune écriture.")
        return
    if not SUPA_KEY:
        sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Upsert clients vers Supabase…")
    upsert(rows)
    print("OK.")


if __name__ == "__main__":
    main()
