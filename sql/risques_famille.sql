-- ================================================================
-- TABLES : risques + famille
-- Import depuis CSV Brio via n8n
-- ================================================================

-- ----------------------------------------------------------------
-- TABLE : risques
-- Objets de risque liés aux polices (contrats)
-- Source : DATA_RISQUE.csv
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risques (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  police                  TEXT NOT NULL,
  actif                   BOOLEAN DEFAULT TRUE,
  visible_mybroker        BOOLEAN DEFAULT FALSE,
  contrats_lies           BOOLEAN DEFAULT FALSE,
  total_contrats_en_cours INTEGER DEFAULT 0,
  type_risque_valeur      TEXT,        -- ex: 001, 011, 060
  type_risque_libelle     TEXT,        -- ex: Véhicule, Contenu, Famille
  description             TEXT,        -- ex: "1YEC323 - SKODA - FABIA"
  gestionnaire            TEXT,
  date_creation           DATE,
  created_by              TEXT,
  date_modification       DATE,
  modified_by             TEXT,
  date_desactivation      DATE,
  desactive_by            TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_risque_police UNIQUE(police)
);

CREATE INDEX IF NOT EXISTS idx_risques_police ON risques(police);
CREATE INDEX IF NOT EXISTS idx_risques_type   ON risques(type_risque_valeur);
CREATE INDEX IF NOT EXISTS idx_risques_actif  ON risques(actif);

-- ----------------------------------------------------------------
-- TABLE : famille
-- Liens familiaux exportés depuis Brio
-- Source : DATA_FAMILLE.csv
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS famille (
  id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_brio             TEXT,                     -- col "Numéro"
  dossier                 TEXT,                     -- dossier du membre principal (peut être vide)
  nom_principal           TEXT,                     -- col "Nom" (côté principal)
  prenom_principal        TEXT,                     -- col "Prénom" (côté principal)
  type_relation_valeur    TEXT,                     -- col "Type de relation - Valeur"
  type_relation_libelle   TEXT,                     -- col "Type de relation - Libellé"
  relation_active         BOOLEAN DEFAULT TRUE,     -- col "Relation active"
  date_fin_relation       DATE,
  physique_morale_valeur  TEXT,                     -- 1=physique, 2=morale
  physique_morale_libelle TEXT,
  nom_lie                 TEXT,                     -- col "Nom" (côté lié)
  prenom_lie              TEXT,                     -- col "Prénom" (côté lié)
  clef_recherche          TEXT,                     -- identifiant Brio du lié
  rue_lie                 TEXT,
  num_rue_lie             TEXT,
  boite_lie               TEXT,
  cp_lie                  TEXT,
  localite_lie            TEXT,
  date_creation           DATE,
  created_by              TEXT,
  date_modification       DATE,
  modified_by             TEXT,
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
  c.nom                                           AS compagnie,
  c.domaine,
  c.situation___libelle                           AS situation,
  cl.nom                                          AS nom_client,
  cl.prenom                                       AS prenom_client,
  cl.gsm,
  cl.email
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
  -- Chercher le dossier du lié dans clients via la clef_recherche
  cl_lie.dossier                                  AS dossier_lie,
  cl_lie.gsm                                      AS gsm_lie,
  cl_lie.email                                    AS email_lie
FROM famille f
LEFT JOIN clients cl_lie
  ON UPPER(REPLACE(REPLACE(cl_lie.nom || cl_lie.prenom, ' ', ''), '-', ''))
     = UPPER(REPLACE(REPLACE(f.clef_recherche, ' ', ''), '-', ''))
     AND LENGTH(f.clef_recherche) > 5;

-- ================================================================
-- TRIGGERS updated_at
-- ================================================================
DROP TRIGGER IF EXISTS trg_risques_updated_at ON risques;
CREATE TRIGGER trg_risques_updated_at
  BEFORE UPDATE ON risques
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_famille_updated_at ON famille;
CREATE TRIGGER trg_famille_updated_at
  BEFORE UPDATE ON famille
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
