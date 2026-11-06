-- Rapprocher une facture de VENTE avec la rentree bancaire qui l'a payee.
--
-- Ce n'est PAS symetrique des achats. Cote achats, le lien va vers
-- factures_achat, une table commune aux six societes. Cote ventes, les
-- factures vivent dans lode_factures — et dtx_, et dyn_. Une colonne unique
-- sur transactions ne peut pas pointer vers trois tables.
--
-- On met donc le lien du cote de la facture : une facture connait son
-- paiement. Le sens inverse se lit par une requete sur cette colonne. Le jour
-- ou les trois jeux de tables fusionnent, le lien se reporte tel quel.
--
-- transactions.facture_id (uuid, sans cle etrangere, 0 ligne remplie sur
-- 6 638) est volontairement LAISSEE TRANQUILLE : reutiliser une colonne morte
-- et ambigue — achat ou vente ? — pour gagner cinq minutes se paie plus tard.

alter table public.lode_factures
  add column if not exists transaction_id uuid
    references public.transactions(id) on delete set null;

comment on column public.lode_factures.transaction_id is
  'Rentree bancaire qui a paye cette facture. Rempli a la main depuis la liste des factures, jamais par un automate : sur 22 factures, 4 seulement ont un candidat au montant exact (mesure du 06/11).';

create index if not exists lode_factures_transaction_id_idx
  on public.lode_factures (transaction_id)
  where transaction_id is not null;
