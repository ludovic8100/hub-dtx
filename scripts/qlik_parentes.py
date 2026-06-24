#!/usr/bin/env python3
"""
HUB DTX — Synchronisation des groupes / liens de parenté (Qlik GroupePreneur)
-> Supabase table public.parentes.

Grain : 1 ligne par (groupe, membre). Le dossier du preneur principal est
reconstruit depuis "Main Taker.Number" pour rattachement à la fiche client.

Rechargement complet (delete + insert). Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1).
"""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"

DIMS=[("Pointeur groupe","groupe_id"),("Naam Voornaam groep","groupe_nom"),
      ("Soort groep.FR","groupe_type"),("Naam Voornaam (lid)","membre_nom"),
      ("Main Taker.Number","_main"),("Group.MB.PoliceCount","nb_polices"),
      ("Group.MB.PrimeAmount","prime_totale")]

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
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"grp"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":[f]}} for f,_ in DIMS],"qMeasures":[],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":len(DIMS),"qHeight":1}]}}])["result"]["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    W=len(DIMS); page=max(1,10000//W); out=[]; top=0
    while top<total:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["result"]["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            rec={}
            for i,(_,col) in enumerate(DIMS):
                rec[col]=(row[i].get("qText") or "").strip() or None
            rec["dossier_principal"]=dossier_from_numero(rec.pop("_main"))
            if not rec.get("groupe_type") or not rec.get("dossier_principal"):
                continue
            for k in ("nb_polices","prime_totale"):
                try: rec[k]=float(rec[k].replace(",",".")) if rec[k] else None
                except: rec[k]=None
            out.append(rec)
        top+=len(mtx)
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/parentes?id=not.is.null",method="DELETE",headers=h))
    B=500
    for i in range(0,len(rows),B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/parentes",data=json.dumps(rows[i:i+B]).encode(),method="POST",headers=h))
    print(f"  inséré {len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction GroupePreneur…"); rows=extract(); print(f"  {len(rows)} liens (groupe-membre)")
    if DRY_RUN:
        for r in rows[:10]:
            print(f"   grp {str(r.get('groupe_id')):8} | {str(r.get('groupe_type'))[:14]:14} | membre {str(r.get('membre_nom'))[:24]:24} | princ.dossier {r.get('dossier_principal')}")
        print("DRY_RUN — aucune écriture."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
