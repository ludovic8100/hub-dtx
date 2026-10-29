#!/usr/bin/env python3
"""
HUB DTX — Alimente la base de TEST à partir de la PRODUCTION : copie partielle et anonymisée.

Ne nécessite aucun accès direct à Postgres : tout passe par l'API REST (PostgREST) des deux
projets avec leurs clés service_role. Idempotent (upsert sur la clé primaire). Lancé par
l'Action GitHub `seed-test.yml` ou à la main.

Variables d'environnement :
  SOURCE_SUPABASE_URL   (def: production)        SOURCE_SERVICE_KEY   service_role PROD  [requis]
  TARGET_SUPABASE_URL   URL du projet TEST        TARGET_SERVICE_KEY   service_role TEST  [requis]
  SAMPLE_CLIENTS        nb de dossiers clients copiés (def: 300)
  DRY_RUN               "1" => lit la prod, anonymise, affiche, n'écrit rien dans TEST

Garde-fous : refuse d'écrire si TARGET_SUPABASE_URL est l'URL de production ou égale à la source.

Ce qui est copié :
  • Référentiel complet : compagnies, categories(+regles), activites, ticket_categories, parametres_frais,
    taux_reference, hex_cotisations_config, sinistre_workflow_definitions, comptes_bancaires, collaborateurs(+taux),
    producteurs, user_permissions (actifs), rdv_categories, ref_*.
  • Facturation LODE / Hexagroup : clients, devis, factures, lignes, cotisations (coordonnées anonymisées).
  • Échantillon Dynassur : SAMPLE_CLIENTS dossiers clients + leurs contrats, quittances, objets_risque,
    sinistres, segmentation, parentes, famille — noms/coordonnées anonymisés de façon stable (même dossier
    → même pseudonyme).
Ce qui n'est PAS copié : transactions bancaires, factures_achat, notes de frais, tickets/tâches, appels,
credits (ids identité non reportables), config_secrets, logs.
"""
import os, sys, json, hashlib, random, urllib.request, urllib.parse

PROD_URL = "https://tndwonqdbeszkcztkzqe.supabase.co"
SRC_URL = (os.environ.get("SOURCE_SUPABASE_URL") or PROD_URL).rstrip("/")
SRC_KEY = os.environ.get("SOURCE_SERVICE_KEY", "")
DST_URL = (os.environ.get("TARGET_SUPABASE_URL") or "").rstrip("/")
DST_KEY = os.environ.get("TARGET_SERVICE_KEY", "")
N_CLIENTS = int(os.environ.get("SAMPLE_CLIENTS", "300"))
DRY_RUN = os.environ.get("DRY_RUN") == "1"

if not SRC_KEY:
    sys.exit("SOURCE_SERVICE_KEY manquante")
if not DRY_RUN:
    if not DST_URL or not DST_KEY:
        sys.exit("TARGET_SUPABASE_URL / TARGET_SERVICE_KEY manquantes")
    if DST_URL == PROD_URL or DST_URL == SRC_URL:
        sys.exit("REFUS : la cible est la production (ou la source).")

# ── Colonnes générées / identité ALWAYS : jamais envoyées à la cible ─────────────
EXCLURE = {
    "clients": {"gsm_e164", "telfixe_e164"},
    "contrats": {"id"}, "objets_risque": {"id"}, "segmentation": {"id"}, "parentes": {"id"},
    "mouvements_production": {"id", "annee", "mois"},
    "hex_cotisations_lignes": {"total"},
}
# Clé d'upsert quand ce n'est pas `id`
CLE = {"sinistres": "pointeur_sinistre", "contrats": "police_unique", "client_donnees_plus": "dossier"}


def api(base, key, method, path, body=None, prefer=None):
    req = urllib.request.Request(base + "/rest/v1/" + path, method=method,
                                 data=json.dumps(body).encode("utf-8") if body is not None else None)
    req.add_header("apikey", key); req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    if prefer: req.add_header("Prefer", prefer)
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read().decode("utf-8")
        return json.loads(raw) if raw else None


