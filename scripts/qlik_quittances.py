#!/usr/bin/env python3
"""
HUB DTX — Quittances BRIO (Qlik Quittance) -> Supabase quittances.

Grain : 1 ligne par quittance (LienQuittance). Sélection d'années côté Qlik
(QUITTANCE_YEARS, défaut "2025,2026") pour limiter le volume.
Champs financiers (prime, commission, date comptable, compte producteur) +
contexte (compagnie, police, client, domaine, gestionnaire, sous-agent)
récupérés via le modèle associatif Qlik. Rechargement complet.

Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ QUITTANCE_YEARS, DRY_RUN=1).
"""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero, parse_date, split_nom

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"
YEARS=[y.strip() for y in os.environ.get("QUITTANCE_YEARS","2025,2026").split(",") if y.strip()]

ONLY=lambda f:f"=Only([{f}])"
MEAS=[
 (ONLY("Receipt.account_no"),"compte_producteur","text"),
 ("=Sum(Prime)","prime_totale","num"),
 ("=Sum(Commission)","commission","num"),
 ("=Date(Max([Ref_DateComptableNum]))","date_comptable","date"),
 (ONLY("Statut Transaction"),"etat","text"),
 (ONLY("Compagnie"),"compagnie","text"),
 (ONLY("Police"),"police","text"),
 (ONLY("Domain.FR"),"domaine","text"),
 (ONLY("Gestionnaire"),"gestionnaire","text"),
 (ONLY("Sous-agent (nom)"),"sous_agent","text"),
 (ONLY("Nom Prénom"),"_nom","text"),
 (ONLY("Numéro"),"_numero","text"),
 (ONLY("Pr.Localité"),"localite","text"),
 (ONLY("Policy.Type.FR"),"type_production","text"),
 (ONLY("Périodicité"),"periodicite","text"),
 (ONLY("FSMA nr"),"fsma","text"),
]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(r["error"])
            return r

def connect():
    ws=create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",header=[f"Authorization: Bearer {QLIK_KEY}"],timeout=300,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    return ws,c,doc

def extract(sample=False):
    ws,c,doc=connect()
    # sélection des années comptables
    fld=c("GetField",doc,["AnneeComptable"])["result"]["qReturn"]["qHandle"]
    c("SelectValues",fld,[[{"qText":y,"qNumber":float(y),"qIsNumeric":True} for y in YEARS],False,False])
    W=2+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"qui"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":["LienQuittance"]}},{"qDef":{"qFieldDefs":["AnneeComptable"]}}],
        "qMeasures":[{"qDef":{"qDef":e}} for e,_,_ in MEAS],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":W,"qHeight":1}]}}])["result"]["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["result"]["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    print(f"  quittances×année sélectionnées ({'+'.join(YEARS)}) : {total}")
    page=max(1,10000//W); out=[]; top=0
    limit=page if sample else total
    while top<limit:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["result"]["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            rec={}
            for j,(_,col,kind) in enumerate(MEAS):
                cell=row[j+2]; v=(cell.get("qText") or "").strip()
                if kind=="num": rec[col]=cell.get("qNum") if cell.get("qNum") not in (None,"NaN") else None
                elif kind=="date": rec[col]=parse_date(v)
                else: rec[col]=v or None
            if not rec.get("date_comptable"): continue
            if rec.get("compte_producteur")=="-": rec["compte_producteur"]=None
            nom,prenom=split_nom(rec.pop("_nom"))
            rec["client_nom"]=nom.upper() if nom else None
            rec["client_prenom"]=prenom.upper() if prenom else None
            rec["dossier"]=dossier_from_numero(rec.pop("_numero"))
            out.append(rec)
        top+=len(mtx)
        if not sample and top%20000<page: print(f"    extrait {top}/{total}")
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/quittances?id=not.is.null",method="DELETE",headers=h))
    B=1000
    for i in range(0,len(rows),B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/quittances",data=json.dumps(rows[i:i+B]).encode(),method="POST",headers=h))
        if i%20000<B: print(f"  insert {min(i+B,len(rows))}/{len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction Quittance…"); rows=extract(sample=DRY_RUN)
    if DRY_RUN:
        for r in rows[:8]:
            print(f"   {str(r.get('date_comptable')):10} | cpte {str(r.get('compte_producteur')):8} | {str(r.get('compagnie'))[:16]:16} | prime {r.get('prime_totale')} | comm {r.get('commission')} | {r.get('client_nom')}")
        print("DRY_RUN — aucune écriture."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    print(f"Rechargement complet quittances ({len(rows)})…"); reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
