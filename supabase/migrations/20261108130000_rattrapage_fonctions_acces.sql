-- Rattrapage : les trois fonctions d'accès n'existaient qu'en base.
--
-- Suite de 20261107160000_rattrapage_modele_de_droits.sql, qui avait rapatrié
-- les TABLES du modèle de droits (ref_modules, ref_modules_societes,
-- collaborateur_acces, compte_hub_actif) mais pas les fonctions qui les
-- lisent. Résultat : l'environnement de test portait le modèle sans savoir
-- l'interroger, et toute migration posant une policy sur a_module() échouait.
--
-- Ces définitions sont copiées telles quelles depuis la production
-- (pg_get_functiondef). CREATE OR REPLACE à l'identique : sans effet là-bas,
-- comble le test. Idempotente, rejouable.
--
-- ⚠️ Le code du module est 'comptabilite', pas 'compta' — ref_modules fait foi.

create or replace function public.a_module(p_module text, p_societe text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
      from collaborateur_acces a
      join collaborateurs c on c.id = a.collaborateur_id
     where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and c.compte_hub_actif
       and a.module_code = p_module
       and a.societe = p_societe
  );
$function$;

create or replace function public.acces_compta(p_societe text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select is_admin() or (p_societe is not null and a_module('comptabilite', p_societe));
$function$;

create or replace function public.acces_compta_compte(p_compte uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select acces_compta((select cb."ENTITE" from comptes_bancaires cb where cb.id = p_compte));
$function$;

-- Fermeture en DEUX temps, parce qu'anon tient son droit de deux sources :
-- PUBLIC (défaut Postgres) et le privilège par défaut de Supabase.
-- Révoquer l'une sans l'autre ne ferme rien.
revoke execute on function public.a_module(text, text)        from public, anon;
revoke execute on function public.acces_compta(text)          from public, anon;
revoke execute on function public.acces_compta_compte(uuid)   from public, anon;

grant  execute on function public.a_module(text, text)        to authenticated;
grant  execute on function public.acces_compta(text)          to authenticated;
grant  execute on function public.acces_compta_compte(uuid)   to authenticated;
