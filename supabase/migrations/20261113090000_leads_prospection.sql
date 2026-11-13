-- PROSPECTION — les leads à appeler, et l'appel qui les traite.
--
-- Demandé par Ludovic le 13/11/2026 : un fichier Excel de leads, mis à jour
-- régulièrement par un prestataire, réparti entre trois commerciaux avec une
-- date d'appel par lead. Ils appellent par 3CX ; l'écran suit ce qui a été
-- appelé, ce qui est en retard, et l'issue de chaque appel.
--
-- Mesuré sur le fichier du 13/11 : 435 leads, 29 jours ouvrables du 16/11 au
-- 24/12, 15 par jour, trois commerciaux à exactement 145 chacun. 58 sont déjà
-- clients, 377 sont des prospects.
--
-- ── CE QUI N'EST PAS UNE COLONNE, ET POURQUOI ───────────────────────────
--
-- ⚠️ IL N'Y A PAS DE COLONNE « statut ». L'état d'un lead se déduit :
--
--     pas d'appel, pas d'issue   → à appeler
--     un appel, pas d'issue      → appelé, l'issue manque
--     une issue                  → traité
--
-- Une colonne `statut` écrite à la main finirait par diverger de la réalité :
-- un appel passé que personne ne note, une issue saisie sans appel, et plus
-- personne ne sait lequel des deux dit vrai. Ici le fait qu'un appel ait eu
-- lieu vient de `appels`, qui est alimentée par 3CX — donc par le central
-- téléphonique, pas par une déclaration.
--
-- ── LA RÈGLE QUI FAIT TOUT TENIR ─────────────────────────────────────────
--
-- Règle donnée par Ludovic : « il ne faudra pas tenir compte des appels
-- antérieurs au jour où ils doivent appeler ».
--
-- Ce n'est pas un détail de filtrage, c'est la clé de voûte. 58 des 435 leads
-- sont DÉJÀ CLIENTS : sans cette borne, un client appelé il y a six mois pour
-- un sinistre apparaîtrait comme traité dès l'import, et le commercial ne
-- l'appellerait jamais.

-- ── Le vocabulaire des issues ────────────────────────────────────────────
-- Validé par Ludovic le 13/11. Une liste fermée : une issue libre se décline
-- en vingt formulations de la même chose et aucune statistique n'en sort.
create table if not exists lead_issues (
  code   text primary key,
  libelle text not null,
  ordre  integer not null default 100,
  -- Une issue qui ferme le lead : on ne le repropose plus.
  termine boolean not null default true,
  actif  boolean not null default true
);

insert into lead_issues (code, libelle, ordre, termine) values
  ('pas_de_reponse',     'Pas de réponse',     10, false),
  ('a_rappeler',         'À rappeler',         20, false),
  ('rdv_pris',           'Rendez-vous pris',   30, true),
  ('pas_interesse',      'Pas intéressé',      40, true),
  ('deja_assure',        'Déjà assuré',        50, true),
  ('mauvais_numero',     'Mauvais numéro',     60, true),
  ('ne_plus_contacter',  'Ne plus contacter',  70, true)
on conflict (code) do nothing;

-- ── Les leads ────────────────────────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  societe text not null default 'DYNASSUR',

  -- Ce que le fichier apporte, tel quel.
  bce               text,       -- Numéro d'entreprise ; ABSENT sur 51 des 435
  denomination      text not null,
  forme_legale      text,
  date_constitution date,
  nace              text,
  rue               text,
  numero_rue        text,
  code_postal       text,
  commune           text,
  telephone         text,
  email             text,
  dirigeant         text,
  est_client        boolean not null default false,
  dossier_brio      text,
  relation_brio     text,
  nb_etablissements integer,
  resultat_exercice numeric,
  effectif          numeric,
  criteres          text,
  age               text,

  -- LE NUMÉRO NORMALISÉ EST LA CLÉ DE RAPPROCHEMENT avec les appels.
  -- `appels.numero_e164` est rempli sur 6 864 lignes sur 6 873, et le fichier
  -- arrive déjà en format international : les deux parlent la même langue.
  -- Sans numéro, le lead ne peut pas être appelé — 14 sont dans ce cas, et
  -- l'écran les sort de la file plutôt que de les y laisser en reproche.
  telephone_e164 text,

  -- Le code lu dans le fichier, GARDÉ TEL QUEL même s'il ne correspond à
  -- personne. Le 13/11, le fichier portait « JGO » là où le Hub connaît
  -- « GGO » : 145 leads pointaient vers un collaborateur inexistant. Un code
  -- inconnu silencieusement ignoré aurait rendu ces leads invisibles dans la
  -- file de tout le monde, et le lot aurait semblé traité.
  attribue_code text not null,
  attribue_id   bigint references collaborateurs(id),
  date_prevue   date not null,

  -- Ce que le Hub possède, et qu'un RÉIMPORT NE DOIT JAMAIS ÉCRASER.
  issue       text references lead_issues(code),
  issue_le    timestamptz,
  -- QUI a donné l'issue — pas forcément celui à qui le lead est attribué.
  -- Règle de Ludovic : un appel passé par un autre commercial compte, mais
  -- on doit savoir qui a pris le rendez-vous.
  issue_par   bigint references collaborateurs(id),
  remarques   text,

  -- Traçabilité de l'import.
  cle_import text not null,
  lot        text,
  importe_le timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- UNE LIGNE PAR LEAD ET PAR DATE D'APPEL. Le même prospect peut revenir dans
