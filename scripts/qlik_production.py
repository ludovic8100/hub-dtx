#!/usr/bin/env python3
"""
HUB DTX — Production BRIO (Qlik Contrat) -> Supabase mouvements_production.

Grain : 1 ligne par contrat (LienContrat) = état de production courant
(type N.A./Avenant/Renon/Mandat…, date de production, compagnie, police,
sous-agent, délégué, gestionnaire). Rechargement complet.

Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1).
"""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import parse_date, split_nom

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"

ONLY=lambda f:f"=Only([{f}])"
MEAS=[
 (ONLY("Contract.Production Type.FR"),"type_prod","text"),
 ("=Date(Only([Contract.Production Date]))","date_mouvement","date"),
 (ONLY("Compagnie"),"cie","text"),
 (ONLY("Police"),"police","text"),
 (ONLY("Policy.Type.FR"),"type_police","text"),
 (ONLY("Nom Prénom"),"_nom","text"),
 (ONLY("Sous-agent (nom)"),"sa_contrat","text"),
 (ONLY("Délégué commercial (nom)"),"delegue_contrat","text"),
 (ONLY("Gestionnaire"),"gestionnaire","text"),
]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(r["error"])
            return r

def extract():
    ws=create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",header=[f"Authorization: Bearer {QLIK_KEY}"],timeout=150,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    W=1+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"prod"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":["LienContrat"]}}],
        "qMeasures":[{"qDef":{"qDef":e}} for e,_,_ in MEAS],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":W,"qHeight":1}]}}])["result"]["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    page=max(1,10000//W); out=[]; top=0
    while top<total:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["result"]["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            rec={}
            for j,(_,col,kind) in enumerate(MEAS):
                v=(row[j+1].get("qText") or "").strip()
                rec[col]=parse_date(v) if kind=="date" else (v or None)
            nom,prenom=split_nom(rec.pop("_nom"))
            rec["nom_client"]=nom.upper() if nom else None
            rec["prenom_client"]=prenom.upper() if prenom else None
            rec["sa_preneur"]=rec.get("sa_contrat")
            if not rec.get("date_mouvement"): continue
            if not rec.get("type_prod") and not rec.get("police"): continue
            out.append(rec)
        top+=len(mtx)
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/mouvements_production?id=not.is.null",method="DELETE",headers=h))
    B=1000
    for i in range(0,len(rows),B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/mouvements_production",data=json.dumps(rows[i:i+B]).encode(),method="POST",headers=h))
        print(f"  insert {min(i+B,len(rows))}/{len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction Contrat (production)…"); rows=extract(); print(f"  {len(rows)} contrats/production")
    if DRY_RUN:
        from collections import Counter
        print("  Répartition type_prod :", dict(Counter(r.get('type_prod') for r in rows).most_common(10)))
        for r in rows[:8]:
            print(f"   {str(r.get('date_mouvement')):10} | {str(r.get('type_prod'))[:18]:18} | {str(r.get('cie'))[:16]:16} | pol {str(r.get('police')):9} | {r.get('nom_client')} | SA {r.get('sa_contrat')}")
        print("DRY_RUN — aucune écriture."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Rechargement complet mouvements_production…"); reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
