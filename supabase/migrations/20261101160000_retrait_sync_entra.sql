-- Retrait de la synchronisation Entra → collaborateurs (01/11/2026).
--
-- Elle échouait sur « Token Entra 404 » (secrets MS_TENANT_ID / MS_CLIENT_ID /
-- MS_CLIENT_SECRET jamais saisis depuis sa création le 30/10) — le garde-fou
-- jobs_log l'a révélé dès sa mise en service, le jour même. Les accès du Hub
-- se gèrent à la main dans Paramètres en attendant.
--
-- On DÉSACTIVE la déclaration au lieu de la supprimer : on compte remettre
-- cette synchro avec le chantier sécurité (docs/DROITS-ACCES.md, bloc 2 bis).
-- Garder la ligne conserve l'historique d'exécution et le motif du retrait,
-- et l'écran Synchronisations l'affiche en gris « désactivé » plutôt qu'en
-- rouge — ce qui est la bonne information.
--
-- ⚠️ Conséquence : plus rien ne coupe automatiquement l'accès Hub d'un
-- collaborateur dont le compte Entra est désactivé. C'est un geste manuel.
--
-- Conservé : config_secrets.sync_entra_secret — le nom est trompeur, mais le
-- cron sync_ponto_comptes_daily s'en sert aussi comme x-sync-secret.

select cron.unschedule('sync_entra_collaborateurs_hourly');

update public.jobs_attendus
   set actif = false,
       commentaire = 'Retirée le 01/11/2026 (secrets Entra jamais saisis). À remettre avec le chantier sécurité — voir docs/DROITS-ACCES.md, bloc 2 bis.'
 where job = 'sync-entra-collaborateurs';
