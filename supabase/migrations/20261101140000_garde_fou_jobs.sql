-- ================================================================
-- Garde-fou d'exécution des jobs (01/11/2026)
--
-- Motif : la synchro Ponto a tourné 11 jours avec une clé invalide
-- sans que personne le voie. Un job qui échoue en silence est
-- indiscernable d'un job qui n'a rien à faire. On rend la différence
-- visible : chaque job déclare ce qu'il fait, et le Hub signale
-- celui qui n'a plus rien écrit depuis trop longtemps.
--
-- Deux tables :
--   jobs_attendus — ce qui DOIT tourner, et à quelle fréquence
--   jobs_log      — ce qui a RÉELLEMENT tourné
-- La vue v_jobs_sante croise les deux.
-- ================================================================

begin;

-- ----------------------------------------------------------------
-- Référentiel : ce qui doit tourner
-- ----------------------------------------------------------------
create table if not exists public.jobs_attendus (
  job                text primary key,
  libelle            text        not null,
  plateforme         text        not null check (plateforme in ('supabase','vercel','github','n8n')),
  frequence_attendue interval    not null,
  tolerance          interval    not null default '1 hour',
  actif              boolean     not null default true,
  commentaire        text
);

comment on table public.jobs_attendus is
  'Jobs que le Hub attend. frequence_attendue + tolerance = délai au-delà duquel on alerte.';

-- ----------------------------------------------------------------
-- Journal : ce qui a tourné
-- ----------------------------------------------------------------
create table if not exists public.jobs_log (
  id             bigint generated always as identity primary key,
  job            text        not null,
  declencheur    text        not null default 'cron' check (declencheur in ('cron','manuel','webhook')),
  statut         text        not null default 'en_cours' check (statut in ('en_cours','succes','echec')),
  demarre_a      timestamptz not null default now(),
  termine_a      timestamptz,
  lignes_lues    integer,
  lignes_ecrites integer,
  message        text,
  detail         jsonb
);

create index if not exists idx_jobs_log_job_demarre on public.jobs_log (job, demarre_a desc);
create index if not exists idx_jobs_log_statut      on public.jobs_log (statut) where statut <> 'succes';

comment on table public.jobs_log is
  'Une ligne par exécution de job. Écrit par job_debut() / job_fin(), réservés au service_role.';

-- ----------------------------------------------------------------
-- Écriture : réservée aux jobs (service_role)
-- ----------------------------------------------------------------
create or replace function public.job_debut(p_job text, p_declencheur text default 'cron')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  insert into public.jobs_log (job, declencheur, statut)
  values (p_job, coalesce(p_declencheur, 'cron'), 'en_cours')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.job_fin(
  p_id             bigint,
  p_statut         text,
  p_lignes_ecrites integer default null,
  p_lignes_lues    integer default null,
  p_message        text    default null,
  p_detail         jsonb   default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.jobs_log
     set statut = p_statut,
         termine_a = now(),
         lignes_ecrites = p_lignes_ecrites,
         lignes_lues = p_lignes_lues,
         message = p_message,
         detail = p_detail
   where id = p_id;
end;
$$;

revoke execute on function public.job_debut(text, text) from public, anon, authenticated;
revoke execute on function public.job_fin(bigint, text, integer, integer, text, jsonb) from public, anon, authenticated;
grant  execute on function public.job_debut(text, text) to service_role;
grant  execute on function public.job_fin(bigint, text, integer, integer, text, jsonb) to service_role;

-- ----------------------------------------------------------------
-- Santé : un état par job attendu
-- ----------------------------------------------------------------
create or replace view public.v_jobs_sante as
with dernier as (
  select distinct on (job) job, statut, demarre_a, termine_a, lignes_ecrites, message
  from public.jobs_log
  order by job, demarre_a desc
),
dernier_succes as (
  select distinct on (job) job, demarre_a as succes_a, lignes_ecrites as succes_lignes
  from public.jobs_log
  where statut = 'succes'
  order by job, demarre_a desc
)
select
  a.job,
  a.libelle,
  a.plateforme,
  a.frequence_attendue,
  a.actif,
  a.commentaire,
  d.statut          as dernier_statut,
  d.demarre_a       as derniere_execution,
  d.message         as dernier_message,
  s.succes_a        as dernier_succes,
  s.succes_lignes,
  now() - s.succes_a as age_dernier_succes,
  case
    when not a.actif                                                    then 'inactif'
    when d.statut = 'en_cours' and now() - d.demarre_a > interval '2 hours' then 'bloque'
    when s.succes_a is null                                             then 'jamais'
    when now() - s.succes_a > a.frequence_attendue + a.tolerance        then 'en_retard'
    when d.statut = 'echec'                                             then 'echec'
    else 'ok'
  end as sante
from public.jobs_attendus a
left join dernier        d on d.job = a.job
left join dernier_succes s on s.job = a.job;

comment on view public.v_jobs_sante is
  'État de chaque job attendu. sante = ok | en_retard | echec | bloque | jamais | inactif.';

-- ----------------------------------------------------------------
-- Lecture : ouverte au Hub, écriture fermée
-- ----------------------------------------------------------------
alter table public.jobs_attendus enable row level security;
alter table public.jobs_log      enable row level security;

drop policy if exists jobs_attendus_lecture on public.jobs_attendus;
create policy jobs_attendus_lecture on public.jobs_attendus for select using (true);

drop policy if exists jobs_log_lecture on public.jobs_log;
create policy jobs_log_lecture on public.jobs_log for select using (true);
-- Aucune policy d'écriture : seul le service_role (qui contourne la RLS) écrit.

-- ----------------------------------------------------------------
-- Ce qui doit tourner aujourd'hui
-- ----------------------------------------------------------------
insert into public.jobs_attendus (job, libelle, plateforme, frequence_attendue, tolerance, commentaire) values
  ('sync-ponto-comptes',        'Soldes et transactions Ponto',        'supabase', '1 day',  '6 hours',  'Edge Function + pg_cron sync_ponto_comptes_daily (00:11)'),
  ('sync-entra-collaborateurs', 'Collaborateurs Entra → Hub',          'supabase', '1 hour', '2 hours',  'Edge Function + pg_cron sync_entra_collaborateurs_hourly (:07)'),
  ('tickets-rappels-echeance',  'Rappels d''échéance des tickets',     'supabase', '1 day',  '6 hours',  'pg_cron tickets_rappels_echeance_daily (06:00)'),
  ('qlik-sync',                 'Clients, contrats, statut production', 'github',  '1 day',  '6 hours',  'GitHub Action qlik-sync.yml (06:30) — seule synchro Qlik conservée')
on conflict (job) do nothing;

commit;
