-- ENCAISSEMENT PRODUCTEUR — modèle de travail, monté d'abord en TEST.
--
-- Ce que c'est, règle donnée par Ludovic le 10/11/2026 : certains clients
-- paient leur prime AU COURTIER et non à la compagnie. La compagnie retire
-- alors le montant du compte producteur — Dynassur encaisse, et doit.
--
-- ⚠️ CE N'EST PAS UN PRODUIT. L'argent entre par la banque et ressort par le
-- débit du relevé ; seule la commission reste. Le compter en « Rentrées »
-- gonflerait le chiffre d'affaires d'un argent qui ne nous appartient pas.
-- Trois natures, donc : produit, dépense, et COLLECTE POUR COMPTE DE TIERS.
--
-- ⚠️ ET CE N'EST PAS UN RAPPROCHEMENT LIGNE À LIGNE. Ludovic, le 10/11 :
-- « tu ne sauras jamais matcher tous les paiements de chaque client à une
-- ligne du bordereau » — les clients paient des montants RONDS, et une
-- régularisation vient plus tard. Chercher le versement qui correspond à la
-- quittance ne tombera jamais juste, et un contrôle qui crie à chaque montant
-- rond est un contrôle qu'on éteint au bout d'un mois.
--
-- D'où un COMPTE COURANT par (client, compte producteur) :
--     dû (quittances) − versé (virements + espèces) = solde
-- Un montant rond n'est plus une anomalie, c'est un acompte. Une
-- régularisation n'est plus un cas particulier, c'est un mouvement de plus.

-- ── L'arrangement ─────────────────────────────────────────────────────────
-- Une ligne par (client, compte producteur) : c'est le « statut » dont parle
-- Ludovic, celui qui donne au client un code différent dans le relevé.
create table if not exists encaissement_comptes (
  id             uuid primary key default gen_random_uuid(),
  societe        text not null default 'DYNASSUR',
  client_id      bigint not null references clients(id) on delete cascade,
  producteur_id  uuid references producteurs(id),
  compagnie_id   uuid references compagnies(id),
  -- Le code que la compagnie donne au client dans le relevé. Information,
  -- jamais clé : c'est (client, compte producteur) qui identifie.
  code_releve    text,
  actif          boolean not null default true,
  depuis         date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (client_id, producteur_id)
);

comment on table encaissement_comptes is
  'Clients qui paient leur prime au courtier plutôt qu''à la compagnie. Un compte courant par (client, compte producteur).';

