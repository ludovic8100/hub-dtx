-- Lecture Ponto alignée sur le rythme réel de Ponto (01/11/2026).
--
-- Ce qu'on ignorait : Ponto ne lit pas les banques en continu. Il se
-- synchronise 4 fois par jour en arrière-plan (vers 2h, 8h, 14h et 20h heure
-- belge). Notre cron tournait à 00h11 : il lisait donc ce que Ponto avait
-- récupéré à 20h la veille — 4 heures de retard gratuit, en plus des 24 h
-- d'intervalle entre deux lectures.
--
-- On lit désormais 4 fois par jour, à 3h, 9h, 15h et 21h UTC. Ce décalage
-- laisse au moins 2 heures de marge après chaque synchro Ponto, été comme
-- hiver (la Belgique étant à UTC+1 ou UTC+2 selon la saison).
--
-- Ce cron LIT seulement. Il ne déclenche pas de synchronisation Ponto → banque :
-- celles-ci sont réservées aux cas « client présent » (PSD2 RTS), avec l'adresse
-- IP réelle du client. C'est le rôle du bouton Synchroniser, pas d'un cron.

select cron.unschedule('sync_ponto_comptes_daily');

select cron.schedule(
  'sync_ponto_comptes_4x',
  '15 3,9,15,21 * * *',
  $cron$
  select net.http_post(
    url := 'https://tndwonqdbeszkcztkzqe.supabase.co/functions/v1/sync-ponto-comptes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select value from config_secrets where key = 'sync_entra_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Le garde-fou doit alerter si rien n'est arrivé depuis plus de 6 h + 2 h de marge,
-- au lieu d'attendre une journée entière.
update public.jobs_attendus
   set frequence_attendue = interval '6 hours',
       tolerance          = interval '2 hours',
       commentaire        = 'Edge Function + pg_cron sync_ponto_comptes_4x (03:15, 09:15, 15:15, 21:15 UTC) — calé après les synchros Ponto→banque de 2h, 8h, 14h et 20h'
 where job = 'sync-ponto-comptes';
