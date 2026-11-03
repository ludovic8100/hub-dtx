-- Un seul modèle de modules (bloc 2 de docs/DROITS-ACCES.md) — étape 1 : additive.
-- APPLIQUÉE EN PRODUCTION le 02/11/2026.
--
-- Crée le catalogue et l'attribution, dérive les droits existants. Ne retire
-- aucune colonne et ne change aucun comportement : le front lit encore les
-- colonnes booléennes. La bascule du front est une étape séparée.
--
-- Vérification après application — aucun accès gagné ni perdu :
--   HOL 3/3 · DYNASSUR 15/15 · DTX 3/3 · LODE 4/4 · HEXAGROUP 4/4 · PRIVE 3/3
--   Outils 18/18 · 178 attributions au total, contre 55 colonnes x 49 personnes.
--
-- Colonnes volontairement NON reprises, parce que leur module n'existe plus :
--   dyn_taches (16 personnes), dyn_rdv (15), hex/dtx/lode/prive/grp_taches,
--   dyn_devis, dyn_bordereaux, et les quatre *_banque — les routes banque sont
--   réservées aux administrateurs, ces colonnes ne décidaient de rien.
--
-- Cas particulier : la colonne lode_rentabilite n'a JAMAIS existé en base alors
-- que la route /lode/rentabilite l'exige. La page était donc inatteignable pour
-- les non-administrateurs. Le module est créé sans aucune attribution, pour ne
-- rien changer : à accorder à la main depuis Paramètres.

create table if not exists ref_modules (
  code    text primary key,
  libelle text not null,
  ordre   int  not null default 100
);

create table if not exists ref_modules_societes (
  module_code     text not null references ref_modules(code) on delete cascade,
  societe         text not null,
  colonnes_legacy text[] not null default '{}',
  colonne_acces   text,
  primary key (module_code, societe)
);

create table if not exists collaborateur_acces (
  collaborateur_id bigint      not null references collaborateurs(id) on delete cascade,
  societe          text        not null,
  module_code      text        not null,
  accorde_le       timestamptz not null default now(),
  primary key (collaborateur_id, societe, module_code),
  foreign key (module_code, societe)
    references ref_modules_societes(module_code, societe) on delete cascade
);

create index if not exists idx_collab_acces_collab on collaborateur_acces(collaborateur_id);

insert into ref_modules (code, libelle, ordre) values
  ('dashboard','Tableau de bord',10), ('clients','Clients',20),
  ('production','Production et chiffres',30), ('compagnies','Compagnies',40),
  ('sinistres','Sinistres',50), ('credits','Crédits',60), ('appels','Appels',70),
  ('comptabilite','Comptabilité',80), ('devis_factures','Devis et factures',90),
  ('rentabilite','Rentabilité',100), ('immobilier','Immobilier',110),
  ('vehicules','Véhicules',120), ('trading','Trading',130), ('membres','Membres',140),
  ('cotisations','Cotisations',150), ('notes_frais','Notes de frais',160),
  ('succession','Succession',170), ('outils','Outils',180)
on conflict (code) do nothing;

