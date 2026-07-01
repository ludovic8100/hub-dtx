#!/usr/bin/env python3
"""HUB DTX — Extrait la STRUCTURE (tables + champs) de l'app Qlik BRIO + une
VALEUR D'EXEMPLE par champ, en sélectionnant un client précis.

LECTURE SEULE. Sélectionne le Preneur dont « Nom Prénom » contient les termes
donnés (def: detilloux + ludovic) ; les tables liées reflètent alors ce client,
les tables techniques/de référence montrent leur 1re ligne.

Sortie : JSON entre les marqueurs ===JSON_START=== / ===JSON_END===.

Env (GitHub Secrets) :
  QLIK_API_KEY  [requis]   QLIK_HOST / QLIK_APP_ID (défauts BRIO)
  MATCH_TERMS   (def: "detilloux ludovic")
"""
import os, json, ssl, sys
from websocket import create_connection

HOST  = os.environ.get("QLIK_HOST",   "h6las9b8umw8ppb.eu.qlikcloud.com")
APPID = os.environ.get("QLIK_APP_ID", "111414a5-e645-4397-8311-9bed88033407")
KEY   = os.environ.get("QLIK_API_KEY", "")
TERMS = [t for t in os.environ.get("MATCH_TERMS", "detilloux ludovic").lower().split() if t]
NAME_FIELD = os.environ.get("NAME_FIELD", "Nom Prénom")


def main():
    if not KEY:
        sys.exit("QLIK_API_KEY manquant")
    ws = create_connection(f"wss://{HOST}/app/{APPID}",
                           header=[f"Authorization: Bearer {KEY}"],
                           timeout=90, sslopt={"cert_reqs": ssl.CERT_NONE})
    _id = [0]
    def c(method, handle, params):
        _id[0] += 1
        ws.send(json.dumps({"jsonrpc": "2.0", "id": _id[0], "method": method,
                            "handle": handle, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == _id[0]:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m["result"]

    doc = c("OpenDoc", -1, [APPID])["qReturn"]["qHandle"]

    # 1) structure
    res = c("GetTablesAndKeys", doc,
            [{"qcx": 10000, "qcy": 10000}, {"qcx": 0, "qcy": 0}, 30, False, False])
    tables = [(t.get("qName"), [f.get("qName") for f in t.get("qFields", [])])
              for t in res.get("qtr", [])]

    # 2) sélection du client via la liste des valeurs de NAME_FIELD
    selected = None
    try:
        lo = c("CreateSessionObject", doc, [{
            "qInfo": {"qType": "lb"},
            "qListObjectDef": {
                "qDef": {"qFieldDefs": [NAME_FIELD]},
                "qInitialDataFetch": [{"qTop": 0, "qLeft": 0, "qWidth": 1, "qHeight": 10000}],
            },
        }])["qReturn"]["qHandle"]
        lay = c("GetLayout", lo, [])["qLayout"]
        matrix = lay["qListObject"]["qDataPages"][0]["qMatrix"]
        for row in matrix:
            txt = (row[0].get("qText") or "")
            low = txt.lower()
            if all(term in low for term in TERMS):
                selected = txt
                break
        if selected:
            fld = c("GetField", doc, [NAME_FIELD])["qReturn"]["qHandle"]
            c("SelectValues", fld, [[{"qText": selected}], False, False])
    except Exception as e:
        selected = f"(échec sélection: {e})"

    # 3) une ligne d'exemple par table (reflète la sélection courante)
    out = {"client_selectionne": selected, "match_terms": TERMS, "tables": []}
    for name, fields in tables:
        entry = {"table": name, "n_rows": None, "champs": []}
        if not fields:
            out["tables"].append(entry)
            continue
        try:
            obj = c("CreateSessionObject", doc, [{
                "qInfo": {"qType": "ht"},
                "qHyperCubeDef": {
                    "qDimensions": [{"qDef": {"qFieldDefs": [fn]}} for fn in fields],
                    "qInitialDataFetch": [{"qTop": 0, "qLeft": 0,
                                           "qWidth": len(fields), "qHeight": 1}],
                    "qSuppressZero": False, "qSuppressMissing": False,
                },
            }])["qReturn"]["qHandle"]
            hl = c("GetLayout", obj, [])["qLayout"]["qHyperCube"]
            entry["n_rows"] = hl["qSize"]["qcy"]
            pages = hl.get("qDataPages", [])
            row = pages[0]["qMatrix"][0] if pages and pages[0].get("qMatrix") else []
            for i, fn in enumerate(fields):
                ex = row[i].get("qText") if i < len(row) else None
                if ex in ("", "-", None):
                    ex = None
                entry["champs"].append({"champ": fn, "exemple": ex})
        except Exception as e:
            entry["erreur"] = str(e)
            entry["champs"] = [{"champ": fn, "exemple": None} for fn in fields]
        out["tables"].append(entry)

    ws.close()
    print("===JSON_START===")
    print(json.dumps(out, ensure_ascii=False))
    print("===JSON_END===")


if __name__ == "__main__":
    main()