-- un lot suivant avec une autre date : c'est un second passage, pas un
-- doublon. C'est le couple qui est unique, jamais la clé seule.
create unique index if not exists leads_cle_date_key on leads (cle_import, date_prevue);
create index if not exists leads_attribue  on leads (attribue_code, date_prevue);
create index if not exists leads_tel       on leads (telephone_e164) where telephone_e164 is not null;
create index if not exists leads_sans_issue on leads (date_prevue) where issue is null;

comment on table leads is
  'Leads de prospection à appeler, importés d''un fichier externe. L''état se déduit des appels 3CX et de l''issue — il n''y a pas de colonne statut.';
comment on column leads.cle_import is
  'Clé de dédoublonnage : le numéro BCE quand il existe, sinon le téléphone, sinon dénomination+code postal. Aucun des replis n''est infaillible.';

-- ── La vue de travail ────────────────────────────────────────────────────
-- Elle joint les appels SORTANTS passés À PARTIR de la date prévue, et dit
-- qui a appelé. Tout le reste de l'écran se lit ici.
create or replace view v_leads_travail as
with appel_lead as (
  select
    l.id lead_id,
    a.id appel_id,
    a.debut,
    a.duree,
    a.agent,
    -- L'agent 3CX s'écrit « 27.PFQ » (839 appels sortants) ou « 27 » tout
    -- court (1 329). Les deux formes commencent par l'extension, donc on lit
    -- ce qui précède le point. Mesuré : zéro appel sortant sans agent.
    split_part(a.agent, '.', 1) extension,
    row_number() over (partition by l.id order by a.debut) rang
  from leads l
  join appels a
    on a.direction = 'Outbound'
   and a.numero_e164 = l.telephone_e164
   and a.debut >= l.date_prevue::timestamptz   -- LA règle : rien d'antérieur
  where l.telephone_e164 is not null
),
premier as (
  select * from appel_lead where rang = 1
),
compte as (
  select lead_id, count(*) nb_appels, sum(
    -- `duree` est du texte et porte deux formats (voir docs/TELEPHONIE.md) :
    -- « 00:01:23 » et un nombre de secondes. On lit les deux, et on ne
    -- compte rien plutôt que de compter faux.
    case when a.duree ~ '^\d+:\d{2}:\d{2}$'
           then split_part(a.duree,':',1)::int*3600 + split_part(a.duree,':',2)::int*60 + split_part(a.duree,':',3)::int
         when a.duree ~ '^\d+$' then a.duree::int
         else null end
  ) secondes_total
  from appel_lead a group by lead_id
)
select
  l.*,
  c_att.code  attribue_nom_code,
  trim(coalesce(c_att.prenom,'') || ' ' || coalesce(c_att.nom,'')) attribue_nom,
  -- Un code d'attribution qui ne correspond à personne : le lead n'est dans
  -- la file de personne, et ça doit se voir.
  (l.attribue_id is null) attribution_inconnue,
  (l.telephone_e164 is null) sans_telephone,
  p.appel_id        premier_appel_id,
  p.debut           premier_appel_le,
  c_app.code        appele_par_code,
  trim(coalesce(c_app.prenom,'') || ' ' || coalesce(c_app.nom,'')) appele_par,
  -- Appelé par quelqu'un d'autre que celui à qui le lead est attribué.
  -- Ça compte quand même comme traité — mais la statistique doit le dire.
  (p.appel_id is not null and c_app.id is distinct from l.attribue_id) appele_par_un_autre,
  coalesce(cp.nb_appels, 0) nb_appels,
  cp.secondes_total,
  i.libelle issue_libelle,
  i.termine issue_termine,
  trim(coalesce(c_iss.prenom,'') || ' ' || coalesce(c_iss.nom,'')) issue_par_nom,
  -- L'ÉTAT, DÉDUIT. Jamais stocké.
  case
    when l.issue is not null then 'traite'
    when p.appel_id is not null then 'appele_sans_issue'
    when l.telephone_e164 is null then 'injoignable'
    when l.date_prevue < current_date then 'en_retard'
    when l.date_prevue = current_date then 'du_jour'
    else 'a_venir'
  end etat
from leads l
left join collaborateurs c_att on c_att.id = l.attribue_id
left join collaborateurs c_iss on c_iss.id = l.issue_par
left join premier p on p.lead_id = l.id
left join collaborateurs c_app on c_app.extension = p.extension and c_app.actif
left join compte cp on cp.lead_id = l.id
left join lead_issues i on i.code = l.issue;

comment on view v_leads_travail is
  'Les leads avec leur premier appel sortant postérieur à la date prévue, qui les a appelés, et l''état déduit. La règle « aucun appel antérieur » évite que les 58 leads déjà clients paraissent traités dès l''import.';

-- ── Accès ────────────────────────────────────────────────────────────────
-- Ouvert aux connectés en attendant le chantier des droits, fermé à `anon`.
-- Les deux révocations, pas une.
alter table leads       enable row level security;
alter table lead_issues enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='leads' and policyname='leads_connectes') then
    create policy leads_connectes on leads for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='lead_issues' and policyname='lead_issues_lecture') then
    create policy lead_issues_lecture on lead_issues for select to authenticated using (true);
  end if;
end $$;

revoke all on leads, lead_issues, v_leads_travail from public, anon;
grant select, insert, update, delete on leads to authenticated;
grant select on lead_issues, v_leads_travail to authenticated;
grant select, insert, update, delete on leads, lead_issues to service_role;

-- ── Vérification ─────────────────────────────────────────────────────────
do $$
declare reste text;
begin
  select string_agg(t, ', ') into reste from unnest(array['leads','lead_issues','v_leads_travail']) t
  where has_table_privilege('anon', 'public.'||t, 'SELECT');
  if reste is not null then raise exception 'anon garde SELECT sur : %', reste; end if;
end $$;
