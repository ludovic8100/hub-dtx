"""
Récupère un fichier du dossier SharePoint DOWNLOAD et l'extrait.

POURQUOI CE SCRIPT EXISTE

Le connecteur Microsoft 365 d'une session Claude lit le texte, les PDF et les
images, mais PAS les archives : « This file's type (application/zip) can't be
read through this connector. » Un package de design livré en ZIP est donc
invisible depuis la session, alors que les GitHub Actions, elles, ont déjà les
accès Graph qu'il faut.

Ce script fait le pont. Il ne modifie RIEN dans SharePoint : il télécharge.

LE PIÈGE DU TÉLÉCHARGEMENT GRAPH

`/content` répond par une redirection 302 vers un lien pré-signé. Suivre cette
redirection en gardant l'en-tête Authorization fait échouer la requête côté
CDN. On lit donc `@microsoft.graph.downloadUrl` dans les métadonnées, et on
télécharge ce lien SANS en-tête — c'est lui qui porte déjà sa signature.
"""
import json
import os
import pathlib
import sys
import urllib.parse
import urllib.request
import zipfile

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

FICHIER = os.environ.get("FICHIER", "").strip()
SORTIE = pathlib.Path(os.environ.get("SORTIE", "package"))


def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT,
        "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=60) as r:
        return json.loads(r.read().decode())["access_token"]


def graph(chemin: str, jeton: str) -> dict:
    requete = urllib.request.Request(GRAPH + chemin, headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return json.loads(reponse.read().decode())


def arbre(racine: pathlib.Path) -> None:
    """Liste tout ce qui a été extrait, avec les tailles. C'est l'inventaire
    que la session lira pour savoir quoi demander ensuite."""
    entrees = sorted(racine.rglob("*"), key=lambda p: str(p).lower())
    for p in entrees:
        rel = p.relative_to(racine)
        if p.is_dir():
            print(f"  [dossier] {rel}/")
        else:
            print(f"  {p.stat().st_size:>10} o  {rel}")


def main() -> int:
    manquants = [n for n, v in (("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                                ("GRAPH_CLIENT_SECRET", SECRET), ("FICHIER", FICHIER)) if not v]
    if manquants:
        print(f"::error::Variables manquantes : {', '.join(manquants)}")
        return 1

    jeton = jeton_graph()
    site_id = graph(f"/sites/{SITE}", jeton)["id"]

    chemin = urllib.parse.quote(f"DOWNLOAD/{FICHIER}")
    meta = graph(f"/sites/{site_id}/drive/root:/{chemin}", jeton)
    taille = meta.get("size", 0)
    lien = meta.get("@microsoft.graph.downloadUrl")
    if not lien:
        print("::error::Pas de lien de téléchargement dans les métadonnées.")
        return 1

    print(f"Fichier   : {meta.get('name')}")
    print(f"Taille    : {taille} octets")
    print(f"Modifié   : {meta.get('lastModifiedDateTime')}")

    archive = pathlib.Path("telecharge.zip")
    with urllib.request.urlopen(lien, timeout=600) as r, archive.open("wb") as f:
        while True:
            bloc = r.read(1 << 20)
            if not bloc:
                break
            f.write(bloc)
    print(f"Téléchargé: {archive.stat().st_size} octets")

    SORTIE.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        # Un ZIP peut contenir des chemins qui sortent du dossier cible
        # (« ../.. »). extractall de Python 3.12 les neutralise, mais on le
        # dit ici pour que personne ne croie que c'est un oubli.
        z.extractall(SORTIE)
    print(f"\nCONTENU EXTRAIT dans {SORTIE}/ :\n")
    arbre(SORTIE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
