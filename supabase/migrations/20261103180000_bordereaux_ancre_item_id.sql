-- Ancre l'identité d'un bordereau sur son identifiant SharePoint, pas sur son nom.
--
-- Pourquoi : `cle_unique` est fabriquée à partir du nom de fichier
-- (« 2026-06-RCP-AXA-0157650 »). Or un renommage automatique corrige
-- régulièrement le nom — c'est même son travail : « DYNASSUR » (le courtier)
-- devient « AXA » (la compagnie), « CARES » devient « CARES ASSISTANCE ».
-- L'indexation créait alors une NOUVELLE ligne sous la nouvelle clé et
-- laissait l'ancienne derrière elle. Résultat : 70 lignes fantômes qui ne
-- correspondent à aucun fichier, dont un même document compté trois fois.
--
-- L'identifiant SharePoint, lui, ne bouge pas quand le fichier est renommé.
--
-- Les 70 lignes retirées ont été vérifiées une à une avant écriture : aucune
-- ne porte de montant, de commission, de net, de solde, de paiement, de date
-- de clôture, de rattachement à un virement, d'extraction ni de note. Ce sont
-- des coquilles vides. La ligne conservée pour chaque document est celle qui
-- porte une donnée financière, et à défaut la plus récente — celle qui porte
-- le nom corrigé.

begin;

create temporary table bordereaux_fantomes on commit drop as
select id
from (
  select id,
         row_number() over (
           partition by sharepoint_item_id
           order by (montant is not null or transaction_id is not null) desc, id desc
         ) as rang
  from public.bordereaux
  where sharepoint_item_id is not null
) t
where rang > 1;

-- Garde-fou : si la suppression portait soudain sur bien plus que les 70
-- doublons constatés, c'est que quelque chose a changé en base depuis
-- l'analyse. On préfère échouer que vider la table.
do $$
declare n integer;
begin
  select count(*) into n from bordereaux_fantomes;
  if n > 150 then
    raise exception 'Suppression inattendue : % lignes visées (70 attendues). Migration interrompue.', n;
  end if;
  raise notice 'Lignes fantômes retirées : %', n;
end $$;

delete from public.bordereaux b
using bordereaux_fantomes f
where b.id = f.id;

-- Désormais un document SharePoint = une ligne, quel que soit son nom.
create unique index if not exists bordereaux_sharepoint_item_id_key
  on public.bordereaux (sharepoint_item_id)
  where sharepoint_item_id is not null;

commit;

-- Le garde-fou des synchronisations : un job qui n'est pas déclaré ici est un
-- job qu'on ne verra pas tomber. C'est exactement ce qui est arrivé à
-- l'indexation des bordereaux, arrêtée le 20/10 et découverte le 03/11.
insert into public.jobs_attendus (job, libelle, plateforme, frequence_attendue, actif, commentaire)
values (
  'bordereaux-sharepoint',
  'Relevés et quittancements compagnies → bordereaux',
  'github',
  interval '1 day',
  true,
  'GitHub Action bordereaux-sharepoint.yml (05:52 UTC) — remplace le workflow n8n « Bordereaux BQT/RCP → Supabase », arrêté le 20/10/2026'
)
on conflict (job) do update
  set libelle            = excluded.libelle,
      plateforme         = excluded.plateforme,
      frequence_attendue = excluded.frequence_attendue,
      actif              = excluded.actif,
      commentaire        = excluded.commentaire;
