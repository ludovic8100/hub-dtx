-- La recherche client expirait. Mesure, pas ressenti : 28,9 secondes.
--
-- COMMENT ON L'A SU
--
-- L'ecran avalait l'erreur et affichait « Aucun resultat », identique a un nom
-- mal orthographie. Une fois le message rendu visible (PR #121), la base a dit
-- elle-meme : « canceling statement due to statement timeout ».
--
-- TROIS CAUSES EMPILEES, CHACUNE MESUREE AVANT CORRECTION
--
-- 1. Chercher un NOM balayait les plaques et les polices.
--    Les CTE orh et cth ne servent qu'a retrouver un vehicule ou un numero de
--    police, mais leur seule garde etait « au moins 3 caracteres » — vraie
--    pour n'importe quel nom. Resultat : 110 503 objets de risque et 29 955
--    contrats balayes pour chercher « detilloux ».
--    GARDE AJOUTEE : la saisie doit contenir un CHIFFRE. Une plaque et un
--    numero de police en ont toujours un ; un nom, jamais.
--    28,9 s → 998 ms.
--
-- 2. Les regles d'acces etaient evaluees LIGNE PAR LIGNE.
--    is_admin(), voit_tout_portefeuille() et mon_bureau_id() font chacune une
--    requete sur collaborateurs. Sur 10 308 clients, jusqu'a 30 000
--    sous-requetes par recherche. Les envelopper dans (select ...) les
--    transforme en InitPlan : evaluees UNE fois, puis reutilisees.
--    998 ms → 162 ms.
--
-- 3. Pour une PLAQUE, les index trigram ne servaient a rien.
--    Deux raisons. D'abord la fonction etait en SQL pur : le motif venait
--    d'une CTE, et le planificateur le traitait comme un filtre de jointure.
--    Passee en plpgsql, le motif devient un PARAMETRE, que gin_trgm_ops sait
--    exploiter. Ensuite client_visible(dossier), non leakproof, etait applique
--    AVANT les conditions de l'utilisateur : la table entiere y passait de
--    toute facon. Meme traitement que le point 2.
--    33,9 s → 1,8 s.
--
-- CE QUI N'A PAS CHANGE : les resultats. Verifie sur quatre cas — nom, plaque,
-- numero de dossier, localite.

create extension if not exists pg_trgm;

create index if not exists objets_risque_descr_norm_trgm
  on public.objets_risque using gin
  (regexp_replace(upper(coalesce(description, '')), '[^A-Z0-9]', '', 'g') gin_trgm_ops);

create index if not exists objets_risque_police_norm_trgm
  on public.objets_risque using gin
  (regexp_replace(upper(coalesce(police, '')), '[^A-Z0-9]', '', 'g') gin_trgm_ops);

create index if not exists contrats_police_norm_trgm
  on public.contrats using gin
  (regexp_replace(upper(coalesce(police, '')), '[^A-Z0-9]', '', 'g') gin_trgm_ops);

-- ── Les regles d'acces, hissees hors de la boucle ────────────────────────
drop policy if exists clients_bureau on public.clients;
create policy clients_bureau on public.clients
  for all
  using (
    (select public.is_admin())
    or (select public.voit_tout_portefeuille())
    or (bureau_id is not null and bureau_id = (select public.mon_bureau_id()))
  );

drop policy if exists contrats_bureau on public.contrats;
create policy contrats_bureau on public.contrats
  for all
  using (
    (select public.is_admin())
    or (select public.voit_tout_portefeuille())
    or dossier in (
      select c.dossier from public.clients c
      where c.bureau_id is not null and c.bureau_id = (select public.mon_bureau_id())
    )
  );

drop policy if exists objets_risque_bureau on public.objets_risque;
create policy objets_risque_bureau on public.objets_risque
  for all
  using (
    (select public.is_admin())
    or (select public.voit_tout_portefeuille())
    or dossier in (
      select c.dossier from public.clients c
      where c.bureau_id is not null and c.bureau_id = (select public.mon_bureau_id())
    )
  );

create or replace function public.client_visible(p_dossier text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select (select public.is_admin())
      or (select public.voit_tout_portefeuille())
      or exists (
        select 1 from public.clients c
        where c.dossier = p_dossier
          and c.bureau_id is not null
          and c.bureau_id = (select public.mon_bureau_id())
      );
$function$;

-- ── La fonction, passee en plpgsql ───────────────────────────────────────
create or replace function public.search_clients_dynassur(q text, lim integer default 60)
returns table(id bigint, dossier text, nom text, prenom text, cp text, localite text, gsm text, email text, match_info text)
language plpgsql stable as $function$
declare
  v_raw     text := trim(coalesce(q, ''));
  v_compact text := regexp_replace(upper(coalesce(q, '')), '[^A-Z0-9]', '', 'g');
  v_digits  text := regexp_replace(coalesce(q, ''), '[^0-9]', '', 'g');
  v_alpha   boolean := coalesce(q, '') ~ '[A-Za-z]';
  v_pats    text[];
  v_motif   text;
  v_objets  boolean;
begin
  if v_raw = '' then return; end if;

  select array_agg('%' || lower(unaccent(tk)) || '%')
    into v_pats
    from unnest(regexp_split_to_array(v_raw, '\s+')) tk
   where tk <> '';

  v_objets := length(v_compact) >= 3 and v_digits <> '';
  v_motif  := '%' || v_compact || '%';

  return query
  with orh as (
    select o.dossier,
           max(o.description) filter (where o.type_risque ilike 'v_hicule') as veh_descr,
           bool_or(o.type_risque ilike 'v_hicule') as is_veh
    from objets_risque o
    where v_objets and (
         regexp_replace(upper(coalesce(o.description, '')), '[^A-Z0-9]', '', 'g') like v_motif
      or regexp_replace(upper(coalesce(o.police, '')), '[^A-Z0-9]', '', 'g') like v_motif)
    group by o.dossier
  ),
  cth as (
    select distinct c.dossier
    from contrats c
    where v_objets
      and regexp_replace(upper(coalesce(c.police, '')), '[^A-Z0-9]', '', 'g') like v_motif
  )
  select cl.id, cl.dossier, cl.nom, cl.prenom, cl.cp, cl.localite, cl.gsm, cl.email,
    case
      when orh.is_veh and orh.veh_descr is not null then '🚗 ' || orh.veh_descr
      when orh.dossier is not null or cth.dossier is not null then '📄 Police'
      else null
    end
  from clients cl
  left join orh on orh.dossier = cl.dossier
  left join cth on cth.dossier = cl.dossier
  where (
       ( v_pats is not null and lower(unaccent(
             coalesce(cl.nom,'')||' '||coalesce(cl.prenom,'')||' '||
             coalesce(cl.localite,'')||' '||coalesce(cl.cp,'')||' '||coalesce(cl.num_maison,'')
         )) like ALL(v_pats) )
    or coalesce(cl.dossier,'') like '%' || v_raw || '%'
    or coalesce(cl.email,'') ilike '%' || v_raw || '%'
    or ( not v_alpha and length(v_digits) >= 6 and regexp_replace(
           coalesce(cl.gsm_e164,'')||coalesce(cl.telfixe_e164,'')||coalesce(cl.gsm,'')||coalesce(cl.tel_fixe,''),
           '[^0-9]','','g') like '%' || right(v_digits, 9) || '%' )
    or orh.dossier is not null
    or cth.dossier is not null
  )
  order by (orh.dossier is not null or cth.dossier is not null) desc, cl.nom, cl.prenom
  limit greatest(1, least(coalesce(lim, 60), 200));
end $function$;

grant execute on function public.search_clients_dynassur(text, integer) to anon, authenticated, service_role;
