-- `bordereaux` portait `allow_all_bordereaux` : ALL, pour anon ET authenticated,
-- avec pour seule condition « etre connecte ». Soit 6 867 relevés de commission
-- de 449 compagnies, que n'importe quel employé pouvait MODIFIER ou SUPPRIMER.
--
-- MESURE AVANT D'AGIR : l'application ne fait qu'UNE chose avec cette table,
-- une lecture (ComptabiliteView.jsx ligne 138, pour afficher l'état d'une
-- rentrée de compagnie). Aucune écriture depuis le navigateur, nulle part.
--
-- Les vraies écritures viennent d'ailleurs et ne passent pas par la RLS :
--   • scripts/bordereaux_sharepoint.py  -> service_role (contourne la RLS)
--   • rapprocher_bordereaux_virements() -> SECURITY DEFINER (idem)
-- Fermer l'écriture aux utilisateurs connectés ne les touche donc pas.

drop policy if exists allow_all_bordereaux on public.bordereaux;

-- Lecture : tout utilisateur connecté.
create policy bordereaux_lecture on public.bordereaux
  for select to authenticated
  using ((select auth.uid()) is not null);

-- Écriture : administrateurs seulement.
create policy bordereaux_ecriture_admin on public.bordereaux
  for all to authenticated
  using (is_admin()) with check (is_admin());

-- `anon` est le rôle d'AVANT connexion, et sa clé est publique.
revoke all on table public.bordereaux from anon;

-- VÉRIFIÉ RÔLE PAR RÔLE, le test annulé pour ne rien écrire :
--
--   anon                        -> REFUSE
--   JFS (non-admin) lecture     -> 6 867   l'écran compta marche
--   JFS (non-admin) écriture    -> 0 ligne  refusée
--   administrateur              -> lecture ET écriture OK
--
-- RESTE OUVERT, et c'est une décision métier, pas un correctif technique :
-- tout connecté voit les 6 867 relevés des 449 compagnies, toutes sociétés
-- confondues. La table n'a pas de colonne `societe` — seulement `compagnie` et
-- `compte_producteur`. Cloisonner demande d'abord de dire à quelle société
-- appartient un relevé.
