-- Déclenchement manuel de la synchronisation Ponto depuis le Hub.
--
-- Le cron tourne à 00:11 ; cette fonction permet de rafraîchir les comptes à la
-- demande, par exemple en fin de journée avant de travailler sur la compta.
--
-- Elle appelle la même Edge Function que le cron, avec le même secret lu dans
-- config_secrets : le secret ne quitte jamais la base, le navigateur ne le voit
-- pas. Le journal distingue les deux origines (declencheur = manuel | cron).
--
-- Garde-fou : une synchro au plus toutes les 5 minutes. Le Hub est en accès
-- libre (ACCES_LIBRE_TEMPORAIRE), donc cette fonction est exécutable sans
-- authentification : la limite évite qu'on martèle l'API Ponto. À resserrer
-- quand le login sera remis (bloc 2 bis de docs/DROITS-ACCES.md).

create or replace function public.lancer_sync_ponto()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recente timestamptz;
  v_secret  text;
begin
  select max(demarre_a) into v_recente
    from public.jobs_log
   where job = 'sync-ponto-comptes'
     and demarre_a > now() - interval '5 minutes';

  if v_recente is not null then
    return jsonb_build_object(
      'ok', false,
      'raison', 'trop_recent',
      'derniere', v_recente,
      'message', 'Une synchronisation a déjà été lancée il y a moins de 5 minutes.'
    );
  end if;

  select value into v_secret from public.config_secrets where key = 'sync_entra_secret';
  if v_secret is null then
    return jsonb_build_object('ok', false, 'raison', 'secret_absent',
                              'message', 'Secret de synchronisation introuvable côté base.');
  end if;

  perform net.http_post(
    url := 'https://tndwonqdbeszkcztkzqe.supabase.co/functions/v1/sync-ponto-comptes?declencheur=manuel',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
    body := '{}'::jsonb
  );

  return jsonb_build_object('ok', true,
                            'message', 'Synchronisation lancée — les soldes se mettent à jour dans quelques secondes.');
end;
$$;

comment on function public.lancer_sync_ponto() is
  'Déclenche la synchro Ponto à la demande depuis le Hub. Une fois toutes les 5 minutes au plus.';

grant execute on function public.lancer_sync_ponto() to anon, authenticated;
