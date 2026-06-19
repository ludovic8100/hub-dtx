-- ================================================================
-- MODULE DEVIS / FACTURES — LODE SRL
-- Numérotation séparée : 2026-0001 (devis) et 2026-0001 (factures)
-- TVA 21% / 6% / 0% · Remise globale (%) + remise par ligne
-- ================================================================

-- Séquences par année (réinitialisables) — gérées via fonction
CREATE SEQUENCE IF NOT EXISTS seq_lode_devis_2026   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_lode_facture_2026 START 1;

-- ----------------------------------------------------------------
-- DEVIS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lode_devis (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero             TEXT UNIQUE NOT NULL,           -- ex: 2026-0001
  statut             TEXT NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon','envoyé','accepté','refusé','expiré')),
  -- Client
  client_nom         TEXT NOT NULL,
  client_adresse     TEXT,
  client_cp          TEXT,
  client_ville       TEXT,
  client_email       TEXT,
  client_telephone   TEXT,
  client_tva         TEXT,
  -- Contenu
  objet              TEXT,
  notes              TEXT,
  remise_pct         NUMERIC(5,2) DEFAULT 0,         -- remise globale %
  -- Totaux (calculés et stockés)
  total_ht           NUMERIC(12,2) DEFAULT 0,
  total_tva          NUMERIC(12,2) DEFAULT 0,
  total_ttc          NUMERIC(12,2) DEFAULT 0,
  -- Dates
  date_devis         DATE DEFAULT CURRENT_DATE,
  date_validite      DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lode_devis_lignes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id      UUID NOT NULL REFERENCES lode_devis(id) ON DELETE CASCADE,
  position      INTEGER DEFAULT 0,
  description   TEXT NOT NULL,
  quantite      NUMERIC(10,2) DEFAULT 1,
  prix_unitaire NUMERIC(12,2) DEFAULT 0,
  remise_pct    NUMERIC(5,2) DEFAULT 0,              -- remise par ligne %
  tva_pct       NUMERIC(5,2) DEFAULT 21,             -- 21 / 6 / 0
  total_ht      NUMERIC(12,2) DEFAULT 0
);

-- ----------------------------------------------------------------
-- FACTURES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lode_factures (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero             TEXT UNIQUE NOT NULL,           -- ex: 2026-0001
  devis_id           UUID REFERENCES lode_devis(id), -- si issue d'un devis
  statut             TEXT NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon','envoyée','payée','partiellement payée','en retard','annulée')),
  client_nom         TEXT NOT NULL,
  client_adresse     TEXT,
  client_cp          TEXT,
  client_ville       TEXT,
  client_email       TEXT,
  client_telephone   TEXT,
  client_tva         TEXT,
  objet              TEXT,
  notes              TEXT,
  remise_pct         NUMERIC(5,2) DEFAULT 0,
  total_ht           NUMERIC(12,2) DEFAULT 0,
  total_tva          NUMERIC(12,2) DEFAULT 0,
  total_ttc          NUMERIC(12,2) DEFAULT 0,
  montant_paye       NUMERIC(12,2) DEFAULT 0,
  date_facture       DATE DEFAULT CURRENT_DATE,
  date_echeance      DATE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lode_factures_lignes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id    UUID NOT NULL REFERENCES lode_factures(id) ON DELETE CASCADE,
  position      INTEGER DEFAULT 0,
  description   TEXT NOT NULL,
  quantite      NUMERIC(10,2) DEFAULT 1,
  prix_unitaire NUMERIC(12,2) DEFAULT 0,
  remise_pct    NUMERIC(5,2) DEFAULT 0,
  tva_pct       NUMERIC(5,2) DEFAULT 21,
  total_ht      NUMERIC(12,2) DEFAULT 0
);

-- ----------------------------------------------------------------
-- Numérotation auto : 2026-0001
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_lode_numero(p_type TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_an  TEXT := to_char(CURRENT_DATE, 'YYYY');
  v_seq INTEGER;
BEGIN
  IF p_type = 'devis' THEN
    v_seq := nextval('seq_lode_devis_2026');
  ELSE
    v_seq := nextval('seq_lode_facture_2026');
  END IF;
  RETURN v_an || '-' || lpad(v_seq::TEXT, 4, '0');
END; $$;

-- ----------------------------------------------------------------
-- Indexes + RLS
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lode_devis_statut    ON lode_devis(statut);
CREATE INDEX IF NOT EXISTS idx_lode_factures_statut ON lode_factures(statut);
CREATE INDEX IF NOT EXISTS idx_lode_dl_devis        ON lode_devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_lode_fl_facture      ON lode_factures_lignes(facture_id);

ALTER TABLE lode_devis           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lode_devis_lignes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lode_factures        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lode_factures_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_lode_devis    ON lode_devis;
CREATE POLICY p_lode_devis    ON lode_devis    FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS p_lode_dl       ON lode_devis_lignes;
CREATE POLICY p_lode_dl       ON lode_devis_lignes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS p_lode_fact     ON lode_factures;
CREATE POLICY p_lode_fact     ON lode_factures FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS p_lode_fl       ON lode_factures_lignes;
CREATE POLICY p_lode_fl       ON lode_factures_lignes FOR ALL USING (true) WITH CHECK (true);

-- updated_at triggers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_lode_devis_ts ON lode_devis;
CREATE TRIGGER trg_lode_devis_ts BEFORE UPDATE ON lode_devis
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
DROP TRIGGER IF EXISTS trg_lode_fact_ts ON lode_factures;
CREATE TRIGGER trg_lode_fact_ts BEFORE UPDATE ON lode_factures
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
