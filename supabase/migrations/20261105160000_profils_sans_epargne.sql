-- « Sans epargne » n'est pas une valeur de `source`.
--
-- #114 ecrivait source = 'sans_epargne'. La colonne porte une contrainte
-- CHECK (source IN ('generated','uploaded')) : l'insertion etait REJETEE.
-- L'ecran annoncait « PDF genere avec succes » et la ligne n'etait jamais
-- ecrite. Trouve a l'usage le 05/11, pas par le build.
--
-- Les deux informations sont orthogonales : `source` dit COMMENT le document
-- a ete produit (genere ici, ou importe rempli), `sans_epargne` dit DANS
-- QUELLES CONDITIONS (avec un contrat et des fonds, ou avec le client).

begin;

alter table public.profils_investisseur
  add column if not exists sans_epargne boolean not null default false;

comment on column public.profils_investisseur.sans_epargne is
  'Fiche etablie sans contrat ni fonds : nouveau client, ou client sans '
  'epargne existante. Les reponses ont ete recueillies aupres du client, '
  'elles ne sont pas reconstituees a partir d''un contrat.';

commit;
