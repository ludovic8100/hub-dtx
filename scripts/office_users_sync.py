#!/usr/bin/env python3
"""
HUB DTX — Synchronisation des utilisateurs Office 365 (Microsoft Graph) vers
la table public.user_permissions.

Principe :
  - liste les utilisateurs du tenant via Graph (app-only) ;
  - crée une fiche pour chaque NOUVEL utilisateur (désactivé, sans aucun droit —
    l'admin coche ensuite les accès) ;
  - pour les utilisateurs existants : met à jour uniquement les champs O365
    (object_id, display_name) — NE TOUCHE JAMAIS aux droits ni au rôle.

Env : GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, SUPABASE_SERVICE_KEY
      (+ SUPABASE_URL optionnel).
"""
import os, json, sys, urllib.request, urllib.parse

TENANT = os.environ.get("GRAPH_TENANT_ID", "29a87d83-130a-42d9-82c9-29c930952c76")
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "d38526f5-527b-44f6-9586-0d5bb10acc26")
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "")
SUPA_URL = os.environ.get("SUPABASE_URL", "https://tndwonqdbeszkcztkzqe.supabase.co")
SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def graph_token():
    data = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default", "grant_type": "client_credentials",
    }).encode()
    req = urllib.request.Request(f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token", data=data)
    return json.load(urllib.request.urlopen(req))["access_token"]


def graph_users(token):
    users, url = [], ("https://graph.microsoft.com/v1.0/users"
                      "?$select=id,displayName,mail,userPrincipalName,accountEnabled,givenName,surname&$top=999")
    while url:
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        d = json.load(urllib.request.urlopen(req))
        users += d.get("value", [])
        url = d.get("@odata.nextLink")
    return users


def supa(method, path, body=None, prefer=None):
    h = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    req = urllib.request.Request(SUPA_URL + "/rest/v1" + path,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers=h)
    r = urllib.request.urlopen(req)
    txt = r.read().decode()
    return json.loads(txt) if txt else None


def main():
    if not SECRET:
        sys.exit("GRAPH_CLIENT_SECRET manquant")
    if not SUPA_KEY:
        sys.exit("SUPABASE_SERVICE_KEY manquant")
    print("Token Graph…")
    tok = graph_token()
    print("Liste des utilisateurs O365…")
    users = graph_users(tok)
    print(f"  {len(users)} utilisateurs renvoyés par Graph")

    # utilisateurs déjà connus
    existing = {}
    start = 0
    while True:
        page = supa("GET", f"/user_permissions?select=user_email,o365_object_id&limit=1000&offset={start}")
        if not page:
            break
        for u in page:
            existing[(u.get("user_email") or "").lower()] = u
        if len(page) < 1000:
            break
        start += 1000
    print(f"  {len(existing)} utilisateurs déjà en base")

    created = updated = skipped = 0
    for u in users:
        email = (u.get("mail") or u.get("userPrincipalName") or "").strip()
        if not email or "#EXT#" in email or not u.get("accountEnabled"):
            skipped += 1
            continue
        code = email.split("@")[0].upper()[:3]
        if email.lower() in existing:
            # MAJ champs O365 uniquement (jamais les droits)
            supa("PATCH", f"/user_permissions?user_email=eq.{urllib.parse.quote(email)}",
                 {"o365_object_id": u.get("id"), "o365_display_name": u.get("displayName")},
                 prefer="return=minimal")
            updated += 1
        else:
            row = {
                "user_email": email, "nom": u.get("displayName"),
                "role": "user", "actif": False,
                "o365_object_id": u.get("id"), "o365_display_name": u.get("displayName"),
                "o365_only": True, "collab_code": code,
            }
            try:
                supa("POST", "/user_permissions", [row], prefer="return=minimal")
                created += 1
            except Exception as e:
                print("   ERR insert", email, e)
                skipped += 1
    print(f"\nCréés : {created} | mis à jour (O365) : {updated} | ignorés : {skipped}")


if __name__ == "__main__":
    main()
