-- Fermeture de l'accès anonyme à la base — APPLIQUÉE EN PRODUCTION le 02/11/2026.
--
-- 1. Retrait des 91 policies temp_acces_libre_sans_login posées le 31/10.
-- 2. Les policies USING (true) / WITH CHECK (true) pour le rôle public — donc
--    anon — exigent désormais une session authentifiée. Elles étaient
--    antérieures au 31/10 : le point 1 seul n'aurait presque rien fermé.
-- 3. Les 4 vues lisibles par anon lui sont retirées. Une vue non
--    security_invoker contourne les RLS des tables qu'elle lit : sans ce
--    point, le 2 se contournait par la vue.
--
-- EXCLUES volontairement : transactions, factures_achat, bordereaux. Le
-- workflow n8n « Miniatures Factures v2 », actif, les lit et les écrit en REST
-- avec la clé publique. Les fermer le casserait. À reprendre une fois n8n
-- basculé sur un credential service_role (phase 3 de docs/N8N-INVENTAIRE.md).
--
-- Vérifié après application, depuis l'extérieur et avec la clé publique :
--   collaborateurs, clients, v_jobs_sante .... 401
--   sinistres, credits, connexions_log,
--   ref_bureaux, lode_clients ................ 200 [] (vide)
--   transactions, factures_achat ............. 200 avec données (attendu)
-- Et authenticated conserve EXECUTE sur is_admin : les connectés passent.

-- ── 1. Retrait de l'accès libre temporaire ──────────────────────────────────
do $$
declare r record; n int := 0;
begin
  for r in
    select schemaname, tablename from pg_policies
    where policyname = 'temp_acces_libre_sans_login'
  loop
    execute format('drop policy if exists temp_acces_libre_sans_login on %I.%I', r.schemaname, r.tablename);
    n := n + 1;
  end loop;
  raise notice 'Policies temporaires retirées : %', n;
end $$;

-- ── 2. Exiger une session sur les policies ouvertes ─────────────────────────
do $$
declare
  r record;
  n int := 0;
  exclues text[] := array['transactions', 'factures_achat', 'bordereaux'];
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true')
      and ('public' = any(roles) or 'anon' = any(roles))
      and not (tablename = any(exclues))
  loop
    if r.qual = 'true' and r.with_check = 'true' then
      execute format(
        'alter policy %I on public.%I using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
        r.policyname, r.tablename);
    elsif r.qual = 'true' then
      execute format(
        'alter policy %I on public.%I using ((select auth.uid()) is not null)',
        r.policyname, r.tablename);
    else
      execute format(
        'alter policy %I on public.%I with check ((select auth.uid()) is not null)',
        r.policyname, r.tablename);
    end if;
    n := n + 1;
  end loop;
  raise notice 'Policies resserrées : %', n;
end $$;

-- ── 3. Vues : retirer anon, garder les utilisateurs connectés ───────────────
revoke select on public.v_jobs_sante          from anon;
revoke select on public.v_lacunes_bordereaux  from anon;
revoke select on public.v_rp_qualite          from anon;
revoke select on public.mv_rp_mensuel         from anon;

grant select on public.v_jobs_sante          to authenticated;
grant select on public.v_lacunes_bordereaux  to authenticated;
grant select on public.v_rp_qualite          to authenticated;
grant select on public.mv_rp_mensuel         to authenticated;
