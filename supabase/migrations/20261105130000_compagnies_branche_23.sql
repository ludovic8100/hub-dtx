-- Quelles compagnies proposent des fonds, et quelles sont leurs valeurs.
--
-- Fait metier, confirme le 05/11/2026 : DELA, Aviza, Monument et Cardif ne
-- proposent pas de produits a fonds. Leurs contrats n'appellent donc aucune
-- analyse de risque investisseur — il n'y a pas de risque de marche.
-- Ensemble, ils representent 1 483 contrats Vie actifs sur 4 113.
--
-- Vivium, Allianz et Athora restent a trancher : la seule indication dont on
-- dispose vient de `type_production`, colonne dont l'encodage dans Brio est
-- connu pour etre errone. On ne tranche pas sur cette base.

begin;

alter table public.compagnies
  add column if not exists propose_branche_23 boolean;

comment on column public.compagnies.propose_branche_23 is
  'La compagnie propose-t-elle des produits a fonds (branche 23) ? false = non, '
  'donc aucune analyse de risque investisseur a mener sur ses contrats. '
  'null = pas encore tranche. Renseigne a la main : connaissance metier, pas '
  'une donnee synchronisee depuis Qlik.';

update public.compagnies set propose_branche_23 = false
 where code in ('DELA', 'AVIZA', 'MONUMENT', 'CARDIF');

-- true uniquement la ou des fonds sont effectivement connus et enregistres.
update public.compagnies set propose_branche_23 = true
 where code in ('BALOISE', 'NN', 'AG', 'AXA');

commit;
