#!/usr/bin/env python3
"""
HUB DTX — Synchronisation BRIO (Qlik Cloud) -> Supabase.

Se connecte au moteur QIX de l'app BRIO Analytics via WebSocket et extrait les
sinistres au grain « 1 ligne par sinistre » : Qlik agrège lui-même (Sum des
montants, Concat des libellés, Max des dates), ce qui évite toute inflation due
aux associations. Puis upsert dans public.sinistres de Supabase.

Variables d'environnement (GitHub Secrets) :
  QLIK_API_KEY          clé API Qlik Cloud (JWT)        [requis]
  SUPABASE_SERVICE_KEY  service_role key Supabase       [requis sauf DRY_RUN]
  QLIK_HOST    (def: h6las9b8umw8ppb.eu.qlikcloud.com)
  QLIK_APP_ID  (def: 111414a5-e645-4397-8311-9bed88033407)
  SUPABASE_URL (def: https://tndwonqdbeszkcztkzqe.supabase.co)
  DRY_RUN      "1" => extrait et affiche, n'écrit pas
"""
import os, json, ssl, sys, urllib.request, datetime
from websocket import create_connection

QLIK_HOST   = os.environ.get("QLIK_HOST",  "h6las9b8umw8ppb.eu.qlikcloud.com")
QLIK_APP_ID = os.environ.get("QLIK_APP_ID","111414a5-e645-4397-8311-9bed88033407")
QLIK_KEY    = os.environ.get("QLIK_API_KEY", "")
SUPA_URL    = os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY    = os.environ.get("SUPABASE_SERVICE_KEY", "")
DRY_RUN     = os.environ.get("DRY_RUN") == "1"

# Dimension de regroupement
DIM = "Pointeur sinistre"
# Mesures : (expression Qlik, colonne Supabase, type)
#   text_first = Concat puis 1ère valeur ; text_join = garde tel quel ;
#   date / num / int
MEAS = [
    ("=Concat(DISTINCT [ReferenceSinistre],'§')",            "reference_sinistre",   "text_first"),
    ("=Concat(DISTINCT [RéférenceProducteur],'§')",          "reference_producteur", "text_first"),
    ("=Concat(DISTINCT [PoliceObjetLien],'§')",              "police_objet_lien",    "text_first"),
    ("=Concat(DISTINCT [Etat sinistre - libellé (fr)],'§')", "etat",                 "text_first"),
    ("=Concat(DISTINCT [EtatSinistre.Code],'§')",            "etat_code",            "text_first"),
    ("=Concat(DISTINCT [Responsability.FR],'§')",            "responsabilite",       "text_first"),
    ("=Concat(DISTINCT [DomaineSinistre],'§')",              "domaine",              "text_first"),
    ("=Concat(DISTINCT [Damage.Manager],'§')",               "gestionnaire",         "text_first"),
    ("=Concat(DISTINCT [Sinistré],'§')",                     "sinistre_nom",         "text_first"),
    ("=Concat(DISTINCT [DescriptionSinsitre],'§')",          "description",          "text_first"),
    ("=Concat(DISTINCT [Sinistre.Garantie],' / ')",          "garantie",             "text_join"),
    ("=Date(Max(DateSurvenanceNum))",                        "date_survenance",      "date"),
    ("=Date(Max([Date ouverture]))",                         "date_ouverture",       "date"),
    ("=Date(Max([Sinistre.Date état sinistre]))",            "date_etat",            "date"),
    ("=Max(AnneeSinistre)",                                  "annee",                "int"),
    ("=Sum([Montant à payer])",                              "montant_a_payer",      "num"),
    ("=Sum([Sinistre.Montant Payé])",                        "montant_paye",         "num"),
    ("=Sum([Montant en Attente])",                           "montant_attente",      "num"),
    ("=Sum([Montant en Réserve])",                           "montant_reserve",      "num"),
    ("=Sum([Montant en Recours])",                           "montant_recours",      "num"),
]


