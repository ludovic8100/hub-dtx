-- ════════════════════════════════════════════════════════════════════════════
-- Production financière reconstruite à partir des bordereaux compagnies
-- ════════════════════════════════════════════════════════════════════════════
-- Remplace `quittances` (Qlik/BRIO, vidée le 01/11/2026) comme source des
-- commissions, de la rentabilité et des objectifs. Qlik ne garde que les
-- clients, les contrats et le STATUT de production (N.A., Renon…) tant que les
-- équipes y travaillent.
--
-- Reflet de l'état appliqué en production (migrations Supabase du 01/11/2026),
-- conservé ici pour que le dépôt se suffise à lui-même.
--
-- ── Choix de conception et pourquoi ─────────────────────────────────────────
-- GRAIN : une ligne de document. Des totaux mensuels ne permettraient jamais de
--   répondre à « cette police a-t-elle été payée ? », qui est le cœur du futur
--   module impayés.
-- VOLUME : cible 5 000 000 de lignes. D'où le partitionnement par année, quatre
--   index seulement (chacun coûte ~150 Mo et ralentit l'import), et des agrégats
--   matérialisés : une vue simple rescannerait 5 M de lignes à chaque écran.
-- CONTRÔLE : chaque bordereau annonce son propre total. On le stocke et on le
--   compare à la somme extraite. Un document dont l'écart dépasse le centime
--   n'est pas fiable et ne doit pas alimenter les chiffres — c'est ce qui
--   manquait à la tentative d'extraction précédente, abandonnée faute de pouvoir
--   détecter une ligne manquée.
-- LACUNES : « on n'a pas tous les bordereaux » est un fait mesuré, pas une
--   inquiétude (voir v_lacunes_bordereaux). Au 01/11/2026 : 113 227 € encaissés
--   en 2026 sans document correspondant.

-- ── Table principale, partitionnée par année ────────────────────────────────
create table public.releves_producteur (
  id                 bigserial,
  bordereau_id       bigint references public.bordereaux(id) on delete cascade,
  compagnie          text not null,
  compte_producteur  text,
  type_document      text not null check (type_document in ('RCP','BQT')),
  periode            date not null,
  date_echeance      date,
  client_nom         text,
  police             text,
  code_operation     text,      -- 600, 606, 637, 912… propre à chaque compagnie
  libelle_operation  text,
  categorie          text,
  sous_agent_code    text,      -- AG le porte sur la ligne : pas de rapprochement par nom
  prime              numeric,   -- surtout présent sur les BQT
  debit              numeric,
  credit             numeric,
  montant            numeric generated always as (coalesce(credit,0) - coalesce(debit,0)) stored,
  importe_le         timestamptz not null default now(),
  primary key (id, periode)     -- la clé doit porter la colonne de partition
) partition by range (periode);

do $$
declare a int;
begin
  for a in 2017..2030 loop
    execute format(
      'create table if not exists public.releves_producteur_%s partition of public.releves_producteur for values from (%L) to (%L)',
      a, a || '-01-01', (a + 1) || '-01-01');
  end loop;
end $$;
create table if not exists public.releves_producteur_hors_plage
  partition of public.releves_producteur default;

-- Pas d'index sur periode seule : le partitionnement s'en charge.
create index idx_rp_compagnie on public.releves_producteur (compagnie, periode);
create index idx_rp_police    on public.releves_producteur (police);
create index idx_rp_sa        on public.releves_producteur (sous_agent_code, periode);
create index idx_rp_bordereau on public.releves_producteur (bordereau_id);

-- ── Contrôle : extrait vs annoncé, document par document ────────────────────
create table public.releves_producteur_controle (
  bordereau_id   bigint primary key references public.bordereaux(id) on delete cascade,
  compagnie      text not null,
  periode        date not null,
  solde_annonce  numeric,
  cumul_mois     numeric,
  cumul_annuel   numeric,
  total_calcule  numeric,
  ecart          numeric generated always as (coalesce(total_calcule,0) - coalesce(cumul_mois,0)) stored,
  nb_lignes      integer,
  importe_le     timestamptz not null default now()
);

-- Le texte d'origine n'est gardé que là où il sert : les documents en échec.
-- Le conserver pour 5 M de lignes coûterait ~120 Mo sans usage.
create table public.releves_producteur_rejets (
  id            bigserial primary key,
  bordereau_id  bigint references public.bordereaux(id) on delete cascade,
  compagnie     text,
  periode       date,
  motif         text,          -- 'ecart_total', 'ligne_non_reconnue'…
  texte_source  text,
  cree_le       timestamptz not null default now()
);
create index idx_rpr_bordereau on public.releves_producteur_rejets (bordereau_id);

-- ── Ce que les écrans lisent ────────────────────────────────────────────────
-- Jamais la table ligne à ligne, sauf pour une police précise.
create materialized view public.mv_rp_mensuel as
select periode, compagnie, sous_agent_code,
       count(*)                          as nb_lignes,
       count(distinct police)            as nb_polices,
       round(sum(montant), 2)            as commission,
       round(sum(coalesce(prime, 0)), 2) as primes
from public.releves_producteur
group by periode, compagnie, sous_agent_code;

-- Index unique obligatoire pour rafraîchir sans bloquer la lecture :
--   refresh materialized view concurrently public.mv_rp_mensuel;
create unique index idx_mv_rp_mensuel on public.mv_rp_mensuel
  (periode, compagnie, coalesce(sous_agent_code, ''));

-- Santé de l'extraction
create or replace view public.v_rp_qualite as
select c.periode, c.compagnie,
       count(*)                                                 as documents,
       count(*) filter (where abs(coalesce(c.ecart,0)) <= 0.01) as documents_ok,
       round(sum(abs(coalesce(c.ecart, 0))), 2)                 as ecart_cumule,
       sum(c.nb_lignes)                                         as lignes
from public.releves_producteur_controle c
group by c.periode, c.compagnie;

-- Trous de collecte : voir la définition appliquée (migration vue_lacunes_bordereaux).
-- etat = 'paye_sans_document' : la compagnie a viré de l'argent, aucun bordereau
-- en face — la production correspondante est invisible.

-- ── Droits (alignés sur l'accès libre temporaire en cours) ──────────────────
alter table public.releves_producteur           enable row level security;
alter table public.releves_producteur_controle  enable row level security;
alter table public.releves_producteur_rejets    enable row level security;

create policy rp_read   on public.releves_producteur          for select to authenticated using (true);
create policy rpc_read  on public.releves_producteur_controle for select to authenticated using (true);
create policy rprj_read on public.releves_producteur_rejets   for select to authenticated using (true);
create policy rp_libre   on public.releves_producteur          for all to anon using (true) with check (true);
create policy rpc_libre  on public.releves_producteur_controle for all to anon using (true) with check (true);
create policy rprj_libre on public.releves_producteur_rejets   for all to anon using (true) with check (true);
