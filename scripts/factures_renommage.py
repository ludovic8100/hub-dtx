"""
Renommage des factures d'achat dans SharePoint, depuis la base.

LE SENS COMPTE. Jusqu'ici le Hub lisait le NOM du fichier pour en deduire les
donnees : c'est ce qui a produit une facture a 202 403 EUR (un numero de piece
pris pour un montant) et une autre a 2 025 EUR (un millesime). Ce script fait
l'inverse, et c'est tout son interet : la BASE fait foi, le nom en decoule.

L'identite d'une facture est son identifiant SharePoint, qui survit au
renommage. Un fichier renomme reste donc la meme ligne — contrairement aux
bordereaux, ou le renommage creait une ligne fantome a chaque passage.

Le nom produit :

    AAAAMMJJ - SOCIETE - FOURNISSEUR - n°NUMERO - MONTANT €.pdf
    20260101 - DYNASSUR - ING - n°2026010055196700 - 25,50 €.pdf

Le FOURNISSEUR est le `nom_court` saisi a la main dans Parametres quand il
existe. Sinon le nom officiel nettoye. Le numero est saute quand la facture
n'en porte pas — pas de « n°- » disgracieux.

LA REGLE QUI TIENT TOUT : on ne renomme que lorsqu'on est sur.
Fournisseur, date et montant doivent etre presents. Sinon le fichier garde son
nom et part dans la liste a verifier (`a_verifier`), ou un humain tranche.

    Un fichier au vilain nom coute une recherche.
    Un fichier au MAUVAIS nom est introuvable.

Ce qu'un renommage ne peut pas reparer : un fichier mal RANGE. Les factures
« ITALIATEX GMBH » lues dans COMPTA/FACTURES/_DYNASSUR/ACHATS appartiennent a
un tiers ; aucun nom ne corrigera cela. Elles sont renommables, donc elles
seront renommees — c'est a l'humain de les signaler et de les deplacer.

Reversibilite : `nom_origine` conserve le nom d'avant le PREMIER renommage.
Une erreur se defait.

Variables d'environnement :
  GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET   application Azure
  SUPABASE_URL, SUPABASE_SERVICE_KEY                      voir scripts/_env.py
  APP_ENV            production (defaut) | test
  DRY_RUN=1          affiche les renommages, n'en fait aucun
  FILTRE_DOSSIER     restreint a un dossier, ex. « _DYNASSUR/ACHATS/2025 »
  LOT                nombre maximum de fichiers a renommer ; 0 = tous
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from _env import APP_ENV, DRY_RUN, SUPABASE_SERVICE_KEY, SUPABASE_URL, banniere

GRAPH = "https://graph.microsoft.com/v1.0"
SITE = "dynassur.sharepoint.com:/sites/ADMINISTRATION"
FILTRE_DOSSIER = os.environ.get("FILTRE_DOSSIER", "").strip()
LOT = int(os.environ.get("LOT", "0") or 0)

TENANT = os.environ.get("GRAPH_TENANT_ID", "").strip()
CLIENT = os.environ.get("GRAPH_CLIENT_ID", "").strip()
SECRET = os.environ.get("GRAPH_CLIENT_SECRET", "").strip()

# Caracteres que SharePoint refuse dans un nom de fichier.
INTERDITS = r'[\\/:*?"<>|#%{}~&]'
FORMES = re.compile(
    r"\b(S\.?A\.?|N\.?V\.?|S\.?R\.?L\.?|SPRL|BVBA|BV|GIE|SCRL|SC|ASBL|VZW|LLC|"
    r"LTD|LIMITED|INC|CORP|CORPORATION|GMBH|PLC|SAS|EURL|CVBA|AG|KG)\b", re.I)
PAYS = re.compile(
    r"\b(BELGIUM|BELGIQUE|BELGIE|BELGI[ËE]|EUROPE|EU|INTERNATIONAL|FRANCE|"
    r"NEDERLAND|IRELAND|OPERATIONS)\b", re.I)


# ── Microsoft Graph ───────────────────────────────────────────────────────────

def jeton_graph() -> str:
    corps = urllib.parse.urlencode({
        "client_id": CLIENT, "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=corps), timeout=30) as r:
            return json.loads(r.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"::error::Jeton Microsoft Graph refuse ({e.code}) : "
                         f"{e.read().decode()[:400]}")


def site_id(jeton: str) -> str:
    req = urllib.request.Request(f"{GRAPH}/sites/{SITE}",
                                 headers={"Authorization": f"Bearer {jeton}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["id"]


def renommer_fichier(jeton: str, sid: str, item_id: str, nouveau: str):
    """PATCH Graph. C'est la SEULE ecriture que ce script fait dans SharePoint :
    un changement de nom. Jamais de deplacement, jamais de suppression."""
    corps = json.dumps({"name": nouveau}).encode()
    req = urllib.request.Request(
        f"{GRAPH}/sites/{sid}/drive/items/{item_id}",
        data=corps, method="PATCH",
        headers={"Authorization": f"Bearer {jeton}",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


# ── Construction du nom ───────────────────────────────────────────────────────

#: Places de marche. Sur Amazon, AliExpress ou eBay, l'emetteur LEGAL de la
#  facture est le vendeur, pas la plateforme : « 20251229 - DYNASSUR - AMAZON -
#  DE5003GSBFQV3I » a pour emetteur « David Lurding ». Le PDF dit vrai, mais
#  dans six mois « David Lurding » ne rappelle rien a personne, tandis
#  qu'« Amazon » situe immediatement l'achat.
#
#  On nomme donc « Amazon — David Lurding » : juridiquement exact ET
#  retrouvable. C'est la SEULE exception ou l'ancien nom de fichier sert
#  encore de source — non pas comme donnee, mais comme indice de provenance,
#  une information que le PDF ne porte pas.
PLACES = {
    "AMAZON": "Amazon", "AMZN": "Amazon",
    "ALIEXPRESS": "AliExpress", "EBAY": "eBay",
    "ETSY": "Etsy", "TEMU": "Temu",
}


def place_de_marche(ancien_nom: str) -> str | None:
    cle = re.sub(r"[^A-Z]", "", (ancien_nom or "").upper())
    for motif, libelle in PLACES.items():
        if motif in cle:
            return libelle
    return None


def nettoyer_fournisseur(nom_court, nom_officiel) -> str:
    """Le nom court saisi a la main prime. Sinon on degrossit l'officiel."""
    if nom_court and nom_court.strip():
        return nom_court.strip()[:30]
    t = re.sub(r"\([^)]*\)", " ", nom_officiel or "")
    t = FORMES.sub(" ", t)
    t = PAYS.sub(" ", t)
    t = re.sub(r"[,;/]", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" -.&")
    return (t or (nom_officiel or "")).strip()[:30]


