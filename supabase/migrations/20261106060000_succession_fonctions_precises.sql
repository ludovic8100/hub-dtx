-- Le pont SQL generique de l'outil Succession, remplace par neuf questions.
--
-- Ludovic, 06/11 : « On peut faire le necessaire pour le pont generique. »
--
-- AVANT : l'iframe envoyait une chaine SQL au parent, qui la passait a
-- execute_raw_sql — SECURITY DEFINER, droits du proprietaire de la base.
-- Onze requetes, toutes construites par interpolation, « protegees » par un
-- .replace(/'/g,"''") ecrit a la main. Ca tient tant qu'on ne rencontre pas
-- un antislash, et surtout ca obligeait a laisser ouverte une fonction qui
-- execute n'importe quoi.
--
-- APRES : neuf fonctions a parametres types. Aucune concatenation, donc
-- aucune injection possible. SECURITY INVOKER, donc les regles d'acces de
-- celui qui regarde s'appliquent — ce que execute_raw_sql contournait par
-- construction.
--
-- CHACUNE A ETE COMPAREE A LA REQUETE D'ORIGINE sur un vrai dossier
-- (1229/00 : 3 batiments, 3 membres de famille, 1 societe, 1 contrat vie),
-- en comptant les lignes ET l'ecart symetrique. Neuf fois sur neuf : ecart
-- nul.
--
-- UNE REGRESSION ATTRAPEE AU PASSAGE : ma premiere version comparait
-- type_risque a 'Batiment' sans accent. La valeur en base est 'Bâtiment',
-- 11 230 lignes. L'outil aurait affiche un patrimoine vide, sans erreur et
-- sans rien dans les journaux.

create or replace function public.succ_clients_recherche(p_q text, p_lim int default 15)
returns table (id bigint, dossier text, nom text, prenom text,
               date_naissance text, cp text, localite text, etat_civil text)
language plpgsql stable security invoker set search_path = public as $$
declare motif text := '%' || btrim(coalesce(p_q, '')) || '%';
begin
  if btrim(coalesce(p_q, '')) = '' then return; end if;
  return query
    select c.id, c.dossier, c.nom, c.prenom, c.date_naissance::text,
           c.cp::text, c.localite, c.etat_civil
    from clients c
    where c.nom ilike motif or c.prenom ilike motif or c.dossier ilike motif
    order by c.nom, c.prenom
    limit greatest(1, least(coalesce(p_lim, 15), 100));
end $$;

create or replace function public.succ_batiments(p_dossiers text[])
returns table (dossier text, description text, type_risque text)
language sql stable security invoker set search_path = public as $$
  select distinct o.dossier, o.description, o.type_risque
  from objets_risque o
  join contrats c on c.dossier = o.dossier and c.police = o.police
  where o.dossier = any(p_dossiers)
    and o.domaine = 'Incendie risques simples'
    and o.situation in ('En cours', 'Suspendu')
    and o.type_risque = 'Bâtiment'
$$;

create or replace function public.succ_vie(p_dossiers text[])
returns table (dossier text, police text, compagnie text, garantie text,
               description text, type_production text)
language sql stable security invoker set search_path = public as $$
  select distinct o.dossier, o.police, o.compagnie, o.garantie,
         o.description, c.type_production
  from objets_risque o
  join contrats c on c.dossier = o.dossier and c.police = o.police
  where o.dossier = any(p_dossiers)
    and o.domaine = 'Vie et placements'
    and o.situation in ('En cours', 'Suspendu')
$$;

create or replace function public.succ_famille(p_dossier text, p_nom text, p_prenom text)
returns table (membre_nom text, membre_dossier text, date_naissance text, cp text)
language sql stable security invoker set search_path = public as $$
  select distinct p.membre_nom, c.dossier, c.date_naissance::text, c.cp::text
  from parentes p
  left join clients c
    on upper(btrim(p.membre_nom)) like '%' || upper(btrim(c.nom)) || '%'
   and upper(btrim(p.membre_nom)) like '%' || upper(btrim(c.prenom)) || '%'
  where p.dossier_principal = p_dossier
    and p.groupe_type = '01-Famille'
    -- Les deux ordres : on ne sait pas comment le nom a ete saisi.
    and upper(btrim(p.membre_nom)) not like
        '%' || upper(coalesce(p_nom,'')) || '%' || upper(coalesce(p_prenom,'')) || '%'
    and upper(btrim(p.membre_nom)) not like
        '%' || upper(coalesce(p_prenom,'')) || '%' || upper(coalesce(p_nom,'')) || '%'
$$;

create or replace function public.succ_entreprises(p_dossier text, p_nom text)
returns table (membre_nom text)
language sql stable security invoker set search_path = public as $$
  select distinct p.membre_nom from parentes p
  where p.dossier_principal = p_dossier and p.groupe_type = '02-Entreprise'
    and upper(btrim(p.membre_nom)) not like '%' || upper(coalesce(p_nom,'')) || '%'
$$;

create or replace function public.succ_groupes_lies(p_noms text[], p_deja_vus text[] default '{}')
returns table (dossier_principal text, groupe_nom text)
language sql stable security invoker set search_path = public as $$
  select distinct p.dossier_principal, p.groupe_nom
  from parentes p
  where upper(btrim(p.membre_nom)) = any(
          select upper(btrim(x)) from unnest(coalesce(p_noms, '{}')) as x)
    and p.groupe_type = '02-Entreprise'
    and not (p.dossier_principal = any(coalesce(p_deja_vus, '{}')))
$$;

create or replace function public.succ_membres_entreprise(p_dossier text)
returns table (membre_nom text)
language sql stable security invoker set search_path = public as $$
  select distinct p.membre_nom from parentes p
  where p.dossier_principal = p_dossier and p.groupe_type = '02-Entreprise'
$$;

create or replace function public.succ_clients_par_noms(p_noms text[])
returns table (dossier text, nom text)
language sql stable security invoker set search_path = public as $$
  select distinct c.dossier, c.nom from clients c
  where upper(c.nom) = any(select upper(btrim(x)) from unnest(coalesce(p_noms, '{}')) as x)
$$;

create or replace function public.succ_homonymes(p_noms text[], p_hors_dossier text)
returns table (dossier text, nom text, prenom text, date_naissance text)
language sql stable security invoker set search_path = public as $$
  select distinct c.dossier, c.nom, c.prenom, c.date_naissance::text
  from clients c
  where upper(btrim(c.nom)) = any(
          select upper(btrim(x)) from unnest(coalesce(p_noms, '{}')) as x)
    and c.dossier is distinct from p_hors_dossier
    and c.prenom is not null and btrim(c.prenom) <> ''
$$;

-- ── LE PIEGE A DEUX FACES, et je suis tombe dans la seconde ─────────────
--
-- Hier j'ai ecrit dans CLAUDE.md : « retirer un droit a anon ne retire
-- rien, c'est PUBLIC qui le porte ». C'est vrai, et ce n'est que la moitie.
--
-- J'ai donc revoque PUBLIC sur ces neuf fonctions... et verifie apres coup :
-- `anon` avait TOUJOURS le droit. Supabase pose des PRIVILEGES PAR DEFAUT
-- sur le schema public qui accordent EXECUTE a anon, authenticated et
-- service_role sur toute fonction nouvelle. `anon` ne tient donc pas
-- seulement son droit de PUBLIC : il en a un, nominatif, pose a la creation.
--
-- LA REGLE COMPLETE : revoquer PUBLIC **et** anon, accorder nommement, puis
-- REVERIFIER avec has_function_privilege. La verification a rattrape
-- l'erreur les deux fois.
do $$
declare f text;
begin
  foreach f in array array[
    'succ_clients_recherche(text,integer)', 'succ_batiments(text[])', 'succ_vie(text[])',
    'succ_famille(text,text,text)', 'succ_entreprises(text,text)',
    'succ_groupes_lies(text[],text[])', 'succ_membres_entreprise(text)',
    'succ_clients_par_noms(text[])', 'succ_homonymes(text[],text)'
  ] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('revoke execute on function public.%s from anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Meme correction sur deux fonctions creees la veille.
revoke execute on function public.dossiers_avec_contrat() from public, anon;
grant  execute on function public.dossiers_avec_contrat() to authenticated, service_role;
revoke execute on function public.search_clients_dynassur(text, integer) from public, anon;
grant  execute on function public.search_clients_dynassur(text, integer) to authenticated, service_role;

-- ── execute_raw_sql n'a plus aucun appelant ────────────────────────────
-- ON NE LA SUPPRIME PAS : supprimer est irreversible, et rien ne dit d'ici
-- si quelque chose HORS du depot l'appelle. On lui retire le droit, ce qui
-- produit le meme effet et se defait d'un GRANT.
revoke execute on function public.execute_raw_sql(text) from public, anon, authenticated;
grant  execute on function public.execute_raw_sql(text) to service_role;

comment on function public.execute_raw_sql(text) is
  'PLUS AUCUN APPELANT depuis le 06/11/2026, et plus executable que par le '
  'service_role. Remplacee par les fonctions succ_* a parametres types. '
  'Conservee sans droits le temps de verifier que rien hors du depot ne '
  's''en sert ; a supprimer ensuite.';
