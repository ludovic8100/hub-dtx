#!/usr/bin/env python3
"""HUB DTX — Sonde Qlik (LECTURE SEULE) sur ObjetDeRisque.
Grain (PoliceUnique × Description × Guarantee.FR) : Description est une DIMENSION,
donc jamais écrasée même quand un contrat couvre plusieurs objets sous une même garantie
(cas des contrats DAS/flotte de protection juridique).
Modes : PROBE_DOSSIER défini -> tout le dossier ; sinon -> Description contient PROBE_TERMS.
Sortie JSON entre ===JSON_START=== / ===JSON_END===.
Env : QLIK_API_KEY [requis], PROBE_DOSSIER (ex "575/00"), PROBE_TERMS (def "2ahs210").
"""
import os, json, ssl, sys
from websocket import create_connection

HOST="h6las9b8umw8ppb.eu.qlikcloud.com"; APPID="111414a5-e645-4397-8311-9bed88033407"
KEY=os.environ.get("QLIK_API_KEY","")
DOSSIER=os.environ.get("PROBE_DOSSIER","").strip()
TERMS=[t for t in os.environ.get("PROBE_TERMS","2ahs210").lower().split() if t]

DIMS=["PoliceUnique","Description","Guarantee.FR"]      # 3 dimensions
ONLY=lambda f:f"=Only([{f}])"
MEAS=[("Police","police"),("DossierUnique","dossier"),("Compagnie","compagnie"),
 ("Domain.FR","domaine"),("Policy.Type.FR","type_police"),("RiskType.FR","type_risque"),
 ("Situation.FR","situation"),("Etat contrat","etat_contrat"),
 ("Sous-agent (nom)","sous_agent"),("Gestionnaire","gestionnaire"),("Dossier_Lié_Type","lien_type")]

def main():
    if not KEY: sys.exit("QLIK_API_KEY manquant")
    ws=create_connection(f"wss://{HOST}/app/{APPID}",header=[f"Authorization: Bearer {KEY}"],
                         timeout=300,sslopt={"cert_reqs":ssl.CERT_NONE})
    _id=[0]
    def c(m,h,p):
        _id[0]+=1
        ws.send(json.dumps({"jsonrpc":"2.0","id":_id[0],"method":m,"handle":h,"params":p}))
        while True:
            r=json.loads(ws.recv())
            if r.get("id")==_id[0]:
                if "error" in r: raise RuntimeError(f"{m}: {r['error']}")
                return r["result"]
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
            rec={"police_unique":(row[0].get("qText") or "").strip() or None,
                 "description":(row[1].get("qText") or "").strip() or None,
                 "garantie":(row[2].get("qText") or "").strip() or None}
            for j,(_,col) in enumerate(MEAS):
                rec[col]=(row[len(DIMS)+j].get("qText") or "").strip() or None
            desc=(rec.get("description") or "").lower()
            if DOSSIER:
                keep=((rec.get("dossier") or "")==DOSSIER)
            else:
                keep=all(t in desc for t in TERMS)
            if keep: hits.append(rec)
        scanned+=len(mtx); top+=len(mtx)
    ws.close()
    print("===JSON_START===")
    print(json.dumps({"mode":"dossier" if DOSSIER else "terms","dossier":DOSSIER,"terms":TERMS,
                      "scanned":scanned,"total":total,"n_hits":len(hits),"hits":hits},ensure_ascii=False))
    print("===JSON_END===")

if __name__=="__main__":
    main()
