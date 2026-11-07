-- `sinistres` : 8 017 lignes lisibles par TOUT utilisateur connecte, avec le nom
-- du client, le montant, la description et le gestionnaire.
--
-- CE QUE J'AURAIS VOULU FAIRE, ET POURQUOI C'EST IMPOSSIBLE AUJOURD'HUI.
-- Le plan etait de cloisonner par bureau comme `clients` : un sinistre visible
-- si son client l'est. Mesure faite avant de coder, et elle dit non :
--
--   sinistres                                        8 017
--   rattachables a un contrat (contrats.police)          8
--   rattachables a un client  (clients.dossier)         27
--   rattachables a un objet de risque                    0
--
-- `police_objet_lien` contient des nombres (10, 100, 1000...) alors que
-- `contrats.police` contient « +180524/1336 ». C'est un identifiant du systeme
-- source qui n'a jamais ete repris ailleurs. Il n'existe donc AUCUN chemin
-- fiable du sinistre vers le client. Le cloisonnement par bureau est bloque par
-- la DONNEE, pas par la politique — il faudra d'abord reconstruire ce lien,
-- probablement depuis Qlik.
--
-- CE QUI EST FAIT A LA PLACE, et qui est deja un vrai resserrage : l'acces suit
-- le module « sinistres » de Dynassur, qui existe et compte 14 attributions sur
-- 19 comptes actifs.

drop policy if exists sinistres_read on public.sinistres;

create policy sinistres_lecture on public.sinistres
  for select to authenticated
  using (a_module('sinistres', 'DYNASSUR'));

revoke all on table public.sinistres from anon;

-- VERIFIE COMPTE PAR COMPTE :
--
--   LDE, BHU, RCA  (ont le module)      8 017
--   MVM            (clients, pas sinistres)  0
--   JFS, LLO       (ni l'un ni l'autre)      0
--   anon                                 REFUSE
--
-- Effet visible : le panneau « sinistres » disparait de la fiche client pour
-- MVM, qui a le module clients mais pas sinistres. C'est coherent avec ses
-- droits.
--
-- RESTE OUVERT : RCA ne voit que 234 clients mais continue de voir les 8 017
-- sinistres. Voir plus haut — c'est la donnee qui manque.
