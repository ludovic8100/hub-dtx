-- ================================================================
-- TABLES : risques + famille
-- Import depuis CSV Brio via n8n
-- Colonnes vérifiées sur DATA_RISQUE.csv et DATA_FAMILLE.csv
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE : risques
-- Objets de risque liés aux polices (contrats)
-- Source : DATA_RISQUE.csv (18 colonnes, séparateur ;)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risques (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  police                  TEXT NOT NULL,                -- col[0]  Police
  actif                   BOOLEAN DEFAULT TRUE,          -- col[1]  Actif (Oui/Non)
  visible_mybroker        BOOLEAN DEFAULT FALSE,         -- col[2]  Visible dans MyBroker
  contrats_lies           BOOLEAN DEFAULT FALSE,         -- col[3]  Contrat(s) lié(s)
  total_contrats_en_cours INTEGER DEFAULT 0,             -- col[4]  Total contrats en cours
  type_risque_valeur      TEXT,                          -- col[5]  Type de risque - Valeur (001, 010, 011, 060...)
  type_risque_libelle     TEXT,                          -- col[6]  Type de risque - Libellé (Véhicule, Bâtiment...)
  description             TEXT,                          -- col[7]  Description (ex: "1YEC323 - SKODA - FABIA")
  date_creation           DATE,                          -- col[8]  Date de création
  created_by              TEXT,                          -- col[9]  Création par utilisateur - Code
  date_modification       DATE,                          -- col[11] Date de modification
  modified_by             TEXT,                          -- col[12] Modifié par utilisateur - Code
  date_desactivation      DATE,                          -- col[14] Date de désactivation
  desactive_by            TEXT,                          -- col[15] Désactivé par utilisateur - Code
  gestionnaire            TEXT,                          -- col[17] Gestionnaire nom
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_risque_police UNIQUE(police)
);

CREATE INDEX IF NOT EXISTS idx_risques_police ON risques(police);
CREATE INDEX IF NOT EXISTS idx_risques_type   ON risques(type_risque_valeur);
CREATE INDEX IF NOT EXISTS idx_risques_actif  ON risques(actif);

-- ----------------------------------------------------------------
-- TABLE : famille
-- Liens familiaux/relationnels exportés depuis Brio
-- Source : DATA_FAMILLE.csv (44 colonnes, séparateur ;)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS famille (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_brio             TEXT NOT NULL,                -- col[0]  Numéro
  dossier                 TEXT,                         -- col[1]  Dossier (peut être vide)
  nom_principal           TEXT,                         -- col[2]  Nom (côté principal)
  prenom_principal        TEXT,                         -- col[3]  Prénom (côté principal)
  type_relation_valeur    TEXT,                         -- col[4]  Type de relation - Valeur (109, 120...)
  type_relation_libelle   TEXT,                         -- col[5]  Type de relation - Libellé (Cousin, Cohabitant...)
  date_modification       DATE,                         -- col[12] Date de modification
  date_creation           DATE,                         -- col[15] Date de création
  relation_active         BOOLEAN DEFAULT TRUE,         -- col[29] Relation active (Oui/Non)
  date_fin_relation       DATE,                         -- col[30] Date fin relation
  physique_morale_valeur  TEXT,                         -- col[31] Physique/Morale - Valeur (1=physique, 2=morale)
  physique_morale_libelle TEXT,                         -- col[32] Physique/Morale - Libellé
  nom_lie                 TEXT,                         -- col[33] Nom (côté lié)
  prenom_lie              TEXT,                         -- col[34] Prénom (côté lié)
  clef_recherche          TEXT,                         -- col[35] Clef recherche (identifiant Brio du lié)
  rue_lie                 TEXT,                         -- col[36] Rue
  num_rue_lie             TEXT,                         -- col[37] No rue
  boite_lie               TEXT,                         -- col[38] Boîte
  cp_lie                  TEXT,                         -- col[41] Code postal
  localite_lie            TEXT,                         -- col[42] Localité
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_famille_brio UNIQUE(numero_brio)
);

CREATE INDEX IF NOT EXISTS idx_famille_dossier  ON famille(dossier);
CREATE INDEX IF NOT EXISTS idx_famille_clef     ON famille(clef_recherche);
CREATE INDEX IF NOT EXISTS idx_famille_active   ON famille(relation_active);

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE risques  ENABLE ROW LEVEL SECURITY;
ALTER TABLE famille  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risques_select ON risques;
CREATE POLICY risques_select ON risques FOR SELECT
  USING (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS risques_write ON risques;
CREATE POLICY risques_write ON risques FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS famille_select ON famille;
CREATE POLICY famille_select ON famille FOR SELECT
  USING (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS famille_write ON famille;
CREATE POLICY famille_write ON famille FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ================================================================
-- VUES
-- ================================================================

-- Vue : risques enrichis avec les infos du contrat + client
CREATE OR REPLACE VIEW v_risques_clients AS
SELECT
  r.police,
  r.type_risque_libelle                           AS type_risque,
  r.description,
  r.actif,
  r.gestionnaire,
  r.date_creation,
  c.dossier,
  c.compagnie,
  c.domaine,
  c.situation___libelle                           AS situation,
  cl.nom                                          AS nom_client,
  cl.prenom                                       AS prenom_client,
  cl.gsm
FROM risques r
LEFT JOIN contrats c  ON c.police = r.police
LEFT JOIN clients cl  ON cl.dossier = c.dossier;

-- Vue : famille enrichie avec dossier du lié (via clef_recherche → clients)
CREATE OR REPLACE VIEW v_famille_clients AS
SELECT
  f.numero_brio,
  f.dossier                                       AS dossier_principal,
  f.nom_principal,
  f.prenom_principal,
  f.type_relation_libelle                         AS relation,
  f.relation_active,
  f.nom_lie,
  f.prenom_lie,
  f.clef_recherche,
  f.cp_lie,
  f.localite_lie,
  cl_lie.dossier                                  AS dossier_lie,
  cl_lie.gsm                                      AS gsm_lie,
  cl_lie.e_mail                                   AS email_lie
FROM famille f
LEFT JOIN clients cl_lie
  ON UPPER(TRIM(cl_lie.nom || cl_lie.prenom))
     = UPPER(REPLACE(REPLACE(f.clef_recherche, ' ', ''), '-', ''))
  AND LENGTH(f.clef_recherche) > 5;

-- ================================================================
-- TRIGGERS updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION update_risques_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_risques_updated_at ON risques;
CREATE TRIGGER trg_risques_updated_at
  BEFORE UPDATE ON risques
  FOR EACH ROW EXECUTE FUNCTION update_risques_ts();

CREATE OR REPLACE FUNCTION update_famille_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_famille_updated_at ON famille;
CREATE TRIGGER trg_famille_updated_at
  BEFORE UPDATE ON famille
  FOR EACH ROW EXECUTE FUNCTION update_famille_ts();
