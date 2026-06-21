-- =====================================================================
-- HUB DTX — SCHÉMA CANONIQUE DE LA BASE SUPABASE
-- Projet : tndwonqdbeszkcztkzqe
-- Généré le 2026-06-21 par reconstruction depuis information_schema
--
-- ⚠️  IMPORTANT
--   • Script de RECRÉATION (disaster-recovery / documentation), pas de modification.
--   • Idempotent : CREATE TABLE IF NOT EXISTS — n'écrase JAMAIS une table existante.
--   • NE PAS exécuter sur la base de production : aucune donnée n'est touchée, mais
--     les tables existantes sont simplement ignorées. À utiliser sur une base vierge.
--
-- NON inclus dans cette reconstruction (voir requêtes d'extraction en bas de fichier) :
--   • Clés étrangères (FK)        • Index & contraintes UNIQUE
--   • Définitions des 6 vues       • Triggers / fonctions
-- Tables : 48
-- =====================================================================

-- Extensions requises par les valeurs par défaut
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;        -- kb_articles.embedding

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ag_starget_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ag_technical_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ag_vie_objectives (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year integer NOT NULL,
  tranche integer NOT NULL,
  base_min numeric,
  base_max numeric,
  rate_b21 numeric,
  rate_b23 numeric,
  actual_base_b21 numeric DEFAULT 0,
  actual_base_b23 numeric DEFAULT 0,
  remuneration_b21 numeric,
  remuneration_b23 numeric,
  source_file text DEFAULT 'HEXAGROUP_R_FR.pdf'::text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bordereaux (
  id bigserial PRIMARY KEY,
  compagnie text NOT NULL,
  mois text NOT NULL,
  annee integer DEFAULT 2026,
  type text NOT NULL,
  montant numeric,
  commission numeric,
  net numeric,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bordereaux_sa (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  sous_agent_id uuid NOT NULL,
  periode text NOT NULL,
  solde numeric DEFAULT 0,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  statut text DEFAULT 'ouvert'::text,
  fichier_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'depense'::text,
  couleur text DEFAULT '#64748b'::text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories_regles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  motif text NOT NULL,
  categorie_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_relations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_a text NOT NULL,
  dossier_b text NOT NULL,
  type_relation text NOT NULL,
  label text,
  note text,
  created_by text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id bigserial PRIMARY KEY,
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
  updated_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collaborateurs (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
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
  taux_commission numeric,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  noms_repris text[]
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compagnies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  updated_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comptes_bancaires (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  societe_id uuid,
  banque text NOT NULL,
  libelle text,
  iban text NOT NULL,
  bic text,
  devise text DEFAULT 'EUR'::text,
  solde_actuel numeric DEFAULT 0,
  date_synchro timestamp with time zone,
  ponto_account_id text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  "ENTITE" text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contrats (
  id bigint NOT NULL PRIMARY KEY,
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
  updated_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.factures (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  societe_id uuid NOT NULL,
  client_id uuid,
  numero text NOT NULL,
  type text DEFAULT 'honoraires'::text,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_echeance date,
  date_paiement date,
  montant_htva numeric NOT NULL,
  taux_tva numeric DEFAULT 0,
  montant_tva numeric,
  montant_ttc numeric,
  statut text DEFAULT 'brouillon'::text,
  iban_destinataire text,
  description text,
  fichier_pdf_url text,
  cree_par_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.famille (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.imports_brio (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurer_actual_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  sp_ratio numeric,
  points_miles numeric DEFAULT 0,
  partnership_level text,
  bonus_calculated numeric DEFAULT 0,
  source_file text,
  imported_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurer_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  categorie text NOT NULL,
  compagnie_id uuid,
  titre text NOT NULL,
  contenu text NOT NULL,
  resume text,
  tags text[],
  embedding vector,
  cree_par uuid,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lode_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lode_devis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  remise_pct numeric DEFAULT 0,
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  date_devis date DEFAULT CURRENT_DATE,
  date_validite date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lode_devis_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id uuid NOT NULL,
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lode_factures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  remise_pct numeric DEFAULT 0,
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
  montant_paye numeric DEFAULT 0,
  date_facture date DEFAULT CURRENT_DATE,
  date_echeance date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  langue text DEFAULT 'fr'::text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lode_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id uuid NOT NULL,
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mouvements_production (
  id bigint NOT NULL PRIMARY KEY,
  date_mouvement date NOT NULL,
  annee smallint,
  mois smallint,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objectifs_annuels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  annee integer NOT NULL,
  collab_code text,
  type_prod text NOT NULL DEFAULT 'NA'::text,
  cible_annuelle integer NOT NULL,
  mois_actifs integer[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}'::integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objectifs_cibles (
  id bigserial PRIMARY KEY,
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objectifs_realises (
  id bigserial PRIMARY KEY,
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.objectives_global (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  pct_na numeric,
  pct_primes numeric,
  pct_commissions numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.polices (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  prime_ttc numeric,
  prime_htva numeric,
  taux_commission numeric,
  commission_montant numeric,
  type_prod text,
  date_prod date,
  notes text,
  date_import_brio date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.producteurs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compagnie_nom text NOT NULL,
  fsma text,
  numero_producteur text NOT NULL,
  telephone text,
  code_postal text,
  ville text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quittances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  prime_totale numeric,
  commission numeric,
  commission_sa numeric,
  date_comptable date,
  etat text,
  type_production text,
  sous_agent text,
  periodicite text,
  dossier text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ref_apporteurs (
  id bigserial PRIMARY KEY,
  code text,
  nom text NOT NULL,
  taux_commission numeric,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ref_bureaux (
  id bigserial PRIMARY KEY,
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ref_gestionnaires (
  id bigserial PRIMARY KEY,
  code text,
  nom text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  pour_le_compte_de text,
  note text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ref_portefeuilles (
  id bigserial PRIMARY KEY,
  libelle text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ref_sous_agents (
  id bigserial PRIMARY KEY,
  code text,
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'sous_agent'::text,
  taux_commission numeric,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.risques (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sinistres (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  police_id uuid NOT NULL,
  client_id uuid NOT NULL,
  gestionnaire_id uuid,
  numero_sinistre text,
  date_sinistre date,
  date_declaration date,
  type_sinistre text,
  description text,
  statut text DEFAULT 'ouvert'::text,
  montant_estime numeric,
  montant_rembourse numeric,
  franchise numeric,
  date_cloture date,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  societe_id uuid,
  ref_sinistre text,
  dossier_client text,
  nom_client text,
  police text,
  compagnie text,
  branche text,
  nature_sinistre text,
  gestionnaire text,
  notes_internes text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.societes (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  logo_url text
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sous_agents (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
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
  taux_commission numeric,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow text NOT NULL,
  statut text NOT NULL,
  comptes_synchro integer DEFAULT 0,
  transactions_synchro integer DEFAULT 0,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taches (
  id bigserial PRIMARY KEY,
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
  tags text[]
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_id uuid,
  ponto_transaction_id text NOT NULL,
  date_valeur date,
  date_execution date,
  montant numeric,
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
  categorie_id uuid
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  nom text NOT NULL,
  role text NOT NULL DEFAULT 'user'::text,
  actif boolean DEFAULT true,
  acc_holding boolean DEFAULT false,
  acc_dtx boolean DEFAULT false,
  acc_dynassur boolean DEFAULT true,
  acc_lode boolean DEFAULT false,
  dyn_dashboard boolean DEFAULT true,
  dyn_taches boolean DEFAULT true,
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
  hex_comptabilite boolean DEFAULT false
);

-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.utilisateurs (
  id uuid NOT NULL PRIMARY KEY,
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

-- =====================================================================
-- VUES (6) — définitions NON reconstruites (logique SELECT inconnue ici)
-- Récupère les vraies définitions avec :
--   SELECT 'CREATE OR REPLACE VIEW public.' || viewname || ' AS ' || definition
--   FROM pg_views WHERE schemaname='public';
-- Colonnes de sortie connues (pour mémoire) :
--   • v_bordereaux_reconciliation : compagnie, annee, mois, has_bqt, has_rcp, bqt_recu, rcp_recu, montant_bqt, montant_rcp, commission_bqt, commission_rcp, ecart, nb_bordereaux
--   • v_famille_clients : numero_brio, dossier_principal, nom_principal, prenom_principal, relation, relation_active, nom_lie, prenom_lie, clef_recherche, cp_lie, localite_lie, dossier_lie, gsm_lie, email_lie
--   • v_risques_clients : police, type_risque, description, actif, gestionnaire, date_creation, dossier, compagnie, domaine, situation, nom_client, prenom_client, gsm
--   • v_taches_enrichies : (taches + client_nom/prenom/email)
--   • v_tresorerie_holding : societe, societe_nom, solde_total, derniere_synchro
--   • view_rentabilite_compagnies : year, insurer, branch, period_type, total_primes_acquises, total_primes_emises, total_sinistres, total_commissions, sp_global, total_bonus, revenu_total
-- =====================================================================

-- =====================================================================
-- POUR OBTENIR LE SCHÉMA À 100% (FK + index), exécuter dans le SQL Editor :
--
--   -- Clés étrangères
--   SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE contype='f'
--     AND connamespace='public'::regnamespace ORDER BY 1;
--
--   -- Index
--   SELECT tablename, indexname, indexdef FROM pg_indexes
--   WHERE schemaname='public' ORDER BY 1,2;
-- =====================================================================