def lire(table, filtre="", page=1000):
    """Lit toute une table (ou un filtre PostgREST) par pages."""
    out, off = [], 0
    while True:
        q = f"{table}?select=*&limit={page}&offset={off}" + (("&" + filtre) if filtre else "")
        rows = api(SRC_URL, SRC_KEY, "GET", q) or []
        out += rows
        if len(rows) < page: break
        off += page
    return out


def ecrire(table, rows):
    if not rows: return 0
    excl = EXCLURE.get(table, set())
    rows = [{k: v for k, v in r.items() if k not in excl} for r in rows]
    if DRY_RUN:
        print(f"  [DRY_RUN] {table}: {len(rows)} lignes (ex: {json.dumps(rows[0], ensure_ascii=False)[:160]}…)")
        return len(rows)
    cle = CLE.get(table, "id")
    n = 0
    for i in range(0, len(rows), 500):
        lot = rows[i:i + 500]
        api(DST_URL, DST_KEY, "POST", f"{table}?on_conflict={cle}", lot, "resolution=merge-duplicates,return=minimal")
        n += len(lot)
    print(f"  {table}: {n} lignes")
    return n


# ── Anonymisation stable (même valeur source → même pseudonyme) ─────────────────
def h(s, n=6):
    return hashlib.sha256(str(s).encode("utf-8")).hexdigest()[:n].upper()

NOMS = ["DUPONT", "MARTIN", "LEFEBVRE", "JANSSENS", "PEETERS", "DUBOIS", "WILLEMS", "LAMBERT", "CLAES", "SIMON"]
PRENOMS = ["Alice", "Bruno", "Chloé", "David", "Emma", "Farid", "Gaëlle", "Hugo", "Inès", "Julien"]

def pseudo_nom(cle):    return NOMS[int(h(cle, 8), 16) % len(NOMS)] + "-" + h(cle, 4)
def pseudo_prenom(cle): return PRENOMS[int(h("p" + str(cle), 8), 16) % len(PRENOMS)]
def pseudo_email(cle):  return f"test-{h(cle, 8).lower()}@example.invalid"
def pseudo_tel(cle):    return "+3247" + str(int(h(cle, 7), 16) % 10_000_000).zfill(7)

def anonymiser_client(c):
    k = c.get("dossier") or c.get("id")
    c.update(nom=pseudo_nom(k), prenom=pseudo_prenom(k), email=pseudo_email(k), gsm=pseudo_tel(k),
             tel_fixe=None, rue="Rue de Test", num_maison=str(int(h(k, 3), 16) % 200 + 1), boite=None,
             date_naissance="1980-01-01", alerte=None)
    return c

def anonymiser_contrat(c):
    k = c.get("dossier") or c.get("id")
    c.update(nom_client=pseudo_nom(k), prenom_client=pseudo_prenom(k), date_naissance=None)
    return c

def anonymiser_quittance(q):
    k = q.get("dossier") or q.get("id")
    q.update(client_nom=pseudo_nom(k), client_prenom=pseudo_prenom(k))
    return q

def anonymiser_sinistre(s):
    s.update(sinistre_nom=pseudo_nom(s.get("pointeur_sinistre")), description="Sinistre de test")
    return s

def anonymiser_objet(o):
    if o.get("type_risque") and "personne" in o["type_risque"].lower():
        o["description"] = pseudo_nom(o.get("dossier")) + " " + pseudo_prenom(o.get("dossier"))
    return o

def anonymiser_lode_client(c):
    k = c["id"]
    c.update(email=pseudo_email(k), telephone=None, gsm=pseudo_tel(k), adresse="Rue de Test " + h(k, 2), notes=None)
    return c

def anonymiser_doc_lode(d):
    k = d.get("client_id") or d["id"]
    d.update(client_email=pseudo_email(k), client_telephone=None, client_adresse="Rue de Test",
             pdf_url=None, pdf_fid=None, billit_order_id=None)
    return d


