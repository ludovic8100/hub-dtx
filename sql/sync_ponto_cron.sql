-- Remplace le workflow n8n "2026 - IBAN SYNC" (soldes + transactions Ponto).
-- Appliqué en production le 31/10/2026 (migration cron_sync_ponto_comptes).
-- La fonction Edge associée : supabase/functions/sync-ponto-comptes/.
-- Réutilise le même secret partagé que sync-entra-collaborateurs
-- (config_secrets.sync_entra_secret) — pas de nouveau secret côté base.

select cron.schedule(
  'sync_ponto_comptes_daily',
  '11 0 * * *',
  $$
  select net.http_post(
    url := 'https://tndwonqdbeszkcztkzqe.supabase.co/functions/v1/sync-ponto-comptes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select value from config_secrets where key = 'sync_entra_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
