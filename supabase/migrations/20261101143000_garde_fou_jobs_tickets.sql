-- Enveloppe journalisée du cron de rappels de tickets (garde-fou jobs_log).
--
-- Volontairement SANS re-raise : l'exception remonterait à pg_cron, dont le
-- rollback annulerait aussi la ligne de journal. Le journal prime — c'est lui
-- qu'on regarde pour savoir si le job a fait son travail.

create or replace function public.job_tickets_rappels()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_n  integer;
begin
  v_id := public.job_debut('tickets-rappels-echeance', 'cron');
  begin
    select public.tickets_rappels_echeance() into v_n;
    perform public.job_fin(v_id, 'succes', v_n, null,
                           format('%s rappel(s) traité(s)', coalesce(v_n, 0)));
  exception when others then
    perform public.job_fin(v_id, 'echec', null, null, sqlerrm);
  end;
end;
$$;

revoke execute on function public.job_tickets_rappels() from public, anon, authenticated;

-- Le cron tickets_rappels_echeance_daily (06:00) passe par l'enveloppe.
select cron.alter_job(1, command := 'select public.job_tickets_rappels();');
