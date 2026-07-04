#!/usr/bin/env python3
"""
HUB DTX — Objets de risque détaillés (Qlik ObjetDeRisque) -> Supabase objets_risque.

Grain : 1 ligne par (police × OBJET × garantie).
La Description (= plaque pour un véhicule, adresse du risque pour un bâtiment) est
une DIMENSION, pour ne PAS écraser les contrats couvrant plusieurs objets sous une
même garantie (ex. DAS/PJ flotte, incendie bâtiment+contenu).
Rechargement complet. Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1).
"""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero, parse_date

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"

# 3 dimensions (police × objet(Description) × garantie) ; le reste en mesures Only()
DIMS=[("PoliceUnique","_polu"),("Description","description"),("Guarantee.FR","garantie")]
ONLY=lambda f:f"=Only([{f}])"
MEAS=[
 (ONLY("Numéro"),"_numero","text"),(ONLY("Police"),"police","text"),
 (ONLY("Compagnie"),"compagnie","text"),(ONLY("Domain.FR"),"domaine","text"),
 (ONLY("RiskType.FR"),"type_risque","text"),
 (ONLY("Version"),"version","text"),(ONLY("Situation.FR"),"situation","text"),
 (ONLY("Etat contrat"),"etat_contrat","text"),(ONLY("Gestionnaire"),"gestionnaire","text"),
 (ONLY("Sous-agent (nom)"),"sous_agent","text"),(ONLY("Date effet"),"date_effet","date"),
]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(r["error"])
            return r

def extract():
    ws=create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",header=[f"Authorization: Bearer {QLIK_KEY}"],timeout=300,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    W=len(DIMS)+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"obr"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":[f]}} for f,_ in DIMS],
        "qMeasures":[{"qDef":{"qDef":e}} for e,_,_ in MEAS],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":W,"qHeight":1}],
        "qSuppressZero":False,"qSuppressMissing":False}}])["result"]["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    page=max(1,10000//W); out=[]; top=0
    while top<total:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["result"]["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            rec={"description":(row[1].get("qText") or "").strip() or None,
                 "garantie":(row[2].get("qText") or "").strip() or None}
            for j,(_,col,kind) in enumerate(MEAS):
                v=(row[len(DIMS)+j].get("qText") or "").strip()
                rec[col]=parse_date(v) if kind=="date" else (v or None)
            rec["dossier"]=dossier_from_numero(rec.pop("_numero"))
            if not rec.get("police"): continue
            out.append(rec)
        top+=len(mtx)
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/objets_risque?id=not.is.null",method="DELETE",headers=h))
    B=1000
    for i in range(0,len(rows),B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/objets_risque",data=json.dumps(rows[i:i+B]).encode(),method="POST",headers=h))
        print(f"  insert {min(i+B,len(rows))}/{len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction ObjetDeRisque (police × objet × garantie)…"); rows=extract(); print(f"  {len(rows)} lignes objet×garantie")
    if DRY_RUN:
        vides=sum(1 for r in rows if (r.get("description") or "-") in ("-",None,""))
        das=[r for r in rows if "2AHS210" in (r.get("description") or "").upper()]
        print(f"  descriptions vides/'-' : {vides} ({100*vides//max(1,len(rows))}%)")
        print(f"  lignes contenant la plaque 2AHS210 : {len(das)}")
        for r in das:
            print(f"    dossier {r.get('dossier')} | {r.get('compagnie')} | pol {r.get('police')} | {r.get('garantie')} | {r.get('description')}")
        print("DRY_RUN — aucune écriture."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Rechargement complet objets_risque…"); reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
