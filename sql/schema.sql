-- =====================================================================
-- HUB DTX — SCHÉMA CANONIQUE DE LA BASE SUPABASE
-- Projet : tndwonqdbeszkcztkzqe
-- Régénéré le 2026-10-27 depuis information_schema (base vivante)
--
-- ⚠️  Script de RECRÉATION (disaster-recovery / documentation).
--     Idempotent (CREATE TABLE IF NOT EXISTS) — ne touche pas aux tables existantes.
--     Les contraintes (PK/FK/UNIQUE), index, vues, triggers et policies RLS
--     ne sont PAS inclus ici.
-- Tables : 100
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

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
  remuneration_b21 numeric,
  remuneration_b23 numeric,
  source_file text DEFAULT 'HEXAGROUP_R_FR.pdf'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appels (
  id bigint NOT NULL,
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
  solde numeric DEFAULT 0,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
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
  gsm_e164 text,
  telfixe_e164 text
);

CREATE TABLE IF NOT EXISTS public.clients_consultes (
  id bigint NOT NULL,
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
  taux_commission numeric,
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
  solde_actuel numeric DEFAULT 0,
  date_synchro timestamp with time zone,
  ponto_account_id text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  ENTITE text
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
  id bigint NOT NULL,
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
  remise_pct numeric DEFAULT 0,
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
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
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
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

CREATE TABLE IF NOT EXISTS public.dtx_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
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
  remise_pct numeric DEFAULT 0,
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
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
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.dyn_devoir_info (
  id bigint NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.dyn_factures_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  facture_id uuid NOT NULL,
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0
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
  total numeric NOT NULL DEFAULT 0,
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
  rappels_jours int4[] NOT NULL DEFAULT '{15,30}'::integer[],
  rappel_max integer NOT NULL DEFAULT 2,
  rappel_envoie_email boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  taux_interet_annuel numeric NOT NULL DEFAULT 10.5,
  indemnite_forfaitaire numeric NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations_lignes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotisation_id uuid NOT NULL,
  position integer NOT NULL DEFAULT 0,
  libelle text,
  quantite numeric NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL DEFAULT 0,
  total numeric
);

CREATE TABLE IF NOT EXISTS public.hex_cotisations_rappels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotisation_id uuid NOT NULL,
  date_rappel date NOT NULL DEFAULT CURRENT_DATE,
  canal text,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  niveau text NOT NULL DEFAULT 'simple'::text,
  frais numeric NOT NULL DEFAULT 0
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
  sp_ratio numeric,
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
  embedding vector,
  cree_par uuid,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.liens_casses_log (
  id bigint NOT NULL,
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
  remise_pct numeric DEFAULT 0,
  total_ht numeric DEFAULT 0,
  total_tva numeric DEFAULT 0,
  total_ttc numeric DEFAULT 0,
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
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0,
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
  position integer DEFAULT 0,
  description text NOT NULL,
  quantite numeric DEFAULT 1,
  prix_unitaire numeric DEFAULT 0,
  remise_pct numeric DEFAULT 0,
  tva_pct numeric DEFAULT 21,
  total_ht numeric DEFAULT 0,
  titre text,
  descriptif text,
  photos jsonb DEFAULT '[]'::jsonb,
  optionnelle boolean DEFAULT false,
  tva_categorie text NOT NULL DEFAULT 'S'::text
);

CREATE TABLE IF NOT EXISTS public.mouvements_production (
  id bigint NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.notes_frais (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  societe text NOT NULL,
  auteur_email text NOT NULL,
  auteur_code text,
  auteur_nom text,
  titre text,
  periode text,
  statut text NOT NULL DEFAULT 'brouillon'::text,
  total numeric NOT NULL DEFAULT 0,
  total_ht numeric NOT NULL DEFAULT 0,
  total_tva numeric NOT NULL DEFAULT 0,
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
  montant_ttc numeric NOT NULL DEFAULT 0,
  taux_tva numeric NOT NULL DEFAULT 0,
  montant_ht numeric NOT NULL DEFAULT 0,
  montant_tva numeric NOT NULL DEFAULT 0,
  km_distance numeric,
  km_taux numeric,
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
  taux_retention_dynassur numeric,
  obj_na_iard integer,
  obj_na_vie integer,
  obj_na_sante integer,
  obj_na_total integer,
  obj_prime_vie numeric,
  obj_com_nette_iard numeric,
  obj_com_nette_vie numeric,
  obj_com_nette_sante numeric,
  obj_com_nette_total numeric,
  obj_taux_retention numeric,
  base_retention_2025 numeric,
  bonus_palier1_seuil numeric,
  bonus_palier1_pct numeric,
  bonus_palier2_seuil numeric,
  bonus_palier2_pct numeric,
  bonus_palier3_seuil numeric,
  bonus_palier3_pct numeric,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_annuels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  annee integer NOT NULL,
  collab_code text,
  type_prod text NOT NULL DEFAULT 'NA'::text,
  cible_annuelle integer NOT NULL,
  mois_actifs int4[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}'::integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_cibles (
  id bigint NOT NULL DEFAULT nextval('objectifs_cibles_id_seq'::regclass),
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objectifs_realises (
  id bigint NOT NULL DEFAULT nextval('objectifs_realises_id_seq'::regclass),
  commercial_code text NOT NULL,
  indicateur text NOT NULL,
  periode_type text NOT NULL,
  periode_key text NOT NULL,
  valeur numeric,
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
  pct_na numeric,
  pct_primes numeric,
  pct_commissions numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.objets_risque (
  id bigint NOT NULL,
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
  id bigint NOT NULL,
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
  taux_commission numeric,
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
  taux_commission numeric,
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
  id bigint NOT NULL,
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
  id bigint NOT NULL,
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
  id bigint NOT NULL,
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
  taux_commission numeric,
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
  montant numeric,
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
  id bigint NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
