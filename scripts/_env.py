"""
Configuration par environnement — SCRIPTS PYTHON (GitHub Actions / exécution locale).

Pendant de `src/config/env.js` et `api/_lib/env.js`. Les scripts font `from _env import *`
(Python ajoute le dossier du script au sys.path, donc l'import fonctionne depuis la racine
du dépôt : `python scripts/qlik_clients.py`).

Variables :
  APP_ENV               production (défaut) | test
  SUPABASE_URL          URL du projet Supabase ; sans valeur → production, sauf en test (erreur)
  SUPABASE_SERVICE_KEY  clé service_role (secret GitHub) ; jamais de défaut
  DRY_RUN               "1" → extrait et affiche, n'écrit rien
"""
import os

PROD_SUPABASE_URL = "https://tndwonqdbeszkcztkzqe.supabase.co"

APP_ENV = os.environ.get("APP_ENV", "production").strip().lower() or "production"
IS_PROD = APP_ENV == "production"
IS_TEST = not IS_PROD


def _supabase_url() -> str:
    v = (os.environ.get("SUPABASE_URL") or "").strip().rstrip("/")
    if v:
        return v
    if IS_TEST:
        raise SystemExit(
            f"[Hub scripts] SUPABASE_URL manquante alors que APP_ENV={APP_ENV} : "
            "refus de retomber sur la production."
        )
    return PROD_SUPABASE_URL


SUPABASE_URL = _supabase_url()
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DRY_RUN = os.environ.get("DRY_RUN") == "1"


def banniere(nom: str) -> None:
    """Affiche l'environnement visé en tête de log (utile dans les Actions)."""
    mode = "DRY_RUN" if DRY_RUN else "ÉCRITURE RÉELLE"
    print(f"[{nom}] env={APP_ENV} supabase={SUPABASE_URL} mode={mode}", flush=True)


def refuser_ecriture_sharepoint(quoi: str) -> bool:
    """En TEST, aucune ecriture ne doit partir vers le VRAI SharePoint.

    APP_ENV=test isole la base Supabase, et c'est tout : les scripts parlent au
    meme site SharePoint dans les deux cas. Un renommage lance en test prendrait
    donc ses ordres dans la base de TEST et modifierait de VRAIS documents.

    Mesure du 07/11/2026 : deux scripts ecrivent dans SharePoint
    (factures_renommage, fdp_renommage). Les autres n'ecrivent que dans Supabase.

    Refuser est le bon defaut : un dossier _TEST a part se perime et donne une
    fausse assurance, alors qu'un refus se voit dans le journal. Le jour ou un
    renommage doit etre repete en test, c'est la lecture qu'on verifie, pas
    l'ecriture.

    Renvoie True quand l'ecriture doit etre SAUTEE.
    """
    if IS_TEST:
        print(f"[TEST] ecriture SharePoint refusee : {quoi}", flush=True)
        return True
    return False
