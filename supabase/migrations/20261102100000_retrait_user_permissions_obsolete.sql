-- Retrait de user_permissions_obsolete_20261030, résidu de la fusion du 30/10/2026
-- (collaborateurs est depuis la seule source pour l'identité et les droits).
--
-- Pourquoi la supprimer : elle porte encore 37 lignes de données personnelles
-- (noms, e-mails, droits) dont plus personne n'est responsable — une copie sans
-- propriétaire, que la minimisation RGPD demande d'effacer. Ce n'est PAS une
-- question de performance : une table que rien n'interroge ne coûte que du
-- disque, elle ne ralentit aucune requête.
--
-- Vérifié avant écriture (02/11/2026) :
--   • aucune vue n'en dépend ;
--   • aucune fonction ne la lit ;
--   • deux clés étrangères pointaient dessus — transactions.employe_id et
--     transaction_ventilation.employe_id — et ces deux colonnes sont
--     ENTIÈREMENT VIDES : 0 ligne renseignée sur 6 576 transactions.
--
-- ⚠️ Les deux colonnes `employe_id` ne sont PAS repointées vers collaborateurs :
-- elles sont en `uuid` alors que `collaborateurs.id` est un `bigint`. Les
-- convertir serait sans risque (elles sont vides), mais `transactions` et
-- `transaction_ventilation` relèvent de la comptabilité, pas des paramètres.
-- Après cette migration, ce sont deux colonnes vides sans contrainte, qui ne
-- pointent plus nulle part. À trancher côté comptabilité : les convertir en
-- bigint et les rattacher à collaborateurs, ou les supprimer si l'idée
-- d'attribuer une transaction à un employé a été abandonnée.

-- 1. Lever les deux dépendances (contraintes seules, les colonnes restent)
alter table public.transactions
  drop constraint if exists transactions_employe_id_fkey;

alter table public.transaction_ventilation
  drop constraint if exists transaction_ventilation_employe_id_fkey;

-- 2. Supprimer la table (son trigger set_user_permissions_updated_at part avec)
drop table if exists public.user_permissions_obsolete_20261030;

-- 3. La fonction du trigger n'était utilisée que par cette table
drop function if exists public.update_user_permissions_updated_at();
