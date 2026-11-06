-- Même défaut que next_lode_numero, trouvé en balayant toutes les fonctions
-- exécutables par `anon` : la numérotation de DTX et de Dynassur était elle
-- aussi ouverte à Internet. Fermer une société sur trois n'aurait rien réglé.
--
-- Rappel de la règle (CLAUDE.md) : DEUX sources à couper, PUBLIC et anon.

revoke execute on function public.next_dtx_numero(text) from public, anon;
revoke execute on function public.next_dyn_numero(text) from public, anon;
grant  execute on function public.next_dtx_numero(text) to authenticated, service_role;
grant  execute on function public.next_dyn_numero(text) to authenticated, service_role;

revoke usage, update, select on sequence
  public.seq_dtx_devis_2026, public.seq_dtx_facture_2026,
  public.seq_dyn_devis_2026, public.seq_dyn_facture_2026
from public, anon;

grant usage, select on sequence
  public.seq_dtx_devis_2026, public.seq_dtx_facture_2026,
  public.seq_dyn_devis_2026, public.seq_dyn_facture_2026
to authenticated, service_role;
