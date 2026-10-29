-- =============================================================================
-- HUB DTX — MIGRATION BASELINE : schéma complet de la production
-- Projet source : tndwonqdbeszkcztkzqe (Postgres 17), exporté le 2026-10-29 depuis les
-- catalogues système (pg_catalog / information_schema), après les 118 migrations historiques.
--
-- Contient : extensions, séquences, 100 tables, contraintes, index, 43 fonctions, 17 vues,
-- 14 triggers, RLS + 147 policies, privilèges anon, 7 buckets + 16 policies storage, 1 cron.
-- Ne contient PAS : les données, la config Auth (fournisseur Azure, URLs de redirection),
-- les secrets (config_secrets est vide), les utilisateurs auth.users.
--
-- Usage :
--   • Projet neuf (TEST) : appliquer tel quel, puis scripts/seed_test.py pour les données.
--   • PRODUCTION : NE PAS APPLIQUER. Marquer comme déjà appliquée :
--       supabase migration repair --status applied 20261029120000
-- =============================================================================

-- ============================================================================
-- Extensions (mêmes schémas qu'en prod : unaccent/vector/pg_net dans public)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Séquences
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.appels_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.bordereaux_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.clients_consultes_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.clients_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.collaborateurs_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.connexions_log_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.contrats_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.dyn_devoir_info_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.factures_fournisseurs_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.liens_casses_log_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.mouvements_production_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.objectifs_cibles_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.objectifs_realises_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.objets_risque_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.parentes_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.profils_investisseur_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ref_apporteurs_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ref_bureaux_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ref_gestionnaires_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ref_portefeuilles_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ref_sous_agents_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.segmentation_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_dtx_devis_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_dtx_facture_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_dyn_devis_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_dyn_facture_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_lode_devis_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_lode_facture_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_lode_nc_2026 AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.sinistre_paiements_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.sinistre_workflow_progress_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.taches_historique_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.taches_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.taches_suivi_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.ticket_categories_id_seq AS integer START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.tickets_messages_id_seq AS bigint START WITH 1 INCREMENT BY 1;

-- ============================================================================
-- Fonctions requises par les colonnes générées (avant les tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_be(raw text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare s text;
begin
  if raw is null then return null; end if;
  s := regexp_replace(raw, '[^0-9+]', '', 'g');
  if s = '' then return null; end if;
  if left(s,1) = '+' then
    return '+' || regexp_replace(substring(s from 2), '[^0-9]', '', 'g');
  end if;
  s := regexp_replace(s, '[^0-9]', '', 'g');
  if s = '' then return null; end if;
  if left(s,2) = '00' then return '+' || substring(s from 3); end if;
  if left(s,2) = '32' then return '+' || s; end if;
  if left(s,1) = '0'  then return '+32' || substring(s from 2); end if;
  return '+32' || s;
end $function$
;

-- ============================================================================
-- Tables (100)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  societe_code text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  couleur text,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ag_starget_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL DEFAULT 2026,
  week_number integer NOT NULL,
  month_number integer NOT NULL,
  star_level text,
  bonus_croissance_ppe numeric DEFAULT 0,
  bonus_croissance_enterprise numeric DEFAULT 0,
  bonus_sp numeric DEFAULT 0,
  bonus_total numeric DEFAULT 0,
  points_iard_ppe numeric,
  points_vie numeric,
  source_file text,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ag_technical_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_year integer,
  period_month integer,
  product_family text NOT NULL,
  product_detail text,
  primes_emises_period numeric,
  primes_acquises_period numeric,
  primes_acquises_cum numeric,
  sinistres_period numeric,
  sinistres_cum numeric,
  commissions_emises numeric,
  commissions_acquises numeric,
  sp_historique_total numeric,
  sp_historique_ecrete numeric,
  evolution_percent numeric,
  source_file text,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ag_vie_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  tranche integer NOT NULL,
  base_min numeric,
  base_max numeric,
  rate_b21 numeric,
  rate_b23 numeric,
  actual_base_b21 numeric DEFAULT 0,
  actual_base_b23 numeric DEFAULT 0,
  remuneration_b21 numeric GENERATED ALWAYS AS (round(((COALESCE(actual_base_b21, (0)::numeric) * COALESCE(rate_b21, (0)::numeric)) / (100)::numeric), 2)) STORED,
  remuneration_b23 numeric GENERATED ALWAYS AS (round(((COALESCE(actual_base_b23, (0)::numeric) * COALESCE(rate_b23, (0)::numeric)) / (100)::numeric), 2)) STORED,
  source_file text DEFAULT 'HEXAGROUP_R_FR.pdf'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appels (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  direction text,
  numero_externe text,
  numero_e164 text,
  client_id bigint,
  agent text,
  duree text,
  debut timestamp with time zone,
  nom_3cx text,
  cree_le timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bordereaux (
  id bigint NOT NULL DEFAULT nextval('bordereaux_id_seq'::regclass),
  compagnie text NOT NULL,
  mois text NOT NULL,
  annee integer DEFAULT 2026,
  type text NOT NULL,
  montant numeric(12,2),
  commission numeric(12,2),
  net numeric(12,2),
  created_at timestamp with time zone DEFAULT now(),
  cle_unique text,
  compte_producteur text,
  nb_polices integer,
  source text DEFAULT 'manuel'::text,
  nom_fichier text,
  notes text,
  sharepoint_item_id text,
  url_sharepoint text
);

CREATE TABLE IF NOT EXISTS public.bordereaux_brio (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code_comp text NOT NULL,
  producteur text NOT NULL,
  mois integer NOT NULL,
  annee integer NOT NULL DEFAULT 2026,
  encode_le timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bordereaux_sa (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sous_agent_id uuid NOT NULL,
  periode text NOT NULL,
  solde numeric(12,2) DEFAULT 0,
  debit numeric(12,2) DEFAULT 0,
  credit numeric(12,2) DEFAULT 0,
  statut text DEFAULT 'ouvert'::text,
  fichier_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'depense'::text,
  couleur text DEFAULT '#64748b'::text,
  created_at timestamp with time zone DEFAULT now(),
  societe text,
  entites text[],
  parent_id uuid
);

CREATE TABLE IF NOT EXISTS public.categories_regles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  motif text NOT NULL,
  categorie_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_donnees_plus (
  dossier text NOT NULL,
  iban text,
  iban_type text,
  numero_ci text,
  ci_valide_au date,
  permis_numero text,
  numero_bce text,
  numero_tva text,
  a_verifier boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'brio_export_2026-07-10'::text,
  imported_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_relations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dossier_a text NOT NULL,
  dossier_b text NOT NULL,
  type_relation text NOT NULL,
  label text,
  note text,
  created_by text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id bigint NOT NULL DEFAULT nextval('clients_id_seq'::regclass),
  dossier text,
  nom text NOT NULL,
  prenom text,
  rue text,
  num_maison text,
  boite text,
  cp text,
  localite text,
  date_naissance text,
  gsm text,
  tel_fixe text,
  email text,
  etat_civil text,
  sexe text,
  sa_code text,
  sa_nom text,
  gestionnaire_code text,
  gestionnaire_nom text,
  bureau text,
  classe text,
  alerte text,
  updated_at timestamp with time zone DEFAULT now(),
  gsm_e164 text GENERATED ALWAYS AS (normalize_be(gsm)) STORED,
  telfixe_e164 text GENERATED ALWAYS AS (normalize_be(tel_fixe)) STORED
);

CREATE TABLE IF NOT EXISTS public.clients_consultes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bureau text NOT NULL,
  dossier text NOT NULL,
  consultant_code text,
  nom text,
  prenom text,
  localite text,
  consulte_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collaborateur_taux (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collaborateur_id bigint NOT NULL,
  type_travail text NOT NULL,
  taux numeric,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.collaborateurs (
  id bigint NOT NULL DEFAULT nextval('collaborateurs_id_seq'::regclass),
  email text,
  code text,
  nom_complet text,
  bureau_id bigint,
  est_commercial boolean NOT NULL DEFAULT false,
  est_gestionnaire boolean NOT NULL DEFAULT false,
  est_sous_agent boolean NOT NULL DEFAULT false,
  est_apporteur boolean NOT NULL DEFAULT false,
  est_admin boolean NOT NULL DEFAULT false,
  nom_sa_data text,
  nom_gestionnaire_data text,
  portefeuille_id bigint,
  taux_commission numeric(5,2),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  noms_repris text[],
  numero integer,
  type text,
  iban text,
  bic text,
  telephone text,
  adresse text,
  code_postal text,
  ville text,
  bce text,
  frais_annuels numeric,
  regroupe_code text
);

CREATE TABLE IF NOT EXISTS public.compagnies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  nom text NOT NULL,
  nom_court text,
  logo_url text,
  couleur text DEFAULT '#1A3A6B'::text,
  site_web text,
  email_contact text,
  telephone text,
  actif boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  numero text,
  attend_bqt boolean NOT NULL DEFAULT true,
  attend_rcp boolean NOT NULL DEFAULT true,
  comm_pattern text
);

CREATE TABLE IF NOT EXISTS public.comptes_bancaires (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  societe_id uuid,
  banque text NOT NULL,
  libelle text,
  iban text NOT NULL,
  bic text,
  devise text DEFAULT 'EUR'::text,
  solde_actuel numeric(14,2) DEFAULT 0,
  date_synchro timestamp with time zone,
  ponto_account_id text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  "ENTITE" text
);

CREATE TABLE IF NOT EXISTS public.config_secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.connexions_log (
  id bigint NOT NULL DEFAULT nextval('connexions_log_id_seq'::regclass),
  user_email text,
  connecte_a timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contrats (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dossier text,
  nom_sa text,
  sa_code text,
  nb_delegues_commerciaux integer,
  nom_client text,
  prenom_client text,
  date_naissance text,
  code_postal text,
  localite text,
  compagnie text,
  police text,
  situation text,
  date_creation date,
  domaine text,
  version text,
  type_production text,
  garantie_valeur numeric,
  nb_conditions_generales integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  police_unique text,
  etat_contrat text,
  motif_etat text,
  gestionnaire text,
  date_etat date,
  annee_etat text
);

CREATE TABLE IF NOT EXISTS public.credits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contrat_id bigint,
  police text,
  type_credit text,
  organisme text,
  capital_initial numeric,
  taux_actuel numeric,
  type_taux text DEFAULT 'fixe'::text,
  date_debut date,
  duree_mois integer,
  mensualite_actuelle numeric,
  notes text,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  taux_depart numeric,
  mensualite_depart numeric,
  date_prochaine_revision date,
  mensualite_revisee numeric
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  societe_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  nom_fichier text NOT NULL,
  url text NOT NULL,
  type_mime text,
  taille_octets integer,
  uploade_par uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dtx_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'particulier'::text,
  numero_bce text,
  denomination text,
  forme_juridique text,
  nom text,
  prenom text,
  adresse text,
  cp text,
  ville text,
  pays text DEFAULT 'Belgique'::text,
  tva text,
  email text,
  telephone text,
  gsm text,
  notes text,
  peppol_id text,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  langue text DEFAULT 'fr'::text
);

CREATE TABLE IF NOT EXISTS public.dtx_devis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  date_devis date DEFAULT CURRENT_DATE,
  date_validite date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text,
  accept_token uuid DEFAULT gen_random_uuid(),
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  accepted_at timestamp with time zone,
  refused_at timestamp with time zone,
  relance_at timestamp with time zone,
  relance_sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.dtx_devis_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  type text NOT NULL,
  detail text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dtx_devis_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.dtx_factures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  devis_id uuid,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  montant_paye numeric(12,2) DEFAULT 0,
  date_facture date DEFAULT CURRENT_DATE,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text
);

CREATE TABLE IF NOT EXISTS public.dtx_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.dyn_devis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  date_devis date DEFAULT CURRENT_DATE,
  date_validite date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text,
  accept_token uuid DEFAULT gen_random_uuid(),
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  accepted_at timestamp with time zone,
  refused_at timestamp with time zone,
  relance_at timestamp with time zone,
  relance_sent_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.dyn_devis_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  type text NOT NULL,
  detail text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dyn_devis_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.dyn_devoir_info (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  client_id bigint,
  dossier text NOT NULL,
  police text,
  compagnie text,
  domaine text,
  produit text,
  conseil text NOT NULL,
  suit_conseil boolean,
  garanties_souscrites text[] NOT NULL DEFAULT '{}'::text[],
  garanties_refusees text[] NOT NULL DEFAULT '{}'::text[],
  motivation text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  pdf_path text,
  lieu text,
  signe_le timestamp with time zone NOT NULL DEFAULT now(),
  collaborateur_code text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dyn_factures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  devis_id uuid,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  montant_paye numeric(12,2) DEFAULT 0,
  date_facture date DEFAULT CURRENT_DATE,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text
);

CREATE TABLE IF NOT EXISTS public.dyn_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.factures (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  societe_id uuid NOT NULL,
  client_id uuid,
  numero text NOT NULL,
  type text DEFAULT 'honoraires'::text,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  date_paiement date,
  montant_htva numeric(12,2) NOT NULL,
  taux_tva numeric(5,2) DEFAULT 0,
  montant_tva numeric(12,2) GENERATED ALWAYS AS (((montant_htva * taux_tva) / (100)::numeric)) STORED,
  montant_ttc numeric(12,2) GENERATED ALWAYS AS ((montant_htva * ((1)::numeric + (taux_tva / (100)::numeric)))) STORED,
  statut text DEFAULT 'brouillon'::text,
  iban_destinataire text,
  description text,
  fichier_pdf_url text,
  cree_par_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.factures_achat (
  id bigint NOT NULL DEFAULT nextval('factures_fournisseurs_id_seq'::regclass),
  fichier_id text NOT NULL,
  nom text,
  societe text,
  montant numeric,
  date_facture date,
  url text,
  chemin text,
  thumb_url text,
  transaction_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sens text NOT NULL DEFAULT 'achat'::text,
  lode_devis_id uuid,
  tva_taux numeric DEFAULT 21
);

CREATE TABLE IF NOT EXISTS public.famille (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero_brio text NOT NULL,
  dossier text,
  nom_principal text,
  prenom_principal text,
  type_relation_valeur text,
  type_relation_libelle text,
  date_modification date,
  date_creation date,
  relation_active boolean DEFAULT true,
  date_fin_relation date,
  physique_morale_valeur text,
  physique_morale_libelle text,
  nom_lie text,
  prenom_lie text,
  clef_recherche text,
  rue_lie text,
  num_rue_lie text,
  boite_lie text,
  cp_lie text,
  localite_lie text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  membre_id uuid NOT NULL,
  annee integer NOT NULL,
  numero text NOT NULL,
  date_facture date,
  statut text NOT NULL DEFAULT 'a_envoyer'::text,
  date_envoi date,
  date_paiement date,
  total numeric(12,2) NOT NULL DEFAULT 0,
  transaction_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  objet text
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  periodicite text NOT NULL DEFAULT 'annuelle'::text,
  generation_auto boolean NOT NULL DEFAULT true,
  generation_mois integer NOT NULL DEFAULT 9,
  generation_jour integer NOT NULL DEFAULT 1,
  delai_paiement_jours integer NOT NULL DEFAULT 30,
  rappel_auto boolean NOT NULL DEFAULT true,
  rappels_jours integer[] NOT NULL DEFAULT '{15,30}'::integer[],
  rappel_max integer NOT NULL DEFAULT 2,
  rappel_envoie_email boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  taux_interet_annuel numeric(6,2) NOT NULL DEFAULT 10.5,
  indemnite_forfaitaire numeric(12,2) NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotisation_id uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  libelle text,
  quantite numeric(12,2) NOT NULL DEFAULT 1,
  prix_unitaire numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS ((quantite * prix_unitaire)) STORED
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations_rappels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotisation_id uuid NOT NULL,
  date_rappel date NOT NULL DEFAULT CURRENT_DATE,
  canal text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  niveau text NOT NULL DEFAULT 'simple'::text,
  frais numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.hex_membres (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  contact text,
  societe text,
  numero_bce text,
  adresse text,
  cp text,
  ville text,
  email text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hexagroup_votes (
  voter_key text NOT NULL,
  voter_name text NOT NULL,
  place_id text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.imports_brio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  date_import date NOT NULL,
  fichier_source text,
  nb_clients integer DEFAULT 0,
  nb_polices integer DEFAULT 0,
  nb_nouveaux integer DEFAULT 0,
  nb_modifies integer DEFAULT 0,
  nb_erreurs integer DEFAULT 0,
  statut text DEFAULT 'succes'::text,
  log_details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurer_actual_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  insurer text NOT NULL,
  period text NOT NULL,
  period_type text NOT NULL,
  period_number integer,
  branch text,
  product text,
  primes_emises numeric DEFAULT 0,
  primes_acquises numeric DEFAULT 0,
  sinistres numeric DEFAULT 0,
  commissions_emises numeric DEFAULT 0,
  commissions_acquises numeric DEFAULT 0,
  sp_ratio numeric GENERATED ALWAYS AS (
CASE
    WHEN (primes_acquises > (0)::numeric) THEN round(((sinistres / primes_acquises) * (100)::numeric), 2)
    ELSE NULL::numeric
END) STORED,
  points_miles numeric DEFAULT 0,
  partnership_level text,
  bonus_calculated numeric DEFAULT 0,
  source_file text,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insurer_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  insurer text NOT NULL,
  rule_type text NOT NULL,
  branch text,
  product text,
  level text,
  threshold_min numeric,
  threshold_max numeric,
  threshold_unit text,
  rate numeric,
  rate_type text,
  sp_reference numeric,
  sp_threshold_low numeric,
  sp_threshold_high numeric,
  notes text,
  source_file text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  categorie text NOT NULL,
  compagnie_id uuid,
  titre text NOT NULL,
  contenu text NOT NULL,
  resume text,
  tags text[],
  embedding vector(1536),
  cree_par uuid,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.liens_casses_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  declencheur text NOT NULL DEFAULT 'auto'::text,
  nb_supprimes integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.liens_preneurs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dossier_a text NOT NULL,
  dossier_b text NOT NULL,
  type_lien text,
  cree_par text,
  cree_le timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lode_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'particulier'::text,
  numero_bce text,
  denomination text,
  forme_juridique text,
  nom text,
  prenom text,
  adresse text,
  cp text,
  ville text,
  pays text DEFAULT 'Belgique'::text,
  tva text,
  email text,
  telephone text,
  gsm text,
  notes text,
  peppol_id text,
  actif boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  langue text DEFAULT 'fr'::text
);

CREATE TABLE IF NOT EXISTS public.lode_devis (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  date_devis date DEFAULT CURRENT_DATE,
  date_validite date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text,
  accept_token uuid DEFAULT gen_random_uuid(),
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  accepted_at timestamp with time zone,
  refused_at timestamp with time zone,
  relance_at timestamp with time zone,
  relance_sent_at timestamp with time zone,
  responsable text
);

CREATE TABLE IF NOT EXISTS public.lode_devis_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  type text NOT NULL,
  detail text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lode_devis_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  devis_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0,
  titre text,
  descriptif text,
  photos jsonb DEFAULT '[]'::jsonb,
  optionnelle boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.lode_factures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  devis_id uuid,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  client_nom text NOT NULL,
  client_adresse text,
  client_cp text,
  client_ville text,
  client_email text,
  client_telephone text,
  client_tva text,
  objet text,
  notes text,
  remise_pct numeric(5,2) DEFAULT 0,
  total_ht numeric(12,2) DEFAULT 0,
  total_tva numeric(12,2) DEFAULT 0,
  total_ttc numeric(12,2) DEFAULT 0,
  montant_paye numeric(12,2) DEFAULT 0,
  date_facture date DEFAULT CURRENT_DATE,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text,
  type text NOT NULL DEFAULT 'facture'::text,
  facture_origine_id uuid,
  total_projet_ttc numeric,
  billit_order_id text,
  billit_statut text,
  responsable text,
  pdf_fid text,
  pdf_url text
);

CREATE TABLE IF NOT EXISTS public.lode_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  "position" integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire numeric(12,2) DEFAULT 0,
  remise_pct numeric(5,2) DEFAULT 0,
  tva_pct numeric(5,2) DEFAULT 21,
  total_ht numeric(12,2) DEFAULT 0,
  titre text,
  descriptif text,
  photos jsonb DEFAULT '[]'::jsonb,
  optionnelle boolean DEFAULT false,
  tva_categorie text NOT NULL DEFAULT 'S'::text
);

CREATE TABLE IF NOT EXISTS public.mouvements_production (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  date_mouvement date NOT NULL,
  annee smallint GENERATED ALWAYS AS ((EXTRACT(year FROM date_mouvement))::smallint) STORED,
  mois smallint GENERATED ALWAYS AS ((EXTRACT(month FROM date_mouvement))::smallint) STORED,
  type_prod text,
  cie text,
  nom_client text,
  prenom_client text,
  type_police text,
  police text,
  sa_contrat text,
  sa_preneur text,
  delegue_contrat text,
  gestionnaire text,
  bce text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes_frais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  societe text NOT NULL,
  auteur_email text NOT NULL,
  auteur_code text,
  auteur_nom text,
  titre text,
  periode text,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  total numeric(12,2) NOT NULL DEFAULT 0,
  total_ht numeric(12,2) NOT NULL DEFAULT 0,
  total_tva numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  validee_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  numero text,
  piece_pdf_path text,
  facture_achat_id bigint,
  benef_iban text,
  benef_nom text,
  soumise_at timestamp with time zone,
  sig_type text,
  sig_image text,
  sig_ref text,
  sig_at timestamp with time zone,
  sig_nom text,
  sig_email text,
  valide_par text,
  valide_par_nom text,
  refus_motif text,
  refus_at timestamp with time zone,
  refus_par text
);

CREATE TABLE IF NOT EXISTS public.notes_frais_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  date date,
  categorie text,
  description text,
  est_km boolean NOT NULL DEFAULT false,
  montant_ttc numeric(12,2) NOT NULL DEFAULT 0,
  taux_tva numeric(5,2) NOT NULL DEFAULT 0,
  montant_ht numeric(12,2) NOT NULL DEFAULT 0,
  montant_tva numeric(12,2) NOT NULL DEFAULT 0,
  km_distance numeric(10,2),
  km_taux numeric(6,4),
  justificatif_path text,
  justificatif_nom text,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  justificatif_fichier_id text
);

CREATE TABLE IF NOT EXISTS public.objectifs_2026 (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collaborateur_code text NOT NULL,
  categorie text NOT NULL,
  taux_retention_dynassur numeric(5,2),
  obj_na_iard integer,
  obj_na_vie integer,
  obj_na_sante integer,
  obj_na_total integer,
  obj_prime_vie numeric(12,2),
  obj_com_nette_iard numeric(12,2),
  obj_com_nette_vie numeric(12,2),
  obj_com_nette_sante numeric(12,2),
  obj_com_nette_total numeric(12,2),
  obj_taux_retention numeric(5,2),
  base_retention_2025 numeric(5,2),
  bonus_palier1_seuil numeric(12,2),
  bonus_palier1_pct numeric(5,2),
  bonus_palier2_seuil numeric(12,2),
  bonus_palier2_pct numeric(5,2),
  bonus_palier3_seuil numeric(12,2),
  bonus_palier3_pct numeric(5,2),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_annuels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  annee integer NOT NULL,
  collab_code text,
  type_prod text NOT NULL DEFAULT 'NA'::text,
  cible_annuelle integer NOT NULL,
  mois_actifs integer[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}'::integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_cibles (
  id bigint NOT NULL DEFAULT nextval('objectifs_cibles_id_seq'::regclass),
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric(12,2),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_realises (
  id bigint NOT NULL DEFAULT nextval('objectifs_realises_id_seq'::regclass),
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric(12,2),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectives_global (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  period_type text NOT NULL DEFAULT 'year'::text,
  period_number integer,
  scope text NOT NULL DEFAULT 'global'::text,
  agent_code text,
  target_na integer DEFAULT 0,
  target_mandat_fav integer DEFAULT 0,
  target_primes numeric DEFAULT 0,
  target_commissions numeric DEFAULT 0,
  actual_na integer DEFAULT 0,
  actual_mandat_fav integer DEFAULT 0,
  actual_primes numeric DEFAULT 0,
  actual_commissions numeric DEFAULT 0,
  pct_na numeric GENERATED ALWAYS AS (
CASE
    WHEN (target_na > 0) THEN round((((actual_na)::numeric / (target_na)::numeric) * (100)::numeric), 1)
    ELSE NULL::numeric
END) STORED,
  pct_primes numeric GENERATED ALWAYS AS (
CASE
    WHEN (target_primes > (0)::numeric) THEN round(((actual_primes / target_primes) * (100)::numeric), 1)
    ELSE NULL::numeric
END) STORED,
  pct_commissions numeric GENERATED ALWAYS AS (
CASE
    WHEN (target_commissions > (0)::numeric) THEN round(((actual_commissions / target_commissions) * (100)::numeric), 1)
    ELSE NULL::numeric
END) STORED,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objets_risque (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dossier text,
  police text,
  compagnie text,
  domaine text,
  type_risque text,
  garantie text,
  description text,
  version text,
  situation text,
  etat_contrat text,
  gestionnaire text,
  sous_agent text,
  date_effet date,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.parametres_frais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cle text NOT NULL,
  libelle text,
  valeur numeric NOT NULL,
  unite text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.parentes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  groupe_id text,
  groupe_nom text,
  groupe_type text,
  membre_nom text,
  dossier_principal text,
  nb_polices numeric,
  prime_totale numeric,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.polices (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  societe_id uuid NOT NULL,
  client_id uuid NOT NULL,
  compagnie_id uuid NOT NULL,
  gestionnaire_id uuid,
  sous_agent_id uuid,
  sa_preneur_id uuid,
  numero_police text NOT NULL,
  type_police text,
  domaine text DEFAULT 'IARD'::text,
  situation text DEFAULT 'actuelle'::text,
  version text,
  date_effet date,
  date_echeance date,
  prime_ttc numeric(12,2),
  prime_htva numeric(12,2),
  taux_commission numeric(5,2),
  commission_montant numeric(12,2) GENERATED ALWAYS AS (((prime_htva * taux_commission) / (100)::numeric)) STORED,
  type_prod text,
  date_prod date,
  notes text,
  date_import_brio date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.producteurs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  compagnie_nom text NOT NULL,
  fsma text,
  numero_producteur text NOT NULL,
  telephone text,
  code_postal text,
  ville text,
  created_at timestamp with time zone DEFAULT now(),
  compagnie_id uuid,
  statut text NOT NULL DEFAULT 'actif'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profils_investisseur (
  id bigint NOT NULL DEFAULT nextval('profils_investisseur_id_seq'::regclass),
  client_id bigint,
  contrat_id bigint,
  dossier text,
  nom_client text,
  profil text NOT NULL,
  score integer NOT NULL,
  answers jsonb,
  funds jsonb,
  horizon_years numeric,
  purpose text,
  pdf_url text,
  source text DEFAULT 'generated'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quittances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  gestionnaire text,
  domaine text,
  fsma text,
  compte_producteur text,
  compagnie text,
  police text,
  client_nom text,
  client_prenom text,
  localite text,
  type_quittance text,
  prime_totale numeric(12,2),
  commission numeric(12,2),
  commission_sa numeric(12,2),
  date_comptable date,
  etat text,
  type_production text,
  sous_agent text,
  periodicite text,
  dossier text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdv (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  outlook_event_id text,
  user_email text,
  web_link text,
  objet text NOT NULL,
  description text,
  lieu text,
  debut timestamp with time zone NOT NULL,
  fin timestamp with time zone,
  journee_entiere boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  statut text DEFAULT 'planifie'::text,
  categorie text,
  dossier_client text,
  client_id bigint,
  commercial_code text,
  gestionnaire_code text,
  organisateur_email text,
  participants jsonb,
  tache_suivi_id bigint,
  societe_id uuid,
  source text DEFAULT 'outlook'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rdv_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  libelle text NOT NULL,
  entite text,
  type text,
  couleur text DEFAULT '#0080BD'::text,
  sync_enabled boolean NOT NULL DEFAULT true,
  actif boolean NOT NULL DEFAULT true,
  ordre integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_apporteurs (
  id bigint NOT NULL DEFAULT nextval('ref_apporteurs_id_seq'::regclass),
  code text,
  nom text NOT NULL,
  taux_commission numeric(5,2),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_bureaux (
  id bigint NOT NULL DEFAULT nextval('ref_bureaux_id_seq'::regclass),
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_gestionnaires (
  id bigint NOT NULL DEFAULT nextval('ref_gestionnaires_id_seq'::regclass),
  code text,
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pour_le_compte_de text,
  note text
);

CREATE TABLE IF NOT EXISTS public.ref_portefeuilles (
  id bigint NOT NULL DEFAULT nextval('ref_portefeuilles_id_seq'::regclass),
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ref_sous_agents (
  id bigint NOT NULL DEFAULT nextval('ref_sous_agents_id_seq'::regclass),
  code text,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'sous_agent'::text,
  taux_commission numeric(5,2),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.risques (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  police text NOT NULL,
  actif boolean DEFAULT true,
  visible_mybroker boolean DEFAULT false,
  contrats_lies boolean DEFAULT false,
  total_contrats_en_cours integer DEFAULT 0,
  type_risque_valeur text,
  type_risque_libelle text,
  description text,
  date_creation date,
  created_by text,
  date_modification date,
  modified_by text,
  date_desactivation date,
  desactive_by text,
  gestionnaire text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.segmentation (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  dossier text,
  groupe_id text,
  groupe_nom text,
  segment text,
  nb_polices numeric,
  prime_totale numeric,
  commission_totale numeric,
  nb_sinistres numeric,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sinistre_paiements (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  reference_sinistre text,
  dossier text,
  beneficiaire_nom text,
  beneficiaire_prenom text,
  police text,
  type_risque text,
  description text,
  garantie text,
  montant numeric,
  etat_paiement text,
  date_paiement date,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sinistre_workflow_definitions (
  id text NOT NULL,
  garantie text NOT NULL,
  step_order integer NOT NULL,
  titre text NOT NULL,
  description text,
  documents text,
  pieges text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sinistre_workflow_progress (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  pointeur_sinistre text NOT NULL,
  step_id text NOT NULL,
  checked boolean DEFAULT true,
  checked_by text,
  checked_at timestamp with time zone DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS public.sinistres (
  pointeur_sinistre text NOT NULL,
  reference_sinistre text,
  reference_producteur text,
  police_objet_lien text,
  date_survenance date,
  date_ouverture date,
  date_etat date,
  etat text,
  etat_code text,
  responsabilite text,
  domaine text,
  garantie text,
  gestionnaire text,
  sinistre_nom text,
  description text,
  montant_a_payer numeric DEFAULT 0,
  montant_paye numeric DEFAULT 0,
  montant_attente numeric DEFAULT 0,
  montant_reserve numeric DEFAULT 0,
  montant_recours numeric DEFAULT 0,
  annee integer,
  source text DEFAULT 'qlik_brio'::text,
  imported_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.societes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL,
  nom text NOT NULL,
  bce text,
  tva text,
  adresse text,
  forme_juridique text,
  date_creation date,
  fsma text,
  iban_principal text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  couleur text,
  logo_url text,
  entite_key text,
  activite text,
  cp text,
  ville text,
  pays text DEFAULT 'Belgique'::text,
  bic text,
  telephone text,
  email_expediteur text,
  email_cc text,
  cgv text,
  delai_paiement_jours integer DEFAULT 30,
  tva_taux_defaut integer DEFAULT 21
);

CREATE TABLE IF NOT EXISTS public.sous_agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  societe_id uuid NOT NULL,
  numero integer,
  code text NOT NULL,
  nom text NOT NULL,
  prenom text,
  type text DEFAULT 'physique'::text,
  bce text,
  email text,
  telephone text,
  iban text,
  taux_commission numeric(5,2),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.succession_simulations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  nom text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow text NOT NULL,
  statut text NOT NULL,
  comptes_synchro integer DEFAULT 0,
  transactions_synchro integer DEFAULT 0,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taches (
  id bigint NOT NULL DEFAULT nextval('taches_id_seq'::regclass),
  titre text NOT NULL,
  priorite text DEFAULT 'moyenne'::text,
  gestionnaire text,
  echeance date,
  statut text DEFAULT 'todo'::text,
  categorie text,
  created_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'manuel'::text,
  code_type text,
  email_objet text,
  email_de text,
  client_id bigint,
  description text,
  assigne_par text,
  assigne_a text,
  updated_at timestamp with time zone DEFAULT now(),
  file_attente boolean DEFAULT false,
  lu_par text[],
  pieces_jointes text[],
  dossier_client text,
  societe_id uuid,
  assigned_by text,
  lien_url text,
  tags text[],
  user_email text,
  date_cloture timestamp with time zone,
  entite text,
  cree_par text,
  date_creation timestamp with time zone DEFAULT now(),
  sous_categories text[],
  is_ticket boolean DEFAULT false,
  ticket_categorie text,
  ticket_statut text DEFAULT 'nouveau'::text,
  ticket_origine text DEFAULT 'interne'::text,
  cloture_par text,
  derniere_activite timestamp with time zone DEFAULT now(),
  participants jsonb DEFAULT '[]'::jsonb,
  checklist jsonb DEFAULT '[]'::jsonb,
  ticket_echeance date
);

CREATE TABLE IF NOT EXISTS public.taches_historique (
  id bigint NOT NULL DEFAULT nextval('taches_historique_id_seq'::regclass),
  tache_id bigint,
  action text,
  par text,
  a timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taches_rapprochement (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  societe text,
  transaction_id uuid,
  montant numeric(12,2),
  date_operation date,
  libelle text,
  factures_candidates jsonb,
  statut text DEFAULT 'ouvert'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  categorie text
);

CREATE TABLE IF NOT EXISTS public.taches_suivi (
  id bigint NOT NULL DEFAULT nextval('taches_suivi_id_seq'::regclass),
  tache_id bigint,
  auteur text,
  note text,
  cree_a timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taux_reference (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categorie text NOT NULL,
  libelle text,
  taux numeric NOT NULL,
  source text DEFAULT 'BNB'::text,
  date_maj date DEFAULT now(),
  actif boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id integer NOT NULL DEFAULT nextval('ticket_categories_id_seq'::regclass),
  label text NOT NULL,
  ordre integer NOT NULL DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'gestion'::text
);

CREATE TABLE IF NOT EXISTS public.tickets_messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tache_id bigint NOT NULL,
  auteur_code text,
  auteur_nom text,
  auteur_email text,
  message text,
  type text DEFAULT 'message'::text,
  piece_jointe_path text,
  piece_jointe_nom text,
  lu_par jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  email_message_id text
);

CREATE TABLE IF NOT EXISTS public.tmp_manquant (
  rn integer NOT NULL,
  pol text,
  comp integer,
  sa text,
  a text,
  hidden integer,
  descr text,
  fill text
);

CREATE TABLE IF NOT EXISTS public.transaction_ventilation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  montant numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  employe_id uuid,
  facture_id bigint,
  categorie_id uuid,
  activite text
);
COMMENT ON TABLE public.transaction_ventilation IS 'Lignes de découpe d''une transaction : montant + catégorie + activité + facture. Somme des lignes = montant de la transaction. Absence de lignes = transaction non ventilée (catégorie/activité lues sur la transaction).';

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  compte_id uuid,
  ponto_transaction_id text NOT NULL,
  date_valeur date,
  date_execution date,
  montant numeric(15,2),
  devise text DEFAULT 'EUR'::text,
  contrepartie_nom text,
  contrepartie_iban text,
  information_paiement text,
  description text,
  type_transaction text,
  statut text DEFAULT 'importé'::text,
  facture_id uuid,
  rapproche boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  categorie_id uuid,
  facture_url text,
  facture_thumb_url text,
  sans_facture boolean DEFAULT false,
  en_attente_facture boolean NOT NULL DEFAULT false,
  employe_id uuid,
  activite text,
  responsable text
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  nom text NOT NULL,
  role text NOT NULL DEFAULT 'user'::text,
  actif boolean DEFAULT true,
  acc_holding boolean DEFAULT false,
  acc_dtx boolean DEFAULT false,
  acc_dynassur boolean DEFAULT false,
  acc_lode boolean DEFAULT false,
  dyn_dashboard boolean DEFAULT false,
  dyn_taches boolean DEFAULT false,
  dyn_clients boolean DEFAULT false,
  dyn_bordereaux boolean DEFAULT false,
  dyn_chiffres boolean DEFAULT false,
  dyn_production boolean DEFAULT false,
  dyn_objectifs boolean DEFAULT false,
  dyn_compagnies boolean DEFAULT false,
  dyn_banque boolean DEFAULT false,
  dyn_comptabilite boolean DEFAULT false,
  dtx_dashboard boolean DEFAULT false,
  dtx_immobilier boolean DEFAULT false,
  dtx_vehicules boolean DEFAULT false,
  dtx_trading boolean DEFAULT false,
  dtx_comptabilite boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  o365_only boolean DEFAULT true,
  o365_object_id text,
  o365_display_name text,
  last_login_at timestamp with time zone,
  lode_dashboard boolean DEFAULT false,
  lode_clients boolean DEFAULT false,
  lode_comptabilite boolean DEFAULT false,
  lode_banque boolean DEFAULT false,
  acc_hexagroup boolean DEFAULT false,
  dyn_sinistres boolean DEFAULT false,
  collab_code text,
  acc_prive boolean DEFAULT false,
  prive_dashboard boolean DEFAULT false,
  prive_banque boolean DEFAULT false,
  prive_comptabilite boolean DEFAULT false,
  hex_dashboard boolean DEFAULT false,
  hex_banque boolean DEFAULT false,
  hex_comptabilite boolean DEFAULT false,
  dyn_rdv boolean DEFAULT false,
  lode_devis boolean DEFAULT false,
  dtx_devis boolean DEFAULT false,
  dyn_devis boolean DEFAULT false,
  premiere_connexion timestamp with time zone,
  derniere_connexion timestamp with time zone,
  date_envoi_acces timestamp with time zone,
  voir_commissions boolean NOT NULL DEFAULT false,
  appel boolean NOT NULL DEFAULT false,
  dyn_appels boolean NOT NULL DEFAULT false,
  dyn_rentabilite boolean NOT NULL DEFAULT false,
  grp_taches boolean NOT NULL DEFAULT false,
  dtx_taches boolean NOT NULL DEFAULT false,
  lode_taches boolean NOT NULL DEFAULT false,
  hex_taches boolean NOT NULL DEFAULT false,
  prive_taches boolean NOT NULL DEFAULT false,
  grp_notesfrais boolean DEFAULT false,
  dyn_notesfrais boolean DEFAULT false,
  dtx_notesfrais boolean DEFAULT false,
  lode_notesfrais boolean DEFAULT false,
  hex_notesfrais boolean DEFAULT false,
  prive_notesfrais boolean DEFAULT false,
  iban text,
  dyn_credits boolean DEFAULT false,
  est_employe boolean NOT NULL DEFAULT false,
  hex_cotisations boolean NOT NULL DEFAULT false,
  hex_membres boolean NOT NULL DEFAULT false,
  acc_tools boolean NOT NULL DEFAULT true,
  prive_succession boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id uuid NOT NULL,
  societe_id uuid NOT NULL,
  code_brio text,
  code_prod text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'gestionnaire'::text,
  telephone text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================================
-- Séquences : propriété
-- ============================================================================
ALTER SEQUENCE public.bordereaux_id_seq OWNED BY public.bordereaux.id;
ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;
ALTER SEQUENCE public.collaborateurs_id_seq OWNED BY public.collaborateurs.id;
ALTER SEQUENCE public.connexions_log_id_seq OWNED BY public.connexions_log.id;
ALTER SEQUENCE public.factures_fournisseurs_id_seq OWNED BY public.factures_achat.id;
ALTER SEQUENCE public.objectifs_cibles_id_seq OWNED BY public.objectifs_cibles.id;
ALTER SEQUENCE public.objectifs_realises_id_seq OWNED BY public.objectifs_realises.id;
ALTER SEQUENCE public.profils_investisseur_id_seq OWNED BY public.profils_investisseur.id;
ALTER SEQUENCE public.ref_apporteurs_id_seq OWNED BY public.ref_apporteurs.id;
ALTER SEQUENCE public.ref_bureaux_id_seq OWNED BY public.ref_bureaux.id;
ALTER SEQUENCE public.ref_gestionnaires_id_seq OWNED BY public.ref_gestionnaires.id;
ALTER SEQUENCE public.ref_portefeuilles_id_seq OWNED BY public.ref_portefeuilles.id;
ALTER SEQUENCE public.ref_sous_agents_id_seq OWNED BY public.ref_sous_agents.id;
ALTER SEQUENCE public.taches_historique_id_seq OWNED BY public.taches_historique.id;
ALTER SEQUENCE public.taches_id_seq OWNED BY public.taches.id;
ALTER SEQUENCE public.taches_suivi_id_seq OWNED BY public.taches_suivi.id;
ALTER SEQUENCE public.ticket_categories_id_seq OWNED BY public.ticket_categories.id;

-- ============================================================================
-- Clés primaires, uniques, checks
-- ============================================================================
ALTER TABLE public.activites ADD CONSTRAINT activites_pkey PRIMARY KEY (id);
ALTER TABLE public.ag_starget_results ADD CONSTRAINT ag_starget_results_pkey PRIMARY KEY (id);
ALTER TABLE public.ag_technical_results ADD CONSTRAINT ag_technical_results_pkey PRIMARY KEY (id);
ALTER TABLE public.ag_vie_objectives ADD CONSTRAINT ag_vie_objectives_pkey PRIMARY KEY (id);
ALTER TABLE public.appels ADD CONSTRAINT appels_pkey PRIMARY KEY (id);
ALTER TABLE public.bordereaux ADD CONSTRAINT bordereaux_pkey PRIMARY KEY (id);
ALTER TABLE public.bordereaux_brio ADD CONSTRAINT bordereaux_brio_pkey PRIMARY KEY (id);
ALTER TABLE public.bordereaux_sa ADD CONSTRAINT bordereaux_sa_pkey PRIMARY KEY (id);
ALTER TABLE public.categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE public.categories_regles ADD CONSTRAINT categories_regles_pkey PRIMARY KEY (id);
ALTER TABLE public.client_donnees_plus ADD CONSTRAINT client_donnees_plus_pkey PRIMARY KEY (dossier);
ALTER TABLE public.client_relations ADD CONSTRAINT client_relations_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.clients_consultes ADD CONSTRAINT clients_consultes_pkey PRIMARY KEY (id);
ALTER TABLE public.collaborateur_taux ADD CONSTRAINT collaborateur_taux_pkey PRIMARY KEY (id);
ALTER TABLE public.collaborateurs ADD CONSTRAINT collaborateurs_pkey PRIMARY KEY (id);
ALTER TABLE public.compagnies ADD CONSTRAINT compagnies_pkey PRIMARY KEY (id);
ALTER TABLE public.comptes_bancaires ADD CONSTRAINT comptes_bancaires_pkey PRIMARY KEY (id);
ALTER TABLE public.config_secrets ADD CONSTRAINT config_secrets_pkey PRIMARY KEY (id);
ALTER TABLE public.connexions_log ADD CONSTRAINT connexions_log_pkey PRIMARY KEY (id);
ALTER TABLE public.contrats ADD CONSTRAINT contrats_pkey PRIMARY KEY (id);
ALTER TABLE public.credits ADD CONSTRAINT credits_pkey PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_clients ADD CONSTRAINT dtx_clients_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_devis ADD CONSTRAINT dtx_devis_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_devis_events ADD CONSTRAINT dtx_devis_events_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_devis_lignes ADD CONSTRAINT dtx_devis_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_factures ADD CONSTRAINT dtx_factures_pkey PRIMARY KEY (id);
ALTER TABLE public.dtx_factures_lignes ADD CONSTRAINT dtx_factures_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_devis ADD CONSTRAINT dyn_devis_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_devis_events ADD CONSTRAINT dyn_devis_events_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_devis_lignes ADD CONSTRAINT dyn_devis_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_devoir_info ADD CONSTRAINT dyn_devoir_info_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_factures ADD CONSTRAINT dyn_factures_pkey PRIMARY KEY (id);
ALTER TABLE public.dyn_factures_lignes ADD CONSTRAINT dyn_factures_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.factures ADD CONSTRAINT factures_pkey PRIMARY KEY (id);
ALTER TABLE public.factures_achat ADD CONSTRAINT factures_fournisseurs_pkey PRIMARY KEY (id);
ALTER TABLE public.famille ADD CONSTRAINT famille_pkey PRIMARY KEY (id);
ALTER TABLE public.hex_cotisations ADD CONSTRAINT hex_cotisations_pkey PRIMARY KEY (id);
ALTER TABLE public.hex_cotisations_config ADD CONSTRAINT hex_cotisations_config_pkey PRIMARY KEY (id);
ALTER TABLE public.hex_cotisations_lignes ADD CONSTRAINT hex_cotisations_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.hex_cotisations_rappels ADD CONSTRAINT hex_cotisations_rappels_pkey PRIMARY KEY (id);
ALTER TABLE public.hex_membres ADD CONSTRAINT hex_membres_pkey PRIMARY KEY (id);
ALTER TABLE public.hexagroup_votes ADD CONSTRAINT hexagroup_votes_pkey PRIMARY KEY (voter_key, place_id);
ALTER TABLE public.imports_brio ADD CONSTRAINT imports_brio_pkey PRIMARY KEY (id);
ALTER TABLE public.insurer_actual_results ADD CONSTRAINT insurer_actual_results_pkey PRIMARY KEY (id);
ALTER TABLE public.insurer_rules ADD CONSTRAINT insurer_rules_pkey PRIMARY KEY (id);
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_pkey PRIMARY KEY (id);
ALTER TABLE public.liens_casses_log ADD CONSTRAINT liens_casses_log_pkey PRIMARY KEY (id);
ALTER TABLE public.liens_preneurs ADD CONSTRAINT liens_preneurs_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_clients ADD CONSTRAINT lode_clients_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_devis ADD CONSTRAINT lode_devis_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_devis_events ADD CONSTRAINT lode_devis_events_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_devis_lignes ADD CONSTRAINT lode_devis_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_pkey PRIMARY KEY (id);
ALTER TABLE public.lode_factures_lignes ADD CONSTRAINT lode_factures_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.mouvements_production ADD CONSTRAINT mouvements_production_pkey PRIMARY KEY (id);
ALTER TABLE public.notes_frais ADD CONSTRAINT notes_frais_pkey PRIMARY KEY (id);
ALTER TABLE public.notes_frais_lignes ADD CONSTRAINT notes_frais_lignes_pkey PRIMARY KEY (id);
ALTER TABLE public.objectifs_2026 ADD CONSTRAINT objectifs_2026_pkey PRIMARY KEY (id);
ALTER TABLE public.objectifs_annuels ADD CONSTRAINT objectifs_annuels_pkey PRIMARY KEY (id);
ALTER TABLE public.objectifs_cibles ADD CONSTRAINT objectifs_cibles_pkey PRIMARY KEY (id);
ALTER TABLE public.objectifs_realises ADD CONSTRAINT objectifs_realises_pkey PRIMARY KEY (id);
ALTER TABLE public.objectives_global ADD CONSTRAINT objectives_global_pkey PRIMARY KEY (id);
ALTER TABLE public.objets_risque ADD CONSTRAINT objets_risque_pkey PRIMARY KEY (id);
ALTER TABLE public.parametres_frais ADD CONSTRAINT parametres_frais_pkey PRIMARY KEY (id);
ALTER TABLE public.parentes ADD CONSTRAINT parentes_pkey PRIMARY KEY (id);
ALTER TABLE public.polices ADD CONSTRAINT polices_pkey PRIMARY KEY (id);
ALTER TABLE public.producteurs ADD CONSTRAINT producteurs_pkey PRIMARY KEY (id);
ALTER TABLE public.profils_investisseur ADD CONSTRAINT profils_investisseur_pkey PRIMARY KEY (id);
ALTER TABLE public.quittances ADD CONSTRAINT quittances_pkey PRIMARY KEY (id);
ALTER TABLE public.rdv ADD CONSTRAINT rdv_pkey PRIMARY KEY (id);
ALTER TABLE public.rdv_categories ADD CONSTRAINT rdv_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_apporteurs ADD CONSTRAINT ref_apporteurs_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_bureaux ADD CONSTRAINT ref_bureaux_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_gestionnaires ADD CONSTRAINT ref_gestionnaires_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_portefeuilles ADD CONSTRAINT ref_portefeuilles_pkey PRIMARY KEY (id);
ALTER TABLE public.ref_sous_agents ADD CONSTRAINT ref_sous_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.risques ADD CONSTRAINT risques_pkey PRIMARY KEY (id);
ALTER TABLE public.segmentation ADD CONSTRAINT segmentation_pkey PRIMARY KEY (id);
ALTER TABLE public.sinistre_paiements ADD CONSTRAINT sinistre_paiements_pkey PRIMARY KEY (id);
ALTER TABLE public.sinistre_workflow_definitions ADD CONSTRAINT sinistre_workflow_definitions_pkey PRIMARY KEY (id);
ALTER TABLE public.sinistre_workflow_progress ADD CONSTRAINT sinistre_workflow_progress_pkey PRIMARY KEY (id);
ALTER TABLE public.sinistres ADD CONSTRAINT sinistres_pkey PRIMARY KEY (pointeur_sinistre);
ALTER TABLE public.societes ADD CONSTRAINT societes_pkey PRIMARY KEY (id);
ALTER TABLE public.sous_agents ADD CONSTRAINT sous_agents_pkey PRIMARY KEY (id);
ALTER TABLE public.succession_simulations ADD CONSTRAINT succession_simulations_pkey PRIMARY KEY (id);
ALTER TABLE public.sync_log ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id);
ALTER TABLE public.taches ADD CONSTRAINT taches_pkey PRIMARY KEY (id);
ALTER TABLE public.taches_historique ADD CONSTRAINT taches_historique_pkey PRIMARY KEY (id);
ALTER TABLE public.taches_rapprochement ADD CONSTRAINT taches_rapprochement_pkey PRIMARY KEY (id);
ALTER TABLE public.taches_suivi ADD CONSTRAINT taches_suivi_pkey PRIMARY KEY (id);
ALTER TABLE public.taux_reference ADD CONSTRAINT taux_reference_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.tickets_messages ADD CONSTRAINT tickets_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.tmp_manquant ADD CONSTRAINT tmp_manquant_pkey PRIMARY KEY (rn);
ALTER TABLE public.transaction_ventilation ADD CONSTRAINT transaction_ventilation_pkey PRIMARY KEY (id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.utilisateurs ADD CONSTRAINT utilisateurs_pkey PRIMARY KEY (id);
ALTER TABLE public.activites ADD CONSTRAINT activites_societe_code_code_key UNIQUE (societe_code, code);
ALTER TABLE public.ag_starget_results ADD CONSTRAINT ag_starget_results_year_week_number_key UNIQUE (year, week_number);
ALTER TABLE public.ag_vie_objectives ADD CONSTRAINT ag_vie_objectives_year_tranche_key UNIQUE (year, tranche);
ALTER TABLE public.bordereaux ADD CONSTRAINT bordereaux_cle_unique_key UNIQUE (cle_unique);
ALTER TABLE public.bordereaux_brio ADD CONSTRAINT bordereaux_brio_code_comp_producteur_mois_annee_key UNIQUE (code_comp, producteur, mois, annee);
ALTER TABLE public.bordereaux_sa ADD CONSTRAINT bordereaux_sa_sous_agent_id_periode_key UNIQUE (sous_agent_id, periode);
ALTER TABLE public.client_relations ADD CONSTRAINT uk_relation UNIQUE (dossier_a, dossier_b);
ALTER TABLE public.clients ADD CONSTRAINT clients_dossier_key UNIQUE (dossier);
ALTER TABLE public.clients_consultes ADD CONSTRAINT clients_consultes_code_dossier_key UNIQUE (consultant_code, dossier);
ALTER TABLE public.collaborateur_taux ADD CONSTRAINT collaborateur_taux_collaborateur_id_type_travail_key UNIQUE (collaborateur_id, type_travail);
ALTER TABLE public.collaborateurs ADD CONSTRAINT collaborateurs_email_key UNIQUE (email);
ALTER TABLE public.compagnies ADD CONSTRAINT compagnies_code_key UNIQUE (code);
ALTER TABLE public.comptes_bancaires ADD CONSTRAINT comptes_bancaires_iban_key UNIQUE (iban);
ALTER TABLE public.config_secrets ADD CONSTRAINT config_secrets_key_key UNIQUE (key);
ALTER TABLE public.dtx_devis ADD CONSTRAINT dtx_devis_numero_key UNIQUE (numero);
ALTER TABLE public.dtx_factures ADD CONSTRAINT dtx_factures_numero_key UNIQUE (numero);
ALTER TABLE public.dyn_devis ADD CONSTRAINT dyn_devis_numero_key UNIQUE (numero);
ALTER TABLE public.dyn_factures ADD CONSTRAINT dyn_factures_numero_key UNIQUE (numero);
ALTER TABLE public.factures ADD CONSTRAINT factures_societe_id_numero_key UNIQUE (societe_id, numero);
ALTER TABLE public.factures_achat ADD CONSTRAINT factures_fournisseurs_fichier_id_key UNIQUE (fichier_id);
ALTER TABLE public.famille ADD CONSTRAINT uk_famille_brio UNIQUE (numero_brio);
ALTER TABLE public.hex_cotisations ADD CONSTRAINT hex_cotisations_annee_numero_key UNIQUE (annee, numero);
ALTER TABLE public.lode_devis ADD CONSTRAINT lode_devis_numero_key UNIQUE (numero);
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_numero_key UNIQUE (numero);
ALTER TABLE public.objectifs_annuels ADD CONSTRAINT objectifs_annuels_annee_collab_code_type_prod_key UNIQUE (annee, collab_code, type_prod);
ALTER TABLE public.objectifs_cibles ADD CONSTRAINT objectifs_cibles_commercial_code_indicateur_periode_type_pe_key UNIQUE (commercial_code, indicateur, periode_type, periode_key);
ALTER TABLE public.objectifs_realises ADD CONSTRAINT objectifs_realises_commercial_code_indicateur_periode_type__key UNIQUE (commercial_code, indicateur, periode_type, periode_key);
ALTER TABLE public.objectives_global ADD CONSTRAINT objectives_global_year_period_type_period_number_scope_agen_key UNIQUE (year, period_type, period_number, scope, agent_code);
ALTER TABLE public.parametres_frais ADD CONSTRAINT parametres_frais_cle_key UNIQUE (cle);
ALTER TABLE public.producteurs ADD CONSTRAINT producteurs_compagnie_nom_numero_producteur_key UNIQUE (compagnie_nom, numero_producteur);
ALTER TABLE public.rdv ADD CONSTRAINT rdv_outlook_event_id_key UNIQUE (outlook_event_id);
ALTER TABLE public.rdv_categories ADD CONSTRAINT rdv_categories_code_key UNIQUE (code);
ALTER TABLE public.ref_apporteurs ADD CONSTRAINT ref_apporteurs_code_key UNIQUE (code);
ALTER TABLE public.ref_apporteurs ADD CONSTRAINT ref_apporteurs_nom_key UNIQUE (nom);
ALTER TABLE public.ref_bureaux ADD CONSTRAINT ref_bureaux_libelle_key UNIQUE (libelle);
ALTER TABLE public.ref_gestionnaires ADD CONSTRAINT ref_gestionnaires_code_key UNIQUE (code);
ALTER TABLE public.ref_gestionnaires ADD CONSTRAINT ref_gestionnaires_nom_key UNIQUE (nom);
ALTER TABLE public.ref_portefeuilles ADD CONSTRAINT ref_portefeuilles_libelle_key UNIQUE (libelle);
ALTER TABLE public.ref_sous_agents ADD CONSTRAINT ref_sous_agents_code_key UNIQUE (code);
ALTER TABLE public.ref_sous_agents ADD CONSTRAINT ref_sous_agents_nom_key UNIQUE (nom);
ALTER TABLE public.risques ADD CONSTRAINT uk_risque_police UNIQUE (police);
ALTER TABLE public.sinistre_workflow_progress ADD CONSTRAINT sinistre_workflow_progress_pointeur_sinistre_step_id_key UNIQUE (pointeur_sinistre, step_id);
ALTER TABLE public.societes ADD CONSTRAINT societes_code_key UNIQUE (code);
ALTER TABLE public.sous_agents ADD CONSTRAINT sous_agents_code_key UNIQUE (code);
ALTER TABLE public.ticket_categories ADD CONSTRAINT ticket_categories_label_key UNIQUE (label);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_ponto_transaction_id_key UNIQUE (ponto_transaction_id);
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_user_email_key UNIQUE (user_email);
ALTER TABLE public.utilisateurs ADD CONSTRAINT utilisateurs_email_key UNIQUE (email);
ALTER TABLE public.client_relations ADD CONSTRAINT client_relations_type_relation_check CHECK ((type_relation = ANY (ARRAY['conjoint'::text, 'enfant'::text, 'parent'::text, 'fratrie'::text, 'entreprise'::text, 'apporteur'::text, 'autre'::text])));
ALTER TABLE public.dtx_clients ADD CONSTRAINT lode_clients_type_check CHECK ((type = ANY (ARRAY['particulier'::text, 'entreprise'::text])));
ALTER TABLE public.dtx_devis ADD CONSTRAINT lode_devis_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyé'::text, 'accepté'::text, 'refusé'::text, 'expiré'::text])));
ALTER TABLE public.dtx_factures ADD CONSTRAINT lode_factures_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyée'::text, 'payée'::text, 'partiellement payée'::text, 'en retard'::text, 'annulée'::text])));
ALTER TABLE public.dyn_devis ADD CONSTRAINT lode_devis_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyé'::text, 'accepté'::text, 'refusé'::text, 'expiré'::text])));
ALTER TABLE public.dyn_devoir_info ADD CONSTRAINT dyn_devoir_info_conseil_check CHECK ((conseil = ANY (ARRAY['A'::text, 'B'::text])));
ALTER TABLE public.dyn_factures ADD CONSTRAINT lode_factures_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyée'::text, 'payée'::text, 'partiellement payée'::text, 'en retard'::text, 'annulée'::text])));
ALTER TABLE public.factures ADD CONSTRAINT statut_fact CHECK ((statut = ANY (ARRAY['brouillon'::text, 'emise'::text, 'payee'::text, 'retard'::text, 'annulee'::text])));
ALTER TABLE public.hexagroup_votes ADD CONSTRAINT hexagroup_votes_place_id_check CHECK ((place_id = ANY (ARRAY['einruhr'::text, 'quinquin'::text, 'clarance'::text, 'mouton'::text, 'osthouse'::text, 'palange'::text, 'eifelwelt'::text, 'suedeifel'::text, 'regina'::text, 'domainecour'::text])));
ALTER TABLE public.hexagroup_votes ADD CONSTRAINT hexagroup_votes_voter_name_check CHECK (((char_length(voter_name) >= 1) AND (char_length(voter_name) <= 40)));
ALTER TABLE public.lode_clients ADD CONSTRAINT lode_clients_type_check CHECK ((type = ANY (ARRAY['particulier'::text, 'entreprise'::text])));
ALTER TABLE public.lode_devis ADD CONSTRAINT lode_devis_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyé'::text, 'accepté'::text, 'refusé'::text, 'expiré'::text])));
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_statut_check CHECK ((statut = ANY (ARRAY['brouillon'::text, 'envoyée'::text, 'payée'::text, 'partiellement payée'::text, 'en retard'::text, 'annulée'::text])));
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_type_chk CHECK ((type = ANY (ARRAY['facture'::text, 'acompte'::text, 'solde'::text, 'note_credit'::text])));
ALTER TABLE public.lode_factures_lignes ADD CONSTRAINT lode_factures_lignes_tvacat_chk CHECK ((tva_categorie = ANY (ARRAY['S'::text, 'AE'::text, 'Z'::text, 'E'::text, 'K'::text, 'G'::text])));
ALTER TABLE public.polices ADD CONSTRAINT domaine_check CHECK ((domaine = ANY (ARRAY['IARD'::text, 'VIE'::text, 'CREDIT'::text, 'SANTE'::text])));
ALTER TABLE public.polices ADD CONSTRAINT situation_check CHECK ((situation = ANY (ARRAY['actuelle'::text, 'projet'::text, 'resiliee'::text, 'suspendue'::text, 'archivee'::text])));
ALTER TABLE public.producteurs ADD CONSTRAINT producteurs_statut_chk CHECK ((statut = ANY (ARRAY['actif'::text, 'runoff'::text, 'cloture'::text])));
ALTER TABLE public.profils_investisseur ADD CONSTRAINT profils_investisseur_source_check CHECK ((source = ANY (ARRAY['generated'::text, 'uploaded'::text])));
ALTER TABLE public.sous_agents ADD CONSTRAINT type_sa CHECK ((type = ANY (ARRAY['physique'::text, 'morale'::text])));
ALTER TABLE public.utilisateurs ADD CONSTRAINT role_check CHECK ((role = ANY (ARRAY['admin'::text, 'gestionnaire'::text, 'sous_agent'::text, 'comptable'::text, 'lecture'::text])));

-- ============================================================================
-- Clés étrangères
-- ============================================================================
ALTER TABLE public.appels ADD CONSTRAINT appels_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.bordereaux_sa ADD CONSTRAINT bordereaux_sa_sous_agent_id_fkey FOREIGN KEY (sous_agent_id) REFERENCES sous_agents(id);
ALTER TABLE public.categories ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE public.categories_regles ADD CONSTRAINT categories_regles_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES categories(id);
ALTER TABLE public.collaborateur_taux ADD CONSTRAINT collaborateur_taux_collaborateur_id_fkey FOREIGN KEY (collaborateur_id) REFERENCES collaborateurs(id) ON DELETE CASCADE;
ALTER TABLE public.collaborateurs ADD CONSTRAINT collaborateurs_bureau_id_fkey FOREIGN KEY (bureau_id) REFERENCES ref_bureaux(id);
ALTER TABLE public.collaborateurs ADD CONSTRAINT collaborateurs_portefeuille_id_fkey FOREIGN KEY (portefeuille_id) REFERENCES ref_portefeuilles(id);
ALTER TABLE public.comptes_bancaires ADD CONSTRAINT comptes_bancaires_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);
ALTER TABLE public.credits ADD CONSTRAINT credits_contrat_id_fkey FOREIGN KEY (contrat_id) REFERENCES contrats(id);
ALTER TABLE public.documents ADD CONSTRAINT documents_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);
ALTER TABLE public.documents ADD CONSTRAINT documents_uploade_par_fkey FOREIGN KEY (uploade_par) REFERENCES utilisateurs(id);
ALTER TABLE public.dtx_devis_events ADD CONSTRAINT dtx_devis_events_fk FOREIGN KEY (devis_id) REFERENCES dtx_devis(id) ON DELETE CASCADE;
ALTER TABLE public.dtx_devis_lignes ADD CONSTRAINT dtx_devis_lignes_fk FOREIGN KEY (devis_id) REFERENCES dtx_devis(id) ON DELETE CASCADE;
ALTER TABLE public.dtx_factures ADD CONSTRAINT dtx_factures_devis_fk FOREIGN KEY (devis_id) REFERENCES dtx_devis(id) ON DELETE SET NULL;
ALTER TABLE public.dtx_factures_lignes ADD CONSTRAINT dtx_factures_lignes_fk FOREIGN KEY (facture_id) REFERENCES dtx_factures(id) ON DELETE CASCADE;
ALTER TABLE public.dyn_devis_events ADD CONSTRAINT dyn_devis_events_fk FOREIGN KEY (devis_id) REFERENCES dyn_devis(id) ON DELETE CASCADE;
ALTER TABLE public.dyn_devis_lignes ADD CONSTRAINT dyn_devis_lignes_fk FOREIGN KEY (devis_id) REFERENCES dyn_devis(id) ON DELETE CASCADE;
ALTER TABLE public.dyn_devoir_info ADD CONSTRAINT dyn_devoir_info_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.dyn_factures ADD CONSTRAINT dyn_factures_devis_fk FOREIGN KEY (devis_id) REFERENCES dyn_devis(id) ON DELETE SET NULL;
ALTER TABLE public.dyn_factures_lignes ADD CONSTRAINT dyn_factures_lignes_fk FOREIGN KEY (facture_id) REFERENCES dyn_factures(id) ON DELETE CASCADE;
ALTER TABLE public.factures ADD CONSTRAINT factures_cree_par_id_fkey FOREIGN KEY (cree_par_id) REFERENCES utilisateurs(id);
ALTER TABLE public.factures ADD CONSTRAINT factures_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);
ALTER TABLE public.factures_achat ADD CONSTRAINT factures_achat_lode_devis_id_fkey FOREIGN KEY (lode_devis_id) REFERENCES lode_devis(id);
ALTER TABLE public.hex_cotisations ADD CONSTRAINT hex_cotisations_membre_id_fkey FOREIGN KEY (membre_id) REFERENCES hex_membres(id) ON DELETE CASCADE;
ALTER TABLE public.hex_cotisations_lignes ADD CONSTRAINT hex_cotisations_lignes_cotisation_id_fkey FOREIGN KEY (cotisation_id) REFERENCES hex_cotisations(id) ON DELETE CASCADE;
ALTER TABLE public.hex_cotisations_rappels ADD CONSTRAINT hex_cotisations_rappels_cotisation_id_fkey FOREIGN KEY (cotisation_id) REFERENCES hex_cotisations(id) ON DELETE CASCADE;
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_cree_par_fkey FOREIGN KEY (cree_par) REFERENCES utilisateurs(id);
ALTER TABLE public.lode_devis ADD CONSTRAINT lode_devis_client_id_fkey FOREIGN KEY (client_id) REFERENCES lode_clients(id);
ALTER TABLE public.lode_devis_events ADD CONSTRAINT lode_devis_events_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES lode_devis(id) ON DELETE CASCADE;
ALTER TABLE public.lode_devis_lignes ADD CONSTRAINT lode_devis_lignes_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES lode_devis(id) ON DELETE CASCADE;
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_client_id_fkey FOREIGN KEY (client_id) REFERENCES lode_clients(id);
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_devis_id_fkey FOREIGN KEY (devis_id) REFERENCES lode_devis(id);
ALTER TABLE public.lode_factures ADD CONSTRAINT lode_factures_facture_origine_id_fkey FOREIGN KEY (facture_origine_id) REFERENCES lode_factures(id);
ALTER TABLE public.lode_factures_lignes ADD CONSTRAINT lode_factures_lignes_facture_id_fkey FOREIGN KEY (facture_id) REFERENCES lode_factures(id) ON DELETE CASCADE;
ALTER TABLE public.notes_frais_lignes ADD CONSTRAINT notes_frais_lignes_note_id_fkey FOREIGN KEY (note_id) REFERENCES notes_frais(id) ON DELETE CASCADE;
ALTER TABLE public.polices ADD CONSTRAINT polices_gestionnaire_id_fkey FOREIGN KEY (gestionnaire_id) REFERENCES utilisateurs(id);
ALTER TABLE public.polices ADD CONSTRAINT polices_sa_preneur_id_fkey FOREIGN KEY (sa_preneur_id) REFERENCES sous_agents(id);
ALTER TABLE public.polices ADD CONSTRAINT polices_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);
ALTER TABLE public.polices ADD CONSTRAINT polices_sous_agent_id_fkey FOREIGN KEY (sous_agent_id) REFERENCES sous_agents(id);
ALTER TABLE public.producteurs ADD CONSTRAINT producteurs_compagnie_id_fkey FOREIGN KEY (compagnie_id) REFERENCES compagnies(id) ON DELETE SET NULL;
ALTER TABLE public.profils_investisseur ADD CONSTRAINT profils_investisseur_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id);
ALTER TABLE public.profils_investisseur ADD CONSTRAINT profils_investisseur_contrat_id_fkey FOREIGN KEY (contrat_id) REFERENCES contrats(id);
ALTER TABLE public.sinistre_workflow_progress ADD CONSTRAINT sinistre_workflow_progress_step_id_fkey FOREIGN KEY (step_id) REFERENCES sinistre_workflow_definitions(id);
ALTER TABLE public.sous_agents ADD CONSTRAINT sous_agents_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);
ALTER TABLE public.succession_simulations ADD CONSTRAINT succession_simulations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.taches ADD CONSTRAINT taches_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.taches_rapprochement ADD CONSTRAINT taches_rapprochement_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE public.tickets_messages ADD CONSTRAINT tickets_messages_tache_id_fkey FOREIGN KEY (tache_id) REFERENCES taches(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_ventilation ADD CONSTRAINT transaction_ventilation_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_ventilation ADD CONSTRAINT transaction_ventilation_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES user_permissions(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_ventilation ADD CONSTRAINT transaction_ventilation_facture_id_fkey FOREIGN KEY (facture_id) REFERENCES factures_achat(id) ON DELETE SET NULL;
ALTER TABLE public.transaction_ventilation ADD CONSTRAINT transaction_ventilation_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_categorie_id_fkey FOREIGN KEY (categorie_id) REFERENCES categories(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_compte_id_fkey FOREIGN KEY (compte_id) REFERENCES comptes_bancaires(id);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_employe_id_fkey FOREIGN KEY (employe_id) REFERENCES user_permissions(id) ON DELETE SET NULL;
ALTER TABLE public.utilisateurs ADD CONSTRAINT utilisateurs_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.utilisateurs ADD CONSTRAINT utilisateurs_societe_id_fkey FOREIGN KEY (societe_id) REFERENCES societes(id);

-- ============================================================================
-- Index
-- ============================================================================
CREATE INDEX IF NOT EXISTS dtx_clients_denomination_idx ON public.dtx_clients USING btree (denomination);
CREATE INDEX IF NOT EXISTS dtx_clients_nom_idx ON public.dtx_clients USING btree (nom);
CREATE INDEX IF NOT EXISTS dtx_clients_numero_bce_idx ON public.dtx_clients USING btree (numero_bce);
CREATE INDEX IF NOT EXISTS dtx_devis_events_devis_id_idx ON public.dtx_devis_events USING btree (devis_id);
CREATE INDEX IF NOT EXISTS dtx_devis_lignes_devis_id_idx ON public.dtx_devis_lignes USING btree (devis_id);
CREATE INDEX IF NOT EXISTS dtx_devis_statut_idx ON public.dtx_devis USING btree (statut);
CREATE INDEX IF NOT EXISTS dtx_factures_lignes_facture_id_idx ON public.dtx_factures_lignes USING btree (facture_id);
CREATE INDEX IF NOT EXISTS dtx_factures_statut_idx ON public.dtx_factures USING btree (statut);
CREATE INDEX IF NOT EXISTS dyn_devis_events_devis_id_idx ON public.dyn_devis_events USING btree (devis_id);
CREATE INDEX IF NOT EXISTS dyn_devis_lignes_devis_id_idx ON public.dyn_devis_lignes USING btree (devis_id);
CREATE INDEX IF NOT EXISTS dyn_devis_statut_idx ON public.dyn_devis USING btree (statut);
CREATE INDEX IF NOT EXISTS dyn_devoir_info_dossier_idx ON public.dyn_devoir_info USING btree (dossier);
CREATE INDEX IF NOT EXISTS dyn_factures_lignes_facture_id_idx ON public.dyn_factures_lignes USING btree (facture_id);
CREATE INDEX IF NOT EXISTS dyn_factures_statut_idx ON public.dyn_factures USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_ag_starget_year_week ON public.ag_starget_results USING btree (year, week_number);
CREATE INDEX IF NOT EXISTS idx_ag_tech_period_family ON public.ag_technical_results USING btree (period_year, period_month, product_family);
CREATE INDEX IF NOT EXISTS idx_appels_client ON public.appels USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_appels_debut ON public.appels USING btree (debut DESC);
CREATE INDEX IF NOT EXISTS idx_bordereaux_cle ON public.bordereaux USING btree (cle_unique);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_societe ON public.categories USING btree (societe);
CREATE INDEX IF NOT EXISTS idx_clients_consultes_bureau_date ON public.clients_consultes USING btree (bureau, consulte_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_gsm_e164 ON public.clients USING btree (gsm_e164);
CREATE INDEX IF NOT EXISTS idx_clients_nom ON public.clients USING btree (nom);
CREATE INDEX IF NOT EXISTS idx_clients_telfixe_e164 ON public.clients USING btree (telfixe_e164);
CREATE INDEX IF NOT EXISTS idx_contrats_compagnie ON public.contrats USING btree (compagnie);
CREATE INDEX IF NOT EXISTS idx_contrats_date_creation ON public.contrats USING btree (date_creation);
CREATE INDEX IF NOT EXISTS idx_contrats_domaine ON public.contrats USING btree (domaine);
CREATE INDEX IF NOT EXISTS idx_contrats_dossier ON public.contrats USING btree (dossier);
CREATE INDEX IF NOT EXISTS idx_contrats_police ON public.contrats USING btree (police);
CREATE INDEX IF NOT EXISTS idx_contrats_sa_code ON public.contrats USING btree (sa_code);
CREATE INDEX IF NOT EXISTS idx_contrats_situation ON public.contrats USING btree (situation);
CREATE INDEX IF NOT EXISTS idx_cr_a ON public.client_relations USING btree (dossier_a);
CREATE INDEX IF NOT EXISTS idx_cr_b ON public.client_relations USING btree (dossier_b);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON public.documents USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_factures_echeance ON public.factures USING btree (date_echeance);
CREATE INDEX IF NOT EXISTS idx_factures_societe ON public.factures USING btree (societe_id);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON public.factures USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_famille_active ON public.famille USING btree (relation_active);
CREATE INDEX IF NOT EXISTS idx_famille_clef ON public.famille USING btree (clef_recherche);
CREATE INDEX IF NOT EXISTS idx_famille_dossier ON public.famille USING btree (dossier);
CREATE INDEX IF NOT EXISTS idx_hex_cotis_annee ON public.hex_cotisations USING btree (annee);
CREATE INDEX IF NOT EXISTS idx_hex_cotis_membre ON public.hex_cotisations USING btree (membre_id);
CREATE INDEX IF NOT EXISTS idx_hex_lignes_cotis ON public.hex_cotisations_lignes USING btree (cotisation_id);
CREATE INDEX IF NOT EXISTS idx_hex_rappels_cotis ON public.hex_cotisations_rappels USING btree (cotisation_id);
CREATE INDEX IF NOT EXISTS idx_iar_insurer_year_period ON public.insurer_actual_results USING btree (insurer, year, period_type);
CREATE INDEX IF NOT EXISTS idx_insurer_rules_insurer_year ON public.insurer_rules USING btree (insurer, year);
CREATE INDEX IF NOT EXISTS idx_insurer_rules_type ON public.insurer_rules USING btree (rule_type);
CREATE INDEX IF NOT EXISTS idx_kb_categorie ON public.kb_articles USING btree (categorie);
CREATE INDEX IF NOT EXISTS idx_kb_embedding ON public.kb_articles USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_liens_preneurs_a ON public.liens_preneurs USING btree (dossier_a);
CREATE INDEX IF NOT EXISTS idx_liens_preneurs_b ON public.liens_preneurs USING btree (dossier_b);
CREATE INDEX IF NOT EXISTS idx_lode_clients_bce ON public.lode_clients USING btree (numero_bce);
CREATE INDEX IF NOT EXISTS idx_lode_clients_denom ON public.lode_clients USING btree (denomination);
CREATE INDEX IF NOT EXISTS idx_lode_clients_nom ON public.lode_clients USING btree (nom);
CREATE INDEX IF NOT EXISTS idx_lode_dev_ev ON public.lode_devis_events USING btree (devis_id);
CREATE INDEX IF NOT EXISTS idx_lode_devis_statut ON public.lode_devis USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_lode_dl_devis ON public.lode_devis_lignes USING btree (devis_id);
CREATE INDEX IF NOT EXISTS idx_lode_factures_statut ON public.lode_factures USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_lode_fl_facture ON public.lode_factures_lignes USING btree (facture_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_annee_mois ON public.mouvements_production USING btree (annee, mois);
CREATE INDEX IF NOT EXISTS idx_mouvements_delegue ON public.mouvements_production USING btree (delegue_contrat);
CREATE INDEX IF NOT EXISTS idx_mouvements_sa_contrat ON public.mouvements_production USING btree (sa_contrat);
CREATE INDEX IF NOT EXISTS idx_mouvements_type_prod ON public.mouvements_production USING btree (type_prod);
CREATE INDEX IF NOT EXISTS idx_mvt_annee ON public.mouvements_production USING btree (annee);
CREATE INDEX IF NOT EXISTS idx_mvt_annee_delegue ON public.mouvements_production USING btree (annee, delegue_contrat);
CREATE INDEX IF NOT EXISTS idx_mvt_annee_sa ON public.mouvements_production USING btree (annee, sa_contrat);
CREATE INDEX IF NOT EXISTS idx_mvt_cie ON public.mouvements_production USING btree (cie);
CREATE INDEX IF NOT EXISTS idx_mvt_date ON public.mouvements_production USING btree (date_mouvement);
CREATE INDEX IF NOT EXISTS idx_mvt_gestionnaire ON public.mouvements_production USING btree (gestionnaire);
CREATE INDEX IF NOT EXISTS idx_nf_auteur ON public.notes_frais USING btree (lower(auteur_email));
CREATE INDEX IF NOT EXISTS idx_nf_societe ON public.notes_frais USING btree (societe);
CREATE INDEX IF NOT EXISTS idx_nfl_note ON public.notes_frais_lignes USING btree (note_id);
CREATE INDEX IF NOT EXISTS idx_objectives_global_year_scope ON public.objectives_global USING btree (year, scope, agent_code);
CREATE INDEX IF NOT EXISTS idx_polices_client ON public.polices USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_polices_compagnie ON public.polices USING btree (compagnie_id);
CREATE INDEX IF NOT EXISTS idx_polices_echeance ON public.polices USING btree (date_echeance);
CREATE INDEX IF NOT EXISTS idx_polices_gestionnaire ON public.polices USING btree (gestionnaire_id);
CREATE INDEX IF NOT EXISTS idx_polices_situation ON public.polices USING btree (situation);
CREATE INDEX IF NOT EXISTS idx_polices_sous_agent ON public.polices USING btree (sous_agent_id);
CREATE INDEX IF NOT EXISTS idx_producteurs_compagnie ON public.producteurs USING btree (compagnie_id);
CREATE INDEX IF NOT EXISTS idx_producteurs_numero ON public.producteurs USING btree (numero_producteur);
CREATE INDEX IF NOT EXISTS idx_quittances_compagnie ON public.quittances USING btree (compagnie);
CREATE INDEX IF NOT EXISTS idx_quittances_cpte ON public.quittances USING btree (compte_producteur);
CREATE INDEX IF NOT EXISTS idx_quittances_date ON public.quittances USING btree (date_comptable);
CREATE INDEX IF NOT EXISTS idx_quittances_fsma ON public.quittances USING btree (fsma);
CREATE INDEX IF NOT EXISTS idx_rdv_commercial ON public.rdv USING btree (commercial_code);
CREATE INDEX IF NOT EXISTS idx_rdv_debut ON public.rdv USING btree (debut DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_dossier ON public.rdv USING btree (dossier_client);
CREATE INDEX IF NOT EXISTS idx_rdv_gestionnaire ON public.rdv USING btree (gestionnaire_code);
CREATE INDEX IF NOT EXISTS idx_rdv_user_email ON public.rdv USING btree (user_email);
CREATE INDEX IF NOT EXISTS idx_risques_actif ON public.risques USING btree (actif);
CREATE INDEX IF NOT EXISTS idx_risques_police ON public.risques USING btree (police);
CREATE INDEX IF NOT EXISTS idx_risques_type ON public.risques USING btree (type_risque_valeur);
CREATE INDEX IF NOT EXISTS idx_sinistres_annee ON public.sinistres USING btree (annee);
CREATE INDEX IF NOT EXISTS idx_sinistres_etat ON public.sinistres USING btree (etat_code);
CREATE INDEX IF NOT EXISTS idx_sinistres_gestionnaire ON public.sinistres USING btree (gestionnaire);
CREATE INDEX IF NOT EXISTS idx_sinistres_police ON public.sinistres USING btree (police_objet_lien);
CREATE INDEX IF NOT EXISTS idx_swd_garantie ON public.sinistre_workflow_definitions USING btree (garantie, step_order);
CREATE INDEX IF NOT EXISTS idx_swp_pointeur ON public.sinistre_workflow_progress USING btree (pointeur_sinistre);
CREATE INDEX IF NOT EXISTS idx_taches_client_id ON public.taches USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_taches_dossier_client ON public.taches USING btree (dossier_client);
CREATE INDEX IF NOT EXISTS idx_taches_echeance ON public.taches USING btree (echeance);
CREATE INDEX IF NOT EXISTS idx_taches_file_attente ON public.taches USING btree (file_attente);
CREATE INDEX IF NOT EXISTS idx_taches_gestionnaire ON public.taches USING btree (gestionnaire);
CREATE INDEX IF NOT EXISTS idx_taches_societe ON public.taches USING btree (societe_id);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON public.taches USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_tickets_messages_created ON public.tickets_messages USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_messages_tache ON public.tickets_messages USING btree (tache_id);
CREATE INDEX IF NOT EXISTS idx_transactions_compte_id ON public.transactions USING btree (compte_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_valeur ON public.transactions USING btree (date_valeur);
CREATE INDEX IF NOT EXISTS idx_transactions_employe ON public.transactions USING btree (employe_id);
CREATE INDEX IF NOT EXISTS idx_txventil_emp ON public.transaction_ventilation USING btree (employe_id);
CREATE INDEX IF NOT EXISTS idx_txventil_tx ON public.transaction_ventilation USING btree (transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_collab ON public.user_permissions USING btree (collab_code);
CREATE INDEX IF NOT EXISTS objets_risque_dossier_idx ON public.objets_risque USING btree (dossier);
CREATE INDEX IF NOT EXISTS objets_risque_police_idx ON public.objets_risque USING btree (police);
CREATE INDEX IF NOT EXISTS parentes_dossier_idx ON public.parentes USING btree (dossier_principal);
CREATE INDEX IF NOT EXISTS seg_dossier_idx ON public.segmentation USING btree (dossier);
CREATE INDEX IF NOT EXISTS sp_dossier_idx ON public.sinistre_paiements USING btree (dossier);
CREATE UNIQUE INDEX IF NOT EXISTS contrats_police_unique_uq ON public.contrats USING btree (police_unique);
CREATE UNIQUE INDEX IF NOT EXISTS credits_contrat_id_uq ON public.credits USING btree (contrat_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comptes_bancaires_iban ON public.comptes_bancaires USING btree (iban) WHERE ((iban IS NOT NULL) AND (iban <> 'À compléter'::text));
CREATE UNIQUE INDEX IF NOT EXISTS idx_tache_rappro_tx ON public.taches_rapprochement USING btree (transaction_id) WHERE (transaction_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS notes_frais_numero_key ON public.notes_frais USING btree (numero) WHERE (numero IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_messages_email_msgid_uidx ON public.tickets_messages USING btree (email_message_id) WHERE (email_message_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_categories_nom ON public.categories USING btree (lower(btrim(nom)));

-- ============================================================================
-- Fonctions (ordre de création prod)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT role FROM utilisateurs WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.get_societe_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT societe_id FROM utilisateurs WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_permissions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from user_permissions
    where lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin' and actif = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_o365_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.raw_app_meta_data->>'provider' = 'azure' THEN
    INSERT INTO public.user_permissions (
      user_email,
      nom,
      role,
      actif,
      o365_only
    )
    VALUES (
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'user',
      false,   -- inactif par défaut, admin active manuellement
      true
    )
    ON CONFLICT (user_email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_secret(p_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO config_secrets (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, created_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.appliquer_regle_categorie()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.categorie_id IS NULL AND NEW.contrepartie_nom IS NOT NULL THEN
    SELECT categorie_id INTO NEW.categorie_id
    FROM categories_regles
    WHERE motif = NEW.contrepartie_nom
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_clients_kpis()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
  annee_en_cours INT := EXTRACT(YEAR FROM NOW())::INT;
BEGIN
  SELECT json_build_object(
    'total_clients',
    (SELECT COUNT(DISTINCT dossier) FROM clients WHERE dossier IS NOT NULL),
    'avec_alerte',
    (SELECT COUNT(DISTINCT dossier) FROM clients
     WHERE alerte IS NOT NULL AND alerte != '' AND alerte != ' '),
    'sans_contrat',
    (SELECT COUNT(DISTINCT c.dossier) FROM clients c
     WHERE dossier IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM contrats ct
         WHERE ct.dossier = c.dossier
           AND (ct.situation___libelle IS NULL OR ct.situation___libelle = 'En cours')
       )),
    'sans_commissions',
    (SELECT COUNT(DISTINCT c.dossier) FROM clients c
     WHERE dossier IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM quittances q
         WHERE q.dossier = c.dossier
           AND EXTRACT(YEAR FROM q.date_comptable::date) = annee_en_cours
       ))
  ) INTO result;
  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_risques_ts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.update_famille_ts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.next_lode_numero(p_type text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_an  text := to_char(current_date, 'YYYY');
  v_seq integer;
begin
  if p_type = 'devis' then
    v_seq := nextval('seq_lode_devis_2026');
    return v_an || '-' || lpad(v_seq::text, 4, '0');          -- devis : 2026-0014
  elsif p_type = 'note_credit' then
    v_seq := nextval('seq_lode_nc_2026');
    return 'NC-' || v_an || '-' || lpad(v_seq::text, 3, '0');  -- note de crédit : NC-2026-001
  else
    v_seq := nextval('seq_lode_facture_2026');
    return v_an || '-' || lpad(v_seq::text, 3, '0');          -- facture : 2026-018
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.rdv_autolink()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  stop text[] := array[
    'RDV','RDVS','PH','PRET','HYPO','HYPOTHEQUE','HYPOTHECAIRE','SIGN','SIGNATURE','CARDIF',
    'DOSSIER','DOSSIERS','CREDIT','SRDU','DEUX','AVEC','ATTENTION','SORTIR','BNB','CAR',
    'FAILLITE','FAILLI','REUNION','EXPERTISE','MME','MR','MONSIEUR','MADAME','LES','DES','POUR',
    'RESTO','REPAS','EQUIPE','DYNASSUR','FORMATION','PROVIDIS','MICROSOFT','POWER','DAYS','FOUNDRY',
    'LIEGE','JUPRELLE','VISIO','TEAMS','APPEL','CALL','TEL','VIE','IARD','AUTO','CONTRAT','CLIENT',
    'NOUVEAU','NEW','SUIVI','POINT','DEBRIEF','MEETING','LUNCH','MIDI','URGENT','SUITE','ROADSHOW',
    'BUREAU','FERME','FERMETURE','OUVERTURE','PETIT','DEJEUNER','VACANCES','CONGE','ANNIVERSAIRE',
    'ZOOM','ABSENT','FERIE','OFFICE','BANQUE','GARAGE'];
  excl text[] := array['DETILLOUX'];
  toks text[];
  ncand int;
  hid bigint;
  hdos text;
begin
  if NEW.client_id is not null then return NEW; end if;
  if NEW.objet is null then return NEW; end if;

  -- tokens significatifs de l'objet (majuscule, sans accents, >=3, hors stop-words)
  select array_agg(t) into toks
  from unnest(regexp_split_to_array(upper(unaccent(NEW.objet)), '[^A-Z]+')) as t
  where length(t) >= 3 and not (t = any(stop));

  if toks is null then return NEW; end if;

  -- nombre de personnes distinctes (nom+prénom) dont nom ET prénom apparaissent dans l'objet
  select count(distinct (upper(unaccent(nom)) || '|' || upper(unaccent(coalesce(prenom,'')))))
  into ncand
  from clients
  where upper(unaccent(nom)) = any(toks)
    and not (upper(unaccent(nom)) = any(excl))
    and coalesce(prenom,'') <> ''
    and upper(unaccent(prenom)) = any(toks)
    and length(upper(unaccent(nom))) >= 3;

  if ncand = 1 then
    select id, dossier into hid, hdos
    from clients
    where upper(unaccent(nom)) = any(toks)
      and not (upper(unaccent(nom)) = any(excl))
      and coalesce(prenom,'') <> ''
      and upper(unaccent(prenom)) = any(toks)
    order by (dossier is not null) desc, id
    limit 1;
    if hid is not null then
      NEW.client_id := hid;
      NEW.dossier_client := hdos;
    end if;
  end if;

  return NEW;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lode_devis_decision(p_token uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE d lode_devis;
BEGIN
  SELECT * INTO d FROM lode_devis WHERE accept_token = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','introuvable'); END IF;
  IF d.statut IN ('accepté','refusé') THEN
    RETURN jsonb_build_object('ok',true,'already',true,'statut',d.statut);
  END IF;
  IF p_action = 'accept' THEN
    UPDATE lode_devis SET statut='accepté', accepted_at=NOW() WHERE id=d.id;
    INSERT INTO lode_devis_events(devis_id,type,detail) VALUES(d.id,'accepte','Accepté par le client');
  ELSIF p_action = 'refuse' THEN
    UPDATE lode_devis SET statut='refusé', refused_at=NOW() WHERE id=d.id;
    INSERT INTO lode_devis_events(devis_id,type,detail) VALUES(d.id,'refuse','Refusé par le client');
  ELSE
    RETURN jsonb_build_object('ok',false,'error','action invalide');
  END IF;
  RETURN jsonb_build_object('ok',true);
END; $function$
;

CREATE OR REPLACE FUNCTION public.lode_devis_public(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE d lode_devis;
BEGIN
  SELECT * INTO d FROM lode_devis WHERE accept_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'devis', to_jsonb(d),
    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
                        FROM lode_devis_lignes l WHERE l.devis_id = d.id), '[]'::jsonb)
  );
END; $function$
;

CREATE OR REPLACE FUNCTION public.next_dtx_numero(p_type text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE v_an TEXT := to_char(CURRENT_DATE,'YYYY'); v_seq INTEGER;
BEGIN
  IF p_type='devis' THEN v_seq:=nextval('seq_dtx_devis_2026');
    ELSE                   v_seq:=nextval('seq_dtx_facture_2026'); END IF;
      RETURN v_an||'-'||lpad(v_seq::TEXT,3,'0');
      END; $function$
;

CREATE OR REPLACE FUNCTION public.dtx_devis_public(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
      DECLARE d dtx_devis;
      BEGIN
        SELECT * INTO d FROM dtx_devis WHERE accept_token = p_token;
          IF NOT FOUND THEN RETURN NULL; END IF;
            RETURN jsonb_build_object(
                'devis', to_jsonb(d),
                    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
                                            FROM dtx_devis_lignes l WHERE l.devis_id = d.id), '[]'::jsonb)
                                              );
                                              END; $function$
;

CREATE OR REPLACE FUNCTION public.dtx_devis_decision(p_token uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
                                              DECLARE d dtx_devis;
                                              BEGIN
                                                SELECT * INTO d FROM dtx_devis WHERE accept_token = p_token;
                                                  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','introuvable'); END IF;
                                                    IF d.statut IN ('accepté','refusé') THEN
                                                        RETURN jsonb_build_object('ok',true,'already',true,'statut',d.statut);
                                                          END IF;
                                                            IF p_action='accept' THEN
                                                                UPDATE dtx_devis SET statut='accepté', accepted_at=NOW() WHERE id=d.id;
                                                                    INSERT INTO dtx_devis_events(devis_id,type,detail) VALUES(d.id,'accepte','Accepté par le client');
                                                                      ELSIF p_action='refuse' THEN
                                                                          UPDATE dtx_devis SET statut='refusé', refused_at=NOW() WHERE id=d.id;
                                                                              INSERT INTO dtx_devis_events(devis_id,type,detail) VALUES(d.id,'refuse','Refusé par le client');
                                                                                ELSE
                                                                                    RETURN jsonb_build_object('ok',false,'error','action invalide');
                                                                                      END IF;
                                                                                        RETURN jsonb_build_object('ok',true);
                                                                                        END; $function$
;

CREATE OR REPLACE FUNCTION public.next_dyn_numero(p_type text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
                                                                                        DECLARE v_an TEXT := to_char(CURRENT_DATE,'YYYY'); v_seq INTEGER;
                                                                                        BEGIN
                                                                                          IF p_type='devis' THEN v_seq:=nextval('seq_dyn_devis_2026');
                                                                                            ELSE                   v_seq:=nextval('seq_dyn_facture_2026'); END IF;
                                                                                              RETURN v_an||'-'||lpad(v_seq::TEXT,3,'0');
                                                                                              END; $function$
;

CREATE OR REPLACE FUNCTION public.dyn_devis_public(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
                                                                                              DECLARE d dyn_devis;
                                                                                              BEGIN
                                                                                                SELECT * INTO d FROM dyn_devis WHERE accept_token = p_token;
                                                                                                  IF NOT FOUND THEN RETURN NULL; END IF;
                                                                                                    RETURN jsonb_build_object(
                                                                                                        'devis', to_jsonb(d),
                                                                                                            'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
                                                                                                                                    FROM dyn_devis_lignes l WHERE l.devis_id = d.id), '[]'::jsonb)
                                                                                                                                      );
                                                                                                                                      END; $function$
;

CREATE OR REPLACE FUNCTION public.dyn_devis_decision(p_token uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
                                                                                                                                      DECLARE d dyn_devis;
                                                                                                                                      BEGIN
                                                                                                                                        SELECT * INTO d FROM dyn_devis WHERE accept_token = p_token;
                                                                                                                                          IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','introuvable'); END IF;
                                                                                                                                            IF d.statut IN ('accepté','refusé') THEN
                                                                                                                                                RETURN jsonb_build_object('ok',true,'already',true,'statut',d.statut);
                                                                                                                                                  END IF;
                                                                                                                                                    IF p_action='accept' THEN
                                                                                                                                                        UPDATE dyn_devis SET statut='accepté', accepted_at=NOW() WHERE id=d.id;
                                                                                                                                                            INSERT INTO dyn_devis_events(devis_id,type,detail) VALUES(d.id,'accepte','Accepté par le client');
                                                                                                                                                              ELSIF p_action='refuse' THEN
                                                                                                                                                                  UPDATE dyn_devis SET statut='refusé', refused_at=NOW() WHERE id=d.id;
                                                                                                                                                                      INSERT INTO dyn_devis_events(devis_id,type,detail) VALUES(d.id,'refuse','Refusé par le client');
                                                                                                                                                                        ELSE
                                                                                                                                                                            RETURN jsonb_build_object('ok',false,'error','action invalide');
                                                                                                                                                                              END IF;
                                                                                                                                                                                RETURN jsonb_build_object('ok',true);
                                                                                                                                                                                END; $function$
;

CREATE OR REPLACE FUNCTION public.crm_lookup(p_number text, p_secret text)
 RETURNS TABLE(id bigint, nom text, prenom text, gsm text, tel_fixe text, email text, dossier text, gestionnaire text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_e164 text; v_ok boolean;
begin
  select (value = p_secret) into v_ok from config_secrets where key = 'threecx_api_secret';
  if not coalesce(v_ok, false) then return; end if;
  v_e164 := normalize_be(p_number);
  if v_e164 is null then return; end if;
  return query
    select c.id, c.nom, c.prenom, c.gsm, c.tel_fixe, c.email, c.dossier,
           coalesce(c.gestionnaire_nom, c.gestionnaire_code)
    from clients c
    where c.gsm_e164 = v_e164 or c.telfixe_e164 = v_e164
    limit 5;
end $function$
;

CREATE OR REPLACE FUNCTION public.crm_log_appel(p_secret text, p_direction text, p_number text, p_name text, p_agent text, p_duration text, p_start timestamp with time zone)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ok boolean; v_e164 text; v_client_id bigint; v_id bigint;
begin
  select (value = p_secret) into v_ok from config_secrets where key = 'threecx_api_secret';
  if not coalesce(v_ok, false) then return null; end if;
  v_e164 := normalize_be(p_number);
  select c.id into v_client_id from clients c
    where c.gsm_e164 = v_e164 or c.telfixe_e164 = v_e164 limit 1;
  insert into appels(direction, numero_externe, numero_e164, client_id, agent, duree, debut, nom_3cx)
    values (p_direction, p_number, v_e164, v_client_id, p_agent, p_duration, p_start, p_name)
    returning id into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.search_clients_dynassur(q text, lim integer DEFAULT 60)
 RETURNS TABLE(id bigint, dossier text, nom text, prenom text, cp text, localite text, gsm text, email text, match_info text)
 LANGUAGE sql
 STABLE
AS $function$
  with p as (
    select
      trim(coalesce(q,'')) as raw,
      regexp_replace(upper(coalesce(q,'')), '[^A-Z0-9]', '', 'g') as compact,
      regexp_replace(coalesce(q,''), '[^0-9]', '', 'g') as digits,
      (coalesce(q,'') ~ '[A-Za-z]') as has_alpha,
      (select array_agg('%'||lower(unaccent(tk))||'%')
         from unnest(regexp_split_to_array(trim(coalesce(q,'')), '\s+')) tk
         where tk <> '') as pats
  ),
  orh as (
    select o.dossier,
           max(o.description) filter (where (o.type_risque ilike 'v_hicule')) as veh_descr,
           bool_or(o.type_risque ilike 'v_hicule') as is_veh
    from objets_risque o, p
    where length(p.compact) >= 3 and (
         ( o.type_risque ilike 'v_hicule'
           and regexp_replace(upper(coalesce(o.description,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%' )
      or regexp_replace(upper(coalesce(o.police,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%'
    )
    group by o.dossier
  ),
  cth as (
    select distinct c.dossier
    from contrats c, p
    where length(p.compact) >= 3
      and regexp_replace(upper(coalesce(c.police,'')), '[^A-Z0-9]', '', 'g') like '%'||p.compact||'%'
  )
  select cl.id, cl.dossier, cl.nom, cl.prenom, cl.cp, cl.localite, cl.gsm, cl.email,
    case
      when orh.is_veh and orh.veh_descr is not null then '🚗 '||orh.veh_descr
      when orh.dossier is not null or cth.dossier is not null then '📄 Police'
      else null
    end as match_info
  from clients cl
  cross join p
  left join orh on orh.dossier = cl.dossier
  left join cth on cth.dossier = cl.dossier
  where p.raw <> '' and (
       -- Tous les mots tapés doivent se retrouver dans nom / prénom / localité / CP / n° de maison
       ( p.pats is not null and lower(unaccent(
             coalesce(cl.nom,'')||' '||coalesce(cl.prenom,'')||' '||
             coalesce(cl.localite,'')||' '||coalesce(cl.cp,'')||' '||coalesce(cl.num_maison,'')
         )) like ALL(p.pats) )
    or coalesce(cl.dossier,'') like '%'||p.raw||'%'
    or coalesce(cl.email,'') ilike '%'||p.raw||'%'
    or ( not p.has_alpha and length(p.digits) >= 6 and regexp_replace(
           coalesce(cl.gsm_e164,'')||coalesce(cl.telfixe_e164,'')||coalesce(cl.gsm,'')||coalesce(cl.tel_fixe,''),
           '[^0-9]','','g') like '%'||right(p.digits,9)||'%' )
    or orh.dossier is not null
    or cth.dossier is not null
  )
  order by (orh.dossier is not null or cth.dossier is not null) desc, cl.nom, cl.prenom
  limit greatest(1, least(coalesce(lim,60), 200));
$function$
;

CREATE OR REPLACE FUNCTION public.couvertures_acquises(p_dossier text, p_nom text, p_prenom text)
 RETURNS TABLE(dossier text, police text, compagnie text, domaine text, situation text, preneur text, objet text)
 LANGUAGE sql
 STABLE
AS $function$
  select distinct on (o.dossier, o.police)
         o.dossier, o.police,
         coalesce(c.compagnie, o.compagnie)   as compagnie,
         coalesce(c.domaine,  o.domaine)       as domaine,
         coalesce(c.situation, o.situation)    as situation,
         nullif(trim(coalesce(c.nom_client,'')||' '||coalesce(c.prenom_client,'')),'') as preneur,
         o.description                          as objet
  from objets_risque o
  left join contrats c on c.dossier = o.dossier and c.police = o.police
  where o.type_risque ilike '%personne%'
    and coalesce(o.dossier,'') <> coalesce(p_dossier,'')
    and lower(unaccent(o.description)) = lower(unaccent(coalesce(p_nom,'')||' '||coalesce(p_prenom,'')))
  order by o.dossier, o.police;
$function$
;

CREATE OR REPLACE FUNCTION public.notes_frais_ligne_calc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.est_km then
    new.km_taux := coalesce(new.km_taux, 0);
    new.km_distance := coalesce(new.km_distance, 0);
    new.montant_ttc := round(new.km_distance * new.km_taux, 2);
    new.taux_tva := 0; new.montant_tva := 0;
    new.montant_ht := new.montant_ttc;
  else
    new.montant_ttc := coalesce(new.montant_ttc, 0);
    new.taux_tva := coalesce(new.taux_tva, 0);
    new.montant_tva := round(new.montant_ttc * new.taux_tva / (100 + new.taux_tva), 2);
    new.montant_ht := new.montant_ttc - new.montant_tva;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.notes_frais_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nid uuid;
begin
  nid := coalesce(new.note_id, old.note_id);
  update public.notes_frais n set
    total     = coalesce((select sum(montant_ttc) from public.notes_frais_lignes where note_id=nid),0),
    total_ht  = coalesce((select sum(montant_ht)  from public.notes_frais_lignes where note_id=nid),0),
    total_tva = coalesce((select sum(montant_tva) from public.notes_frais_lignes where note_id=nid),0),
    updated_at = now()
  where n.id = nid;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.nf_valider(p_note_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note public.notes_frais;
  v_email text := lower(auth.jwt()->>'email');
  v_pfx text; v_soc text; v_yr text; v_seq int; v_numero text;
  v_benef_nom text; v_benef_iban text; v_fa_id bigint; v_nom text; v_valid_nom text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Reserve aux administrateurs'; END IF;
  SELECT * INTO v_note FROM public.notes_frais WHERE id = p_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note introuvable'; END IF;
  IF v_note.statut <> 'soumise' THEN RAISE EXCEPTION 'La note doit etre soumise avant validation'; END IF;

  v_pfx := CASE v_note.societe
    WHEN 'dynassur' THEN 'DYN' WHEN 'dtx' THEN 'DTX' WHEN 'lode' THEN 'LODE'
    WHEN 'hexagroup' THEN 'HEX' WHEN 'prive' THEN 'PRV' WHEN 'groupe' THEN 'GRP'
    ELSE upper(v_note.societe) END;
  v_soc := CASE v_note.societe
    WHEN 'dynassur' THEN 'DYNASSUR' WHEN 'dtx' THEN 'DTX' WHEN 'lode' THEN 'LODE'
    WHEN 'hexagroup' THEN 'HEXAGROUP' WHEN 'prive' THEN 'PRIVE' WHEN 'groupe' THEN 'GROUPE'
    ELSE upper(v_note.societe) END;
  v_yr := to_char(now(),'YYYY');

  IF v_note.numero IS NULL THEN
    SELECT coalesce(max(split_part(numero,'-',4)::int),0)+1 INTO v_seq
      FROM public.notes_frais
     WHERE societe = v_note.societe AND numero LIKE 'NF-'||v_pfx||'-'||v_yr||'-%';
    v_numero := 'NF-'||v_pfx||'-'||v_yr||'-'||lpad(v_seq::text,3,'0');
  ELSE
    v_numero := v_note.numero;
  END IF;

  SELECT nom, iban INTO v_benef_nom, v_benef_iban
    FROM public.user_permissions WHERE lower(user_email) = lower(v_note.auteur_email) LIMIT 1;
  SELECT nom INTO v_valid_nom FROM public.user_permissions WHERE lower(user_email) = v_email LIMIT 1;

  UPDATE public.notes_frais
     SET statut='validee', validee_at=coalesce(validee_at, now()), numero=v_numero,
         benef_iban=v_benef_iban, benef_nom=coalesce(v_benef_nom, v_note.auteur_nom),
         valide_par=v_email, valide_par_nom=coalesce(v_valid_nom, v_email), updated_at=now()
   WHERE id = p_note_id;

  v_nom := to_char(now(),'YYYYMMDD')||' - '||v_soc||' - NOTE DE FRAIS - '||v_numero
           ||' - '||replace(to_char(coalesce(v_note.total,0),'FM999990.00'),'.',',')||'€';

  IF v_note.facture_achat_id IS NOT NULL THEN
    UPDATE public.factures_achat
       SET nom=v_nom, societe=v_soc, montant=coalesce(v_note.total,0),
           date_facture=current_date, sens='achat', updated_at=now()
     WHERE id = v_note.facture_achat_id;
    v_fa_id := v_note.facture_achat_id;
  ELSE
    INSERT INTO public.factures_achat(fichier_id, nom, societe, montant, date_facture, sens)
    VALUES (v_numero, v_nom, v_soc, coalesce(v_note.total,0), current_date, 'achat')
    RETURNING id INTO v_fa_id;
    UPDATE public.notes_frais SET facture_achat_id=v_fa_id WHERE id=p_note_id;
  END IF;

  RETURN jsonb_build_object(
    'numero', v_numero, 'total', coalesce(v_note.total,0),
    'benef_nom', coalesce(v_benef_nom, v_note.auteur_nom),
    'benef_iban', v_benef_iban, 'societe', v_soc, 'facture_achat_id', v_fa_id);
END $function$
;

CREATE OR REPLACE FUNCTION public.nf_set_piece(p_note_id uuid, p_path text, p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_fa bigint; v_email text := lower(auth.jwt()->>'email');
BEGIN
  SELECT facture_achat_id INTO v_fa FROM public.notes_frais
   WHERE id=p_note_id AND (public.is_admin() OR lower(auteur_email)=v_email);
  IF NOT FOUND THEN RAISE EXCEPTION 'Non autorise'; END IF;
  UPDATE public.notes_frais SET piece_pdf_path=p_path, updated_at=now() WHERE id=p_note_id;
  IF v_fa IS NOT NULL THEN
    UPDATE public.factures_achat SET chemin=p_path, url=p_url, updated_at=now() WHERE id=v_fa;
  END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.nf_devalider(p_note_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_fa bigint; v_email text := lower(auth.jwt()->>'email');
BEGIN
  SELECT facture_achat_id INTO v_fa FROM public.notes_frais
   WHERE id=p_note_id AND (public.is_admin() OR lower(auteur_email)=v_email);
  IF NOT FOUND THEN RAISE EXCEPTION 'Non autorise'; END IF;
  IF v_fa IS NOT NULL THEN DELETE FROM public.factures_achat WHERE id=v_fa; END IF;
  UPDATE public.notes_frais
     SET statut='brouillon', validee_at=NULL, facture_achat_id=NULL, updated_at=now()
   WHERE id=p_note_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.nf_soumettre(p_note_id uuid, p_sig_type text, p_sig_image text DEFAULT NULL::text, p_sig_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_note public.notes_frais;
  v_email text := lower(auth.jwt()->>'email');
  v_nom text; v_manq int; v_nb int;
  v_pfx text; v_yr text; v_seq int; v_numero text;
  v_montant text; v_titre text;
begin
  select * into v_note from public.notes_frais where id = p_note_id;
  if not found then raise exception 'Note introuvable'; end if;
  if not (public.is_admin() or lower(v_note.auteur_email) = v_email) then raise exception 'Non autorise'; end if;
  if v_note.statut = 'validee' then raise exception 'Note deja validee'; end if;

  select count(*) into v_nb from public.notes_frais_lignes where note_id = p_note_id;
  if v_nb = 0 then raise exception 'Aucune ligne a soumettre'; end if;
  select count(*) into v_manq from public.notes_frais_lignes
    where note_id = p_note_id and coalesce(categorie,'') <> 'Kilométrique' and coalesce(justificatif_path,'') = '';
  if v_manq > 0 then raise exception '% ligne(s) sans justificatif', v_manq; end if;

  if p_sig_type = 'dessin' then
    if coalesce(p_sig_image,'') = '' then raise exception 'Signature manquante'; end if;
  elsif p_sig_type = 'eidas' then
    if coalesce(p_sig_ref,'') = '' then raise exception 'Reference eIDAS manquante'; end if;
  else
    raise exception 'Type de signature invalide';
  end if;

  -- Numero (attribue a la soumission)
  v_numero := v_note.numero;
  if v_numero is null or v_numero = '' then
    v_pfx := case v_note.societe
      when 'dynassur' then 'DYN' when 'dtx' then 'DTX' when 'lode' then 'LODE'
      when 'hexagroup' then 'HEX' when 'prive' then 'PRV' when 'groupe' then 'GRP'
      else upper(v_note.societe) end;
    v_yr := to_char(coalesce(v_note.created_at, now()), 'YYYY');
    perform pg_advisory_xact_lock(hashtextextended(v_note.societe || '-' || v_yr, 0));
    select coalesce(max(split_part(numero, '-', 4)::int), 0) + 1 into v_seq
      from public.notes_frais
     where societe = v_note.societe and numero like 'NF-' || v_pfx || '-' || v_yr || '-%';
    v_numero := 'NF-' || v_pfx || '-' || v_yr || '-' || lpad(v_seq::text, 3, '0');
  end if;

  -- Titre : on (re)pose le montant total en fin ("... - 432,34€"), en preservant la date/code deja saisis
  v_montant := replace(to_char(coalesce(v_note.total, 0), 'FM999999990.00'), '.', ',');
  v_titre := btrim(regexp_replace(coalesce(v_note.titre, ''), '\s*-\s*[0-9.,]+\s*€\s*$', ''));
  if v_titre = '' then
    v_titre := to_char(coalesce(v_note.created_at, now()), 'YYYYMMDD') || ' - NF - ' || coalesce(v_note.auteur_code, '');
  end if;
  v_titre := v_titre || ' - ' || v_montant || '€';

  select nom into v_nom from public.user_permissions where lower(user_email) = lower(v_note.auteur_email) limit 1;

  update public.notes_frais
     set statut='soumise', soumise_at=now(), numero=v_numero, titre=v_titre,
         sig_type=p_sig_type, sig_image=p_sig_image, sig_ref=p_sig_ref, sig_at=now(),
         sig_nom=coalesce(v_nom, v_note.auteur_nom), sig_email=v_note.auteur_email,
         refus_motif=null, refus_at=null, refus_par=null, updated_at=now()
   where id = p_note_id;

  return jsonb_build_object('statut','soumise', 'numero', v_numero, 'titre', v_titre);
end $function$
;

CREATE OR REPLACE FUNCTION public.nf_refuser(p_note_id uuid, p_motif text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_note public.notes_frais;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Reserve aux administrateurs'; END IF;
  SELECT * INTO v_note FROM public.notes_frais WHERE id = p_note_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note introuvable'; END IF;
  UPDATE public.notes_frais
     SET statut='brouillon', refus_motif=p_motif, refus_at=now(), refus_par=lower(auth.jwt()->>'email'),
         soumise_at=NULL, sig_type=NULL, sig_image=NULL, sig_ref=NULL, sig_at=NULL, sig_nom=NULL, sig_email=NULL,
         validee_at=NULL, updated_at=now()
   WHERE id = p_note_id;
  RETURN jsonb_build_object('statut','brouillon');
END $function$
;

CREATE OR REPLACE FUNCTION public.norm_name(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select coalesce(
    (select string_agg(tok,' ' order by tok)
     from regexp_split_to_table(
        regexp_replace(lower(unaccent(coalesce(t,''))), '[^a-z ]', ' ', 'g'),
        '\s+') as tok
     where tok <> ''),
  '');
$function$
;

CREATE OR REPLACE FUNCTION public.maj_solde_compte(p_id uuid, p_solde numeric)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update comptes_bancaires
  set solde_actuel = p_solde,
      date_synchro = now()
  where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.hexagroup_results()
 RETURNS TABLE(place_id text, voter_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select place_id, voter_name from hexagroup_votes order by updated_at;
$function$
;

CREATE OR REPLACE FUNCTION public.hexagroup_vote(p_name text, p_places text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text := lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
begin
  if char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 40 then raise exception 'nom invalide'; end if;
  if p_places is null or cardinality(p_places) = 0 or cardinality(p_places) > 10 then raise exception 'choix invalide'; end if;
  if (select count(distinct voter_key) from hexagroup_votes) >= 80 and not exists (select 1 from hexagroup_votes where voter_key = k) then
    raise exception 'trop de votes';
  end if;
  delete from hexagroup_votes where voter_key = k;
  insert into hexagroup_votes(voter_key, voter_name, place_id)
  select distinct k, btrim(p_name), x from unnest(p_places) x;
end $function$
;

CREATE OR REPLACE FUNCTION public.ticket_add_email_message(p_ticket bigint, p_from_email text, p_from_name text, p_body text, p_secret text, p_msg_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ok boolean; v_code text; v_nom text;
  v_titre text; v_client_id bigint; v_dossier text;
  v_auteur_nom text; v_role text; v_client_nom text;
begin
  select (value = p_secret) into v_ok from config_secrets where key = 'hub_ticket_intake_secret';
  if not coalesce(v_ok, false) then return jsonb_build_object('ok', false, 'error', 'secret'); end if;

  select titre, client_id, dossier_client into v_titre, v_client_id, v_dossier
    from taches where id = p_ticket and is_ticket = true;
  if v_titre is null then return jsonb_build_object('ok', false, 'error', 'ticket_introuvable'); end if;

  -- anti-doublon : mail déjà intégré
  if p_msg_id is not null and exists (select 1 from tickets_messages where email_message_id = p_msg_id) then
    return jsonb_build_object('ok', true, 'dedup', true, 'ticket', p_ticket);
  end if;

  -- 1) expéditeur interne ?
  select collab_code, coalesce(o365_display_name, nom) into v_code, v_nom
    from user_permissions where lower(user_email) = lower(coalesce(p_from_email,'')) limit 1;

  if v_code is not null then
    v_auteur_nom := coalesce(v_nom, p_from_name, p_from_email); v_role := 'interne';
  else
    -- 2) sinon : seulement si = client du dossier du ticket
    select btrim(coalesce(c.prenom,'') || ' ' || coalesce(c.nom,''))
      into v_client_nom
      from clients c
     where lower(c.email) = lower(coalesce(p_from_email,''))
       and ( c.id = v_client_id or (v_dossier is not null and c.dossier = v_dossier) )
     limit 1;
    if v_client_nom is null then
      return jsonb_build_object('ok', false, 'error', 'expediteur_non_autorise');
    end if;
    v_auteur_nom := coalesce(nullif(v_client_nom,''), p_from_name, p_from_email); v_role := 'client';
  end if;

  insert into tickets_messages(tache_id, auteur_code, auteur_nom, auteur_email, message, type, email_message_id)
  values (p_ticket, v_code, v_auteur_nom, p_from_email, nullif(btrim(p_body),''), 'email', p_msg_id);
  update taches set derniere_activite = now() where id = p_ticket;

  return jsonb_build_object('ok', true, 'role', v_role, 'ticket', p_ticket, 'auteur_code', v_code);
end $function$
;

CREATE OR REPLACE FUNCTION public.execute_raw_sql(sql_query text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  EXECUTE 'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (' || sql_query || ') t' INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.tickets_rappels_echeance()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
declare
  r record; n integer := 0; v_subject text; v_html text; v_open text; v_close text;
begin
  for r in
    select t.id, t.titre, t.ticket_echeance,
           up.user_email,
           case when t.ticket_echeance < current_date then 'retard'
                when t.ticket_echeance = current_date + 1 then 'demain' end as kind
    from public.taches t
    join public.user_permissions up on upper(up.collab_code) = upper(t.gestionnaire)
    where t.is_ticket = true
      and coalesce(t.ticket_statut,'nouveau') not in ('resolu','cloture')
      and t.ticket_echeance is not null
      and up.user_email is not null
      and (t.ticket_echeance < current_date or t.ticket_echeance = current_date + 1)
  loop
    v_open  := '<a href="https://hub-dtx.vercel.app/tickets?ticket='||r.id||'" style="background:#1E5799;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">Ouvrir le ticket</a>';
    v_close := '<a href="https://hub-dtx.vercel.app/tickets?ticket='||r.id||'&do=resolve" style="background:#2E7D32;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">✅ Clôturer (Résolu)</a>';
    if r.kind = 'retard' then
      v_subject := '⏰ Ticket [#'||r.id||'] en retard — '||coalesce(r.titre,'');
      v_html := '<div style="font-family:Arial,sans-serif;color:#1A3A6B"><p>Bonjour,</p><p>Le ticket <b>#'||r.id||'</b> — '||coalesce(r.titre,'')||' est <b style="color:#E74C3C">EN RETARD</b> (échéance le '||to_char(r.ticket_echeance,'DD/MM/YYYY')||').</p><p style="margin-top:14px">'||v_open||' &nbsp; '||v_close||'</p><p style="color:#8A9BBE;font-size:12px;margin-top:16px">Hub DTX — rappel automatique</p></div>';
    else
      v_subject := '⏰ Ticket [#'||r.id||'] à échéance demain — '||coalesce(r.titre,'');
      v_html := '<div style="font-family:Arial,sans-serif;color:#1A3A6B"><p>Bonjour,</p><p>Le ticket <b>#'||r.id||'</b> — '||coalesce(r.titre,'')||' arrive à <b>échéance demain</b> ('||to_char(r.ticket_echeance,'DD/MM/YYYY')||').</p><p style="margin-top:14px">'||v_open||' &nbsp; '||v_close||'</p><p style="color:#8A9BBE;font-size:12px;margin-top:16px">Hub DTX — rappel automatique</p></div>';
    end if;
    perform net.http_post(
      url := 'https://n8n.srv1082740.hstgr.cloud/webhook/ticket-alerte',
      body := jsonb_build_object('to', jsonb_build_array(r.user_email), 'subject', v_subject, 'html', v_html),
      headers := jsonb_build_object('Content-Type','application/json')
    );
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.creer_ticket_depuis_mail(p_subject text, p_body text, p_from_email text, p_from_name text, p_msg_id text DEFAULT NULL::text, p_secret text DEFAULT NULL::text, p_entite text DEFAULT 'dynassur'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_ok boolean; v_code text; v_nom text; v_titre text; v_id bigint; v_email_lde text; v_html text;
begin
  select (value = p_secret) into v_ok from config_secrets where key = 'hub_ticket_intake_secret';
  if not coalesce(v_ok,false) then return jsonb_build_object('ok',false,'error','secret'); end if;

  -- ignorer les réponses à un ticket existant (gérées par le fil)
  if coalesce(p_subject,'') ~ '\[#[0-9]+\]' then
    return jsonb_build_object('ok',true,'skipped','reponse_ticket');
  end if;
  -- anti-doublon : mail déjà intégré
  if p_msg_id is not null and exists (select 1 from tickets_messages where email_message_id = p_msg_id) then
    return jsonb_build_object('ok',true,'dedup',true);
  end if;

  v_titre := btrim(regexp_replace(coalesce(p_subject,''), '^\s*hub\s*[-:]\s*', '', 'i'));
  if v_titre = '' then v_titre := '(sans objet)'; end if;

  -- expéditeur interne ?
  select collab_code, coalesce(o365_display_name, nom) into v_code, v_nom
    from user_permissions where lower(user_email) = lower(coalesce(p_from_email,'')) limit 1;

  insert into taches(titre, description, is_ticket, entite, ticket_categorie, ticket_statut, ticket_origine,
                     priorite, gestionnaire, participants, cree_par, user_email, statut, source, derniere_activite, date_creation)
  values (v_titre, nullif(btrim(coalesce(p_body,'')),''), true, coalesce(p_entite,'dynassur'), null, 'nouveau', 'mail',
          'moyenne', null, '[]'::jsonb, v_code, p_from_email, 'todo', 'ticket', now(), now())
  returning id into v_id;

  insert into tickets_messages(tache_id, auteur_code, auteur_nom, auteur_email, message, type, email_message_id)
  values (v_id, v_code, coalesce(v_nom, p_from_name, p_from_email), p_from_email, nullif(btrim(coalesce(p_body,'')),''), 'email', p_msg_id);

  insert into tickets_messages(tache_id, auteur_code, type, message)
  values (v_id, 'MAIL', 'systeme', 'Ticket créé depuis un e-mail de ' || coalesce(p_from_name, p_from_email, 'inconnu'));

  -- notifier l'admin (LDE) qu'un ticket à attribuer est arrivé
  select user_email into v_email_lde from user_permissions where upper(collab_code)='LDE' limit 1;
  if v_email_lde is not null then
    v_html := '<div style="font-family:Arial,sans-serif;color:#1A3A6B"><p>Un <b>nouveau ticket</b> est arrivé par e-mail (à attribuer) :</p>'
      || '<p><b>#'||v_id||'</b> — '||replace(v_titre,'&','&amp;')||'<br><span style="color:#8A9BBE;font-size:13px">de '||coalesce(replace(p_from_name,'&','&amp;'),p_from_email,'?')||'</span></p>'
      || '<p style="margin-top:14px"><a href="https://hub-dtx.vercel.app/tickets?ticket='||v_id||'" style="background:#1E5799;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">Ouvrir le ticket</a></p>'
      || '<p style="color:#8A9BBE;font-size:12px;margin-top:16px">Hub DTX — notification automatique</p></div>';
    perform net.http_post(url := 'https://n8n.srv1082740.hstgr.cloud/webhook/ticket-alerte',
      body := jsonb_build_object('to', jsonb_build_array(v_email_lde), 'subject','Nouveau ticket [#'||v_id||'] (par e-mail)','html', v_html),
      headers := jsonb_build_object('Content-Type','application/json'));
  end if;

  return jsonb_build_object('ok',true,'ticket',v_id);
end $function$
;

-- ============================================================================
-- Vues (ordre de dépendance)
-- ============================================================================
CREATE OR REPLACE VIEW public.dyn_clients AS
 SELECT id,
    'particulier'::text AS type,
    TRIM(BOTH FROM (COALESCE(nom, ''::text) || ' '::text) || COALESCE(prenom, ''::text)) AS denomination,
    nom,
    prenom,
    TRIM(BOTH FROM ((COALESCE(rue, ''::text) || ' '::text) || COALESCE(num_maison, ''::text)) ||
        CASE
            WHEN boite IS NOT NULL AND boite <> ''::text THEN ' bte '::text || boite
            ELSE ''::text
        END) AS adresse,
    cp,
    localite AS ville,
    'Belgique'::text AS pays,
    NULL::text AS tva,
    NULL::text AS numero_bce,
    email,
    tel_fixe AS telephone,
    gsm,
    NULL::text AS langue,
    dossier,
    true AS actif
   FROM clients;

CREATE OR REPLACE VIEW public.v_bordereaux_reconciliation AS
 SELECT compagnie,
    annee,
    mois,
    bool_or(type = 'BQT'::text) AS has_bqt,
    bool_or(type = 'RCP'::text) AS has_rcp,
    bool_or(type = 'BQT'::text) AS bqt_recu,
    bool_or(type = 'RCP'::text) AS rcp_recu,
    sum(
        CASE
            WHEN type = 'BQT'::text THEN montant
            ELSE 0::numeric
        END) AS montant_bqt,
    sum(
        CASE
            WHEN type = 'RCP'::text THEN montant
            ELSE 0::numeric
        END) AS montant_rcp,
    sum(
        CASE
            WHEN type = 'BQT'::text THEN commission
            ELSE 0::numeric
        END) AS commission_bqt,
    sum(
        CASE
            WHEN type = 'RCP'::text THEN commission
            ELSE 0::numeric
        END) AS commission_rcp,
    sum(
        CASE
            WHEN type = 'BQT'::text THEN montant
            ELSE 0::numeric
        END) - sum(
        CASE
            WHEN type = 'RCP'::text THEN montant
            ELSE 0::numeric
        END) AS ecart,
    count(*) AS nb_bordereaux
   FROM bordereaux
  GROUP BY compagnie, annee, mois
  ORDER BY compagnie, annee, mois;

CREATE OR REPLACE VIEW public.v_ca_producteur AS
 SELECT EXTRACT(year FROM q.date_comptable)::integer AS annee,
    COALESCE(c.code, '—'::text) AS code,
    q.sous_agent AS producteur,
        CASE
            WHEN c.est_sous_agent THEN 'Sous-agent'::text
            WHEN c.est_apporteur THEN 'Apporteur'::text
            WHEN c.est_commercial OR c.est_gestionnaire THEN 'Employé/Juprelle'::text
            ELSE 'Non classé'::text
        END AS categorie,
    count(*) AS nb_quittances,
    round(sum(q.commission)) AS ca_commission
   FROM quittances q
     LEFT JOIN collaborateurs c ON c.nom_sa_data = q.sous_agent
  WHERE q.commission IS NOT NULL
  GROUP BY (EXTRACT(year FROM q.date_comptable)::integer), (COALESCE(c.code, '—'::text)), q.sous_agent, (
        CASE
            WHEN c.est_sous_agent THEN 'Sous-agent'::text
            WHEN c.est_apporteur THEN 'Apporteur'::text
            WHEN c.est_commercial OR c.est_gestionnaire THEN 'Employé/Juprelle'::text
            ELSE 'Non classé'::text
        END);

CREATE OR REPLACE VIEW public.v_famille_clients AS
 SELECT f.numero_brio,
    f.dossier AS dossier_principal,
    f.nom_principal,
    f.prenom_principal,
    f.type_relation_libelle AS relation,
    f.relation_active,
    f.nom_lie,
    f.prenom_lie,
    f.clef_recherche,
    f.cp_lie,
    f.localite_lie,
    cl_lie.dossier AS dossier_lie,
    cl_lie.gsm AS gsm_lie,
    cl_lie.email AS email_lie
   FROM famille f
     LEFT JOIN clients cl_lie ON upper(TRIM(BOTH FROM cl_lie.nom || cl_lie.prenom)) = upper(replace(replace(f.clef_recherche, ' '::text, ''::text), '-'::text, ''::text)) AND length(f.clef_recherche) > 5;

CREATE OR REPLACE VIEW public.v_garanties_catalogue WITH (security_invoker = true) AS
 SELECT domaine,
    garantie,
    count(*)::integer AS n
   FROM objets_risque
  WHERE garantie IS NOT NULL AND domaine IS NOT NULL
  GROUP BY domaine, garantie
 HAVING count(*) >= 20;

CREATE OR REPLACE VIEW public.v_paiements_rcp_2026 AS
 WITH base AS (
         SELECT t.id AS transaction_id,
            t.montant,
            t.date_execution,
            t.contrepartie_nom,
            regexp_replace(t.information_paiement, '\s+'::text, ' '::text, 'g'::text) AS comm
           FROM transactions t
          WHERE (t.compte_id = ANY (ARRAY['d176f437-4899-4215-a4a4-25ca1b9a461f'::uuid, 'bdddd436-d967-4424-9a39-86689c1b42ce'::uuid, 'eeb333f7-8554-4085-8440-004bb76fcbff'::uuid])) AND t.montant > 0::numeric AND t.date_execution >= '2026-01-01'::date
        ), mapped AS (
         SELECT b.transaction_id,
            b.montant,
            b.date_execution,
            b.contrepartie_nom,
            b.comm,
                CASE
                    WHEN b.contrepartie_nom ~~* 'AG INSURANCE%'::text THEN 'AG'::text
                    WHEN b.contrepartie_nom ~~* 'AXA%'::text THEN 'AXA'::text
                    WHEN b.contrepartie_nom ~* 'P ?& ?V|P V ASSUR'::text THEN 'VIVIUM'::text
                    WHEN b.contrepartie_nom ~~* 'BALOISE BELGIUM%'::text THEN 'BALOISE'::text
                    WHEN b.contrepartie_nom ~~* 'DKV%'::text THEN 'DKV'::text
                    WHEN b.contrepartie_nom ~* 'DAS RECHT|^DAS '::text THEN 'DAS'::text
                    WHEN b.contrepartie_nom ~~* 'NN INSURANCE%'::text THEN 'NN'::text
                    WHEN b.contrepartie_nom ~~* 'CARDIF%'::text THEN 'CARDIF'::text
                    WHEN b.contrepartie_nom ~~* 'ALLIANZ BENELUX%'::text THEN 'ALLIANZ'::text
                    WHEN b.contrepartie_nom ~~* 'MONUMENT%'::text THEN 'MONUMENT'::text
                    WHEN b.contrepartie_nom ~~* 'AEDES%'::text THEN 'AEDES'::text
                    WHEN b.contrepartie_nom ~~* 'ATHORA%'::text THEN 'ATHORA'::text
                    WHEN b.contrepartie_nom ~~* 'AMMA%'::text THEN 'AMMA'::text
                    WHEN b.contrepartie_nom ~~* 'ARAG%'::text THEN 'ARAG'::text
                    WHEN b.contrepartie_nom ~~* 'EUROMEX%'::text THEN 'EUROMEX'::text
                    ELSE NULL::text
                END AS code_comp
           FROM base b
        ), ext AS (
         SELECT m.transaction_id,
            m.montant,
            m.date_execution,
            m.contrepartie_nom,
            m.comm,
            m.code_comp,
                CASE m.code_comp
                    WHEN 'AG'::text THEN "substring"(m.comm, 'PRODUCTEUR-001000(\d+)EUR'::text)
                    WHEN 'AXA'::text THEN "substring"(m.comm, 'CPT NR0*(\d+)\s'::text)
                    WHEN 'VIVIUM'::text THEN "substring"(m.comm, '0*(\d+) SOLDE CR'::text)
                    WHEN 'BALOISE'::text THEN "substring"(m.comm, 'SOLDE INT (\d+)'::text)
                    WHEN 'DKV'::text THEN "substring"(m.comm, 'REF\. (\d+)'::text)
                    WHEN 'DAS'::text THEN "substring"(m.comm, 'PROD\. 0*(\d+)/'::text)
                    WHEN 'NN'::text THEN "substring"(m.comm, '(\d{5,}) SOLDE'::text)
                    WHEN 'CARDIF'::text THEN "substring"(m.comm, '(\S+)\+COM'::text)
                    WHEN 'ALLIANZ'::text THEN "substring"(m.comm, 'AGENT (BCAB\d+)'::text)
                    WHEN 'MONUMENT'::text THEN "substring"(m.comm, '(\d+) ?/ ?MONTH'::text)
                    WHEN 'AEDES'::text THEN "substring"(m.comm, '(C\d+)/'::text)
                    WHEN 'ATHORA'::text THEN "substring"(m.comm, '0*(\d+) SOLDE CRED'::text)
                    WHEN 'AMMA'::text THEN "substring"(m.comm, '(\d+) - \d{2}/\d{4}'::text)
                    WHEN 'ARAG'::text THEN "substring"(m.comm, 'CPT\. NO\. (\d+)'::text)
                    WHEN 'EUROMEX'::text THEN "substring"(m.comm, 'SOLDE INT (\d+) \d{6}'::text)
                    ELSE NULL::text
                END AS prod_brut,
                CASE m.code_comp
                    WHEN 'AG'::text THEN "substring"(m.comm, 'EUR-(\d{4}-\d{2})'::text)
                    WHEN 'DAS'::text THEN
                    CASE
                        WHEN "substring"(m.comm, 'PROD\. \d+/(\d{4})'::text) ~ '^\d{4}$'::text THEN (('20'::text || "left"("substring"(m.comm, 'PROD\. \d+/(\d{4})'::text), 2)) || '-'::text) || "right"("substring"(m.comm, 'PROD\. \d+/(\d{4})'::text), 2)
                        ELSE NULL::text
                    END
                    WHEN 'NN'::text THEN to_char(to_date("substring"(m.comm, 'SOLDE (\d{2}/\d{4})'::text), 'MM/YYYY'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    WHEN 'CARDIF'::text THEN to_char(to_date("substring"(m.comm, 'NSBL(\d{6})'::text), 'MMYYYY'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    WHEN 'AEDES'::text THEN to_char(to_date("substring"(m.comm, '(\d{2}\.\d{4})'::text), 'MM.YYYY'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    WHEN 'AMMA'::text THEN to_char(to_date("substring"(m.comm, '- (\d{2}/\d{4})'::text), 'MM/YYYY'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    WHEN 'ARAG'::text THEN to_char(to_date("substring"(m.comm, 'SOLDE (\d{4}\.\d{2})'::text), 'YYYY.MM'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    WHEN 'EUROMEX'::text THEN to_char(to_date("substring"(m.comm, 'INT \d+ (\d{6})'::text), 'YYYYMM'::text)::timestamp with time zone, 'YYYY-MM'::text)
                    ELSE NULL::text
                END AS periode_comm
           FROM mapped m
          WHERE m.code_comp IS NOT NULL
        )
 SELECT transaction_id,
    montant,
    date_execution,
    contrepartie_nom,
    code_comp,
        CASE
            WHEN prod_brut ~ '^0+\d'::text THEN ltrim(prod_brut, '0'::text)
            ELSE prod_brut
        END AS producteur,
    COALESCE(periode_comm, to_char(date_execution - '1 mon'::interval, 'YYYY-MM'::text)) AS periode
   FROM ext;

CREATE OR REPLACE VIEW public.v_pnl_producteur_2026 AS
 WITH q AS (
         SELECT q.sous_agent,
            q.commission,
                CASE
                    WHEN q.domaine = 'Vie et placements'::text THEN 'Vie'::text
                    WHEN q.domaine = 'Prêt'::text THEN 'Crédit'::text
                    WHEN q.domaine = 'Protection juridique'::text THEN 'PJ'::text
                    WHEN q.domaine = 'Individuelle'::text THEN 'Santé'::text
                    ELSE 'Non-Vie'::text
                END AS type_travail
           FROM quittances q
          WHERE q.domaine IS NOT NULL AND q.domaine <> '-'::text AND q.commission IS NOT NULL
        ), brut AS (
         SELECT q.sous_agent,
            q.commission,
            q.type_travail,
            c1.code AS code_brut,
            c1.regroupe_code
           FROM q
             LEFT JOIN collaborateurs c1 ON lower(TRIM(BOTH FROM c1.nom_sa_data)) = lower(TRIM(BOTH FROM q.sous_agent))
        ), eff AS (
         SELECT b.commission,
            b.type_travail,
            b.sous_agent,
            c2.id AS collab_id,
            c2.code,
            c2.nom_sa_data,
            COALESCE(c2.est_sous_agent, false) AS est_sa
           FROM brut b
             LEFT JOIN collaborateurs c2 ON c2.code = COALESCE(b.regroupe_code, b.code_brut)
        ), jt AS (
         SELECT eff.commission,
            eff.type_travail,
            eff.sous_agent,
            eff.collab_id,
            eff.code,
            eff.nom_sa_data,
            eff.est_sa,
            ct.taux
           FROM eff
             LEFT JOIN collaborateur_taux ct ON ct.collaborateur_id = eff.collab_id AND ct.type_travail = eff.type_travail AND COALESCE(ct.actif, true) = true
        )
 SELECT COALESCE(code, '(non rattaché)'::text) AS code,
    max(COALESCE(nom_sa_data, sous_agent)) AS nom,
    bool_or(est_sa) AS est_sous_agent,
    round(sum(commission)) AS commission,
    round(sum(commission * COALESCE(taux, 0::numeric) / 100.0)) AS production_attribuee,
    round(sum(
        CASE
            WHEN est_sa THEN commission * COALESCE(taux, 0::numeric) / 100.0
            ELSE 0::numeric
        END)) AS retrocession_versee,
    round(sum(commission -
        CASE
            WHEN est_sa THEN commission * COALESCE(taux, 0::numeric) / 100.0
            ELSE 0::numeric
        END)) AS marge_dynassur,
    count(*) FILTER (WHERE collab_id IS NOT NULL AND taux IS NULL) AS lignes_sans_taux
   FROM jt
  GROUP BY code
  ORDER BY (round(sum(commission))) DESC;

CREATE OR REPLACE VIEW public.v_pnl_producteur_annee AS
 WITH q AS (
         SELECT EXTRACT(year FROM q.date_comptable)::integer AS annee,
            q.sous_agent,
            q.commission,
                CASE
                    WHEN q.domaine = 'Vie et placements'::text THEN 'Vie'::text
                    WHEN q.domaine = 'Prêt'::text THEN 'Crédit'::text
                    WHEN q.domaine = 'Protection juridique'::text THEN 'PJ'::text
                    WHEN q.domaine = 'Individuelle'::text THEN 'Santé'::text
                    ELSE 'Non-Vie'::text
                END AS type_travail
           FROM quittances q
          WHERE q.domaine IS NOT NULL AND q.domaine <> '-'::text AND q.commission IS NOT NULL AND q.date_comptable IS NOT NULL
        ), brut AS (
         SELECT q.annee,
            q.sous_agent,
            q.commission,
            q.type_travail,
            c1.code AS code_brut,
            c1.regroupe_code
           FROM q
             LEFT JOIN collaborateurs c1 ON lower(TRIM(BOTH FROM c1.nom_sa_data)) = lower(TRIM(BOTH FROM q.sous_agent))
        ), eff AS (
         SELECT b.annee,
            b.commission,
            b.type_travail,
            c2.id AS collab_id,
            c2.code,
            c2.nom_sa_data AS nom,
            COALESCE(c2.est_sous_agent, false) AS est_sa
           FROM brut b
             LEFT JOIN collaborateurs c2 ON c2.code = COALESCE(b.regroupe_code, b.code_brut)
        ), jt AS (
         SELECT eff.annee,
            eff.commission,
            eff.type_travail,
            eff.collab_id,
            eff.code,
            eff.nom,
            eff.est_sa,
            ct.taux
           FROM eff
             LEFT JOIN collaborateur_taux ct ON ct.collaborateur_id = eff.collab_id AND ct.type_travail = eff.type_travail AND COALESCE(ct.actif, true) = true
        ), theo AS (
         SELECT COALESCE(jt.code, '(non rattaché)'::text) AS code,
            max(jt.nom) AS nom,
            jt.annee,
            bool_or(jt.est_sa) AS est_sous_agent,
            round(sum(jt.commission)) AS commission,
            round(sum(
                CASE
                    WHEN jt.est_sa THEN jt.commission * COALESCE(jt.taux, 0::numeric) / 100.0
                    ELSE 0::numeric
                END)) AS retro_theorique
           FROM jt
          GROUP BY (COALESCE(jt.code, '(non rattaché)'::text)), jt.annee
        ), paie AS (
         SELECT EXTRACT(year FROM t_1.date_execution)::integer AS annee,
            t_1.contrepartie_nom,
            abs(t_1.montant) AS montant
           FROM transactions t_1
          WHERE (t_1.compte_id = ANY (ARRAY['d176f437-4899-4215-a4a4-25ca1b9a461f'::uuid, 'bdddd436-d967-4424-9a39-86689c1b42ce'::uuid, 'eeb333f7-8554-4085-8440-004bb76fcbff'::uuid])) AND t_1.montant < 0::numeric AND t_1.contrepartie_nom IS NOT NULL AND t_1.contrepartie_nom <> ''::text
        ), sa AS (
         SELECT COALESCE(collaborateurs.regroupe_code, collaborateurs.code) AS code_eff,
            collaborateurs.noms_repris,
            split_part(COALESCE(collaborateurs.nom_sa_data, ''::text), ' '::text, 1) AS nom_fam
           FROM collaborateurs
          WHERE collaborateurs.est_sous_agent
        ), reel AS (
         SELECT sa.code_eff AS code,
            p.annee,
            round(sum(p.montant)) AS paye_reel
           FROM paie p
             JOIN sa ON length(sa.nom_fam) >= 4 AND p.contrepartie_nom ~~* (('%'::text || sa.nom_fam) || '%'::text) OR (EXISTS ( SELECT 1
                   FROM unnest(COALESCE(sa.noms_repris, '{}'::text[])) a(a)
                  WHERE length(a.a) >= 3 AND p.contrepartie_nom ~~* (('%'::text || a.a) || '%'::text)))
          GROUP BY sa.code_eff, p.annee
        )
 SELECT COALESCE(t.code, r.code) AS code,
    t.nom,
    COALESCE(t.annee, r.annee) AS annee,
    COALESCE(t.est_sous_agent, true) AS est_sous_agent,
    COALESCE(t.commission, 0::numeric) AS commission,
    COALESCE(t.retro_theorique, 0::numeric) AS retro_theorique,
        CASE
            WHEN COALESCE(t.est_sous_agent, false) THEN COALESCE(t.commission, 0::numeric) - COALESCE(t.retro_theorique, 0::numeric)
            ELSE COALESCE(t.commission, 0::numeric)
        END AS marge_theorique,
    r.paye_reel
   FROM theo t
     FULL JOIN reel r ON t.code = r.code AND t.annee = r.annee;

CREATE OR REPLACE VIEW public.v_polices_2026_sans_commission AS
 SELECT police,
    sum(COALESCE(commission, 0::numeric)) AS commission_2026,
    sum(COALESCE(prime_totale, 0::numeric)) AS prime_2026,
    count(*) AS nb_quittances_2026,
    max(compagnie) AS compagnie,
    max(type_production) AS produit,
    max(periodicite) AS periodicite,
    max(etat) AS etat,
    max(gestionnaire) AS gestionnaire,
    max(sous_agent) AS sous_agent,
    max(dossier) AS dossier,
    max(client_nom) AS client_nom,
    max(client_prenom) AS client_prenom,
    sum(COALESCE(prime_totale, 0::numeric)) > 0::numeric AS prime_facturee
   FROM quittances
  WHERE date_comptable >= '2026-01-01'::date AND date_comptable <= CURRENT_DATE AND police IS NOT NULL
  GROUP BY police
 HAVING sum(COALESCE(commission, 0::numeric)) = 0::numeric;

CREATE OR REPLACE VIEW public.v_producteurs_officiels AS
 SELECT compagnie,
    compte_producteur,
    max(fsma) AS fsma,
    count(*) AS nb_quittances,
    min(date_comptable) AS premiere_quittance,
    max(date_comptable) AS derniere_quittance
   FROM quittances
  WHERE compagnie IS NOT NULL AND compagnie <> '-'::text AND compte_producteur IS NOT NULL
  GROUP BY compagnie, compte_producteur
  ORDER BY compagnie, compte_producteur;

CREATE OR REPLACE VIEW public.v_risques_clients AS
 SELECT r.police,
    r.type_risque_libelle AS type_risque,
    r.description,
    r.actif,
    r.gestionnaire,
    r.date_creation,
    c.dossier,
    c.compagnie,
    c.domaine,
    c.situation,
    cl.nom AS nom_client,
    cl.prenom AS prenom_client,
    cl.gsm
   FROM risques r
     LEFT JOIN contrats c ON c.police = r.police
     LEFT JOIN clients cl ON cl.dossier = c.dossier;

CREATE OR REPLACE VIEW public.v_taches_enrichies AS
 SELECT t.id,
    t.titre,
    t.priorite,
    t.gestionnaire,
    t.echeance,
    t.statut,
    t.categorie,
    t.created_at,
    t.source,
    t.code_type,
    t.email_objet,
    t.email_de,
    t.client_id,
    t.description,
    t.assigne_par,
    t.assigne_a,
    t.updated_at,
    t.file_attente,
    t.lu_par,
    t.pieces_jointes,
    c.nom AS client_nom,
    c.prenom AS client_prenom,
    c.email AS client_email
   FROM taches t
     LEFT JOIN clients c ON c.id = t.client_id;

CREATE OR REPLACE VIEW public.v_tresorerie_holding AS
 SELECT s.code AS societe,
    s.nom AS societe_nom,
    sum(cb.solde_actuel) AS solde_total,
    max(cb.date_synchro) AS derniere_synchro
   FROM comptes_bancaires cb
     JOIN societes s ON s.id = cb.societe_id
  WHERE cb.actif = true
  GROUP BY s.id, s.code, s.nom
UNION ALL
 SELECT 'HOL'::text AS societe,
    'TOTAL HOLDING'::text AS societe_nom,
    sum(comptes_bancaires.solde_actuel) AS solde_total,
    max(comptes_bancaires.date_synchro) AS derniere_synchro
   FROM comptes_bancaires
  WHERE comptes_bancaires.actif = true;

CREATE OR REPLACE VIEW public.v_vie_active_sans_quittance AS
 SELECT police,
    nom_client,
    prenom_client,
    compagnie,
    type_production,
    date_creation,
    sa_code,
    nom_sa,
    dossier,
    code_postal,
    localite,
    date_creation >= '2025-01-01'::date AS cree_2025_ou_apres
   FROM contrats c
  WHERE situation = 'En cours'::text AND domaine = 'Vie et placements'::text AND police IS NOT NULL AND NOT (EXISTS ( SELECT 1
           FROM quittances q
          WHERE q.police = c.police));

CREATE OR REPLACE VIEW public.view_rentabilite_compagnies AS
 SELECT year,
    insurer,
    branch,
    period_type,
    sum(primes_acquises) AS total_primes_acquises,
    sum(primes_emises) AS total_primes_emises,
    sum(sinistres) AS total_sinistres,
    sum(commissions_acquises) AS total_commissions,
    round(sum(sinistres) / NULLIF(sum(primes_acquises), 0::numeric) * 100::numeric, 2) AS sp_global,
    sum(bonus_calculated) AS total_bonus,
    sum(commissions_acquises) + sum(bonus_calculated) AS revenu_total
   FROM insurer_actual_results r
  GROUP BY year, insurer, branch, period_type;

CREATE OR REPLACE VIEW public.v_matrice_rcp_2026 AS
 WITH paie AS (
         SELECT v_paiements_rcp_2026.code_comp,
            v_paiements_rcp_2026.producteur,
            "right"(v_paiements_rcp_2026.periode, 2)::integer AS mois,
            sum(v_paiements_rcp_2026.montant) AS montant
           FROM v_paiements_rcp_2026
          WHERE v_paiements_rcp_2026.periode ~~ '2026-%'::text AND v_paiements_rcp_2026.producteur IS NOT NULL
          GROUP BY v_paiements_rcp_2026.code_comp, v_paiements_rcp_2026.producteur, ("right"(v_paiements_rcp_2026.periode, 2)::integer)
        ), bordn AS (
         SELECT
                CASE
                    WHEN bordereaux.compagnie ~~* 'AG%'::text THEN 'AG'::text
                    WHEN bordereaux.compagnie ~~* 'AXA%'::text THEN 'AXA'::text
                    WHEN bordereaux.compagnie ~* 'P ?& ?V|VIVIUM'::text THEN 'VIVIUM'::text
                    WHEN bordereaux.compagnie ~~* 'BALOISE%'::text THEN 'BALOISE'::text
                    WHEN bordereaux.compagnie ~~* 'DKV%'::text THEN 'DKV'::text
                    WHEN bordereaux.compagnie ~~* 'DAS%'::text THEN 'DAS'::text
                    WHEN bordereaux.compagnie ~~* 'NN%'::text THEN 'NN'::text
                    WHEN bordereaux.compagnie ~~* 'CARDIF%'::text THEN 'CARDIF'::text
                    WHEN bordereaux.compagnie ~~* 'ALLIANZ%'::text THEN 'ALLIANZ'::text
                    WHEN bordereaux.compagnie ~~* 'MONUMENT%'::text THEN 'MONUMENT'::text
                    WHEN bordereaux.compagnie ~~* 'AEDES%'::text THEN 'AEDES'::text
                    WHEN bordereaux.compagnie ~* 'A?HTORA'::text THEN 'ATHORA'::text
                    WHEN bordereaux.compagnie ~~* 'AMMA%'::text THEN 'AMMA'::text
                    WHEN bordereaux.compagnie ~~* 'ARAG%'::text THEN 'ARAG'::text
                    WHEN bordereaux.compagnie ~~* 'EUROMEX%'::text THEN 'EUROMEX'::text
                    ELSE NULL::text
                END AS code_comp,
                CASE
                    WHEN bordereaux.compte_producteur = '3145235'::text THEN '145235'::text
                    WHEN bordereaux.compte_producteur ~ '^0*\d+$'::text THEN ltrim(bordereaux.compte_producteur, '0'::text)
                    ELSE bordereaux.compte_producteur
                END AS producteur,
            bordereaux.mois::integer AS mois,
            bordereaux.type
           FROM bordereaux
          WHERE bordereaux.annee = 2026 AND (bordereaux.type = ANY (ARRAY['RCP'::text, 'BQT'::text]))
        ), rcpd AS (
         SELECT DISTINCT bordn.code_comp,
            bordn.producteur,
            bordn.mois
           FROM bordn
          WHERE bordn.type = 'RCP'::text AND bordn.code_comp IS NOT NULL
        ), bqtd AS (
         SELECT DISTINCT bordn.code_comp,
            bordn.producteur,
            bordn.mois
           FROM bordn
          WHERE bordn.type = 'BQT'::text AND bordn.code_comp IS NOT NULL
        ), keys AS (
         SELECT paie.code_comp,
            paie.producteur,
            paie.mois
           FROM paie
        UNION
         SELECT rcpd.code_comp,
            rcpd.producteur,
            rcpd.mois
           FROM rcpd
        UNION
         SELECT bqtd.code_comp,
            bqtd.producteur,
            bqtd.mois
           FROM bqtd
        )
 SELECT k.code_comp,
    k.producteur,
    k.mois,
    p.producteur IS NOT NULL AS paye,
    p.montant AS montant_paye,
    r.producteur IS NOT NULL AS rcp_doc,
    b.producteur IS NOT NULL AS bqt_doc
   FROM keys k
     LEFT JOIN paie p ON p.code_comp = k.code_comp AND p.producteur = k.producteur AND p.mois = k.mois
     LEFT JOIN rcpd r ON r.code_comp = k.code_comp AND r.producteur = k.producteur AND r.mois = k.mois
     LEFT JOIN bqtd b ON b.code_comp = k.code_comp AND b.producteur = k.producteur AND b.mois = k.mois
  WHERE k.code_comp IS NOT NULL AND k.producteur IS NOT NULL;

CREATE OR REPLACE VIEW public.v_rapprochement_rcp_2026 AS
 WITH paie AS (
         SELECT v_paiements_rcp_2026.code_comp,
            v_paiements_rcp_2026.producteur,
            v_paiements_rcp_2026.periode,
            sum(v_paiements_rcp_2026.montant) AS montant_paye,
            count(*) AS nb_paiements
           FROM v_paiements_rcp_2026
          WHERE v_paiements_rcp_2026.periode ~~ '2026-%'::text AND v_paiements_rcp_2026.producteur IS NOT NULL
          GROUP BY v_paiements_rcp_2026.code_comp, v_paiements_rcp_2026.producteur, v_paiements_rcp_2026.periode
        ), bord AS (
         SELECT
                CASE
                    WHEN bordereaux.compagnie ~~* 'AG%'::text THEN 'AG'::text
                    WHEN bordereaux.compagnie ~~* 'AXA%'::text THEN 'AXA'::text
                    WHEN bordereaux.compagnie ~* 'P ?& ?V|VIVIUM'::text THEN 'VIVIUM'::text
                    WHEN bordereaux.compagnie ~~* 'BALOISE%'::text THEN 'BALOISE'::text
                    WHEN bordereaux.compagnie ~~* 'DKV%'::text THEN 'DKV'::text
                    WHEN bordereaux.compagnie ~~* 'DAS%'::text THEN 'DAS'::text
                    WHEN bordereaux.compagnie ~~* 'NN%'::text THEN 'NN'::text
                    WHEN bordereaux.compagnie ~~* 'CARDIF%'::text THEN 'CARDIF'::text
                    WHEN bordereaux.compagnie ~~* 'ALLIANZ%'::text THEN 'ALLIANZ'::text
                    WHEN bordereaux.compagnie ~~* 'MONUMENT%'::text THEN 'MONUMENT'::text
                    WHEN bordereaux.compagnie ~~* 'AEDES%'::text THEN 'AEDES'::text
                    WHEN bordereaux.compagnie ~* 'A?HTORA'::text THEN 'ATHORA'::text
                    WHEN bordereaux.compagnie ~~* 'AMMA%'::text THEN 'AMMA'::text
                    WHEN bordereaux.compagnie ~~* 'ARAG%'::text THEN 'ARAG'::text
                    WHEN bordereaux.compagnie ~~* 'EUROMEX%'::text THEN 'EUROMEX'::text
                    ELSE NULL::text
                END AS code_comp,
                CASE
                    WHEN bordereaux.compte_producteur = '3145235'::text THEN '145235'::text
                    WHEN bordereaux.compte_producteur ~ '^0*\d+$'::text THEN ltrim(bordereaux.compte_producteur, '0'::text)
                    ELSE bordereaux.compte_producteur
                END AS producteur,
            (bordereaux.annee || '-'::text) || lpad(bordereaux.mois, 2, '0'::text) AS periode
           FROM bordereaux
          WHERE bordereaux.type = 'RCP'::text AND bordereaux.annee = 2026
        ), bordf AS (
         SELECT bord.code_comp,
            bord.producteur,
            bord.periode,
            count(*) AS nb_bordereaux
           FROM bord
          WHERE bord.code_comp IS NOT NULL
          GROUP BY bord.code_comp, bord.producteur, bord.periode
        )
 SELECT COALESCE(p.code_comp, b.code_comp) AS code_comp,
    COALESCE(p.producteur, b.producteur) AS producteur,
    COALESCE(p.periode, b.periode) AS periode,
    p.montant_paye,
    p.nb_paiements,
    b.nb_bordereaux,
        CASE
            WHEN p.producteur IS NOT NULL AND b.producteur IS NOT NULL THEN 'vert'::text
            WHEN p.producteur IS NOT NULL THEN 'orange'::text
            ELSE 'rouge'::text
        END AS statut
   FROM paie p
     FULL JOIN bordf b ON p.code_comp = b.code_comp AND p.producteur = b.producteur AND p.periode = b.periode;

-- ============================================================================
-- Triggers
-- ============================================================================
CREATE TRIGGER set_user_permissions_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION update_user_permissions_updated_at();
CREATE TRIGGER taches_updated_at BEFORE UPDATE ON public.taches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_appliquer_regle BEFORE INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION appliquer_regle_categorie();
CREATE TRIGGER trg_factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_famille_updated_at BEFORE UPDATE ON public.famille FOR EACH ROW EXECUTE FUNCTION update_famille_ts();
CREATE TRIGGER trg_kb_updated_at BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lode_clients_ts BEFORE UPDATE ON public.lode_clients FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_lode_devis_ts BEFORE UPDATE ON public.lode_devis FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_lode_fact_ts BEFORE UPDATE ON public.lode_factures FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_nfl_calc BEFORE INSERT OR UPDATE ON public.notes_frais_lignes FOR EACH ROW EXECUTE FUNCTION notes_frais_ligne_calc();
CREATE TRIGGER trg_nfl_recalc AFTER INSERT OR DELETE OR UPDATE ON public.notes_frais_lignes FOR EACH ROW EXECUTE FUNCTION notes_frais_recalc();
CREATE TRIGGER trg_polices_updated_at BEFORE UPDATE ON public.polices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_rdv_autolink BEFORE INSERT OR UPDATE OF objet ON public.rdv FOR EACH ROW EXECUTE FUNCTION rdv_autolink();
CREATE TRIGGER trg_risques_updated_at BEFORE UPDATE ON public.risques FOR EACH ROW EXECUTE FUNCTION update_risques_ts();

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ag_starget_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ag_technical_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ag_vie_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bordereaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bordereaux_brio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bordereaux_sa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories_regles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_donnees_plus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_consultes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborateur_taux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compagnies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comptes_bancaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connexions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_devis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dtx_factures_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_devis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_devoir_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dyn_factures_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_achat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.famille ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_cotisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_cotisations_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_cotisations_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_cotisations_rappels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hex_membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hexagroup_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports_brio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_actual_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liens_casses_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liens_preneurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_devis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_factures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lode_factures_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mouvements_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_frais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes_frais_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs_annuels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs_cibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs_realises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objets_risque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametres_frais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profils_investisseur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdv ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdv_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_apporteurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_bureaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_gestionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_portefeuilles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_sous_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistre_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistre_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistre_workflow_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinistres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.succession_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taches_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taches_rapprochement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taches_suivi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taux_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tmp_manquant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_ventilation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Policies (147)
-- ============================================================================
CREATE POLICY "Allow all for anon" ON public.profils_investisseur AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Ecriture activites" ON public.activites AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Ecriture categories" ON public.categories AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Ecriture producteurs" ON public.producteurs AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Ecriture quittances" ON public.quittances AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Ecriture regles" ON public.categories_regles AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Ecriture ventilation" ON public.transaction_ventilation AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Insert credits" ON public.credits AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Insert objectives_global" ON public.objectives_global AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Insert taux" ON public.taux_reference AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Insert transactions" ON public.transactions AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Insertion publique contrats" ON public.contrats AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Insertion publique mouvements" ON public.mouvements_production AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Lecture activites" ON public.activites AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture ag_starget_results" ON public.ag_starget_results AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture ag_technical_results" ON public.ag_technical_results AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture ag_vie_objectives" ON public.ag_vie_objectives AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture categories" ON public.categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture credits" ON public.credits AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture frais" ON public.parametres_frais AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture insurer_actual_results" ON public.insurer_actual_results AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture insurer_rules" ON public.insurer_rules AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture objectives_global" ON public.objectives_global AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture producteurs" ON public.producteurs AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture publique contrats" ON public.contrats AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture publique mouvements" ON public.mouvements_production AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture quittances" ON public.quittances AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture regles" ON public.categories_regles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture taches rapprochement" ON public.taches_rapprochement AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture taux" ON public.taux_reference AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture transactions" ON public.transactions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Lecture ventilation" ON public.transaction_ventilation AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Mise à jour publique contrats" ON public.contrats AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update credits" ON public.credits AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update factures_achat" ON public.factures_achat AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Update frais" ON public.parametres_frais AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update objectives_global" ON public.objectives_global AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update taches rapprochement" ON public.taches_rapprochement AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update taux" ON public.taux_reference AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Update transactions categorie" ON public.transactions AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Users can manage own simulations" ON public.succession_simulations AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "admin lit liens_casses_log" ON public.liens_casses_log AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "insert consultations" ON public.clients_consultes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lecture consultations" ON public.clients_consultes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "update consultations" ON public.clients_consultes AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY admin_full_access ON public.user_permissions AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY allow_all ON public.objectifs_cibles AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.objectifs_realises AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_bordereaux ON public.bordereaux AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_clients ON public.clients AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_factures_achat ON public.factures_achat AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY allow_all_taches ON public.taches AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY appels_read ON public.appels AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_all ON public.objectifs_2026 AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all ON public.objectifs_annuels AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all ON public.sinistre_workflow_definitions AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all ON public.sinistre_workflow_progress AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_all ON public.sync_log AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY brio_all ON public.bordereaux_brio AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY cdp_select_all ON public.client_donnees_plus AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY collab_admin_write ON public.collaborateurs AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY collaborateur_taux_all ON public.collaborateur_taux AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY comptes_bancaires_select_auth ON public.comptes_bancaires AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY connexions_all ON public.connexions_log AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY cr_select ON public.client_relations AS PERMISSIVE FOR SELECT TO public USING ((( SELECT is_admin() AS is_admin) OR ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) IS NOT NULL)));
CREATE POLICY cr_write ON public.client_relations AS PERMISSIVE FOR ALL TO public USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY dtx_clients_rw ON public.dtx_clients AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY famille_select ON public.famille AS PERMISSIVE FOR SELECT TO public USING ((( SELECT is_admin() AS is_admin) OR ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) IS NOT NULL)));
CREATE POLICY famille_write ON public.famille AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY ff_select ON public.factures_achat AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY hex_config_admin ON public.hex_cotisations_config AS PERMISSIVE FOR ALL TO public USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));
CREATE POLICY hex_cotis_admin ON public.hex_cotisations AS PERMISSIVE FOR ALL TO public USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));
CREATE POLICY hex_lignes_admin ON public.hex_cotisations_lignes AS PERMISSIVE FOR ALL TO public USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));
CREATE POLICY hex_membres_admin ON public.hex_membres AS PERMISSIVE FOR ALL TO public USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));
CREATE POLICY hex_rappels_admin ON public.hex_cotisations_rappels AS PERMISSIVE FOR ALL TO public USING (( SELECT is_admin() AS is_admin)) WITH CHECK (( SELECT is_admin() AS is_admin));
CREATE POLICY liens_preneurs_auth_all ON public.liens_preneurs AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY nf_delete ON public.notes_frais AS PERMISSIVE FOR DELETE TO authenticated USING (((lower(auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin)));
CREATE POLICY nf_insert ON public.notes_frais AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((lower(auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin)));
CREATE POLICY nf_select ON public.notes_frais AS PERMISSIVE FOR SELECT TO authenticated USING (((lower(auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin)));
CREATE POLICY nf_update ON public.notes_frais AS PERMISSIVE FOR UPDATE TO authenticated USING (((lower(auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin))) WITH CHECK (((lower(auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin)));
CREATE POLICY nfl_all ON public.notes_frais_lignes AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM notes_frais n
  WHERE ((n.id = notes_frais_lignes.note_id) AND ((lower(n.auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM notes_frais n
  WHERE ((n.id = notes_frais_lignes.note_id) AND ((lower(n.auteur_email) = lower((( SELECT auth.jwt() AS jwt) ->> 'email'::text))) OR ( SELECT is_admin() AS is_admin))))));
CREATE POLICY no_public_access ON public.config_secrets AS PERMISSIVE FOR ALL TO public USING (false);
CREATE POLICY objets_risque_read ON public.objets_risque AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_dtx_devis ON public.dtx_devis AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dtx_devis_events ON public.dtx_devis_events AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dtx_devis_lignes ON public.dtx_devis_lignes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dtx_factures ON public.dtx_factures AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dtx_factures_lignes ON public.dtx_factures_lignes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dyn_devis ON public.dyn_devis AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dyn_devis_events ON public.dyn_devis_events AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dyn_devis_lignes ON public.dyn_devis_lignes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dyn_devoir_info_insert ON public.dyn_devoir_info AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_dyn_devoir_info_select ON public.dyn_devoir_info AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY p_dyn_factures ON public.dyn_factures AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_dyn_factures_lignes ON public.dyn_factures_lignes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_lode_clients ON public.lode_clients AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY p_lode_dev_ev ON public.lode_devis_events AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY p_lode_devis ON public.lode_devis AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_lode_dl ON public.lode_devis_lignes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_lode_fact ON public.lode_factures AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY p_lode_fl ON public.lode_factures_lignes AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY p_read ON public.collaborateurs AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_read ON public.ref_apporteurs AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_read ON public.ref_bureaux AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_read ON public.ref_gestionnaires AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_read ON public.ref_portefeuilles AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY p_read ON public.ref_sous_agents AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY parentes_read ON public.parentes AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY pol_bordereaux_sa_admin ON public.bordereaux_sa AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_comptes_admin ON public.comptes_bancaires AS PERMISSIVE FOR ALL TO public USING ((get_role() = ANY (ARRAY['admin'::text, 'comptable'::text])));
CREATE POLICY pol_documents_admin ON public.documents AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_documents_user ON public.documents AS PERMISSIVE FOR SELECT TO public USING (((get_role() = 'gestionnaire'::text) AND (societe_id = get_societe_id())));
CREATE POLICY pol_factures_compta ON public.factures AS PERMISSIVE FOR ALL TO public USING ((get_role() = ANY (ARRAY['admin'::text, 'comptable'::text])));
CREATE POLICY pol_imports_admin ON public.imports_brio AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_kb_read ON public.kb_articles AS PERMISSIVE FOR SELECT TO public USING ((actif = true));
CREATE POLICY pol_kb_write ON public.kb_articles AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_polices_admin ON public.polices AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_polices_gestionnaire ON public.polices AS PERMISSIVE FOR SELECT TO public USING ((gestionnaire_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY pol_societes_admin ON public.societes AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_societes_user ON public.societes AS PERMISSIVE FOR SELECT TO public USING ((id = get_societe_id()));
CREATE POLICY pol_sous_agents_admin ON public.sous_agents AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_utilisateurs_admin ON public.utilisateurs AS PERMISSIVE FOR ALL TO public USING ((get_role() = 'admin'::text));
CREATE POLICY pol_utilisateurs_self ON public.utilisateurs AS PERMISSIVE FOR SELECT TO public USING ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY public_all ON public.compagnies AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY rdv_categories_read ON public.rdv_categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY rdv_categories_write ON public.rdv_categories AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY rdv_read ON public.rdv AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY rdv_update ON public.rdv AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY read_own_row ON public.user_permissions AS PERMISSIVE FOR SELECT TO public USING ((user_email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)));
CREATE POLICY risques_select ON public.risques AS PERMISSIVE FOR SELECT TO public USING ((( SELECT is_admin() AS is_admin) OR ((( SELECT auth.jwt() AS jwt) ->> 'email'::text) IS NOT NULL)));
CREATE POLICY risques_write ON public.risques AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY seg_read ON public.segmentation AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY sinistres_read ON public.sinistres AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY societes_select_auth ON public.societes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY societes_write_admin ON public.societes AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY sp_read ON public.sinistre_paiements AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY th_all ON public.taches_historique AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY ticket_categories_select ON public.ticket_categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY tickets_messages_insert ON public.tickets_messages AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY tickets_messages_select ON public.tickets_messages AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY tickets_messages_update ON public.tickets_messages AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY tmp_ins ON public.tmp_manquant AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY tmp_sel ON public.tmp_manquant AS PERMISSIVE FOR SELECT TO anon USING (true);
CREATE POLICY tmp_upd ON public.tmp_manquant AS PERMISSIVE FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY ts_all ON public.taches_suivi AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY up_select_auth ON public.user_permissions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY up_write_admin ON public.user_permissions AS PERMISSIVE FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================================
-- Privilèges : anon n'a accès à aucune table ; RPC publiques explicitement listées
-- ============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- RPC appelées sans session (token/secret vérifié dans la fonction)
GRANT EXECUTE ON FUNCTION public.creer_ticket_depuis_mail TO anon;
GRANT EXECUTE ON FUNCTION public.crm_log_appel TO anon;
GRANT EXECUTE ON FUNCTION public.crm_lookup TO anon;
GRANT EXECUTE ON FUNCTION public.dtx_devis_decision TO anon;
GRANT EXECUTE ON FUNCTION public.dtx_devis_public TO anon;
GRANT EXECUTE ON FUNCTION public.dyn_devis_decision TO anon;
GRANT EXECUTE ON FUNCTION public.dyn_devis_public TO anon;
GRANT EXECUTE ON FUNCTION public.hexagroup_results TO anon;
GRANT EXECUTE ON FUNCTION public.hexagroup_vote TO anon;
GRANT EXECUTE ON FUNCTION public.lode_devis_decision TO anon;
GRANT EXECUTE ON FUNCTION public.lode_devis_public TO anon;
GRANT EXECUTE ON FUNCTION public.ticket_add_email_message TO anon;
-- Phase 0 sécurité
REVOKE EXECUTE ON FUNCTION public.execute_raw_sql(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.tickets_rappels_echeance() FROM public, anon, authenticated;
-- Vues : anon n'y a pas accès (revoke_anon_v_garanties_catalogue en prod)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- ============================================================================
-- Storage : buckets et policies
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('devis-photos', 'devis-photos', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('devoir-info', 'devoir-info', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('factures-thumbs', 'factures-thumbs', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('hexagroup-photos', 'hexagroup-photos', true, 500000, '{image/jpeg}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('logos', 'logos', true, NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('notes-frais', 'notes-frais', false, 15728640, '{image/jpeg,image/png,image/webp,image/heic,application/pdf}') ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('tickets', 'tickets', false, NULL, NULL) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Listing public logos" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'logos'::text));
CREATE POLICY "devis photos delete" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING ((bucket_id = 'devis-photos'::text));
CREATE POLICY "devis photos lecture" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'devis-photos'::text));
CREATE POLICY "devis photos update" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING ((bucket_id = 'devis-photos'::text));
CREATE POLICY "devis photos upload" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK ((bucket_id = 'devis-photos'::text));
CREATE POLICY logos_insert_admin ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'logos'::text) AND is_admin()));
CREATE POLICY logos_update_admin ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'logos'::text) AND is_admin())) WITH CHECK (((bucket_id = 'logos'::text) AND is_admin()));
CREATE POLICY nf_obj_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'notes-frais'::text) AND ((owner = auth.uid()) OR is_admin())));
CREATE POLICY nf_obj_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'notes-frais'::text));
CREATE POLICY nf_obj_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'notes-frais'::text) AND ((owner = auth.uid()) OR is_admin())));
CREATE POLICY nf_obj_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'notes-frais'::text) AND ((owner = auth.uid()) OR is_admin())));
CREATE POLICY p_devoir_info_read ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'devoir-info'::text));
CREATE POLICY p_devoir_info_write ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'devoir-info'::text));
CREATE POLICY tickets_obj_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'tickets'::text) AND ((owner = auth.uid()) OR is_admin())));
CREATE POLICY tickets_obj_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'tickets'::text));
CREATE POLICY tickets_obj_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'tickets'::text));

-- ============================================================================
-- pg_cron — à ne PAS planifier sur le projet TEST (rappels mails)
-- ============================================================================
-- SELECT cron.schedule('tickets_rappels_echeance_daily', '0 6 * * *', ' select public.tickets_rappels_echeance(); ');