def call(ws, method, handle, params, _id):
    ws.send(json.dumps({"jsonrpc": "2.0", "id": _id, "method": method,
                        "handle": handle, "params": params}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == _id:
            if "error" in m:
                raise RuntimeError(f"{method}: {m['error']}")
            return m


def parse_date(txt):
    if not txt:
        return None
    txt = txt.strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.datetime.strptime(txt, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def first(txt):
    if not txt:
        return None
    for part in txt.split("§"):
        if part.strip():
            return part.strip()
    return None


def extract():
    ws = create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",
                           header=[f"Authorization: Bearer {QLIK_KEY}"],
                           timeout=60, sslopt={"cert_reqs": ssl.CERT_NONE})
    _id = [0]
    def c(method, handle, params):
        _id[0] += 1
        return call(ws, method, handle, params, _id[0])

    doc = c("OpenDoc", -1, [QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    obj = c("CreateSessionObject", doc, [{
        "qInfo": {"qType": "sync"},
        "qHyperCubeDef": {
            "qDimensions": [{"qDef": {"qFieldDefs": [DIM]}}],
            "qMeasures": [{"qDef": {"qDef": e}} for e, _, _ in MEAS],
            "qInitialDataFetch": [{"qTop": 0, "qLeft": 0, "qWidth": 1 + len(MEAS), "qHeight": 1}],
        },
    }])["result"]["qReturn"]["qHandle"]

    total = c("GetLayout", obj, [])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    W = 1 + len(MEAS)
    page = max(1, 10000 // W)
    out, top = [], 0
    while top < total:
        data = c("GetHyperCubeData", obj, ["/qHyperCubeDef",
                  [{"qTop": top, "qLeft": 0, "qWidth": W, "qHeight": page}]])
        matrix = data["result"]["qDataPages"][0]["qMatrix"]
        if not matrix:
            break
        for row in matrix:
            ptr = (row[0].get("qText") or "").strip()
            if not ptr:
                continue
            rec = {"pointeur_sinistre": ptr}
            for i, (_, col, kind) in enumerate(MEAS):
                cell = row[i + 1]
                if kind == "text_first":
                    rec[col] = first(cell.get("qText"))
                elif kind == "text_join":
                    v = (cell.get("qText") or "").strip()
                    rec[col] = v or None
                elif kind == "date":
                    rec[col] = parse_date(cell.get("qText"))
                elif kind == "num":
                    n = cell.get("qNum")
                    rec[col] = round(float(n), 2) if isinstance(n, (int, float)) else 0
                elif kind == "int":
                    n = cell.get("qNum")
                    rec[col] = int(n) if isinstance(n, (int, float)) and n == n else None
            out.append(rec)
        top += len(matrix)
    ws.close()
    return out


def upsert(rows):
    url = f"{SUPA_URL}/rest/v1/sinistres?on_conflict=pointeur_sinistre"
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
    print("Extraction des sinistres depuis Qlik (agrégation côté moteur)…")
    rows = extract()
    print(f"  {len(rows)} sinistres extraits")
    if DRY_RUN:
        tot = sum(r["montant_reserve"] for r in rows)
        ouverts = sum(1 for r in rows if (r.get("etat") or "").lower().startswith("en cours"))
        print(f"  réserve totale = {tot:,.2f} | 'en cours' = {ouverts}")
        for r in rows[:6]:
            print("   ", r["reference_sinistre"], "|", r["date_ouverture"], "|", r["etat"],
                  "|", r["gestionnaire"], "| rés.", r["montant_reserve"], "| rec.", r["montant_recours"])
        print("DRY_RUN — aucune écriture Supabase.")
        return
    if not SUPA_KEY:
        sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Upsert vers Supabase…")
    upsert(rows)
    print("OK.")


if __name__ == "__main__":
    main()