def fmt_montant(m) -> str:
    """1234.5 -> « 1.234,50 € », a la belge."""
    try:
        v = float(m)
    except (TypeError, ValueError):
        return ""
    entier, dec = divmod(round(v * 100), 100)
    milliers = f"{entier:,}".replace(",", ".")
    return f"{milliers},{dec:02d} €"


def construire_nom(ligne) -> str | None:
    """Le nom cible, ou None si une piece manque. Ne devine jamais."""
    date = (ligne.get("date_facture") or "")[:10]
    if len(date) != 10:
        return None
    fournisseur = nettoyer_fournisseur(ligne.get("nom_court"), ligne.get("fournisseur"))
    if not fournisseur:
        return None

    # Achat sur une place de marche : on prefixe, sauf si le vendeur EST la
    # plateforme (« Amazon Business EU » n'a pas besoin de « Amazon — Amazon »).
    place = place_de_marche(ligne.get("nom_origine") or ligne.get("nom"))
    if place and place.upper() not in fournisseur.upper():
        fournisseur = f"{place} — {fournisseur}"[:48]
    montant = fmt_montant(ligne.get("montant"))
    if not montant:
        return None

    morceaux = [date.replace("-", ""), (ligne.get("societe") or "").upper(), fournisseur]
    numero = (ligne.get("numero") or "").strip()
    if numero and numero not in ("-", "n/a", "N/A"):
        morceaux.append("n°" + numero[:40])
    morceaux.append(montant)

    nom = " - ".join(m for m in morceaux if m)
    nom = re.sub(INTERDITS, "", nom)
    nom = re.sub(r"\s+", " ", nom).strip()
    # SharePoint plafonne le chemin ; on borne le nom bien en dessous.
    return (nom[:180] + ".pdf") if nom else None


# ── Supabase ──────────────────────────────────────────────────────────────────

def supabase(methode: str, chemin: str, charge=None, entetes=None):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{chemin}",
        data=json.dumps(charge).encode() if charge is not None else None,
        headers={"apikey": SUPABASE_SERVICE_KEY,
                 "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                 "Content-Type": "application/json", **(entetes or {})},
        method=methode)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            corps = r.read().decode().strip()
            return json.loads(corps) if corps else None
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode()[:800]
        except Exception:
            pass
        raise SystemExit(f"::error::Supabase a refuse {methode} {chemin} ({e.code}).\n"
                         f"  Reponse : {detail}")


