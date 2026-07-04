#!/usr/bin/env python3
"""HUB DTX — Sonde Qlik (LECTURE SEULE) : trouve tous les ObjetDeRisque dont la
Description contient les termes donnés (ex. une plaque). Sert à vérifier si un
même bien (véhicule) est couvert par plusieurs contrats (auto + DAS/PJ…).

Scanne toute la table ObjetDeRisque (grain police × garantie) et filtre en Python.
Sortie JSON entre ===JSON_START=== / ===JSON_END===.
Env : QLIK_API_KEY [requis], PROBE_TERMS (def "2ahs210").
"""
import os, json, ssl, sys
from websocket import create_connection

HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; APPID="111414a5-e645-4397-8311-9bed88033407"
KEY=os.environ.get("QLIK_API_KEY",""); 
TERMS=[t for t in os.environ.get("PROBE_TERMS","2ahs210").lower().split() if t]

DIMS=["PoliceUnique","Guarantee.FR"]
ONLY=lambda f:f"=Only([{f}])"
MEAS=[("Numéro","_numero"),("Police","police"),("DossierUnique","dossier"),
 ("Compagnie","compagnie"),("Domain.FR","domaine"),("Policy.Type.FR","type_police"),
 ("RiskType.FR","type_risque"),("Description","description"),("Situation.FR","situation"),
 ("Etat contrat","etat_contrat"),("Sous-agent (nom)","sous_agent"),("Dossier_Lié_Type","lien_type")]

def call(ws,m,h,p,i):
    ws.send(json.dumps({"jsonrpc":"2.0","id":i,"method":m,"handle":h,"params":p}))
    while True:
        r=json.loads(ws.recv())
        if r.get("id")==i:
            if "error" in r: raise RuntimeError(f"{m}: {r['error']}")
            return r["result"]

def main():
    if not KEY: sys.exit("QLIK_API_KEY manquant")
    ws=create_connection(f"wss://{HOST}/app/{APPID}",header=[f"Authorization: Bearer {KEY}"],
                         timeout=240,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1; return call(ws,m,h,p,_id[0])
    doc=c("OpenDoc",-1,[APPID])["qReturn"]["qHandle"]
    W=len(DIMS)+len(MEAS)
    obj=c("CreateSessionObject",doc,[{"qInfo":{"qType":"probe"},"qHyperCubeDef":{
        "qDimensions":[{"qDef":{"qFieldDefs":[f]}} for f in DIMS],
        "qMeasures":[{"qDef":{"qDef":ONLY(f)}} for f,_ in MEAS],
        "qInitialDataFetch":[{"qTop":0,"qLeft":0,"qWidth":W,"qHeight":1}],
        "qSuppressZero":False,"qSuppressMissing":False}}])["qReturn"]["qHandle"]
    total=c("GetLayout",obj,[])["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    page=max(1,10000//W); top=0; hits=[]; scanned=0
    while top<total:
        mtx=c("GetHyperCubeData",obj,["/qHyperCubeDef",[{"qTop":top,"qLeft":0,"qWidth":W,"qHeight":page}]])["qDataPages"][0]["qMatrix"]
        if not mtx: break
        for row in mtx:
            desc=(row[1+ [m[1] for m in MEAS].index("description")].get("qText") or "")
            # description est la mesure d'index 'description'
            didx=len(DIMS)+[m[1] for m in MEAS].index("description")
            desc=(row[didx].get("qText") or "")
            low=desc.lower()
            if all(t in low for t in TERMS):
                rec={}
                for j,(_,col) in enumerate(MEAS):
                    rec[col]=(row[len(DIMS)+j].get("qText") or "").strip() or None
                rec["garantie"]=(row[1].get("qText") or "").strip() or None
                hits.append(rec)
        scanned+=len(mtx); top+=len(mtx)
    ws.close()
    print("===JSON_START===")
    print(json.dumps({"terms":TERMS,"scanned":scanned,"total":total,"n_hits":len(hits),"hits":hits},ensure_ascii=False))
    print("===JSON_END===")

if __name__=="__main__":
    main()
