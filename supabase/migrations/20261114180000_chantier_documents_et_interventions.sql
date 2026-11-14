-- LE CHANTIER PORTE SES DOCUMENTS, SES PASSAGES ET SA COMMANDE (14/11/2026)
-- ---------------------------------------------------------------------------
--
-- Trois besoins donnés par Ludovic le même jour, qui tiennent sur la même
-- fiche et se posent donc ensemble.
--
-- ══ 1. LES DOCUMENTS ══════════════════════════════════════════════════════
--
-- « Je dois pouvoir ajouter un document qui est sur mon disque dur : le bon de
-- commande du fournisseur, le devis du fournisseur, les fiches techniques, les
-- QR codes qui servent à connecter le moteur… » et « avoir un dossier rien
-- qu'avec ces documents ».
--
-- ⚠️ UNE SEULE COPIE, DANS SHAREPOINT. Le premier choix exprimé était « dans
-- le Hub ET copié vers SharePoint ». Deux copies du même PDF, dont une
-- annotée, et plus personne ne sait laquelle fait foi — c'est le genre de
-- dérive qui ne se voit qu'au moment où elle coûte cher. Le fichier vit donc
-- dans `ADMINISTRATION/LODE_CHANTIERS/<numéro> - <client>/`, un vrai dossier
-- ouvrable dans l'Explorateur, synchronisable et partageable.
--
-- Cette table ne porte que des MÉTADONNÉES : nom, identifiant Graph, adresse,
-- taille, type. Elle ne stocke aucun contenu — c'est la règle du projet,
-- « SharePoint est la source de vérité des fichiers, Supabase les métadonnées
-- et l'URL ».
--
-- Seule exception, et elle est assumée : `vignette_path`, l'image de la
-- première page, pour l'aperçu au survol. 40 ko, personne ne confondra ça avec
-- l'original ni ne l'enverra à un client. Elle est générée DANS LE NAVIGATEUR
-- au dépôt — les vignettes passaient par n8n, qui est arrêté, et aucune
-- nouvelle dépendance n8n n'est permise.
--
-- ══ 2. LES PASSAGES ═══════════════════════════════════════════════════════
--
-- « On peut très bien y retourner un autre jour : 4 h le mardi, il manque une
-- pièce, 4 h le vendredi. »
--
-- `dossiers` ne portait QU'UN seul jeu de champs (`mo_heures`, `mo_visites`,
-- `mo_collaborateur_id`, `mo_taux_horaire`). Deux dates s'écrasaient, deux
-- personnes étaient impossibles, et « il manque une pièce » n'avait nulle part
-- où aller. Une ligne par passage et par personne règle les trois.
--
-- ⚠️ ON COMPTE DES JOURNÉES, PAS DES HEURES. Règle de Ludovic : « un forfait
-- journée, 450 €/journée/homme pour 8 h de travail » — ce que l'architecture
-- prévoyait déjà sous le nom de « barème forfaitaire par type d'intervention ».
-- `quantite` vaut donc 1 ou 0,5. Saisir des heures et diviser par 8 serait un
-- taux horaire déguisé ; autant ne pas appeler ça un forfait.
--
-- ⚠️ `forfait_jour` EST FIGÉ SUR LA LIGNE, jamais relu du barème. Augmenter le
-- tarif l'an prochain ne doit pas changer la marge d'un chantier de cette
-- année — c'est la règle déjà posée pour le taux horaire : « la M.O. d'il y a
-- trois ans, c'était la M.O. d'il y a trois ans ».
--
-- ⚠️ ET LE TRAJET SE COMPTE PAR PASSAGE, pas par chantier. C'est tout l'enjeu
-- de l'exemple : revenir parce qu'il manque une pièce, c'est un déplacement et
-- un chargement de plus. Si on additionne simplement 4 + 4 = une journée, un
-- chantier bien préparé et un chantier raté affichent le même coût, et la
-- préparation ne rapporte rien de visible. Le nombre de lignes EST le nombre
-- de trajets : aucune saisie supplémentaire.
--
-- ⚠️ Les colonnes `mo_*` de `dossiers` sont CONSERVÉES. Elles ne sont plus la
-- source, mais une colonne supprimée ne revient pas d'un `git revert`, et deux
-- chantiers sur neuf y portent des heures — reprises ici en une ligne chacun.
--
-- ══ 3. LA COMMANDE DE MATÉRIEL ════════════════════════════════════════════
--
-- Entre le devis accepté et la pose il y a la commande et le délai. Deux dates
-- sur le chantier, corrigées à la main quand le fournisseur décale — ce que
-- Ludovic a explicitement accepté plutôt qu'une alerte au bout de N semaines.

