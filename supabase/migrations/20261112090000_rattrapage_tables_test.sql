-- RATTRAPAGE DU SCHÉMA DE TEST — les 9 tables qui n'existaient qu'en production.
--
-- Suite du 11/11. Les 86 colonnes manquantes sont comblées ; restaient les
-- tables entières. Celles-ci ne se rattrapent pas par un `add column` : il
-- faut leurs clés, leurs contraintes et leurs index, sinon on recrée une
-- coquille qui accepte n'importe quoi et le test ne vaut rien.
--
-- Définitions relevées dans la production, pas inventées : colonnes et
-- valeurs par défaut depuis `information_schema`, contraintes depuis
-- `pg_get_constraintdef`, index depuis `pg_indexes`.
--
-- ⚠️ L'ORDRE COMPTE. `collaborateur_societes` référence `ref_statuts` et
-- `societes` ; `fournisseurs_alias` référence `fournisseurs`. Les créer dans
-- le désordre échoue sur la clé étrangère.
--
-- Ce que chacune débloque :
--   personnes              l'identité : une personne une seule fois, qu'elle
--                          soit cliente, collaboratrice, ou seulement la
--                          relation de quelqu'un. C'est elle qui porte le
--                          fichier de relations (9 050 liens, 34 types).
--   fournisseurs + alias   la fiche partagée entre les six sociétés — « ce
--                          qui est un fait sur le monde est partagé ».
--   compagnies_alias       les libellés lus dans les bordereaux, rattachés
--                          à la bonne compagnie.
--   clients_attribution    gestionnaire et sous-agent dans le temps.
--   collaborateur_societes un collaborateur par société, avec son coût.
--   ref_statuts/_societes  le référentiel des statuts.
--   ref_activites          les activités par société.
--
-- Reste après celle-ci : `releves_producteur` et ses 15 partitions, plus
-- `releves_producteur_controle` et `_rejets`. Une table partitionnée demande
-- sa clé de partition et ses bornes — et ⚠️ Postgres N'HÉRITE PAS la RLS sur
-- une partition, donc chaque partition devra l'activer séparément.
-- Idempotente.

