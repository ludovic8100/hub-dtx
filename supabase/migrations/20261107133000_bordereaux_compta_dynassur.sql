-- Correction de la policy posee quelques minutes plus tot dans
-- 20261107130000_bordereaux_lecture_seule.sql.
--
-- `bordereaux_lecture` donnait la lecture a TOUT utilisateur connecte. Ludovic
-- l'a releve en une phrase : « JFS n'a pas acces a la compta ». C'etait vrai —
-- JFS lisait pourtant les 6 867 releves. J'avais ferme l'ecriture et laisse la
-- lecture ouverte, en la presentant comme un reste a faire : c'etait un trou,
-- pas un reste.
--
-- MESURE : sur 19 comptes actifs, 5 ont la comptabilite (3 administrateurs,
-- LLO sur LODE, rudy@rhassur.be sur HEXAGROUP). 14 n'en ont aucune.
--
-- HYPOTHESE METIER, ASSUMEE ET FACILE A DEFAIRE : un bordereau est un releve de
-- commission envoye par un ASSUREUR. `compte_producteur` est un numero de
-- producteur chez l'assureur (25393, 116263, 7046484...), pas une societe du
-- groupe. Seul Dynassur est courtier : LODE, DTX et Hexagroup ne recoivent pas
-- de commissions d'assurance. La lecture est donc reservee a la comptabilite
-- DYNASSUR.
--
-- Si c'est faux, une ligne suffit a l'elargir : remplacer acces_compta('DYNASSUR')
-- par un test « a la comptabilite d'au moins une societe ».

drop policy if exists bordereaux_lecture on public.bordereaux;

create policy bordereaux_lecture on public.bordereaux
  for select to authenticated
  using (acces_compta('DYNASSUR'));

-- VERIFIE COMPTE PAR COMPTE :
--
--                                 avant    apres
--   administrateur (compta DYN)   6 867    6 867
--   JFS      (aucune compta)      6 867        0
--   LLO      (compta LODE)        6 867        0
--   rudy     (compta HEXAGROUP)   6 867        0
--   ICE      (aucune compta)      6 867        0
--   anon                         refuse   refuse