-- ── Le barème ─────────────────────────────────────────────────────────────
--
-- En base et non en dur : le projet interdit la règle métier codée dans le
-- code. La ligne par défaut existe dès la création — un module qui exige de
-- remplir un barème avant la première saisie ne démarre jamais.
create table if not exists public.ref_baremes_intervention (
  code         text primary key,
  libelle      text not null,
  forfait_jour numeric not null check (forfait_jour >= 0),
  societe      text,
  actif        boolean not null default true
);

insert into public.ref_baremes_intervention (code, libelle, forfait_jour, societe) values
  ('standard', 'Journée standard', 450, 'LODE')
on conflict (code) do nothing;

-- ── Les documents ─────────────────────────────────────────────────────────
create table if not exists public.dossier_documents (
  id                  uuid primary key default gen_random_uuid(),
  dossier_id          uuid not null references public.dossiers(id) on delete cascade,
  societe             text not null,
  nom                 text not null,
  -- Où le fichier vit VRAIMENT. `item_id` est la clé stable de Graph : le nom
  -- et le chemin peuvent changer, lui non.
  sharepoint_item_id  text,
  sharepoint_url      text,
  taille              bigint,
  type_mime           text,
  -- La seule donnée binaire côté Hub, et c'est une image de 40 ko.
  vignette_path       text,
  categorie           text,
  note                text,
  depose_par          text,
  created_at          timestamptz not null default now()
);

create index if not exists dossier_documents_dossier_idx on public.dossier_documents(dossier_id);
create index if not exists dossier_documents_societe_idx on public.dossier_documents(societe);

-- ── Les passages ──────────────────────────────────────────────────────────
create table if not exists public.dossier_interventions (
  id               uuid primary key default gen_random_uuid(),
  dossier_id       uuid not null references public.dossiers(id) on delete cascade,
  societe          text not null,
  date             date not null default current_date,
  collaborateur_id bigint references public.collaborateurs(id),
  -- 1 journée ou 0,5. Rien de plus fin : au-delà on retombe sur un taux horaire.
  quantite         numeric not null default 1 check (quantite > 0 and quantite <= 2),
  -- Figé à la saisie. Ne jamais relire le barème pour un affichage.
  forfait_jour     numeric check (forfait_jour >= 0),
  bareme_code      text references public.ref_baremes_intervention(code),
  -- « il manque une pièce » : la raison du retour, qui n'avait nulle part où aller.
  note             text,
  trajet_km        numeric check (trajet_km >= 0),
  -- Coché sur le DERNIER passage : le chantier bascule alors en « à facturer ».
  -- Pas un champ de plus sur le chantier — une case sur ce qu'on saisit déjà.
  termine          boolean not null default false,
  cree_par         text,
  created_at       timestamptz not null default now()
);

create index if not exists dossier_interventions_dossier_idx on public.dossier_interventions(dossier_id);
create index if not exists dossier_interventions_date_idx    on public.dossier_interventions(date);

-- ── La commande de matériel ───────────────────────────────────────────────
alter table public.dossiers add column if not exists materiel_commande_le      date;
alter table public.dossiers add column if not exists materiel_livraison_prevue date;
alter table public.dossiers add column if not exists materiel_note             text;

comment on column public.dossiers.materiel_livraison_prevue is
  'Date annoncée par le fournisseur. Corrigée à la main quand elle bouge — choix explicite de Ludovic le 14/11/2026, plutôt qu''une alerte automatique.';

-- ── Reprise des heures déjà saisies ───────────────────────────────────────
--
-- Deux chantiers sur neuf portent des heures. On les convertit en journées sur
-- la base de 8 h, et on garde la trace de la conversion dans la note : un
-- chiffre repris sans dire d'où il vient est un chiffre qu'on ne saura plus
-- vérifier.
insert into public.dossier_interventions
  (dossier_id, societe, date, collaborateur_id, quantite, forfait_jour, note, cree_par)
