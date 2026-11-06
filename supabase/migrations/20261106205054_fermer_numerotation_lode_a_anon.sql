-- La numérotation des devis et factures LODE était appelable par `anon`,
-- c'est-à-dire par n'importe qui sur Internet : la clé anon est dans le
-- bundle du navigateur ET dans ce dépôt public. Chaque appel consomme un
-- numéro, et une séquence Postgres ne recule jamais — le trou est définitif
-- dans une numérotation qui doit être continue par la loi.
--
-- next_lode_numero est SECURITY INVOKER et ne fait que des nextval() : aucune
-- politique RLS ne la protégeait, puisqu'elle ne touche aucune table.
--
-- DEUX SOURCES À COUPER, comme documenté dans CLAUDE.md. L'ACL constaté avant
-- correction était :  =X/postgres | anon=X/postgres | ...
--   =X/postgres     -> PUBLIC (Postgres l'accorde à toute fonction nouvelle)
--   anon=X/postgres -> le privilège par défaut de Supabase, nominatif
-- Révoquer une seule des deux ne change rien.

revoke execute on function public.next_lode_numero(text) from public, anon;
grant  execute on function public.next_lode_numero(text) to authenticated, service_role;

-- Défense en profondeur : anon n'a aucune raison de toucher ces séquences,
-- même si une future fonction venait à les exposer autrement.
revoke usage, update, select on sequence
  public.seq_lode_devis_2026,
  public.seq_lode_facture_2026,
  public.seq_lode_nc_2026
from public, anon;

grant usage, select on sequence
  public.seq_lode_devis_2026,
  public.seq_lode_facture_2026,
  public.seq_lode_nc_2026
to authenticated, service_role;
