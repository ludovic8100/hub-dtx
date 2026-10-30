-- Portefeuille par bureau (phase 1 de la refonte des droits d'accès).
-- Appliquée en production le 30/10/2026 (Supabase MCP apply_migration « portefeuille_par_bureau »).
-- Remplace les politiques RLS "USING (true)" de clients/contrats/objets_risque/quittances/
-- segmentation/parentes par un filtrage réel : un utilisateur ne voit que les clients de son
-- bureau (collaborateurs.bureau_id via user_permissions.collab_code), sauf administrateur ou
-- drapeau user_permissions.voit_tout_portefeuille. Voir docs/DROITS-ACCES.md pour le détail.

alter table public.clients add column if not exists bureau_id bigint references public.ref_bureaux(id);
create index if not exists idx_clients_bureau_id on public.clients(bureau_id);

alter table public.user_permissions add column if not exists voit_tout_portefeuille boolean not null default false;
comment on column public.user_permissions.voit_tout_portefeuille is
  'Voit tous les clients de ses sociétés autorisées, sans restriction de bureau (ex: comptabilité, direction). Les administrateurs voient déjà tout, ce drapeau est pour les non-admins.';

with cb as (
  select distinct on (code) code, bureau_id
  from public.collaborateurs
  where bureau_id is not null
  order by code, id
)
update public.clients cl set bureau_id = cb.bureau_id
from cb where cl.gestionnaire_code = cb.code and cl.bureau_id is null;

with cb as (
  select distinct on (code) code, bureau_id
  from public.collaborateurs
  where bureau_id is not null
  order by code, id
)
update public.clients cl set bureau_id = cb.bureau_id
from cb where cl.sa_code = cb.code and cl.bureau_id is null;

create or replace function public.mon_bureau_id()
returns bigint
language sql stable security definer
set search_path to 'public'
as $$
  select col.bureau_id
  from public.user_permissions up
  join public.collaborateurs col on col.code = up.collab_code
  where lower(up.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and up.actif = true
  limit 1;
$$;
comment on function public.mon_bureau_id() is 'Bureau (ref_bureaux.id) du collaborateur lié au compte connecté, via user_permissions.collab_code.';

create or replace function public.voit_tout_portefeuille()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select up.voit_tout_portefeuille from public.user_permissions up
    where lower(up.user_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and up.actif = true
  ), false);
$$;

create or replace function public.client_visible(p_dossier text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select public.is_admin() or public.voit_tout_portefeuille() or exists (
    select 1 from public.clients c
    where c.dossier = p_dossier
      and c.bureau_id is not null
      and c.bureau_id = public.mon_bureau_id()
  );
$$;
comment on function public.client_visible(text) is 'Vrai si le compte connecté doit voir ce dossier client : admin, voit_tout_portefeuille, ou même bureau que le client.';

drop policy if exists allow_all_clients on public.clients;
create policy clients_bureau on public.clients for all
  using (is_admin() or voit_tout_portefeuille() or (bureau_id is not null and bureau_id = mon_bureau_id()))
  with check (is_admin() or voit_tout_portefeuille() or (bureau_id is not null and bureau_id = mon_bureau_id()));

drop policy if exists "Lecture publique contrats" on public.contrats;
drop policy if exists "Insertion publique contrats" on public.contrats;
drop policy if exists "Mise à jour publique contrats" on public.contrats;
create policy contrats_bureau on public.contrats for all
  using (client_visible(dossier)) with check (client_visible(dossier));

drop policy if exists objets_risque_read on public.objets_risque;
create policy objets_risque_bureau on public.objets_risque for all
  using (client_visible(dossier)) with check (client_visible(dossier));

drop policy if exists "Lecture quittances" on public.quittances;
drop policy if exists "Ecriture quittances" on public.quittances;
create policy quittances_bureau on public.quittances for all
  using (client_visible(dossier)) with check (client_visible(dossier));

drop policy if exists seg_read on public.segmentation;
create policy segmentation_bureau on public.segmentation for all
  using (client_visible(dossier)) with check (client_visible(dossier));

drop policy if exists parentes_read on public.parentes;
create policy parentes_bureau on public.parentes for all
  using (client_visible(dossier_principal)) with check (client_visible(dossier_principal));
