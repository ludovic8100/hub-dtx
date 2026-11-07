-- RATTRAPAGE — le modele de droits n'existait dans AUCUNE migration du depot.
--
-- Il a ete applique directement en production fin octobre, sans laisser de
-- fichier. Le projet de test, monte le 07/11 a partir des migrations, ne l'a
-- donc jamais recu — et ca s'est vu de la facon la plus visible possible :
-- l'authentification Microsoft reussissait, puis le Hub cherchait la fiche du
-- collaborateur et tombait sur « Acces non autorise », faute de colonne
-- `compte_hub_actif` et des trois tables du modele de modules.
--
-- Cette migration est IDEMPOTENTE : en production elle ne fait rien (tout
-- existe deja), en test elle comble. C'est le premier morceau d'un rattrapage
-- plus large — une vingtaine d'objets sont encore dans ce cas, dont
-- `fournisseurs`, `personnes`, `releves_producteur`, les vues d'anomalies,
-- `a_module()` et `acces_compta()`.

alter table public.collaborateurs
  add column if not exists compte_hub_actif       boolean default false,
  add column if not exists premiere_connexion     timestamptz,
  add column if not exists derniere_connexion     timestamptz,
  add column if not exists voit_tout_portefeuille boolean default false;

create table if not exists public.ref_modules (
  code    text primary key,
  libelle text not null,
  ordre   integer not null default 0
);

create table if not exists public.ref_modules_societes (
  module_code     text not null references public.ref_modules(code) on delete cascade,
  societe         text not null,
  colonnes_legacy text[],
  colonne_acces   text,
  primary key (module_code, societe)
);

create table if not exists public.collaborateur_acces (
  collaborateur_id bigint not null references public.collaborateurs(id) on delete cascade,
  societe          text   not null,
  module_code      text   not null references public.ref_modules(code) on delete cascade,
  accorde_le       timestamptz not null default now(),
  primary key (collaborateur_id, societe, module_code)
);

-- RLS DES LA CREATION. Une table neuve n'herite d'aucun droit, et c'est le
-- piege qui a coute deux fois le 07/11 : les partitions de releves_producteur
-- et les vues d'anomalies etaient ouvertes a `anon` pour cette seule raison.
do $$
begin
  execute 'alter table public.ref_modules          enable row level security';
  execute 'alter table public.ref_modules_societes enable row level security';
  execute 'alter table public.collaborateur_acces  enable row level security';
exception when others then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ref_modules' and policyname='modules_lecture') then
    execute 'create policy modules_lecture on public.ref_modules for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ref_modules_societes' and policyname='modsoc_lecture') then
    execute 'create policy modsoc_lecture on public.ref_modules_societes for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='collaborateur_acces' and policyname='acces_lecture') then
    execute 'create policy acces_lecture on public.collaborateur_acces for select to authenticated using (true)';
  end if;
end $$;

revoke all on table public.ref_modules, public.ref_modules_societes, public.collaborateur_acces from anon;

-- Le CATALOGUE des modules est du referentiel, pas de la donnee metier : il est
-- le meme dans tous les environnements. `on conflict do nothing` le rend sans
-- effet la ou il existe deja.
insert into public.ref_modules (code, libelle, ordre) values
('dashboard','Tableau de bord',10),('clients','Clients',20),('production','Production et chiffres',30),
('compagnies','Compagnies',40),('sinistres','Sinistres',50),('credits','Crédits',60),
('appels','Appels',70),('comptabilite','Comptabilité',80),('devis_factures','Devis et factures',90),
('rentabilite','Rentabilité',100),('immobilier','Immobilier',110),('vehicules','Véhicules',120),
('trading','Trading',130),('membres','Membres',140),('cotisations','Cotisations',150),
('notes_frais','Notes de frais',160),('succession','Succession',170),('outils','Outils',180)
on conflict (code) do nothing;

insert into public.ref_modules_societes (module_code, societe, colonnes_legacy, colonne_acces) values
('appels','DYNASSUR','{dyn_appels}','acc_dynassur'),('clients','DYNASSUR','{dyn_clients}','acc_dynassur'),
('clients','LODE','{lode_clients}','acc_lode'),('compagnies','DYNASSUR','{dyn_compagnies}','acc_dynassur'),
('comptabilite','DTX','{dtx_comptabilite}','acc_dtx'),('comptabilite','DYNASSUR','{dyn_comptabilite}','acc_dynassur'),
('comptabilite','HEXAGROUP','{hex_comptabilite}','acc_hexagroup'),('comptabilite','HOL','{acc_holding}','acc_holding'),
('comptabilite','LODE','{lode_comptabilite}','acc_lode'),('comptabilite','PRIVE','{prive_comptabilite}','acc_prive'),
('cotisations','HEXAGROUP','{hex_cotisations}','acc_hexagroup'),('credits','DYNASSUR','{dyn_credits}','acc_dynassur'),
('dashboard','DTX','{dtx_dashboard}','acc_dtx'),('dashboard','DYNASSUR','{dyn_dashboard}','acc_dynassur'),
('dashboard','HEXAGROUP','{hex_dashboard}','acc_hexagroup'),('dashboard','HOL','{acc_holding}','acc_holding'),
('dashboard','LODE','{lode_dashboard}','acc_lode'),('dashboard','PRIVE','{prive_dashboard}','acc_prive'),
('devis_factures','DTX','{dtx_devis}','acc_dtx'),('devis_factures','LODE','{lode_devis}','acc_lode'),
('immobilier','DTX','{dtx_immobilier}','acc_dtx'),('membres','HEXAGROUP','{hex_membres}','acc_hexagroup'),
('notes_frais','DTX','{dtx_notesfrais}','acc_dtx'),('notes_frais','DYNASSUR','{dyn_notesfrais}','acc_dynassur'),
('notes_frais','HEXAGROUP','{hex_notesfrais}','acc_hexagroup'),('notes_frais','HOL','{grp_notesfrais}','acc_holding'),
('notes_frais','LODE','{lode_notesfrais}','acc_lode'),('notes_frais','PRIVE','{prive_notesfrais}','acc_prive'),
('outils','TRANSVERSAL','{acc_tools}',NULL),
('production','DYNASSUR','{dyn_production,dyn_chiffres,dyn_rentabilite,dyn_objectifs}','acc_dynassur'),
('rentabilite','LODE','{lode_rentabilite}','acc_lode'),('sinistres','DYNASSUR','{dyn_sinistres}','acc_dynassur'),
('succession','PRIVE','{prive_succession}','acc_prive'),('trading','DTX','{dtx_trading}','acc_dtx'),
('vehicules','DTX','{dtx_vehicules}','acc_dtx')
on conflict (module_code, societe) do nothing;

-- PAS DE COLLABORATEUR ICI. Les comptes sont de la donnee, pas du schema :
-- la fiche administrateur du projet de test a ete creee a la main, et le
-- peuplement du test est le role de scripts/seed_test.py.