def main():
    print(f"Source : {SRC_URL}  →  Cible : {DST_URL or '(DRY_RUN)'}  — échantillon : {N_CLIENTS} dossiers")

    # 1) Référentiel
    for t in ["societes", "ref_bureaux", "ref_portefeuilles", "ref_gestionnaires", "ref_sous_agents", "ref_apporteurs",
              "compagnies", "categories", "categories_regles", "activites", "ticket_categories", "parametres_frais",
              "taux_reference", "hex_cotisations_config", "sinistre_workflow_definitions", "rdv_categories"]:
        ecrire(t, lire(t))
    ecrire("comptes_bancaires", [dict(r, ponto_account_id=None) for r in lire("comptes_bancaires")])
    ecrire("collaborateurs", [dict(r, iban=None, bic=None, telephone=None, adresse=None) for r in lire("collaborateurs")])
    ecrire("collaborateur_taux", lire("collaborateur_taux"))
    ecrire("producteurs", [dict(r, telephone=None) for r in lire("producteurs")])
    ecrire("user_permissions", [dict(r, iban=None, premiere_connexion=None, derniere_connexion=None, last_login_at=None)
                                for r in lire("user_permissions", "actif=eq.true")])

    # 2) LODE / Hexagroup
    ecrire("lode_clients", [anonymiser_lode_client(r) for r in lire("lode_clients")])
    ecrire("lode_devis", [anonymiser_doc_lode(r) for r in lire("lode_devis")])
    ecrire("lode_devis_lignes", [dict(r, photos=[]) for r in lire("lode_devis_lignes")])
    ecrire("lode_devis_events", lire("lode_devis_events"))
    ecrire("lode_factures", [anonymiser_doc_lode(r) for r in lire("lode_factures")])
    ecrire("lode_factures_lignes", [dict(r, photos=[]) for r in lire("lode_factures_lignes")])
    ecrire("hex_membres", [dict(r, email=pseudo_email(r["id"]), adresse=None) for r in lire("hex_membres")])
    for t in ["hex_cotisations", "hex_cotisations_lignes", "hex_cotisations_rappels"]:
        ecrire(t, lire(t))

    # 3) Échantillon Dynassur : dossiers tirés de façon reproductible
    tous = [c["dossier"] for c in lire("clients", "select=dossier&dossier=not.is.null") if c.get("dossier")]
    random.Random(42).shuffle(tous)
    dossiers = sorted(tous[:N_CLIENTS])
    print(f"  dossiers retenus : {len(dossiers)}")

    def par_dossiers(table, col="dossier", extra=""):
        rows = []
        for i in range(0, len(dossiers), 80):
            lst = ",".join(urllib.parse.quote(d, safe="") for d in dossiers[i:i + 80])
            rows += lire(table, f"{col}=in.({lst})" + extra)
        return rows

    ecrire("clients", [anonymiser_client(r) for r in par_dossiers("clients")])
    ecrire("contrats", [anonymiser_contrat(r) for r in par_dossiers("contrats") if r.get("police_unique")])
    ecrire("quittances", [anonymiser_quittance(r) for r in par_dossiers("quittances")])
    ecrire("objets_risque", [anonymiser_objet(r) for r in par_dossiers("objets_risque")])
    ecrire("segmentation", par_dossiers("segmentation"))
    ecrire("parentes", par_dossiers("parentes", "dossier_principal"))
    ecrire("famille", [dict(r, nom_lie=pseudo_nom(r["numero_brio"]), prenom_lie=pseudo_prenom(r["numero_brio"]),
                            nom_principal=pseudo_nom(r.get("dossier")), prenom_principal=pseudo_prenom(r.get("dossier")),
                            clef_recherche=None, rue_lie=None, num_rue_lie=None, boite_lie=None)
                       for r in par_dossiers("famille")])
    # sinistres : rattachés par police_objet_lien = police des contrats retenus
    polices = sorted({c["police"] for c in par_dossiers("contrats") if c.get("police")})
    sin = []
    for i in range(0, len(polices), 80):
        lst = ",".join(urllib.parse.quote(p, safe="") for p in polices[i:i + 80])
        sin += lire("sinistres", f"police_objet_lien=in.({lst})")
    ecrire("sinistres", [anonymiser_sinistre(s) for s in sin])
    print("Terminé.")


if __name__ == "__main__":
    main()
