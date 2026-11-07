-- Trois vues d'anomalies comptables etaient lisibles par `anon` : le role
-- d'AVANT connexion, dont la cle est publique par conception et ecrite dans ce
-- depot public. N'importe qui sur Internet pouvait donc lire :
--
--   v_factures_impayees  1 457 lignes   (fournisseurs, montants, six societes)
--   v_factures_doublons     62 lignes
--   v_paiements_doubles     27 lignes
--
-- MESURE EN SE FAISANT PASSER POUR `anon`, PAS DEDUITE DES POLICIES. La lecture
-- des policies m'avait d'abord fait conclure l'inverse : pour une policy INSERT,
-- `qual` est NULL et la condition est dans `with_check`. Une policy lue de
-- travers rassure sans proteger.
--
-- Cause : une vue ignore la RLS des tables qu'elle lit tant qu'elle n'est pas
-- `security_invoker`. Fermer les tables ne ferme donc rien tant que les vues
-- restent ouvertes — c'est la meme regle que les partitions (07/11) sous une
-- autre forme : Postgres applique la securite PAR RELATION.

revoke all on table public.v_factures_impayees  from anon;
revoke all on table public.v_factures_doublons  from anon;
revoke all on table public.v_paiements_doubles  from anon;
revoke all on table public.v_appels             from anon;
revoke all on table public.v_fournisseurs_usage from anon;
revoke all on table public.taches               from anon;

-- Entre utilisateurs connectes aussi : ces deux vues contournaient
-- `acces_compta()` et montraient les six societes a qui n'a acces qu'a une.
alter view public.v_factures_doublons set (security_invoker = on);
alter view public.v_paiements_doubles set (security_invoker = on);

-- v_factures_impayees NON : essayee, mesuree, revertee. Avec security_invoker
-- elle depasse 25 s (RLS evaluee par ligne sur 7 388 factures croisees a 6 644
-- transactions, fonctions deja STABLE) et l'onglet Anomalies ne repond plus.
-- Le correctif est une reecriture de la vue, pas un drapeau. Reste ouvert :
-- un connecte ayant la compta d'UNE societe voit encore les impayes des SIX
-- en interrogeant cette vue directement.