insert into ref_modules_societes (module_code, societe, colonnes_legacy, colonne_acces) values
  ('dashboard','HOL','{acc_holding}','acc_holding'),
  ('comptabilite','HOL','{acc_holding}','acc_holding'),
  ('notes_frais','HOL','{grp_notesfrais}','acc_holding'),
  ('dashboard','DYNASSUR','{dyn_dashboard}','acc_dynassur'),
  ('clients','DYNASSUR','{dyn_clients}','acc_dynassur'),
  ('production','DYNASSUR','{dyn_production,dyn_chiffres,dyn_rentabilite,dyn_objectifs}','acc_dynassur'),
  ('compagnies','DYNASSUR','{dyn_compagnies}','acc_dynassur'),
  ('sinistres','DYNASSUR','{dyn_sinistres}','acc_dynassur'),
  ('credits','DYNASSUR','{dyn_credits}','acc_dynassur'),
  ('appels','DYNASSUR','{dyn_appels}','acc_dynassur'),
  ('comptabilite','DYNASSUR','{dyn_comptabilite}','acc_dynassur'),
  ('notes_frais','DYNASSUR','{dyn_notesfrais}','acc_dynassur'),
  ('dashboard','DTX','{dtx_dashboard}','acc_dtx'),
  ('immobilier','DTX','{dtx_immobilier}','acc_dtx'),
  ('vehicules','DTX','{dtx_vehicules}','acc_dtx'),
  ('trading','DTX','{dtx_trading}','acc_dtx'),
  ('comptabilite','DTX','{dtx_comptabilite}','acc_dtx'),
  ('devis_factures','DTX','{dtx_devis}','acc_dtx'),
  ('notes_frais','DTX','{dtx_notesfrais}','acc_dtx'),
  ('dashboard','LODE','{lode_dashboard}','acc_lode'),
  ('clients','LODE','{lode_clients}','acc_lode'),
  ('devis_factures','LODE','{lode_devis}','acc_lode'),
  ('comptabilite','LODE','{lode_comptabilite}','acc_lode'),
  ('rentabilite','LODE','{}','acc_lode'),
  ('notes_frais','LODE','{lode_notesfrais}','acc_lode'),
  ('dashboard','HEXAGROUP','{hex_dashboard}','acc_hexagroup'),
  ('comptabilite','HEXAGROUP','{hex_comptabilite}','acc_hexagroup'),
  ('membres','HEXAGROUP','{hex_membres}','acc_hexagroup'),
  ('cotisations','HEXAGROUP','{hex_cotisations}','acc_hexagroup'),
  ('notes_frais','HEXAGROUP','{hex_notesfrais}','acc_hexagroup'),
  ('dashboard','PRIVE','{prive_dashboard}','acc_prive'),
  ('comptabilite','PRIVE','{prive_comptabilite}','acc_prive'),
  ('notes_frais','PRIVE','{prive_notesfrais}','acc_prive'),
  ('succession','PRIVE','{prive_succession}','acc_prive'),
  ('outils','TRANSVERSAL','{acc_tools}',null)
on conflict (module_code, societe) do nothing;

-- Reprise à l'identique : même règle que ProtectedRoute (colonne acc_* ET au
-- moins une colonne du module).
do $$
declare r record; sql text; n int;
begin
  for r in select * from ref_modules_societes loop
    if array_length(r.colonnes_legacy, 1) is null then continue; end if;
    sql := format(
      'insert into collaborateur_acces (collaborateur_id, societe, module_code)
         select id, %L, %L from collaborateurs
          where compte_hub_actif and (%s) %s
       on conflict do nothing',
      r.societe, r.module_code,
      (select string_agg(format('coalesce(%I, false)', c), ' or ') from unnest(r.colonnes_legacy) c),
      case when r.colonne_acces is null then '' else format('and coalesce(%I, false)', r.colonne_acces) end
    );
    execute sql;
    get diagnostics n = row_count;
    raise notice '% / % : % droits repris', r.societe, r.module_code, n;
  end loop;
end $$;

-- Une table neuve n'hérite d'aucun droit : RLS et grants explicites.
alter table ref_modules          enable row level security;
alter table ref_modules_societes enable row level security;
alter table collaborateur_acces  enable row level security;

create policy modules_lecture  on ref_modules          for select to authenticated using (true);
create policy modules_ecriture on ref_modules          for all    to authenticated using (is_admin()) with check (is_admin());
create policy modsoc_lecture   on ref_modules_societes for select to authenticated using (true);
create policy modsoc_ecriture  on ref_modules_societes for all    to authenticated using (is_admin()) with check (is_admin());
create policy acces_lecture    on collaborateur_acces  for select to authenticated using (true);
create policy acces_ecriture   on collaborateur_acces  for all    to authenticated using (is_admin()) with check (is_admin());

grant select on ref_modules, ref_modules_societes, collaborateur_acces to authenticated;
grant insert, update, delete on collaborateur_acces to authenticated;
grant insert, update, delete on ref_modules, ref_modules_societes to authenticated;
