-- Retire l'accès libre temporaire mis en place le 31/10/2026 (voir
-- docs/DROITS-ACCES.md). À exécuter UNIQUEMENT après avoir remis
-- ACCES_LIBRE_TEMPORAIRE à false dans src/lib/auth.jsx et redéployé —
-- sinon l'app resterait bloquée (plus de session, plus d'accès anonyme).
do $$
declare r record;
begin
  for r in
    select schemaname, tablename from pg_tables
    where schemaname = 'public'
      and exists (
        select 1 from pg_policies p
        where p.schemaname = pg_tables.schemaname and p.tablename = pg_tables.tablename
          and p.policyname = 'temp_acces_libre_sans_login'
      )
  loop
    execute format('drop policy if exists temp_acces_libre_sans_login on %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;
