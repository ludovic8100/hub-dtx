-- Recherche client Dynassur — moteur multi-critères (appliqué en base le 2026-07-03)
-- Chaque MOT tapé doit se retrouver dans nom / prénom / localité / CP / n° de maison
-- (=> "Lud Lor", "lorange 474", "juprelle 474" ciblent). Plaque partielle (>=3),
-- police, téléphone (9 derniers chiffres), dossier et email restent gérés.
CREATE OR REPLACE FUNCTION public.search_clients_dynassur(q text, lim integer DEFAULT 60)
 RETURNS TABLE(id bigint, dossier text, nom text, prenom text, cp text, localite text, gsm text, email text, match_info text)
 LANGUAGE sql STABLE
AS $function$
  with p as (
    select
      trim(coalesce(q,'')) as raw,
      regexp_replace(upper(coalesce(q,'')), '[^A-Z0-9]', '', 'g') as compact,
      regexp_replace(coalesce(q,''), '[^0-9]', '', 'g') as digits,
      (coalesce(q,'') ~ '[A-Za-z]') as has_alpha,
      (select array_agg('%'||lower(unaccent(tk))||'%')
         from unnest(regexp_split_to_array(trim(coalesce(q,'')), '\s+')) tk
         where tk <> '') as pats
  ),
  orh as (
    select o.dossier,
           max(o.description) filter (where (o.type_risque ilike 'v_hicule')) as veh_descr,
           bool_or(o.type_risque ilike 'v_hicule') as is_veh
    from objets_risque o, p
    where length(p.compact) >= 3 and (
         ( o.type_risque ilike 'v_hicule'
           and regexp_replace(upper(coalesce(o.description,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%' )
      or regexp_replace(upper(coalesce(o.police,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%'
    )
    group by o.dossier
  ),
  cth as (
    select distinct c.dossier
    from contrats c, p
    where length(p.compact) >= 3
      and regexp_replace(upper(coalesce(c.police,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%'
  )
  select cl.id, cl.dossier, cl.nom, cl.prenom, cl.cp, cl.localite, cl.gsm, cl.email,
    case
      when orh.is_veh and orh.veh_descr is not null then '🚗 '||orh.veh_descr
      when orh.dossier is not null or cth.dossier is not null then '📄 Police'
      else null
    end as match_info
  from clients cl
  cross join p
  left join orh on orh.dossier = cl.dossier
  left join cth on cth.dossier = cl.dossier
  where p.raw <> '' and (
       ( p.pats is not null and lower(unaccent(
             coalesce(cl.nom,'')||' '||coalesce(cl.prenom,'')||' '||
             coalesce(cl.localite,'')||' '||coalesce(cl.cp,'')||' '||coalesce(cl.num_maison,'')
         )) like ALL(p.pats) )
    or coalesce(cl.dossier,'') like '%'||p.raw||'%'
    or coalesce(cl.email,'') ilike '%'||p.raw||'%'
    or ( not p.has_alpha and length(p.digits) >= 6 and regexp_replace(
           coalesce(cl.gsm_e164,'')||coalesce(cl.telfixe_e164,'')||coalesce(cl.gsm,'')||coalesce(cl.tel_fixe,''),
           '[^0-9]','','g') like '%'||right(p.digits,9)||'%' )
    or orh.dossier is not null
    or cth.dossier is not null
  )
  order by (orh.dossier is not null or cth.dossier is not null) desc, cl.nom, cl.prenom
  limit greatest(1, least(coalesce(lim,60), 200));
$function$;
