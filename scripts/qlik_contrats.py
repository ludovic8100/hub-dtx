#!/usr/bin/env python3
"""
HUB DTX — Synchronisation contrats BRIO (Qlik ObjetDeRisque) -> Supabase.

Grain : 1 ligne par POLICE (dimension Qlik PoliceUnique).
Le dossier est reconstruit depuis "Numéro" (même règle que les clients).
Les infos client (nom/prénom/naissance/cp/localité) sont complétées depuis la
table clients (jointure par dossier).

Rechargement complet (delete + insert) — la table contrats n'a pas de clé
métier unique et son id n'est référencé par aucune autre table.

Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1).
"""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero, parse_date, load_code_map, map_code, na  # réutilisation

QLIK_HOST   = "h6las9b8umw8ppb.eu.qlikcloud.com"
QLIK_APP_ID = "111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY    = os.environ.get("QLIK_API_KEY", "")
SUPA_URL    = os.environ.get("SUPABASE_URL", "https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
DRY_RUN     = os.environ.get("DRY_RUN") == "1"

ONLY = lambda f: f"=Only([{f}])"
MEAS = [
    (ONLY("Numéro"),          "_numero",         "text"),
    (ONLY("Police"),          "police",          "text"),
    (ONLY("Compagnie"),       "compagnie",       "text"),
    (ONLY("Situation.FR"),    "situation",       "text"),
    (ONLY("Domain.FR"),       "domaine",         "text"),
    (ONLY("Version"),         "version",         "text"),
    (ONLY("Policy.Type.FR"),  "type_production", "text"),
    (ONLY("Sous-agent (nom)"),"nom_sa",          "text"),
    (ONLY("Date effet"),      "date_creation",   "date"),
]


def call(ws, method, handle, params, _id):
    ws.send(json.dumps({"jsonrpc": "2.0", "id": _id, "method": method, "handle": handle, "params": params}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == _id:
            if "error" in m:
                raise RuntimeError(f"{method}: {m['error']}")
            return m


def extract():
    ws = create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",
                           header=[f"Authorization: Bearer {QLIK_KEY}"],
                           timeout=120, sslopt={"cert_reqs": ssl.CERT_NONE})
    _id = [0]
    def c(m, h, p):
        _id[0] += 1
        return call(ws, m, h, p, _id[0])
    doc = c("OpenDoc", -1, [QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    obj = c("CreateSessionObject", doc, [{
        "qInfo": {"qType": "ctr"},
        "qHyperCubeDef": {
            "qDimensions": [{"qDef": {"qFieldDefs": ["PoliceUnique"]}}],
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
            rec = {}
            for i, (_, col, kind) in enumerate(MEAS):
                v = (row[i + 1].get("qText") or "").strip()
                rec[col] = parse_date(v) if kind == "date" else (v or None)
            rec["dossier"] = dossier_from_numero(rec.pop("_numero"))
            if not rec["dossier"] or not rec.get("police"):
                continue
            out.append(rec)
        top += len(matrix)
    ws.close()
    return out


def fetch_clients_index():
    """ dossier -> infos client (nom, prénom, naissance, cp, localité) """
    idx, start = {}, 0
    while True:
        url = f"{SUPA_URL}/rest/v1/clients?select=dossier,nom,prenom,date_naissance,cp,localite&limit=1000&offset={start}"
        req = urllib.request.Request(url, headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"})
        page = json.load(urllib.request.urlopen(req))
        for c in page:
            idx[c["dossier"]] = c
        if len(page) < 1000:
            break
        start += 1000
    return idx


def reload_all(rows):
    h = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/contrats?id=not.is.null", method="DELETE", headers=h))
    B = 500
    for i in range(0, len(rows), B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/contrats",
            data=json.dumps(rows[i:i + B]).encode(), method="POST", headers=h))
        print(f"  insert {i + len(rows[i:i+B])}/{len(rows)}")


def main():
    if not QLIK_KEY:
        sys.exit("QLIK_API_KEY manquant")
    print("Extraction ObjetDeRisque (grain police)…")
    rows = extract()
    print(f"  {len(rows)} contrats")
    cm = load_code_map()
    if SUPA_KEY:
        idx = fetch_clients_index()
        hit = 0
        for r in rows:
            cl = idx.get(r["dossier"])
            if cl:
                hit += 1
                r["nom_client"] = cl.get("nom"); r["prenom_client"] = cl.get("prenom")
                r["date_naissance"] = cl.get("date_naissance")
                r["code_postal"] = cl.get("cp"); r["localite"] = cl.get("localite")
            r["sa_code"] = map_code(r.get("nom_sa"), cm)
        print(f"  infos client complétées : {hit}/{len(rows)}")
    if DRY_RUN:
        print("  Exemples :")
        for r in rows[:10]:
            print(f"   {r['dossier']:9} | pol {str(r.get('police')):9} | {str(r.get('compagnie'))[:18]:18} | {str(r.get('domaine'))[:16]:16} | {str(r.get('situation')):9} | {r.get('date_creation')} | client={r.get('nom_client')}")
        print("DRY_RUN — aucune écriture.")
        return
    if not SUPA_KEY:
        sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Rechargement complet contrats…")
    reload_all(rows)
    print("OK.")


if __name__ == "__main__":
    main()
