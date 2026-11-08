-- Rattrapage : is_admin() ne lisait pas la meme chose dans les deux bases.
--
-- Trouve le 08/11 en montant un jeu de demonstration en test : l'ecran
-- Dossiers restait vide alors que les achats s'affichaient. La cause n'etait
-- pas l'ecran, c'etait la RLS — et sous elle, is_admin().
--
--   Production : lit collaborateurs.est_admin + compte_hub_actif
--   Test       : lisait user_permissions, la table que la production N'A PLUS
--
-- Consequence : en test, PERSONNE n'etait administrateur. Toute politique
-- batie sur acces_compta() (qui appelle is_admin()) refusait tout le monde,
-- en lecture comme en ecriture, sans message d'erreur — une liste vide.
--
-- C'est la meme dette que a_module() et acces_compta() : des fonctions de
-- securite appliquees directement en base, jamais versionnees, donc ni
-- relisibles en diff ni reapplicables. Celle-ci est la plus genante des
-- trois : elle decide qui est administrateur.
--
-- Definition copiee telle quelle depuis la production. Idempotente.

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.collaborateurs
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and est_admin = true and compte_hub_actif = true
  );
$function$;

-- Double revocation : PUBLIC et le privilege par defaut de Supabase.
-- Couper l'une sans l'autre laisse le droit intact.
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;
