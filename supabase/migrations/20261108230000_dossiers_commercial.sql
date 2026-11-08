-- Le commercial d'un chantier.
--
-- Ludovic : « tu dois ajouter le commercial au chantier, pour savoir grâce à
-- qui on l'a fait ».
--
-- POURQUOI SUR LE DOSSIER ET PAS SEULEMENT SUR LE DEVIS
--
-- Le devis porte deja un `responsable`, mais un chantier peut n'avoir aucun
-- devis (un depannage) ou en porter plusieurs. Deduire le commercial du
-- premier devis rattache — ce que faisait l'ecran Rentabilite faute de mieux
-- — donne une colonne vide sur les depannages et un resultat arbitraire quand
-- il y a deux devis.
--
-- Le code (LDE, JCL, LLO...) plutot qu'un identifiant : c'est deja la
-- convention de lode_devis.responsable, et elle survit a la suppression d'une
-- fiche collaborateur. Un chantier de 2023 doit garder le nom de qui l'a
-- apporte, meme si la personne est partie depuis.

alter table dossiers add column if not exists responsable text;

create index if not exists dossiers_responsable_idx
  on dossiers (societe, responsable) where responsable is not null;

comment on column dossiers.responsable is
  'Code du commercial a qui le chantier est attribue (LDE, JCL, LLO...). Volontairement un CODE et non une cle etrangere : le chantier garde son commercial meme si la fiche disparait.';
