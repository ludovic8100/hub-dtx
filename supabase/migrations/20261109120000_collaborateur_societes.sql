-- Le rôle appartient au couple (personne, société), pas à la personne
-- =================================================================
-- Constat de Ludovic le 09/11 : « je crois que tu as tout mélangé, les
-- bureaux, les rôles, les commissions ». Il avait raison, et la cause tient
-- en une phrase : `est_commercial`, `est_sous_agent`, `bureau_id`, `numero`
-- et les taux sont portés par la PERSONNE, alors qu'ils ne valent que pour
-- UNE société.
--
-- Ce que ça produisait, mesuré avant de coder :
--   • une gestionnaire Dynassur apparaissait comme commerciale LODE ;
--   • le commercial de LODE ne pouvait pas être déclaré commercial, parce
--     que cocher un rôle exige code + n° producteur + BCE + IBAN + BIC,
--     qui sont des champs de courtage ;
--   • `collaborateur_taux` n'avait aucune colonne `societe` : les % étaient
--     stockés comme s'ils valaient pour LODE et DTX aussi.
--
-- Trois faits distincts, qui étaient écrasés en un seul :
--   STATUT       comment la personne est liée       (administrateur, employé, sous-agent, apporteur)
--   FONCTION     ce qu'elle fait                    (commercial, gestionnaire)
--   RÉMUNÉRATION comment elle est payée ICI         (salaire, honoraires, commissions, aucune)
--
-- La rémunération est séparée du statut parce qu'elles ne se déduisent pas
-- l'une de l'autre : un administrateur peut être salarié dans une société,
-- facturer ses honoraires dans une autre, et n'être pas payé dans une
-- troisième.

-- ── Référentiel des statuts, par société ─────────────────────────────────
-- En base et non dans le code : ajouter une société ou un statut ne doit pas
-- être une modification du Hub (garde-fou « aucune règle métier en dur sur un
-- nom de société »).
create table if not exists ref_statuts (
  code    text primary key,
  libelle text not null,
  ordre   integer not null default 100
);

insert into ref_statuts (code, libelle, ordre) values
  ('administrateur',  'Administrateur',   10),
  ('employe',         'Employé',          20),
  ('sous_agent',      'Sous-agent',       30),
  ('apporteur',       'Apporteur',        40),
  ('membre_comite',   'Membre du comité', 50)
on conflict (code) do nothing;

create table if not exists ref_statuts_societes (
  statut_code text not null references ref_statuts(code) on delete cascade,
  societe     text not null,
  primary key (statut_code, societe)
);

insert into ref_statuts_societes (statut_code, societe) values
  ('administrateur','DYNASSUR'), ('employe','DYNASSUR'), ('sous_agent','DYNASSUR'), ('apporteur','DYNASSUR'),
  ('administrateur','LODE'),     ('employe','LODE'),
  ('administrateur','DTX'),      ('employe','DTX'),
  ('administrateur','HEXAGROUP'),('membre_comite','HEXAGROUP'),
  ('administrateur','PRIVE'),
  ('administrateur','HOL')
on conflict do nothing;

-- ── Une ligne par personne et par société ────────────────────────────────
create table if not exists collaborateur_societes (
  id                bigserial primary key,
  collaborateur_id  bigint not null references collaborateurs(id) on delete cascade,
  societe           text   not null references societes(code),

  statut            text references ref_statuts(code),
  fonction          text check (fonction in ('commercial','gestionnaire')),
  remuneration      text check (remuneration in ('salaire','honoraires','commissions','aucune')),

  -- Dynassur : le bureau décide des clients vus, le numéro identifie la
  -- personne chez le courtier. Le numéro vaut pour TOUT LE MONDE chez
  -- Dynassur, pas seulement pour les sous-agents — Ludovic, 09/11.
  bureau_id         bigint,
  numero_sous_agent integer,

  -- Rémunération réelle, par société : un employé LODE coûte à LODE.
  brut_mensuel      numeric,
  mois_payes        numeric default 13.92,
  charges_pct       numeric default 25,
  vehicule_mensuel  numeric,
  autres_mensuel    numeric,
  honoraires_mensuels numeric,
  prime_annuelle    numeric,
  heures_annuelles  numeric default 1530,

  actif             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (collaborateur_id, societe)
);

-- Le coût horaire se calcule dans les deux cas — salaire ou honoraires — à
-- partir de ce qui est RÉELLEMENT versé. 13,92 mois = 12 + 13ᵉ + 0,92 de
-- double pécule ; 1 530 h et non 1 820, parce que congés, jours fériés,
-- maladie et formation ne sont pas des heures facturables.
alter table collaborateur_societes
  add column if not exists cout_horaire numeric
  generated always as (
    case
      when coalesce(heures_annuelles, 0) <= 0 then null
      when coalesce(brut_mensuel, 0) > 0 then round((
             brut_mensuel * coalesce(mois_payes, 13.92) * (1 + coalesce(charges_pct, 25) / 100)
             + coalesce(vehicule_mensuel, 0) * 12
             + coalesce(autres_mensuel, 0) * 12) / heures_annuelles, 2)
      when coalesce(honoraires_mensuels, 0) > 0 then round((
             honoraires_mensuels * 12 + coalesce(prime_annuelle, 0)
             + coalesce(vehicule_mensuel, 0) * 12
             + coalesce(autres_mensuel, 0) * 12) / heures_annuelles, 2)
      else null
    end
  ) stored;

