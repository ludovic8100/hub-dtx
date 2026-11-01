-- Retrait de la synchronisation Entra → collaborateurs (01/11/2026).
--
-- Elle échouait sur « Token Entra 404 » (secret MS_TENANT_ID vide côté Edge
-- Function) — le garde-fou jobs_log l'a révélé dès sa mise en service, le jour
-- même. Les accès du Hub sont désormais gérés à la main dans Paramètres.
--
-- ⚠️ Conséquence : plus rien ne coupe automatiquement l'accès Hub d'un
-- collaborateur dont le compte Entra est désactivé. C'est un geste manuel.
--
-- Conservé : config_secrets.sync_entra_secret — le nom est trompeur, mais le
-- cron sync_ponto_comptes_daily s'en sert aussi comme x-sync-secret.

select cron.unschedule('sync_entra_collaborateurs_hourly');

delete from public.jobs_log      where job = 'sync-entra-collaborateurs';
delete from public.jobs_attendus where job = 'sync-entra-collaborateurs';
