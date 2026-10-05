#!/usr/bin/env python3
"""HUB DTX - Liste les apps Qlik Cloud du tenant (lecture seule, API REST).
But: reperer une eventuelle app contenant le detail credit (taux/capital/duree)
absent de l'app BRIO Analytics principale. N'ecrit rien.
Env: QLIK_API_KEY [requis], QLIK_HOST (def h6las9b8umw8ppb.eu.qlikcloud.com)
"""
import os, sys, json, ssl, urllib.request
HOST = os.environ.get("QLIK_HOST", "h6las9b8umw8ppb.eu.qlikcloud.com")
KEY  = os.environ.get("QLIK_API_KEY", "")

def get(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {KEY}",
                                               "Accept": "application/json"})
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
        return json.loads(r.read().decode())

def main():
    if not KEY:
        sys.exit("QLIK_API_KEY manquant")
    url = f"https://{HOST}/api/v1/items?resourceType=app&limit=100"
    apps = []
    while url:
        d = get(url)
        apps += d.get("data", [])
        url = ((d.get("links", {}) or {}).get("next") or {}).get("href")
    print(f"\n========== {len(apps)} APP(S) QLIK ==========\n")
    KW = ["cred","créd","pret","prêt","lening","krediet","loan","solde","srdu","financ","bank","leasing"]
    for a in sorted(apps, key=lambda x: (x.get("name") or "").lower()):
        name = a.get("name","?"); rid = a.get("resourceId","?")
        desc = (a.get("description") or "").replace("\n"," ")
        flag = "   <== CANDIDAT CREDIT" if any(k in (name+" "+desc).lower() for k in KW) else ""
        print(f"- {name}{flag}")
        print(f"    app_id={rid}  desc={desc[:90]}")
    print("\n(CANDIDAT = nom/desc evoquant credit/pret/banque/leasing -> a introspecter)")

if __name__ == "__main__":
    main()
