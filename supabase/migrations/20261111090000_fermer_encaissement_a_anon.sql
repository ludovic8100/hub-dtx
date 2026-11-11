-- FERMER L'ENCAISSEMENT PRODUCTEUR À `anon` — et dire pourquoi c'était ouvert.
--
-- Mesuré le 11/11/2026 en se faisant passer pour `anon` sur la base de TEST :
--
--     v_encaissement_solde      4 LIGNES LISIBLES   ← nom du client, dossier,
--                                                     compagnie, dû, versé, solde
--     encaissement_comptes      lisible (0 ligne, filtrée par RLS)
--     encaissement_versements   lisible (0 ligne, filtrée par RLS)
--
-- La production, elle, refuse les trois. Le test était donc PLUS ouvert que la
-- production, au moment précis où on s'apprête à y mettre de vraies données
-- clients.
--
-- ⚠️ POURQUOI — ET C'EST LE PIÈGE À RETENIR.
-- `20261110180000_encaissement_producteur.sql` révoquait bien :
--
--     revoke all on v_encaissement_solde from public, anon;
--
-- Mais la vue portait un bug de jointure (CTE `du` sans alias). Je l'ai
-- recréée avec `create or replace view` — et Supabase accorde par défaut
-- SELECT à `anon` sur tout objet NOUVEAU du schéma `public`.
--
--     Recréer une vue RÉARME les droits par défaut. Le revoke d'avant ne
--     protège plus l'objet d'après.
--
-- C'est le même mécanisme que celui déjà écrit dans CLAUDE.md pour les
-- fonctions, sous une autre forme. Un `create or replace` n'est pas une
-- modification du point de vue des privilèges : c'est un objet neuf.
--
-- RÈGLE : toute recréation d'une vue ou d'une fonction sensible doit être
-- suivie de sa révocation, dans la MÊME migration, puis revérifiée en se
-- faisant passer pour `anon`. Lire les droits ne suffit pas — ici,
-- `information_schema` annonçait les grants, mais seul le test a montré que
-- quatre lignes sortaient vraiment.

-- ── La vue ────────────────────────────────────────────────────────────────
-- Elle est SECURITY DEFINER par défaut : elle lit ses tables avec les droits
-- de son propriétaire, donc la RLS des tables sous-jacentes ne la protège
-- PAS. Son seul rempart est le droit de lecture. D'où la révocation.
revoke all on v_encaissement_solde from public, anon;
grant  select on v_encaissement_solde to authenticated;

-- ── Les deux tables ───────────────────────────────────────────────────────
-- Leur RLS filtrait déjà à zéro (aucune policy ne vise `anon`), donc rien ne
-- fuyait. On retire quand même le droit : deux barrières valent mieux qu'une,
-- et une policy mal écrite demain ne doit pas suffire à ouvrir la table.
revoke all on encaissement_comptes, encaissement_versements from public, anon;
grant  select, insert, update, delete
  on encaissement_comptes, encaissement_versements to authenticated;

-- ── `tmp_chargement` : la seule table sans RLS de la base de test ─────────
-- Table de travail, vide. Elle n'est pas supprimée — une suppression ne se
-- défait pas, et c'est la règle du dépôt. Mais elle est fermée.
do $$
begin
  if to_regclass('public.tmp_chargement') is not null then
    execute 'alter table public.tmp_chargement enable row level security';
    execute 'revoke all on public.tmp_chargement from public, anon';
  end if;
end $$;

-- ── Vérification ──────────────────────────────────────────────────────────
-- Un correctif de sécurité non revérifié rassure sans protéger. La migration
-- échoue si `anon` garde le moindre droit de lecture sur les trois objets.
do $$
declare o text; reste text := '';
begin
  foreach o in array array['v_encaissement_solde','encaissement_comptes','encaissement_versements']
  loop
    if to_regclass('public.'||o) is not null
       and has_table_privilege('anon', 'public.'||o, 'SELECT') then
      reste := reste || o || ' ';
    end if;
  end loop;
  if reste <> '' then
    raise exception 'anon garde SELECT sur : %', reste;
  end if;
end $$;
