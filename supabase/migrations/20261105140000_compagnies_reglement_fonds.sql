-- Vivium, Allianz et Athora font bien de la branche 23 (confirme le 05/11/2026).
--
-- Et l'URL du reglement de gestion des fonds, pour les compagnies ou elle est
-- connue. C'est le document reglementaire qui liste tous les fonds d'une
-- compagnie : plus stable qu'une page web, il change quelques fois par an et
-- pas a chaque refonte du site. C'est la cible du futur bouton
-- d'actualisation — pas du scraping de pages produit.

begin;

update public.compagnies set propose_branche_23 = true
 where code in ('VIVIUM', 'ALLIANZ', 'ATHORA');

alter table public.compagnies
  add column if not exists reglement_fonds_url text,
  add column if not exists reglement_fonds_vu_le date;

comment on column public.compagnies.reglement_fonds_url is
  'URL du reglement de gestion des fonds branche 23 de la compagnie : le '
  'document reglementaire qui liste tous ses fonds. Cible du bouton '
  'd''actualisation.';

update public.compagnies
   set reglement_fonds_url = 'https://www.baloise.be/dam/jcr:4bff17b6-260d-4cf2-ad84-9cc39e3c4e12/FR%20B3302.LEV.07.26-Beheerreglement-Tak23-fondsen-FR.pdf'
 where code = 'BALOISE';

update public.compagnies
   set reglement_fonds_url = 'https://vivium.be/documents/d/vivium/vivium-beheersreglementen-fondsen-tak-23_15022025'
 where code = 'VIVIUM';

commit;
