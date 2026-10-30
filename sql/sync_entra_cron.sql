-- Remplace le workflow n8n "2026_HUB_DTX_USER_PERMISSION" (sync Entra → Hub).
-- Appliqué en production le 30/10/2026 (migration cron_sync_entra_collaborateurs).
-- La fonction Edge associée : supabase/functions/sync-entra-collaborateurs/.

insert into config_secrets (key, value)
values ('sync_entra_secret', '<valeur générée — voir Dashboard Supabase > Edge Functions > Secrets > SYNC_SHARED_SECRET>')
on conflict (key) do update set value = excluded.value;

select cron.schedule(
  'sync_entra_collaborateurs_hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://tndwonqdbeszkcztkzqe.supabase.co/functions/v1/sync-entra-collaborateurs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select value from config_secrets where key = 'sync_entra_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