def a_traiter():
    """Les factures d'achat pas encore renommees, avec leur fournisseur."""
    filtre = "&renomme_le=is.null&sens=eq.achat&fichier_id=like.01*"
    if FILTRE_DOSSIER:
        filtre += "&url=like.*" + urllib.parse.quote(FILTRE_DOSSIER, safe="") + "*"
    lignes = supabase(
        "GET",
        "factures_achat?select=id,fichier_id,nom,societe,montant,date_facture,"
        "fournisseur,numero,nom_origine,fournisseur_id,"
        "fournisseurs(nom_court,nom_officiel)" + filtre + "&order=date_facture.desc.nullslast"
    ) or []
    for l in lignes:
        f = l.get("fournisseurs") or {}
        l["nom_court"] = f.get("nom_court")
        if not l.get("fournisseur"):
            l["fournisseur"] = f.get("nom_officiel")
    return lignes


def main() -> int:
    banniere("factures-renommage")
    for nom, val in (("GRAPH_TENANT_ID", TENANT), ("GRAPH_CLIENT_ID", CLIENT),
                     ("GRAPH_CLIENT_SECRET", SECRET)):
        if not val:
            raise SystemExit(f"::error::{nom} manquant.")

    jeton = jeton_graph()
    sid = site_id(jeton)
    lignes = a_traiter()
    print(f"{len(lignes)} facture(s) candidate(s)"
          + (f" dans « {FILTRE_DOSSIER} »" if FILTRE_DOSSIER else "")
          + f" — {'DRY_RUN' if DRY_RUN else 'RENOMMAGE REEL'}\n", flush=True)

    renommes = inchanges = a_verifier = erreurs = 0
    motifs = {}
    vus = set()

    for i, l in enumerate(lignes, 1):
        if LOT and renommes >= LOT:
            print(f"\nLot de {LOT} atteint, arret.", flush=True)
            break

        cible = construire_nom(l)
        if not cible:
            manques = [m for m, v in (("fournisseur", l.get("fournisseur")),
                                      ("date", l.get("date_facture")),
                                      ("montant", l.get("montant"))) if not v]
            motif = "manque : " + ", ".join(manques)
            motifs[motif] = motifs.get(motif, 0) + 1
            a_verifier += 1
            if not DRY_RUN:
                supabase("PATCH", f"factures_achat?id=eq.{l['id']}",
                         {"a_verifier": True, "motif_verification": motif},
                         {"Prefer": "return=minimal"})
            continue

        if cible == l["nom"]:
            inchanges += 1
            continue

        # Deux factures ne doivent pas viser le meme nom dans un meme passage.
        if cible.lower() in vus:
            base, ext = cible[:-4], cible[-4:]
            n = 2
            while f"{base} ({n}){ext}".lower() in vus:
                n += 1
            cible = f"{base} ({n}){ext}"
        vus.add(cible.lower())

        print(f"[{i}/{len(lignes)}] {l['nom'][:58]}\n            → {cible}", flush=True)

        if DRY_RUN:
            renommes += 1
            continue

        try:
            renommer_fichier(jeton, sid, l["fichier_id"], cible)
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode()[:300]
            except Exception:
                pass
            print(f"    REFUSE par SharePoint ({e.code}) : {detail}", flush=True)
            erreurs += 1
            continue
        except Exception as e:
            print(f"    erreur inattendue, fichier ignore : {type(e).__name__} : {e}", flush=True)
            erreurs += 1
            continue

        # Le nom d'origine n'est ecrit QU'UNE FOIS : au premier renommage.
        charge = {"nom": cible, "renomme_le": "now()", "a_verifier": False,
                  "motif_verification": None}
        if not l.get("nom_origine"):
            charge["nom_origine"] = l["nom"]
        supabase("PATCH", f"factures_achat?id=eq.{l['id']}", charge,
                 {"Prefer": "return=minimal"})
        renommes += 1

    print(f"\n{renommes} renomme(s), {inchanges} deja au bon nom, "
          f"{a_verifier} a verifier, {erreurs} refuse(s).", flush=True)
    if motifs:
        print("\nCe qui attend un humain :", flush=True)
        for m, n in sorted(motifs.items(), key=lambda x: -x[1]):
            print(f"  {n:>5}  {m}", flush=True)
    print(f"LIGNES_ECRITES={renommes}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