-- ── Référentiels, d'abord : les autres s'y accrochent ─────────────────────
create table if not exists public.ref_statuts (
  code text not null,
  libelle text not null,
  ordre integer default 100 not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ref_statuts_pkey') then
    alter table public.ref_statuts add constraint ref_statuts_pkey primary key (code);
  end if;
end $$;

create table if not exists public.ref_statuts_societes (
  statut_code text not null,
  societe text not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ref_statuts_societes_pkey') then
    alter table public.ref_statuts_societes add constraint ref_statuts_societes_pkey primary key (statut_code, societe);
  end if;
end $$;

create table if not exists public.ref_activites (
  code text not null,
  libelle text not null,
  societe text not null,
  ordre integer default 100 not null,
  actif boolean default true not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='ref_activites_pkey') then
    alter table public.ref_activites add constraint ref_activites_pkey primary key (code);
  end if;
end $$;

-- ── L'identité ────────────────────────────────────────────────────────────
create table if not exists public.personnes (
  id bigint generated always as identity,
  nom_complet text,
  date_naissance date,
  gsm text,
  gsm_e164 text,
  email text,
  adresse text,
  code_postal text,
  ville text,
  created_at timestamptz default now() not null,
  prenom text,
  nom text,
  numero text,
  boite text
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='personnes_pkey') then
    alter table public.personnes add constraint personnes_pkey primary key (id);
  end if;
end $$;

-- ── Les fournisseurs, partagés entre les six sociétés ─────────────────────
create table if not exists public.fournisseurs (
  id uuid default gen_random_uuid() not null,
  nom_officiel text not null,
  nom_court text,
  bce text,
  tva text,
  forme_juridique text,
  adresse text,
  code_postal text,
  localite text,
  pays text default 'BE'::text,
  telephone text,
  email text,
  site_web text,
  statut_bce text,
  verifie_le timestamptz,
  actif boolean default true not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fournisseurs_pkey') then
    alter table public.fournisseurs add constraint fournisseurs_pkey primary key (id);
  end if;
end $$;

create table if not exists public.fournisseurs_alias (
  id bigserial not null,
  fournisseur_id uuid not null,
  libelle text not null,
  libelle_cle text,
  source text default 'manuel'::text not null,
  cree_le timestamptz default now() not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fournisseurs_alias_pkey') then
    alter table public.fournisseurs_alias add constraint fournisseurs_alias_pkey primary key (id);
  end if;
end $$;

-- ── Les alias de compagnies, lus dans les bordereaux ──────────────────────
create table if not exists public.compagnies_alias (
  id bigserial not null,
  libelle text not null,
  libelle_cle text,
  compagnie_id uuid,
  source text default 'bordereaux'::text not null,
  note text,
  cree_le timestamptz default now() not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='compagnies_alias_pkey') then
    alter table public.compagnies_alias add constraint compagnies_alias_pkey primary key (id);
  end if;
end $$;

-- ── L'attribution d'un client dans le temps ───────────────────────────────
create table if not exists public.clients_attribution (
  dossier text not null,
  gestionnaire_code text,
  sa_code text,
  depuis date default CURRENT_DATE not null,
  par_qui text,
  motif text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='clients_attribution_pkey') then
    alter table public.clients_attribution add constraint clients_attribution_pkey primary key (dossier);
  end if;
end $$;

-- ── Un collaborateur par société ──────────────────────────────────────────
create table if not exists public.collaborateur_societes (
  id bigserial not null,
  collaborateur_id bigint not null,
  societe text not null,
  statut text,
  fonction text,
  remuneration text,
  bureau_id bigint,
  numero_sous_agent integer,
  brut_mensuel numeric,
  mois_payes numeric default 13.92,
  charges_pct numeric default 25,
  vehicule_mensuel numeric,
  autres_mensuel numeric,
  honoraires_mensuels numeric,
  prime_annuelle numeric,
  heures_annuelles numeric default 1530,
  actif boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  cout_horaire numeric,
  activites text[],
  portefeuilles text[],
  date_debut date,
  date_fin date
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_pkey') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_pkey primary key (id);
  end if;
end $$;

-- ── Les contraintes qui portent la règle métier ───────────────────────────
-- Posées après coup, et seulement si elles manquent : une contrainte ajoutée
-- deux fois échoue, et `add constraint` n'a pas de `if not exists`.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_fonction_check') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_fonction_check
      check (fonction = any (array['commercial'::text,'gestionnaire'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_remuneration_check') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_remuneration_check
      check (remuneration = any (array['salaire'::text,'honoraires'::text,'commissions'::text,'aucune'::text]));
  end if;
  -- Une période qui finit avant d'avoir commencé n'est pas une période.
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_periode_coherente') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_periode_coherente
      check (date_fin is null or date_debut is null or date_fin >= date_debut);
  end if;
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_collaborateur_id_fkey') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_collaborateur_id_fkey
      foreign key (collaborateur_id) references collaborateurs(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_societe_fkey') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_societe_fkey
      foreign key (societe) references societes(code);
  end if;
  if not exists (select 1 from pg_constraint where conname='collaborateur_societes_statut_fkey') then
    alter table public.collaborateur_societes add constraint collaborateur_societes_statut_fkey
      foreign key (statut) references ref_statuts(code);
  end if;
  if not exists (select 1 from pg_constraint where conname='ref_activites_societe_fkey') then
    alter table public.ref_activites add constraint ref_activites_societe_fkey
      foreign key (societe) references societes(code);
  end if;
  if not exists (select 1 from pg_constraint where conname='ref_statuts_societes_statut_code_fkey') then
    alter table public.ref_statuts_societes add constraint ref_statuts_societes_statut_code_fkey
      foreign key (statut_code) references ref_statuts(code) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='compagnies_alias_compagnie_id_fkey') then
    alter table public.compagnies_alias add constraint compagnies_alias_compagnie_id_fkey
      foreign key (compagnie_id) references compagnies(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='fournisseurs_alias_fournisseur_id_fkey') then
    alter table public.fournisseurs_alias add constraint fournisseurs_alias_fournisseur_id_fkey
      foreign key (fournisseur_id) references fournisseurs(id) on delete cascade;
  end if;
end $$;

-- ── Les index ─────────────────────────────────────────────────────────────
create index if not exists clients_attribution_gest   on public.clients_attribution (gestionnaire_code);
create index if not exists clients_attribution_sa     on public.clients_attribution (sa_code);
create index if not exists idx_collab_soc_collab      on public.collaborateur_societes (collaborateur_id);
create index if not exists idx_collab_soc_societe     on public.collaborateur_societes (societe);
create index if not exists fournisseurs_nom_court_idx on public.fournisseurs (nom_court);
create index if not exists fournisseurs_alias_fid_idx on public.fournisseurs_alias (fournisseur_id);

-- UN SEUL RATTACHEMENT COURANT par collaborateur et par société : c'est la
-- clause `where date_fin is null` qui le dit. L'historique reste permis.
create unique index if not exists idx_collab_soc_courante
  on public.collaborateur_societes (collaborateur_id, societe) where (date_fin is null);
create unique index if not exists idx_cal_cle             on public.compagnies_alias (libelle_cle);
create unique index if not exists fournisseurs_bce_key    on public.fournisseurs (bce) where (bce is not null);
create unique index if not exists fournisseurs_alias_cle_key on public.fournisseurs_alias (libelle_cle);

-- ── Accès ─────────────────────────────────────────────────────────────────
-- Même forme que le reste du Hub en attendant le chantier des droits :
-- ouvert aux connectés, fermé à `anon`. Les deux révocations, pas une.
do $$
declare t text;
begin
  foreach t in array array['ref_statuts','ref_statuts_societes','ref_activites','personnes',
                           'fournisseurs','fournisseurs_alias','compagnies_alias',
                           'clients_attribution','collaborateur_societes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_connectes') then
      execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)',
                     t || '_connectes', t);
    end if;
  end loop;
end $$;

-- ── Vérification ──────────────────────────────────────────────────────────
do $$
declare manque text;
begin
  select string_agg(t, ', ') into manque from unnest(array[
    'ref_statuts','ref_statuts_societes','ref_activites','personnes','fournisseurs',
    'fournisseurs_alias','compagnies_alias','clients_attribution','collaborateur_societes']) t
  where to_regclass('public.'||t) is null;
  if manque is not null then raise exception 'tables absentes : %', manque; end if;

  select string_agg(t, ', ') into manque from unnest(array[
    'ref_statuts','ref_statuts_societes','ref_activites','personnes','fournisseurs',
    'fournisseurs_alias','compagnies_alias','clients_attribution','collaborateur_societes']) t
  where has_table_privilege('anon', 'public.'||t, 'SELECT');
  if manque is not null then raise exception 'anon garde SELECT sur : %', manque; end if;
end $$;
