-- Le second contrôle du classement des factures : LE PAIEMENT.
--
-- Ludovic, 10/11 : « pourquoi ne pas faire un second contrôle, quand il est
-- dans le dossier, où il lit, voit qu'il y a une erreur, et là il place
-- l'alarme ? »
--
-- L'idée est bonne, la forme ne marche pas : relire le MÊME PDF avec le MÊME
-- lecteur redonne la MÊME réponse. Un contrôle qui ne peut pas contredire ce
-- qu'il vérifie n'est pas un contrôle, c'est une seconde signature.
--
-- Il faut donc un signal que le document ne produit pas lui-même. Il en
-- existe un, et il est déjà en base : QUI A PAYÉ. Une facture classée chez
-- Dynassur mais réglée depuis un compte LODE est une contradiction que le
-- PDF ne peut pas fabriquer — elle vient de la banque.
--
-- La vue ne liste donc que les factures DÉJÀ rapprochées : avant le paiement,
-- il n'y a rien à confronter.
--
-- Premier résultat, à la création : 3 factures classées DTX payées depuis un
-- compte PRIVE, pour 114 €. Trois lignes à regarder, pas un déluge — c'est le
-- signe d'un contrôle utilisable.
create or replace view v_factures_societe_incoherente as
select f.id,
       f.societe            as societe_du_classement,
       cb."ENTITE"          as societe_qui_a_paye,
       f.fournisseur,
       f.date_facture,
       f.montant,
       f.nom                as nom_fichier,
       f.url,
       t.date_execution     as date_paiement,
       t.contrepartie_nom
  from factures_achat f
  join transactions t        on t.id = f.transaction_id
  join comptes_bancaires cb  on cb.id = t.compte_id
 where f.sens = 'achat'
   and f.transaction_id is not null
   and cb."ENTITE" is not null
   and f.societe is not null
   and upper(cb."ENTITE") <> upper(f.societe);

comment on view v_factures_societe_incoherente is
  'Factures dont la société de classement contredit la société du compte qui a payé. Second contrôle INDÉPENDANT du document : il vient de la banque, pas du PDF.';

revoke all on v_factures_societe_incoherente from anon;
grant select on v_factures_societe_incoherente to authenticated;
