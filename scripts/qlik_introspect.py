#!/usr/bin/env python3
"""HUB DTX — Introspection du modèle de données Qlik (app BRIO Analytics).

LECTURE SEULE : ouvre l'app via le moteur QIX (WebSocket) et liste toutes les
tables chargées + leurs champs, via GetTablesAndKeys. N'écrit rien, ni dans
Qlik ni dans Supabase.

But : déterminer s'il existe dans l'app Qlik une table de tâches / agenda /
activités / relances / suivi exploitable pour le calendrier du Hub. Sinon, on
basculera sur des « tâches générées » (sinistres ouverts, quittances impayées,
échéances de contrats).

Variables d'environnement (GitHub Secrets) :
  QLIK_API_KEY   clé API Qlik Cloud (JWT)                 [requis]
  QLIK_HOST      (def: h6las9b8umw8ppb.eu.qlikcloud.com)
  QLIK_APP_ID    (def: 111414a5-e645-4397-8311-9bed88033407)
"""
import os, json, ssl, sys
from websocket import create_connection

QLIK_HOST   = os.environ.get("QLIK_HOST",   "h6las9b8umw8ppb.eu.qlikcloud.com")
QLIK_APP_ID = os.environ.get("QLIK_APP_ID", "111414a5-e645-4397-8311-9bed88033407")
QLIK_KEY    = os.environ.get("QLIK_API_KEY", "")

# Mots-clés qui trahiraient une table/champ d'agenda ou de tâches
KW = ["tach", "tâche", "task", "todo", "to_do", "agenda", "activit", "relance",
      "suivi", "rappel", "reminder", "diary", "echeance", "échéance", "deadline",
      "renouvel", "action", "appel", "call", "contact", "rendez", "rdv"]


def call(ws, method, handle, params, _id):
    ws.send(json.dumps({"jsonrpc": "2.0", "id": _id, "method": method,
                        "handle": handle, "params": params}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == _id:
            if "error" in msg:
                sys.exit(f"Erreur QIX sur {method}: {msg['error']}")
            return msg


def main():
    if not QLIK_KEY:
        sys.exit("QLIK_API_KEY manquant")

    ws = create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",
                           header=[f"Authorization: Bearer {QLIK_KEY}"],
                           timeout=60, sslopt={"cert_reqs": ssl.CERT_NONE})
    _id = [0]
    def c(method, handle, params):
        _id[0] += 1
        return call(ws, method, handle, params, _id[0])

    doc = c("OpenDoc", -1, [QLIK_APP_ID])["result"]["qReturn"]["qHandle"]

    res = c("GetTablesAndKeys", doc, [
        {"qcx": 10000, "qcy": 10000},   # qWindowSize
        {"qcx": 0, "qcy": 0},           # qNullSize
        30,                              # qCellHeight
        False,                           # qSyntheticMode
        False,                           # qIncludeSysVars
    ])["result"]
    ws.close()

    tables = res.get("qtr", [])
    keys   = res.get("qk", [])

    hits = []
    print(f"\n========== MODÈLE QLIK : {len(tables)} table(s) ==========\n")
    for t in tables:
        name   = t.get("qName", "?")
        nrows  = t.get("qNoOfRows", "?")
        fields = [f.get("qName", "?") for f in t.get("qFields", [])]
        print(f"### TABLE: {name}   ({nrows} lignes, {len(fields)} champs)")
        for fn in fields:
            print(f"      - {fn}")
        blob = (name + " " + " ".join(fields)).lower()
        matched = [k for k in KW if k in blob]
        if matched:
            hits.append((name, sorted(set(matched))))
        print()

    if keys:
        print("========== CLÉS D'ASSOCIATION ==========")
        for k in keys:
            kf = k.get("qKeyFields", []) if isinstance(k, dict) else k
            tbls = [(x.get("qName") if isinstance(x, dict) else x) for x in k.get("qTables", [])]
            print(f"      clé {kf}  relie  {tbls}")
        print()

    print("========== VERDICT — candidats tâches/agenda/relance ==========")
    if hits:
        for name, matched in hits:
            print(f"  ⚑ {name}   (mots-clés: {', '.join(matched)})")
        print("\n→ Des tables/champs potentiellement liés à des tâches/agenda existent.")
        print("  Vérifier ci-dessus s'il s'agit de vraies tâches utilisateur ou juste")
        print("  de champs portefeuille (échéance de contrat, date d'appel, etc.).")
    else:
        print("  AUCUN — pas de table tâches/agenda/relance dans cette app Qlik.")
        print("  → Basculer sur des tâches générées (sinistres ouverts, quittances")
        print("    impayées, échéances de contrats).")


if __name__ == "__main__":
    main()
