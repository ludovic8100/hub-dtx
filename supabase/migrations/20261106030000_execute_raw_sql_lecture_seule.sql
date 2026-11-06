-- execute_raw_sql : n'importe quel employe connecte etait administrateur
-- de la base de donnees.
--
-- CE QUE LA FONCTION FAISAIT, mot pour mot :
--
--   EXECUTE 'SELECT ... FROM (' || sql_query || ') t'
--
-- SECURITY DEFINER, proprietaire `postgres`, droit d'execution accorde a
-- `authenticated`. Du texte libre, concatene, execute avec les droits du
-- proprietaire de la base.
--
-- La phase 0 de securite avait retire ce droit a `anon`. Elle ne l'avait
-- pas retire a `authenticated` — c'est-a-dire a tout le monde, puisque
-- tout utilisateur du Hub est authentifie.
--
-- L'EXPLOITATION NE DEMANDAIT AUCUNE FAILLE. Pas besoin de XSS, pas besoin
-- du pont postMessage de l'outil Succession : la console du navigateur
-- suffisait. supabase.rpc('execute_raw_sql', {sql_query: "..."}) et l'on
-- ecrit ce qu'on veut, partout. Les regles d'acces ne s'appliquent pas :
-- le proprietaire les contourne par construction. Et EXECUTE accepte
-- PLUSIEURS ordres dans une seule chaine — il suffisait de refermer la
-- parenthese pour enchainer un UPDATE ou un DROP.
--
-- Cela annulait d'avance tout le chantier des droits : inutile de
-- cloisonner les portefeuilles par bureau si chacun peut reecrire la base
-- entiere en une ligne.
--
-- ── CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS ──────────────
--
-- Elle verrouille la fonction EN LECTURE SEULE : un seul ordre, SELECT ou
-- WITH uniquement, et un delai maximum de 15 s.
--
-- Rien ne casse : le seul appelant est l'outil Succession
-- (src/pages/tools/ToolSuccession.jsx, pont postMessage) et il n'emet que
-- des SELECT — 28 occurrences dans le fichier, zero INSERT, UPDATE, DELETE
-- ou DDL.
--
-- VERIFIE APRES APPLICATION, en production :
--   select 1                                        -> passe
--   with x as (...) select * from x                 -> passe
--   select updated_at ... order by updated_at desc   -> passe (bornes de mot :
--                                        `updated_at` n'est pas le mot `update`)
--   select ... offset 1 limit 2                      -> passe (`offset` != `set`)
--   select 1) t; create table zzz; select * from (1  -> « Un seul ordre SQL »
--   update user_permissions set role='admin'         -> « Lecture seule »
--   drop table clients                               -> « Lecture seule »
--   ... (grant select on clients to anon) ...        -> « mot-cle d'ecriture »
-- Et aucune table n'a ete creee par le test d'enchainement.
--
-- ELLE NE REGLE PAS LE FOND. Une fonction SECURITY DEFINER qui execute du
-- texte libre reste une mauvaise idee, meme en lecture. Aujourd'hui les
-- droits sont ouverts a tous (USING (true)), donc lire par cette fonction
-- ne donne rien de plus que lire par l'API. Le jour ou les portefeuilles
-- seront cloisonnes, elle redeviendra un contournement.
--
-- Le vrai remede : remplacer le pont generique par des fonctions precises,
-- une par question que l'outil pose. A faire avec docs/DROITS-ACCES.md.
create or replace function public.execute_raw_sql(sql_query text)
returns json
language plpgsql
security definer
set search_path = public
set statement_timeout = '15s'
as $function$
declare
  result json;
  q      text := btrim(coalesce(sql_query, ''));
begin
  if q = '' then
    return json_build_object('error', 'Requete vide');
  end if;

  -- Un seul ordre. EXECUTE en accepte plusieurs separes par des
  -- points-virgules : c'etait la porte d'entree.
  q := btrim(rtrim(btrim(q), ';'));
  if q like '%;%' then
    return json_build_object('error', 'Un seul ordre SQL a la fois');
  end if;

  if q !~* '^(with|select)\s' then
    return json_build_object('error', 'Lecture seule : seuls SELECT et WITH sont acceptes');
  end if;

  -- Les bornes de mot evitent les faux positifs : `updated_at` contient
  -- « update » mais n'est pas le mot « update », et `offset` n'est pas `set`.
  if q ~* '\m(insert|update|delete|merge|drop|alter|create|grant|revoke|truncate|copy|vacuum|reindex|call|do|set|reset|listen|notify|prepare|execute|refresh|comment|import|lock|analyze)\M' then
    return json_build_object('error', 'Lecture seule : mot-cle d''ecriture detecte');
  end if;

  execute 'select coalesce(json_agg(row_to_json(t)), ''[]''::json) from (' || q || ') t' into result;
  return result;
exception when others then
  return json_build_object('error', sqlerrm);
end;
$function$;

comment on function public.execute_raw_sql(text) is
  'LECTURE SEULE depuis le 06/11/2026. Un seul ordre, SELECT ou WITH uniquement. '
  'Avant cela, tout utilisateur authentifie pouvait executer du SQL arbitraire '
  'avec les droits du proprietaire de la base. Seul appelant : l''outil Succession.';
