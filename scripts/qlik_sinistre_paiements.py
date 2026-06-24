#!/usr/bin/env python3
"""HUB DTX — Paiements sinistres (Qlik SinGarPay) -> Supabase sinistre_paiements.
Grain : 1 ligne par paiement de garantie. Rechargement complet.
Env : QLIK_API_KEY, SUPABASE_SERVICE_KEY (+ DRY_RUN=1)."""
import os, json, ssl, sys, urllib.request
from websocket import create_connection
sys.path.insert(0, os.path.dirname(__file__))
from qlik_clients import dossier_from_numero, parse_date

QLIK_HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; QLIK_APP_ID="111414a5-e645-4397-8311-9bed88033407"
QLIK_KEY=os.environ.get("QLIK_API_KEY",""); SUPA_URL=os.environ.get("SUPABASE_URL","https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY=os.environ.get("SUPABASE_SERVICE_KEY",""); DRY_RUN=os.environ.get("DRY_RUN")=="1"

ONLY=lambda f:f"=Only([{f}])"
MEAS=[
 (ONLY("SinGarPay.Référence sinistre"),"reference_sinistre","text"),
 (ONLY("SinGarPay.Numéro"),"_numero","text"),
 (ONLY("SinGarPay.Nom"),"beneficiaire_nom","text"),
 (ONLY("SinGarPay.Prénom"),"beneficiaire_prenom","text"),
 (ONLY("SinGarPay.Police"),"police","text"),
 (ONLY("SinGarPay.Type de risque"),"type_risque","text"),
 (ONLY("SinGarPay.Description objet"),"description","text"),
 (ONLY("SinGarPay.Garantie paiement"),"garantie","text"),
 ("=Sum([SinGarPay.Montant à payer])","montant","num"),
 (ONLY("SinGarPay.Etat paiement"),"etat_paiement","text"),
 ("=Date(Max(DatePaiement_Sinistre_Garantie))","date_paiement","date"),
]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(r["error"])
            return r

def extract():
    ws=create_connection(f"wss://{QLIK_HOST}/app/{QLIK_APP_ID}",header=[f"Authorization: Bearer {QLIK_KEY}"],timeout=120,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[QLIK_APP_ID])["result"]["qReturn"]["qHandle"]
    W=1+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"sgp"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":["SinGarPay.Pointer"]}}],
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
                cell=row[j+1]; v=(cell.get("qText") or "").strip()
                if kind=="num": rec[col]=cell.get("qNum") if cell.get("qNum") not in (None,"NaN") else None
                elif kind=="date": rec[col]=parse_date(v)
                else: rec[col]=v or None
            rec["dossier"]=dossier_from_numero(rec.pop("_numero"))
            if not rec.get("reference_sinistre"): continue
            out.append(rec)
        top+=len(mtx)
    ws.close(); return out

def reload_all(rows):
    h={"apikey":SUPA_KEY,"Authorization":f"Bearer {SUPA_KEY}","Content-Type":"application/json","Prefer":"return=minimal"}
    urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/sinistre_paiements?id=not.is.null",method="DELETE",headers=h))
    B=1000
    for i in range(0,len(rows),B):
        urllib.request.urlopen(urllib.request.Request(f"{SUPA_URL}/rest/v1/sinistre_paiements",data=json.dumps(rows[i:i+B]).encode(),method="POST",headers=h))
    print(f"  inséré {len(rows)}")

def main():
    if not QLIK_KEY: sys.exit("QLIK_API_KEY manquant")
    print("Extraction SinGarPay…"); rows=extract(); print(f"  {len(rows)} paiements sinistres")
    if DRY_RUN:
        for r in rows[:8]:
            print(f"   {str(r.get('reference_sinistre'))[:14]:14} | {str(r.get('dossier')):8} | {str(r.get('garantie'))[:20]:20} | {r.get('montant')} € | {r.get('etat_paiement')} | {r.get('date_paiement')}")
        print("DRY_RUN."); return
    if not SUPA_KEY: sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Rechargement complet sinistre_paiements…"); reload_all(rows); print("OK.")

if __name__=="__main__":
    main()
