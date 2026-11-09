-- Activités et portefeuilles, par personne et par société
-- =======================================================
-- Ludovic, 09/11 : « dans LODE, on doit pouvoir choisir le type d'activité,
-- même les deux ; dans Dynassur, à quel bureau il appartient et quel
-- portefeuille il gère ».
--
-- Deux faits qui ne se déduisent pas l'un de l'autre, d'où deux colonnes :
-- le BUREAU dit d'où la personne travaille, le PORTEFEUILLE ce qu'elle gère.
-- Juprelle a six gestionnaires : le bureau seul n'a jamais suffi à attribuer.
--
-- `ref_portefeuilles` existait depuis le début avec ses trois lignes
-- (Particulier, Professionnel, VIP) et AUCUN collaborateur rattaché. C'était
-- le point resté ouvert du 05/11 — « portefeuille, c'est le segment, le
-- bureau, ou une troisième notion ? ». Réponse : le segment, géré par
-- quelqu'un, dans un bureau.
create table if not exists ref_activites (
  code    text primary key,
  libelle text not null,
  societe text not null references societes(code),
  ordre   integer not null default 100,
  actif   boolean not null default true
);

insert into ref_activites (code, libelle, societe, ordre) values
  ('lode_protect',  'LODE PROTECT — portes de garage',     'LODE', 10),
  ('lode_rental',   'LODE RENTAL — location courte durée', 'LODE', 20),
  ('dtx_renovation','Rénovation',                          'DTX',  10),
  ('dtx_court',     'Location courte durée',               'DTX',  20),
  ('dtx_long',      'Location longue durée',               'DTX',  30)
on conflict (code) do nothing;

alter table collaborateur_societes add column if not exists activites     text[];
alter table collaborateur_societes add column if not exists portefeuilles bigint[];

comment on column collaborateur_societes.activites is
  'Codes de ref_activites. Cumulables : on peut faire les portes de garage ET la location.';
comment on column collaborateur_societes.portefeuilles is
  'Identifiants ref_portefeuilles gérés par la personne dans cette société (Dynassur). Le bureau et le portefeuille sont deux axes distincts.';

alter table ref_activites enable row level security;
drop policy if exists ref_activites_lecture on ref_activites;
create policy ref_activites_lecture on ref_activites for select to authenticated using (true);
revoke all on ref_activites from anon;
