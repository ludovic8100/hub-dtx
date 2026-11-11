-- FERMER `anon` SUR TOUTES LES TABLES ET VUES DU SCHÉMA PUBLIC.
--
-- Décision de Ludovic le 11/11/2026 : « on resserre les droits, c'est
-- important car je ne veux pas être piraté ».
--
-- ÉTAT MESURÉ AVANT. En production, `anon` avait `SELECT` sur 96 tables,
-- dont `clients`, `contrats`, `objets_risque` et `quittances`. Rien ne
-- fuyait — vérifié en se faisant passer pour `anon`, tout était refusé —
-- mais pour une seule raison : la policy appelle `client_visible()`, qui
-- renvoie `false` hors connexion.
--
-- ⚠️ UNE SEULE FONCTION PROTÉGEAIT 96 TABLES. Une policy réécrite sans
-- précaution, une fonction modifiée, une table nouvelle dont on oublie la
-- policy, et la lecture s'ouvre à tout Internet. Rappel : la clé `anon` est
-- dans le bundle du navigateur ET dans ce dépôt, qui est public.
--
-- LE DROIT ET LA POLICY SONT DEUX BARRIÈRES, PAS UNE. La policy filtre les
-- lignes, le droit décide si la question peut seulement être posée. Garder
-- les deux coûte zéro et évite qu'une erreur sur l'une ouvre la porte.
--
-- CE QUI N'EST PAS TOUCHÉ, ET POURQUOI :
--   - les FONCTIONS. `/devis/:token` est la seule page publique du Hub et
--     elle n'appelle que des RPC (`lode_devis_public`, `dtx_devis_public`,
--     `dyn_devis_public` et leurs décisions). Vérifié dans le code :
--     `LodeDevisAccept.jsx` ne fait aucun `select` sur une table. Ces
--     fonctions sont SECURITY DEFINER, donc elles n'ont pas besoin que
--     l'appelant ait un droit sur les tables.
--   - `authenticated` et `service_role`, qui gardent tout.
--
-- CE QUI SE PASSE POUR L'APPLICATION : rien. Les requêtes du Hub partent
-- après la connexion Microsoft, donc en `authenticated`. Les seules lectures
-- faites par `anon` renvoyaient déjà zéro ligne ; elles renverront désormais
-- un refus. Aucun écran ne lit avant connexion.

-- ── 1. Les objets existants ───────────────────────────────────────────────
do $$
declare r record; n int := 0;
begin
  for r in
    select c.relname, c.relkind
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public'
      and c.relkind in ('r','p','v','m','f')   -- table, partition, vue, vue mat., table distante
  loop
    execute format('revoke all on public.%I from anon', r.relname);
    n := n + 1;
  end loop;
  raise notice 'anon révoqué sur % relations', n;
end $$;

-- Les séquences : une séquence ouverte laisse deviner le volume d'une table,
-- et surtout laisse écrire si un droit d'insertion revient par ailleurs.
do $$
declare r record;
begin
  for r in select sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('revoke all on sequence public.%I from anon', r.sequencename);
  end loop;
end $$;

-- ── 2. Les objets FUTURS ──────────────────────────────────────────────────
-- ⚠️ C'EST LA PARTIE QUI COMPTE LE PLUS, et celle qu'on oublie.
-- Supabase pose un privilège par défaut qui accorde les droits à `anon` sur
-- tout objet NOUVEAU du schéma `public`. Sans ce bloc, la prochaine table —
-- ou la prochaine vue recréée par `create or replace` — rouvrirait la porte
-- en silence. C'est exactement ce qui s'est produit le 10/11 sur
-- `v_encaissement_solde`, recréée pour corriger un bug de jointure et
-- rouverte à `anon` sans que personne ne le voie.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ── 3. Vérification ───────────────────────────────────────────────────────
-- Un correctif de sécurité non revérifié rassure sans protéger. La migration
-- échoue si `anon` garde le moindre droit de lecture sur une relation.
do $$
declare reste text;
begin
  select string_agg(c.relname, ', ')
    into reste
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind in ('r','p','v','m','f')
    and has_table_privilege('anon', c.oid, 'SELECT');
  if reste is not null then
    raise exception 'anon garde SELECT sur : %', reste;
  end if;
  raise notice 'Vérifié : anon n''a plus aucun droit de lecture dans public.';
end $$;