create index if not exists idx_collab_soc_collab  on collaborateur_societes (collaborateur_id);
create index if not exists idx_collab_soc_societe on collaborateur_societes (societe);

-- ── Les taux de commission appartiennent aussi à une société ─────────────
-- Ils ne concernent que Dynassur aujourd'hui : les 183 lignes existantes y
-- sont donc rattachées explicitement, au lieu de valoir pour tout le groupe.
alter table collaborateur_taux add column if not exists societe text;
update collaborateur_taux set societe = 'DYNASSUR' where societe is null;

-- ── Reprise de l'existant ────────────────────────────────────────────────
-- Une ligne par société à laquelle la personne a accès aujourd'hui. C'est la
-- moins mauvaise approximation disponible : `acc_<societe>` est tout ce que
-- la base sait de l'appartenance. Les fiches devront être relues — c'est
-- justement ce que l'écran permettra enfin de faire.
-- ⚠️ Le seed est enveloppé dans un DO : l'environnement de TEST n'a pas les
-- colonnes `acc_<societe>` que la production porte (dérive dépôt/production
-- constatée le 07/11). Sans cette garde, la migration échoue en test et le
-- projet de test reste inutilisable — ce qui est exactement le problème qu'on
-- essaie de ne plus avoir.
do $seed$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'collaborateurs' and column_name = 'acc_dynassur') then
    insert into collaborateur_societes (collaborateur_id, societe, statut, fonction, bureau_id, numero_sous_agent, remuneration)
    select c.id, s.code,
           case when c.est_admin then 'administrateur' when c.est_employe then 'employe'
                when c.est_sous_agent then 'sous_agent' when c.est_apporteur then 'apporteur' end,
           case when c.est_commercial then 'commercial' when c.est_gestionnaire then 'gestionnaire' end,
           case when s.code = 'DYNASSUR' then c.bureau_id end,
           case when s.code = 'DYNASSUR' then c.numero end,
           case when c.est_sous_agent or c.est_apporteur then 'commissions'
                when c.est_employe then 'salaire' end
      from collaborateurs c
      join societes s on (
            (s.code='DYNASSUR'  and c.acc_dynassur) or (s.code='LODE'      and c.acc_lode)
         or (s.code='DTX'       and c.acc_dtx)      or (s.code='HEXAGROUP' and c.acc_hexagroup)
         or (s.code='PRIVE'     and c.acc_prive)    or (s.code='HOL'       and c.acc_holding))
     where c.actif is not false
    on conflict (collaborateur_id, societe) do nothing;
  else
    raise notice 'Colonnes acc_* absentes : reprise ignorée (base de test).';
  end if;
end
$seed$;

-- Le coût horaire n'est renseigné que sur UNE fiche en production : on le
-- pose sur sa ligne Dynassur si elle existe, sinon sur sa première société.
-- À relire — c'est la seule valeur que la reprise ne peut pas deviner.
update collaborateur_societes cs
   set brut_mensuel     = c.cout_brut_mensuel,
       mois_payes       = coalesce(c.cout_mois_payes, 13.92),
       charges_pct      = coalesce(c.cout_charges_pct, 25),
       vehicule_mensuel = c.cout_vehicule_mensuel,
       autres_mensuel   = c.cout_autres_mensuel,
       heures_annuelles = coalesce(c.cout_heures_annuelles, 1530)
  from collaborateurs c
 where cs.collaborateur_id = c.id
   and c.cout_brut_mensuel is not null
   and cs.id = (select x.id from collaborateur_societes x
                 where x.collaborateur_id = c.id
                 order by (x.societe = 'DYNASSUR') desc, x.id
                 limit 1);

-- ── Accès ────────────────────────────────────────────────────────────────
alter table collaborateur_societes enable row level security;
alter table ref_statuts            enable row level security;
alter table ref_statuts_societes   enable row level security;

drop policy if exists collab_soc_lecture on collaborateur_societes;
create policy collab_soc_lecture on collaborateur_societes
  for select to authenticated using (true);
drop policy if exists collab_soc_ecriture on collaborateur_societes;
create policy collab_soc_ecriture on collaborateur_societes
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists ref_statuts_lecture on ref_statuts;
create policy ref_statuts_lecture on ref_statuts for select to authenticated using (true);
drop policy if exists ref_statuts_soc_lecture on ref_statuts_societes;
create policy ref_statuts_soc_lecture on ref_statuts_societes for select to authenticated using (true);

revoke all on collaborateur_societes, ref_statuts, ref_statuts_societes from anon;
