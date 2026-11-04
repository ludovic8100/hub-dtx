"""
Vérifie que l'application Azure du Hub peut lire les fichiers SharePoint.

À lancer une fois, après avoir déposé GRAPH_TENANT_ID, GRAPH_CLIENT_ID et
GRAPH_CLIENT_SECRET dans les secrets GitHub. Le script ne modifie rien : il
demande un jeton, ouvre le site ADMINISTRATION, et compte les documents du
dossier BORDEREAUX.

Il dit en clair ce qui manque quand ça échoue, plutôt que de renvoyer un code
HTTP brut : l'erreur la plus fréquente est l'autorisation ajoutée mais jamais
consentie par un administrateur.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
DOSSIER = "BORDEREAUX"
GRAPH = "https://graph.microsoft.com/v1.0"


def appel(url: str, jeton: str) -> dict:
    requete = urllib.request.Request(url, headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode())


def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT,
        "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=30) as r:
        return json.loads(r.read().decode())["access_token"]


def permissions_du_jeton(jeton: str) -> list[str]:
    """Les autorisations d'application reellement portees par le jeton.

    Un jeton client_credentials liste ses permissions dans la claim `roles` de
    sa charge utile. On la lit telle quelle — pas de verification de signature,
    on ne fait que relire notre propre jeton — ce qui evite de deviner ce qui a
    ete accorde dans le portail, ou d'envoyer un vrai mail pour le decouvrir.

    Le jeton lui-meme n'est jamais affiche.
    """
    try:
        charge = jeton.split(".")[1]
        charge += "=" * (-len(charge) % 4)          # base64url sans remplissage
        return sorted(json.loads(base64.urlsafe_b64decode(charge)).get("roles", []))
    except (IndexError, ValueError, json.JSONDecodeError):
        return []


def main() -> int:
    manquants = [n for n, v in
                 (("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT), ("GRAPH_CLIENT_SECRET", SECRET))
                 if not v]
    if manquants:
        print(f"::error::Secret(s) manquant(s) : {', '.join(manquants)}")
        return 1

    # 1. Le jeton — échoue si le tenant ou l'application n'existe pas
    try:
        jeton = jeton_graph()
        print("1/3  Jeton Microsoft Graph obtenu.")
        roles = permissions_du_jeton(jeton)
        print(f"     Autorisations portees : {', '.join(roles) if roles else '(aucune)'}")
        for besoin, a_quoi in (("Sites.Read.All", "lire les documents SharePoint"),
                               ("Mail.Send", "envoyer devis, factures et rappels"),
                               ("Mail.Read", "lire une boite aux lettres")):
            etat = "oui" if besoin in roles else "NON"
            print(f"       {besoin:<22} {etat:<4} — {a_quoi}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:400]
        print(f"::error::Impossible d'obtenir un jeton ({e.code}). "
              f"Vérifie l'ID du locataire, l'ID d'application et le secret.\n{detail}")
        return 1

    # 2. Le site — échoue si Sites.Read.All manque ou n'a pas reçu le consentement admin
    try:
        site = appel(f"{GRAPH}/sites/{SITE}", jeton)
        print(f"2/3  Site lisible : {site.get('displayName') or site.get('name')}")
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            print("::error::Jeton valide, mais la lecture du site est refusée. "
                  "L'autorisation d'application Sites.Read.All est absente, "
                  "ou le consentement administrateur n'a pas été accordé.")
        else:
            print(f"::error::Lecture du site impossible ({e.code}) : {e.read().decode()[:400]}")
        return 1

    # 3. Le dossier — la vraie cible
    try:
        enfants = appel(
            f"{GRAPH}/sites/{site['id']}/drive/root:/{urllib.parse.quote(DOSSIER)}:/children?$top=5",
            jeton)
        noms = [x.get("name") for x in enfants.get("value", [])][:5]
        print(f"3/3  Dossier {DOSSIER} lisible. Premières entrées : {', '.join(noms) or '(vide)'}")
    except urllib.error.HTTPError as e:
        print(f"::error::Site accessible mais dossier {DOSSIER} illisible ({e.code}).")
        return 1

    print("\nAccès SharePoint opérationnel — l'extraction des relevés peut être construite.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
