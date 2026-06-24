#!/usr/bin/env python3
"""HUB DTX — Segmentation portefeuille (Qlik, matrice de Boston) -> Supabase segmentation.
Grain : 1 ligne par groupe/ménage, rattaché au dossier du preneur principal.
nb polices / primes / commissions / sinistres + segment Boston.
Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1)."""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"

DIMS=[("Pointeur groupe","groupe_id"),("Main Taker.Number","_main"),
      ("Naam Voornaam groep","groupe_nom"),("Segment_Matrice_Boston","segment")]
ONLY=lambda f:f"=Only([{f}])"
MEAS=[("=Only([Group.MB.PoliceCount])","nb_polices","num"),
      ("=Only([Group.MB.PrimeAmount])","prime_totale","num"),
      ("=Only([Group.MB.CommissionAmount])","commission_totale","num"),
      ("=Only([Group.MB.SinistreCount])","nb_sinistres","num")]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(r["error"])
            return r

def extract():
    ws=create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",header=[f"Authorization: Bearer {QLIK_KEY}"],timeout=90,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    W=len(DIMS)+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"seg"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":[f]}} for f,_ in DIMS],
        "qMeasures":[{"qDef":{"qDef":e}} for e,_,_ in MEAS],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":W,"qHeight":1}]}}])["result"]["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    page=max(1,10000//W); out=[]; top=0
    while top<total:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["result"]["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            rec={}
            for i,(_,col) in enumerate(DIMS):
                rec[col]=(row[i].get("qText") or "").strip() or None
            for j,(_,col,_k) in enumerate(MEAS):
                cell=row[len(DIMS)+j]; rec[col]=cell.get("qNum") if cell.get("qNum") not in (None,"NaN") else None
            rec["dossier"]=dossier_from_numero(rec.pop("_main"))
            if not rec.get("dossier") or not rec.get("segment"): continue
            out.append(rec)
        top+=len(mtx)
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/segmentation?id=not.is.null",method="DELETE",headers=h))
    for i in range(0,len(rows),1000):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/segmentation",data=json.dumps(rows[i:i+1000]).encode(),method="POST",headers=h))
    print(f"  inséré {len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction segmentation (matrice Boston)…"); rows=extract(); print(f"  {len(rows)} groupes segmentés")
    if DRY_RUN:
        from collections import Counter
        print("  segments :", dict(Counter(r.get('segment') for r in rows).most_common()))
        for r in rows[:8]:
            print(f"   {str(r.get('dossier')):8} | {str(r.get('segment'))[:22]:22} | {r.get('nb_polices')} pol | {r.get('prime_totale')} € | {r.get('nb_sinistres')} sin")
        print("DRY_RUN."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Rechargement complet segmentation…"); reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
