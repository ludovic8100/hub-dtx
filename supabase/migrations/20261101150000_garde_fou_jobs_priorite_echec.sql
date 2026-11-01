-- Correctif d'ordre dans v_jobs_sante : un job dont la dernière exécution a
-- échoué doit s'afficher « echec », même s'il n'a jamais connu de succès.
-- Avant, « jamais » passait en premier et masquait l'échec.
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
    when not a.actif                                                        then 'inactif'
    when d.statut = 'en_cours' and now() - d.demarre_a > interval '2 hours' then 'bloque'
    when d.statut = 'echec'                                                 then 'echec'
    when s.succes_a is null                                                 then 'jamais'
    when now() - s.succes_a > a.frequence_attendue + a.tolerance            then 'en_retard'
    else 'ok'
  end as sante
from public.jobs_attendus a
left join dernier        d on d.job = a.job
left join dernier_succes s on s.job = a.job;

comment on view public.v_jobs_sante is
  'État de chaque job attendu. sante = ok | echec | en_retard | bloque | jamais | inactif.';
