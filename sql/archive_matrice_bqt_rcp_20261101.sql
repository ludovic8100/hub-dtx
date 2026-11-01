-- Archive des objets retirés le 01/11/2026 avec l'onglet « Matrice BQT/RCP ».
-- Conservé ici pour pouvoir reconstruire si besoin : la logique n'est pas perdue,
-- seuls les objets en base ont été supprimés (1 ligne dans bordereaux_brio, aucune
-- donnée métier — v_matrice_rcp_2026 était une vue, donc recalculable).
--
-- ATTENTION : v_paiements_rcp_2026, dont dépendait v_matrice_rcp_2026, N'A PAS été
-- supprimée. C'est elle qui détecte les paiements entrants des compagnies et en
-- extrait le producteur et la période (brique de la phase 2) : elle reste en place.

-- ───────────────────────────── bordereaux_brio ─────────────────────────────
-- Suivi manuel « ce bordereau a été encodé dans Brio », coché à la main dans la
-- Matrice. Une seule ligne avait été saisie depuis sa création.

create table if not exists public.bordereaux_brio (
  id         uuid primary key default gen_random_uuid(),
  code_comp  text    not null,
  producteur text    not null,
  mois       integer not null,
  annee      integer not null default 2026,
  encode_le  timestamptz not null default now()
);

-- ─────────────────────────── v_matrice_rcp_2026 ───────────────────────────
-- Croisait, par compagnie × producteur × mois de 2026 : le paiement reçu
-- (v_paiements_rcp_2026), la présence d'un document RCP et celle d'un document BQT.
-- La normalisation des noms de compagnie y était codée en dur (quinzaine de CASE WHEN),
-- ce qui est précisément ce qu'on remplace par un référentiel par compagnie.

create or replace view public.v_matrice_rcp_2026 as
with paie as (
  select code_comp, producteur, right(periode, 2)::integer as mois, sum(montant) as montant
  from v_paiements_rcp_2026
  where periode like '2026-%' and producteur is not null
  group by code_comp, producteur, right(periode, 2)::integer
), bordn as (
  select
    case
      when compagnie ilike 'AG%'       then 'AG'
      when compagnie ilike 'AXA%'      then 'AXA'
      when compagnie ~* 'P ?& ?V|VIVIUM' then 'VIVIUM'
      when compagnie ilike 'BALOISE%'  then 'BALOISE'
      when compagnie ilike 'DKV%'      then 'DKV'
      when compagnie ilike 'DAS%'      then 'DAS'
      when compagnie ilike 'NN%'       then 'NN'
      when compagnie ilike 'CARDIF%'   then 'CARDIF'
      when compagnie ilike 'ALLIANZ%'  then 'ALLIANZ'
      when compagnie ilike 'MONUMENT%' then 'MONUMENT'
      when compagnie ilike 'AEDES%'    then 'AEDES'
      when compagnie ~* 'A?HTORA'      then 'ATHORA'
      when compagnie ilike 'AMMA%'     then 'AMMA'
      when compagnie ilike 'ARAG%'     then 'ARAG'
      when compagnie ilike 'EUROMEX%'  then 'EUROMEX'
      else null
    end as code_comp,
    case
      when compte_producteur = '3145235' then '145235'
      when compte_producteur ~ '^0*\d+$' then ltrim(compte_producteur, '0')
      else compte_producteur
    end as producteur,
    mois::integer as mois,
    type
  from bordereaux
  where annee = 2026 and type in ('RCP', 'BQT')
), rcpd as (
  select distinct code_comp, producteur, mois from bordn where type = 'RCP' and code_comp is not null
), bqtd as (
  select distinct code_comp, producteur, mois from bordn where type = 'BQT' and code_comp is not null
), keys as (
  select code_comp, producteur, mois from paie
  union select code_comp, producteur, mois from rcpd
  union select code_comp, producteur, mois from bqtd
)
select k.code_comp, k.producteur, k.mois,
       p.producteur is not null as paye,
       p.montant as montant_paye,
       r.producteur is not null as rcp_doc,
       b.producteur is not null as bqt_doc
from keys k
  left join paie p on p.code_comp = k.code_comp and p.producteur = k.producteur and p.mois = k.mois
  left join rcpd r on r.code_comp = k.code_comp and r.producteur = k.producteur and r.mois = k.mois
  left join bqtd b on b.code_comp = k.code_comp and b.producteur = k.producteur and b.mois = k.mois
where k.code_comp is not null and k.producteur is not null;
