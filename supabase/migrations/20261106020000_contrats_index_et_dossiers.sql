-- Deux requetes de la page Clients tenaient 382 secondes de base a elles seules.
--
-- MESURE DU 06/11 (pg_stat_statements, trafic reel de l'application) :
--
--   SELECT updated_at FROM contrats ... ORDER BY updated_at DESC LIMIT 1
--     27 appels, 7 204 ms de moyenne, 195 s au total
--
--   SELECT dossier FROM contrats LIMIT 1000 OFFSET ...
--     60 appels, 3 124 ms de moyenne, 187 s au total
--
-- ── 1. L'INDEX QUI MANQUAIT ──────────────────────────────────────────────
--
-- `SyncQlik` affiche « derniere synchro » sur le tableau de bord Dynassur.
-- Pour cela il demande la date la plus recente de `contrats`. Sans index,
-- Postgres lit les 29 955 lignes et les trie : 1,4 s en direct, 7,2 s a
-- travers les regles d'acces. A chaque ouverture du tableau de bord.
--
-- Index PARTIEL : la requete porte toujours `updated_at is not null`, donc
-- l'index n'a aucune raison de porter les lignes nulles.
create index if not exists contrats_updated_at_desc
  on public.contrats (updated_at desc)
  where updated_at is not null;

-- ── 2. NE PAS RAPATRIER 29 955 LIGNES POUR EN DEDUIRE 8 189 VALEURS ─────
--
-- Pour afficher « clients sans contrat », la page parcourait TOUTE la table
-- des contrats, mille lignes par mille lignes — trente allers-retours — puis
-- construisait un Set en memoire pour ne garder que les numeros de dossier
-- distincts. 29 955 lignes transferees pour repondre a une question qui tient
-- en 8 189 valeurs.
--
-- La base sait faire ce `distinct` elle-meme, et elle le fait une fois.
--
-- SECURITY INVOKER (le defaut, ecrit ici pour qu'on ne l'oublie pas) : la
-- fonction s'execute avec les droits de l'appelant, donc les regles d'acces
-- de `contrats` s'appliquent exactement comme avant. Une fonction
-- SECURITY DEFINER aurait ouvert une porte : elle aurait rendu TOUS les
-- dossiers, y compris ceux que l'utilisateur n'a pas le droit de voir.
create or replace function public.dossiers_avec_contrat()
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select distinct dossier::text
  from public.contrats
  where dossier is not null
$$;

comment on function public.dossiers_avec_contrat() is
  'Les numeros de dossier ayant au moins un contrat, en une requete au lieu '
  'de trente pages de 1 000 lignes. Respecte les regles d''acces de l''appelant.';

grant execute on function public.dossiers_avec_contrat() to authenticated;
