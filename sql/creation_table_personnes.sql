-- Appliqué en production le 31/10/2026 (migrations creation_table_personnes,
-- backfill_personnes_sans_email, rls_grants_personnes). Conservé ici pour
-- traçabilité — voir docs/DROITS-ACCES.md pour le contexte et le schéma.
--
-- Phase 1 : collaborateurs seulement (49 lignes, sans ambiguïté). clients.personne_id
-- reste vide — le rapprochement des 10 298 clients est un chantier séparé, qui demande
-- une revue humaine des correspondances proposées avant toute fusion réelle.

create table public.personnes (
  id bigint generated always as identity primary key,
  nom_complet text,
  date_naissance date,
  gsm text,
  gsm_e164 text,
  email text,
  adresse text,
  code_postal text,
  ville text,
  created_at timestamptz not null default now()
);
comment on table public.personnes is 'Identité physique unique. collaborateurs et (plus tard) clients y renvoient via personne_id, pour éviter de dupliquer coordonnées/contacts par rôle.';

alter table public.collaborateurs add column if not exists personne_id bigint references public.personnes(id);
alter table public.collaborateurs add column if not exists titre text;
comment on column public.collaborateurs.titre is 'Titre/fonction affiché (ex. "Gestionnaire sinistres") — distinct du rôle métier (Commercial/Gestionnaire/...) qui sert au calcul des commissions et aux droits.';

alter table public.clients add column if not exists personne_id bigint references public.personnes(id);
comment on column public.clients.personne_id is 'Vers personnes.id — vide pour l''instant. Rapprochement des clients existants non fait automatiquement (chantier séparé, nécessite une revue humaine).';

-- Backfill : une ligne personnes par collaborateur (1:1, sans ambiguïté)
with cree as (
  insert into public.personnes (nom_complet, date_naissance, gsm, gsm_e164, email, adresse, code_postal, ville)
  select nom_complet, date_naissance, gsm, gsm_e164, email, adresse, code_postal, ville
  from public.collaborateurs
  order by id
  returning id, email
)
update public.collaborateurs c
set personne_id = p.id
from cree p
where lower(c.email) = lower(p.email);

-- Collaborateurs sans email (sous-agents purs sans compte Hub) : jointure par nom
update public.collaborateurs c
set personne_id = p.id
from public.personnes p
where c.personne_id is null
  and p.email is null
  and p.nom_complet = c.nom_complet
  and not exists (select 1 from public.collaborateurs c2 where c2.personne_id = p.id);

-- Adresse structurée des bureaux (devoirs d'information, courriers clients)
alter table public.ref_bureaux add column if not exists rue text;
alter table public.ref_bureaux add column if not exists numero text;
alter table public.ref_bureaux add column if not exists boite text;
alter table public.ref_bureaux add column if not exists code_postal text;
alter table public.ref_bureaux add column if not exists ville text;

-- RLS + droits (nouvelle table, rien n'est accordé par défaut)
alter table public.personnes enable row level security;
create policy p_read on public.personnes for select to authenticated using (true);
create policy p_write_admin on public.personnes for all to authenticated using (is_admin()) with check (is_admin());
-- Cohérent avec l'accès libre temporaire actif ailleurs — à retirer avec
-- sql/retirer_acces_libre_temporaire.sql en même temps que les autres.
create policy temp_acces_libre_sans_login on public.personnes for all to anon using (true) with check (true);
grant select, insert, update, delete on table public.personnes to authenticated, anon;
grant usage, select on sequence personnes_id_seq to authenticated, anon;
