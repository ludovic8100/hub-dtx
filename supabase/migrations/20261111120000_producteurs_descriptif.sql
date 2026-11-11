-- `producteurs.descriptif` : rattrapage d'une colonne qui n'existait qu'en production.
--
-- Révélée le 11/11/2026 par le test de Ludovic. Ajouter un compte producteur
-- en environnement de test rendait :
--
--     Could not find the 'descriptif' column of 'producteurs' in the schema cache
--
-- Mesuré des deux côtés :
--
--     PRODUCTION  id, compagnie_nom, fsma, numero_producteur, telephone,
--                 code_postal, ville, created_at, compagnie_id, statut,
--                 updated_at, descriptif
--     TEST        … tout sauf descriptif
--
-- La colonne a été ajoutée directement en base de production, sans migration.
-- C'est le défaut déjà écrit dans CLAUDE.md — « le dépôt ne reproduit pas la
-- production » — pris sur le fait, et il a coûté exactement ce qu'il coûte
-- toujours : une fonctionnalité qui marche d'un côté et pas de l'autre, sans
-- qu'aucune lecture du code ne puisse l'expliquer.
--
-- ⚠️ La leçon n'est pas « ajouter cette colonne », c'est que l'environnement
-- de test ne vaut que s'il porte le même schéma. Chaque écart trouvé doit
-- devenir une migration, sinon le test valide autre chose que la production.
--
-- Idempotente : sans effet en production, elle comble le test.

alter table public.producteurs
  add column if not exists descriptif text;

comment on column public.producteurs.descriptif is
  'À quoi sert ce compte producteur : PH, PAT, portefeuille repris… Information libre, jamais une clé.';
