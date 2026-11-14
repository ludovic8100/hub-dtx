-- UNE PERSONNE FAIT PLUSIEURS CHOSES À LA FOIS (14/11/2026)
-- ---------------------------------------------------------------------------
--
-- `collaborateur_societes.fonction` ne porte qu'UNE valeur. Ludovic a détaillé
-- qui fait quoi chez LODE, et ses quatre exemples suffisent à montrer que
-- c'est faux :
--
--   LDE  commercial, gère certains chantiers ET installe
--   JCL  commercial, gère ET installe
--   LLO  commerciale, mais ne fera JAMAIS d'installation ni de gestion
--   NGI  ni l'un ni l'autre — administratif, elle ne prestera jamais chez LODE
--
-- Avec une seule valeur, « commercial » écrasait « installe » : la liste de la
-- main-d'œuvre d'un chantier rendait LLO et NGI, qui n'y ont rien à faire, et
-- l'information « LDE installe » n'existait nulle part.
--
-- ⚠️ QUATRE NOTIONS DISTINCTES, à ne jamais refondre en une :
--
--   `collaborateurs.est_admin`        administrateur DU HUB — lu par is_admin()
--   `collaborateurs.acc_<societe>`    a le droit d'OUVRIR ce module
--   `collaborateur_societes.statut`   le lien contractuel
--   `collaborateur_societes.roles`    ce que la personne FAIT   ← nouveau
--
-- Elles se sont déjà télescopées deux fois le même jour : d'abord l'écran
-- filtrait sur `acc_lode` (2 collaborateurs actifs sur 31 l'ont, aucun
-- commercial LODE), ensuite sur `fonction`, à une seule valeur.
--
-- Trace de ce télescopage, laissée en l'état faute d'instruction : NGI porte
-- `statut = 'administrateur'` sur les SIX sociétés alors qu'elle n'est
-- administratrice d'aucune — elle est administratrice du Hub. Le mandat dans
-- la société n'est pas modélisé (décision du 14/11 : pas tant qu'aucun écran
-- n'en a besoin), et `statut` n'alimente aucune liste, donc rien n'en dépend.

create table if not exists public.ref_roles (
  code    text primary key,
  libelle text not null,
  ordre   int  not null default 100,
  actif   boolean not null default true
);

-- Un référentiel EN BASE et non une liste en dur dans le code : le projet
-- interdit la règle métier codée en dur, et ajouter un métier ne doit pas
-- demander un déploiement.
insert into public.ref_roles (code, libelle, ordre) values
  ('commercial',       'Commercial',         10),
  ('gestion_chantier', 'Gère les chantiers', 20),
  ('installation',     'Installe',           30),
  ('administratif',    'Administratif',      40),
  -- ⚠️ `gestionnaire` n'est PAS dans les quatre rôles demandés, et il est
  -- conservé délibérément. Dix lignes portaient `fonction = 'gestionnaire'` :
  -- six pour NGI (qui est administrative) mais quatre pour des gestionnaires
  -- d'assurance de Dynassur, qui ne sont pas des administratifs. Les y ranger
  -- aurait détruit une information que rien ne permettrait de reconstituer.
  ('gestionnaire',     'Gestionnaire',       50)
on conflict (code) do nothing;

alter table public.collaborateur_societes add column if not exists roles text[];

alter table public.ref_roles enable row level security;
drop policy if exists ref_roles_lecture  on public.ref_roles;
drop policy if exists ref_roles_ecriture on public.ref_roles;
create policy ref_roles_lecture  on public.ref_roles for select to authenticated using (true);
create policy ref_roles_ecriture on public.ref_roles for all    to authenticated using (is_admin()) with check (is_admin());

revoke all   on public.ref_roles from public, anon;
grant  select on public.ref_roles to authenticated;

-- Reprise de l'existant. `fonction` est CONSERVÉE : elle n'est plus lue, mais
-- une colonne supprimée ne se récupère pas d'un `git revert`.
update collaborateur_societes cs set roles = array['commercial']
 where cs.fonction = 'commercial' and cs.roles is null;

update collaborateur_societes cs set roles = array['administratif']
 where cs.fonction = 'gestionnaire' and cs.roles is null
   and exists (select 1 from collaborateurs c where c.id = cs.collaborateur_id and c.code = 'NGI');

update collaborateur_societes cs set roles = array['gestionnaire']
 where cs.fonction = 'gestionnaire' and cs.roles is null;

-- Les quatre de LODE, d'après les explications de Ludovic.
update collaborateur_societes cs set roles = array['commercial','gestion_chantier','installation']
  from collaborateurs c
 where c.id = cs.collaborateur_id and cs.societe = 'LODE' and c.code in ('LDE','JCL');

update collaborateur_societes cs set roles = array['commercial','administratif']
  from collaborateurs c
 where c.id = cs.collaborateur_id and cs.societe = 'LODE' and c.code = 'LLO';

update collaborateur_societes cs set roles = array['administratif']
  from collaborateurs c
 where c.id = cs.collaborateur_id and cs.societe = 'LODE' and c.code = 'NGI';

-- ⚠️ La vue, et non la table : `collaborateur_societes` porte `brut_mensuel`,
-- `prime_annuelle` et `honoraires_mensuels` sous une policy de lecture
-- `USING (true)` ouverte à tout compte connecté. La faire lire par un écran de
-- chantier exposerait la rémunération à qui ouvre l'onglet réseau.
create or replace view public.v_collaborateurs_societe as
select cs.societe,
       c.code,
       c.nom_complet,
       cs.fonction,
       c.id,
       c.cout_horaire,
       coalesce(cs.roles, '{}'::text[]) as roles
from collaborateur_societes cs
join collaborateurs c on c.id = cs.collaborateur_id
where coalesce(cs.actif, true) and coalesce(c.actif, false) and c.code is not null;

-- ⚠️ `create or replace view` réarme les privilèges par défaut de Supabase.
revoke all   on public.v_collaborateurs_societe from public, anon;
grant  select on public.v_collaborateurs_societe to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.v_collaborateurs_societe', 'select')
  or has_table_privilege('anon', 'public.ref_roles', 'select') then
    raise exception 'anon peut encore lire le referentiel des roles';
  end if;
end $$;
