-- Ferme les trois dernières tables restées accessibles sans compte.
-- APPLIQUÉE EN PRODUCTION le 02/11/2026.
--
-- Elles avaient été épargnées le matin même pour ne pas casser des workflows
-- n8n. Vérification faite depuis :
--
--   • « Bordereaux BQT/RCP » et « Rapprochement Factures » ne sont plus actifs.
--     bordereaux pouvait donc être fermée sans aucune conséquence.
--
--   • « 2026 - Miniatures Factures v2 » est actif, mais ses trois nœuds
--     Supabase — Lister factures, Upload, Écrire URL — portent EN CLAIR la clé
--     publishable SUPPRIMÉE le 31/10 (sb_publishable_xBt6ZaZ…). Il reçoit donc
--     un 401 à chaque passage depuis deux jours et ne génère plus aucune
--     vignette. Il n'y avait rien à préserver.
--
-- Pour le remettre en service : un credential n8n « Header Auth » nommé
-- Supabase service_role (apikey + Authorization: Bearer sb_secret_…) sur ces
-- trois nœuds, à la place de la clé en clair. Voir docs/N8N-INVENTAIRE.md § 2.
-- Le nœud « Résoudre ID » n'est pas concerné : il parle à Microsoft Graph.
--
-- Vérifié après application, depuis l'extérieur avec la clé publique :
-- bordereaux, transactions et factures_achat renvoient toutes trois 200 [].

do $$
declare r record; n int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check from pg_policies
    where schemaname = 'public'
      and tablename in ('bordereaux', 'transactions', 'factures_achat')
      and (qual = 'true' or with_check = 'true')
      and ('public' = any(roles) or 'anon' = any(roles))
  loop
    if r.qual = 'true' and r.with_check = 'true' then
      execute format('alter policy %I on public.%I using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', r.policyname, r.tablename);
    elsif r.qual = 'true' then
      execute format('alter policy %I on public.%I using ((select auth.uid()) is not null)', r.policyname, r.tablename);
    else
      execute format('alter policy %I on public.%I with check ((select auth.uid()) is not null)', r.policyname, r.tablename);
    end if;
    n := n + 1;
  end loop;
  raise notice 'Policies resserrées : %', n;
end $$;
