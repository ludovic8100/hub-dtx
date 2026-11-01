"""
Journal d'exécution d'un job (garde-fou `v_jobs_sante`).

Appelé par les GitHub Actions pour déclarer le début puis la fin d'un job, afin
que le Hub sache si la synchro a réellement tourné — et le signale quand ce n'est
plus le cas. Motif : la synchro Ponto a tourné 11 jours dans le vide sans alerte.

Usage :
    python scripts/job_journal.py debut <job> [declencheur]   -> imprime l'id
    python scripts/job_journal.py fin <id> <succes|echec> [lignes_ecrites] [message]

Silencieux par conception : un journal indisponible ne doit jamais faire échouer
le job qu'il observe. Sort toujours en code 0.
"""
import json
import sys
import urllib.error
import urllib.request

from _env import SUPABASE_URL, SUPABASE_SERVICE_KEY


def _rpc(fonction: str, charge: dict):
    if not SUPABASE_SERVICE_KEY:
        return None
    requete = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/rpc/{fonction}",
        data=json.dumps(charge).encode(),
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(requete, timeout=15) as reponse:
            corps = reponse.read().decode().strip()
            return json.loads(corps) if corps else None
    except (urllib.error.URLError, ValueError, OSError) as e:
        print(f"[job_journal] {fonction} indisponible : {e}", file=sys.stderr)
        return None


def main() -> int:
    if len(sys.argv) < 2:
        return 0
    action = sys.argv[1]

    if action == "debut":
        job = sys.argv[2]
        declencheur = sys.argv[3] if len(sys.argv) > 3 else "cron"
        identifiant = _rpc("job_debut", {"p_job": job, "p_declencheur": declencheur})
        print(identifiant if identifiant is not None else "")

    elif action == "fin":
        brut = (sys.argv[2] or "").strip()
        if not brut:
            return 0            # début non enregistré : rien à clôturer
        lignes = sys.argv[4] if len(sys.argv) > 4 else ""
        _rpc("job_fin", {
            "p_id": int(brut),
            "p_statut": sys.argv[3],
            "p_lignes_ecrites": int(lignes) if lignes.isdigit() else None,
            "p_lignes_lues": None,
            "p_message": sys.argv[5] if len(sys.argv) > 5 else None,
            "p_detail": None,
        })

    return 0


if __name__ == "__main__":
    sys.exit(main())