select d.id,
       coalesce(d.societe, 'LODE'),
       coalesce(d.date_fin, d.date_debut, current_date),
       d.mo_collaborateur_id,
       greatest(0.5, round((d.mo_heures / 8.0) * 2) / 2),
       450,
       'Repris de la saisie unique du chantier : ' || d.mo_heures || ' h'
         || case when d.mo_visites is not null then ' / ' || d.mo_visites || ' visite(s)' else '' end
         || coalesce(' — ' || d.mo_note, ''),
       'migration 14/11/2026'
from public.dossiers d
where d.mo_heures is not null and d.mo_heures > 0
  and not exists (select 1 from public.dossier_interventions i where i.dossier_id = d.id);

-- ── Sécurité ──────────────────────────────────────────────────────────────
--
-- ⚠️ `anon` est le rôle d'AVANT connexion, et sa clé est dans le bundle du
-- navigateur ET dans ce dépôt public. Aucune de ces tables ne doit lui être
-- accessible.
alter table public.ref_baremes_intervention enable row level security;
alter table public.dossier_documents        enable row level security;
alter table public.dossier_interventions    enable row level security;

drop policy if exists bareme_lecture  on public.ref_baremes_intervention;
drop policy if exists bareme_ecriture on public.ref_baremes_intervention;
create policy bareme_lecture  on public.ref_baremes_intervention for select to authenticated using (true);
create policy bareme_ecriture on public.ref_baremes_intervention for all    to authenticated using (is_admin()) with check (is_admin());

drop policy if exists doc_lecture     on public.dossier_documents;
drop policy if exists doc_ajout       on public.dossier_documents;
drop policy if exists doc_maj         on public.dossier_documents;
drop policy if exists doc_suppression on public.dossier_documents;
create policy doc_lecture on public.dossier_documents for select to authenticated using (true);
create policy doc_ajout   on public.dossier_documents for insert to authenticated with check (true);
create policy doc_maj     on public.dossier_documents for update to authenticated using (true) with check (true);
-- SUPPRESSION RÉSERVÉE AUX ADMINISTRATEURS — choix explicite de Ludovic :
-- un document déposé sur un chantier est une pièce du dossier.
create policy doc_suppression on public.dossier_documents for delete to authenticated using (is_admin());

drop policy if exists inter_lecture     on public.dossier_interventions;
drop policy if exists inter_ecriture    on public.dossier_interventions;
drop policy if exists inter_suppression on public.dossier_interventions;
create policy inter_lecture  on public.dossier_interventions for select to authenticated using (true);
create policy inter_ecriture on public.dossier_interventions for all    to authenticated using (true) with check (true);

revoke all on public.ref_baremes_intervention from public, anon;
revoke all on public.dossier_documents        from public, anon;
revoke all on public.dossier_interventions    from public, anon;
grant select                         on public.ref_baremes_intervention to authenticated;
grant select, insert, update, delete on public.dossier_documents        to authenticated;
grant select, insert, update, delete on public.dossier_interventions    to authenticated;

-- ── Le coût de main-d'œuvre, calculé et non saisi ─────────────────────────
create or replace view public.v_dossier_mo as
select i.dossier_id,
       count(*)                                        as passages,
       sum(i.quantite)                                 as journees,
       sum(i.quantite * coalesce(i.forfait_jour, 0))   as cout_mo,
       sum(coalesce(i.trajet_km, 0))                   as km_total,
       max(i.date)                                     as dernier_passage,
       bool_or(i.termine)                              as chantier_termine
from public.dossier_interventions i
group by i.dossier_id;

revoke all   on public.v_dossier_mo from public, anon;
grant  select on public.v_dossier_mo to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.dossier_documents',     'select')
  or has_table_privilege('anon', 'public.dossier_interventions', 'select')
  or has_table_privilege('anon', 'public.v_dossier_mo',          'select') then
    raise exception 'anon peut encore lire les documents ou les interventions de chantier';
  end if;
end $$;