-- ── Les versements ────────────────────────────────────────────────────────
-- LE MODE COMPTE AUTANT QUE LE MONTANT. Sans lui, un client qui paie au
-- comptoir est indiscernable d'un impayé : le module impayés le relancerait.
create table if not exists encaissement_versements (
  id               uuid primary key default gen_random_uuid(),
  societe          text not null default 'DYNASSUR',
  compte_id        uuid not null references encaissement_comptes(id) on delete cascade,
  date_versement   date not null,
  montant          numeric not null check (montant > 0),
  mode             text not null check (mode in ('virement','especes','domiciliation','autre')),
  -- Virement : le mouvement bancaire qui le prouve. Nul tant que la banque
  -- ne l'a pas encore rendu — l'écran le signale « à rapprocher » au lieu de
  -- refuser la saisie.
  transaction_id   uuid references transactions(id),
  -- Espèces : le numéro de la quittance remise au client. C'est la seule
  -- preuve qui existe pour ce mode.
  quittance_numero text,
  recu_par         text,
  notes            text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_encaiss_vers_compte on encaissement_versements (compte_id, date_versement);
create index if not exists idx_encaiss_vers_tx     on encaissement_versements (transaction_id) where transaction_id is not null;

comment on table encaissement_versements is
  'Chaque versement d''un client en encaissement producteur. Le mode distingue virement et espèces : sans lui, un paiement au comptoir ressemble à un impayé.';

-- `quittances` relie aujourd'hui par le NOM du client, ce qui ne tient pas.
-- Colonne ajoutée, nullable : rien ne casse, et le lien devient possible.
alter table quittances add column if not exists client_id bigint references clients(id);
create index if not exists idx_quittances_client on quittances (client_id);

-- ── Le solde ──────────────────────────────────────────────────────────────
-- Les deux côtés sont agrégés SÉPARÉMENT avant d'être joints. Une jointure
-- directe entre quittances et versements multiplierait les lignes : trois
-- quittances et deux versements donneraient six lignes, et des totaux faux.
create or replace view v_encaissement_solde as
with du as (
  select client_id,
         count(*)                        nb_quittances,
         coalesce(sum(prime_totale), 0)  total_du,
         min(date_comptable)             premiere_echeance,
         max(date_comptable)             derniere_echeance
  from quittances
  where client_id is not null
  group by client_id
),
verse as (
  select compte_id,
         count(*)                                                     nb_versements,
         coalesce(sum(montant), 0)                                    total_verse,
         coalesce(sum(montant) filter (where mode = 'especes'), 0)    dont_especes,
         max(date_versement)                                          dernier_versement,
         count(*) filter (where mode = 'virement' and transaction_id is null)  virements_sans_mouvement,
         count(*) filter (where mode = 'especes'  and quittance_numero is null) especes_sans_quittance
  from encaissement_versements
  group by compte_id
)
select
  ec.id                                   compte_id,
  ec.societe,
  ec.actif,
  ec.code_releve,
  c.id                                    client_id,
  trim(coalesce(c.nom,'') || ' ' || coalesce(c.prenom,'')) client,
  c.dossier,
  cie.nom                                 compagnie,
  p.numero_producteur,
  coalesce(d.nb_quittances, 0)            nb_quittances,
  coalesce(d.total_du, 0)                 total_du,
  coalesce(v.nb_versements, 0)            nb_versements,
  coalesce(v.total_verse, 0)              total_verse,
  coalesce(v.dont_especes, 0)             dont_especes,
  -- Positif = le client doit encore. Négatif = il a payé d'avance.
  coalesce(d.total_du, 0) - coalesce(v.total_verse, 0) as solde,
  d.derniere_echeance,
  v.dernier_versement,
  coalesce(v.virements_sans_mouvement, 0) virements_sans_mouvement,
  coalesce(v.especes_sans_quittance, 0)   especes_sans_quittance
from encaissement_comptes ec
join clients c           on c.id = ec.client_id
left join producteurs p  on p.id = ec.producteur_id
left join compagnies cie on cie.id = ec.compagnie_id
left join du d           on d.client_id = ec.client_id
left join verse v        on v.compte_id = ec.id;

comment on view v_encaissement_solde is
  'Compte courant par client en encaissement producteur : dû (quittances) moins versé (virements + espèces). Positif = le client doit, négatif = il a payé d''avance.';

-- ── Accès ─────────────────────────────────────────────────────────────────
-- `anon` est le rôle d'AVANT connexion, et sa clé est publique. Deux
-- révocations, pas une : PUBLIC et anon tiennent le droit séparément.
alter table encaissement_comptes    enable row level security;
alter table encaissement_versements enable row level security;

drop policy if exists encaiss_comptes_lecture on encaissement_comptes;
create policy encaiss_comptes_lecture on encaissement_comptes
  for all to authenticated using (true) with check (true);

drop policy if exists encaiss_versements_lecture on encaissement_versements;
create policy encaiss_versements_lecture on encaissement_versements
  for all to authenticated using (true) with check (true);

revoke all on encaissement_comptes, encaissement_versements from public, anon;
grant select, insert, update, delete on encaissement_comptes, encaissement_versements to authenticated;

revoke all on v_encaissement_solde from public, anon;
grant select on v_encaissement_solde to authenticated;
