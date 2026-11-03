-- Libellés des postes 3CX, indiqués par Ludovic le 02/11/2026.
--
-- Rappel : le Hub n'interroge pas 3CX (l'intégration est à sens unique), donc
-- ces correspondances ne peuvent pas être lues depuis le central. Elles se
-- saisissent — ici pour les postes de service, dans Paramètres pour les
-- collaborateurs.

-- 28 appartient à un collaborateur, pas à un service : 3 appels, 5 min 30 de
-- durée moyenne, c'est quelqu'un qui décroche.
UPDATE public.collaborateurs SET extension = '28'
 WHERE code = 'GGO' AND extension IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.collaborateurs WHERE extension = '28');
DELETE FROM public.postes_telephonie WHERE extension = '28';

-- 80 est le serveur vocal d'accueil : le menu que le client entend en appelant.
-- D'où les 10 secondes de durée moyenne sur 492 appels — on n'y parle à personne.
UPDATE public.postes_telephonie SET libelle = 'Menu d''accueil',             categorie = 'svi'     WHERE extension = '80';
UPDATE public.postes_telephonie SET libelle = 'File d''attente — Assurance', categorie = 'file'    WHERE extension = '91';
UPDATE public.postes_telephonie SET libelle = 'File d''attente — Crédit',    categorie = 'file'    WHERE extension = '92';
UPDATE public.postes_telephonie SET libelle = 'File d''attente — Sinistres', categorie = 'file'    WHERE extension = '93';

-- Les deux boîtes vocales. 30 recueille les messages hors horaires, 32 ceux
-- du service Crédit.
-- Marqué inactif plutôt que détruit : actif = false le retire des tableaux par
-- poste, et ses 125 appels restent au journal. Effacer les lignes serait
-- irréversible, et un message vocal laissé sans rappel reste une information.
-- Un UPDATE suffit à revenir en arrière.
UPDATE public.postes_telephonie
   SET libelle = 'Messagerie — bureau fermé', categorie = 'messagerie', actif = false,
       commentaire = 'Masquée des tableaux par poste à la demande (02/11/2026). Les 125 messages restent au journal.'
 WHERE extension = '30';

INSERT INTO public.postes_telephonie (extension, libelle, categorie, actif, commentaire)
VALUES ('32', 'Messagerie — Crédit', 'messagerie', false, 'Masquée des tableaux par poste à la demande (02/11/2026).')
ON CONFLICT (extension) DO UPDATE
   SET libelle = excluded.libelle, categorie = excluded.categorie,
       actif = excluded.actif, commentaire = excluded.commentaire;
