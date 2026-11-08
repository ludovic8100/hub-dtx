-- Main-d'oeuvre reelle d'un chantier : heures et visites.
--
-- Ludovic : « rajouter un bouton pour la M.O. reelle qui calculera le cout
-- reel, mais la tu places le bouton avec des idees grisees, qui ne calcule
-- pas. On regardera ca apres. Mais comme le bouton sera la, on saura qu'il
-- est la : quand on clique dessus, juste nombre d'heures, nombre de visites. »
--
-- POURQUOI ON STOCKE DEJA, ALORS QUE RIEN NE CALCULE
--
-- Un bouton qui ne fait rien se clique une fois, puis s'ignore, puis
-- s'oublie. En enregistrant les deux nombres des aujourd'hui, le geste est
-- reel et l'historique se constitue : le jour ou le taux horaire sera pose,
-- il s'appliquera a des chantiers deja mesures, au lieu de repartir de zero.
--
-- Ce qui reste GRISE, c'est le COUT — et l'ecran dit pourquoi : il n'existe
-- aucun taux horaire en base. Afficher un cout calcule sur un taux invente
-- serait pire que de n'afficher rien.
--
-- CE N'EST PAS CONTRADICTOIRE AVEC « AUCUNE SAISIE DE TEMPS »
--
-- La decision anterieure (CLAUDE.md) est un BAREME FORFAITAIRE par type
-- d'intervention, pour chiffrer sans saisie. Les heures reelles repondent a
-- une autre question : le bareme dit ce qu'on FACTURE, les heures disent ce
-- que ca a COUTE. L'ecart entre les deux est justement ce qu'on veut voir.

alter table dossiers add column if not exists mo_heures  numeric;
alter table dossiers add column if not exists mo_visites integer;
alter table dossiers add column if not exists mo_note    text;

alter table dossiers drop constraint if exists dossiers_mo_positif_chk;
alter table dossiers add  constraint dossiers_mo_positif_chk
  check ((mo_heures  is null or mo_heures  >= 0)
     and (mo_visites is null or mo_visites >= 0));

comment on column dossiers.mo_heures  is 'Heures de main-d''oeuvre reellement prestees. Null = non renseigne, jamais 0 par defaut.';
comment on column dossiers.mo_visites is 'Nombre de deplacements chez le client. Sert aux kilometres quand ils seront calcules.';
