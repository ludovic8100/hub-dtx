#!/usr/bin/env python3
"""
HUB DTX — Import du rapport Brio « Preneur avec relation » (Excel) -> table public.famille.

Le rapport Brio (feuille « Sélection et Rapport ») a 7 colonnes :
  Dossier | Nom | Prénom | Type de relation - Libellé | Type de groupe - Libellé | Nom (lié) | Prénom (lié)
Il n'a pas de numéro Brio : on fabrique une clé stable `XLS-<sha1>` à partir de
(dossier, type, NOM lié, PRÉNOM lié), ce qui rend l'import idempotent (upsert sur numero_brio).

Règles :
  - lignes sans dossier, sans type ou sans nom lié : ignorées ;
  - doublons sur la clé : une seule ligne conservée ;
  - personne morale si le type est une société (Firme, Organisation, Employeur, Société mère,
    Filiale, Avocat pour (cie)) ou si le prénom lié est vide ;
  - clef_recherche = « NOM PRÉNOM » du lié en majuscules (la vue v_famille_clients retire espaces et tirets) ;
  - relation_active = true (le rapport ne liste que les relations en cours).

Usage : python scripts/import_famille_xlsx.py chemin/vers/Preneur_Avec_Relation.xlsx
Env   : SUPABASE_SERVICE_KEY (obligatoire hors DRY_RUN), SUPABASE_URL (sinon production), DRY_RUN=1.
Dépendance : openpyxl (pip install openpyxl).
"""
import hashlib, json, os, re, sys, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from _env import SUPABASE_URL  # voir scripts/_env.py

SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DRY_RUN = os.environ.get("DRY_RUN") == "1"
MORALE_TYPES = {"firme", "organisation(professionnelle)", "employeur", "société mère", "filiale", "avocat pour (cie)"}
COLS = ["numero_brio", "dossier", "nom_principal", "prenom_principal", "type_relation_libelle", "type_groupe_libelle",
        "relation_active", "physique_morale_valeur", "physique_morale_libelle", "nom_lie", "prenom_lie", "clef_recherche"]


def clean(v):
    v = "" if v is None else str(v).strip()
    return v or None


def lire_excel(chemin):
    import openpyxl
    ws = openpyxl.load_workbook(chemin, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    entete = [clean(x) for x in rows[0]]
    if (entete[0] or "").lower() != "dossier" or len(entete) < 7:
        sys.exit(f"Format inattendu, en-tête lue : {entete}")
    out = {}
    for r in rows[1:]:
        dossier, nom, prenom, typ, grp, nom_lie, prenom_lie = (clean(x) for x in (list(r) + [None] * 7)[:7])
        if not dossier or not typ or not nom_lie:
            continue
        cle = "|".join([dossier, typ.lower(), nom_lie.upper(), (prenom_lie or "").upper()])
        num = "XLS-" + hashlib.sha1(cle.encode("utf-8")).hexdigest()[:16]
        morale = typ.lower() in MORALE_TYPES or prenom_lie is None
        out[num] = dict(
            numero_brio=num, dossier=dossier, nom_principal=nom, prenom_principal=prenom,
            type_relation_libelle=typ, type_groupe_libelle=grp, relation_active=True,
            physique_morale_valeur="2" if morale else "1",
            physique_morale_libelle="Personne morale" if morale else "Personne physique",
            nom_lie=nom_lie, prenom_lie=prenom_lie,
            clef_recherche=re.sub(r"\s+", " ", f"{nom_lie} {prenom_lie or ''}").strip().upper(),
        )
    return list(out.values()), len(rows) - 1


def upsert(rows):
    h = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json",
         "Prefer": "resolution=merge-duplicates,return=minimal"}
    url = f"{SUPABASE_URL}/rest/v1/famille?on_conflict=numero_brio"
    B = 500
    for i in range(0, len(rows), B):
        req = urllib.request.Request(url, data=json.dumps(rows[i:i + B]).encode(), method="POST", headers=h)
        urllib.request.urlopen(req, timeout=120)
        print(f"  {min(i + B, len(rows))}/{len(rows)}")


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage : import_famille_xlsx.py <fichier.xlsx>")
    rows, brutes = lire_excel(sys.argv[1])
    print(f"{brutes} lignes Excel -> {len(rows)} relations à charger "
          f"({sum(1 for r in rows if r['physique_morale_valeur'] == '2')} personnes morales)")
    if DRY_RUN:
        for r in rows[:8]:
            print(f"   {r['dossier']:9} {r['type_relation_libelle'][:22]:22} -> {r['nom_lie']} {r['prenom_lie'] or ''}")
        print("DRY_RUN — aucune écriture.")
        return
    if not SUPA_KEY:
        sys.exit("SUPABASE_SERVICE_KEY manquant")
    upsert(rows)
    print("OK.")


if __name__ == "__main__":
    main()
