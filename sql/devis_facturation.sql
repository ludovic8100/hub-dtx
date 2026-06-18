-- ================================================================
-- MODULE DEVIS/FACTURATION — DTX SRL & LODE SRL
-- DEVE Suite Partie 4
-- ================================================================

-- ----------------------------------------------------------------
-- SÉQUENCES de numérotation automatique par société/type
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_dtx_devis    START 1;
CREATE SEQUENCE IF NOT EXISTS seq_lode_devis   START 1;
CREATE SEQUENCE IF NOT EXISTS seq_dtx_facture  START 1;
CREATE SEQUENCE IF NOT EXISTS seq_lode_facture START 1;

-- ----------------------------------------------------------------
-- TABLE : quotes (Devis)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  societe               TEXT NOT NULL CHECK (societe IN ('DTX','LODE')),
  numero                TEXT NOT NULL UNIQUE,
  statut                TEXT NOT NULL DEFAULT 'brouillon'
                          CHECK (statut IN ('brouillon','envoyé','accepté','refusé','expiré')),
  client_nom            TEXT NOT NULL,
  client_email          TEXT,
  client_telephone      TEXT,
  client_adresse        TEXT,
  client_tva            TEXT,
  objet                 TEXT NOT NULL,
  notes                 TEXT,
  montant_total_ht      NUMERIC(12,2) DEFAULT 0,
  montant_tva           NUMERIC(12,2) DEFAULT 0,
  montant_total_ttc     NUMERIC(12,2) DEFAULT 0,
  date_creation         TIMESTAMPTZ DEFAULT NOW(),
  date_envoi            TIMESTAMPTZ,
  date_expiration       DATE,
  date_acceptation      TIMESTAMPTZ,
  token_acceptation     TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expire_at       TIMESTAMPTZ,
  accepte_par_ip        TEXT,
  created_by            TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE : quote_lines (Lignes de devis)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_lines (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id              UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  ordre                 INTEGER NOT NULL DEFAULT 1,
  description           TEXT NOT NULL,
  quantite              NUMERIC(10,3) NOT NULL DEFAULT 1,
  prix_unitaire_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  taux_tva              NUMERIC(5,2) NOT NULL DEFAULT 21
);

-- ----------------------------------------------------------------
-- TABLE : invoices (Factures DTX/LODE — distincte de la table "factures" legacy)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  societe               TEXT NOT NULL CHECK (societe IN ('DTX','LODE')),
  numero                TEXT NOT NULL UNIQUE,
  quote_id              UUID REFERENCES quotes(id),
  statut                TEXT NOT NULL DEFAULT 'brouillon'
                          CHECK (statut IN ('brouillon','envoyé','payé','partiellement_payé','en_retard','annulé')),
  client_nom            TEXT NOT NULL,
  client_email          TEXT,
  client_telephone      TEXT,
  client_adresse        TEXT,
  client_tva            TEXT,
  objet                 TEXT,
  notes                 TEXT,
  montant_total_ht      NUMERIC(12,2) DEFAULT 0,
  montant_tva           NUMERIC(12,2) DEFAULT 0,
  montant_total_ttc     NUMERIC(12,2) DEFAULT 0,
  montant_paye          NUMERIC(12,2) DEFAULT 0,
  date_creation         TIMESTAMPTZ DEFAULT NOW(),
  date_envoi            TIMESTAMPTZ,
  date_echeance         DATE,
  date_paiement         DATE,
  iban_paiement         TEXT,
  bic_paiement          TEXT,
  reference_structuree  TEXT,
  lien_paiement         TEXT,
  qr_code_data          TEXT,
  created_by            TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE : invoice_lines (Lignes de facture)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_lines (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id            UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  ordre                 INTEGER NOT NULL DEFAULT 1,
  description           TEXT NOT NULL,
  quantite              NUMERIC(10,3) NOT NULL DEFAULT 1,
  prix_unitaire_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  taux_tva              NUMERIC(5,2) NOT NULL DEFAULT 21
);

-- ----------------------------------------------------------------
-- TABLE : quote_events (Tracking vues/acceptations)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quote_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN (
                'created','sent','viewed','accepted','declined','expired','converted_to_invoice'
              )),
  event_at    TIMESTAMPTZ DEFAULT NOW(),
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}'::jsonb
);

-- ----------------------------------------------------------------
-- INDEX
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quotes_societe       ON quotes(societe);
CREATE INDEX IF NOT EXISTS idx_quotes_statut        ON quotes(statut);
CREATE INDEX IF NOT EXISTS idx_quotes_token         ON quotes(token_acceptation);
CREATE INDEX IF NOT EXISTS idx_invoices_societe     ON invoices(societe);
CREATE INDEX IF NOT EXISTS idx_invoices_statut      ON invoices(statut);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_inv    ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_quote_lines_quote    ON quote_lines(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_events_quote   ON quote_events(quote_id);

-- ----------------------------------------------------------------
-- TRIGGER updated_at (crée la fonction si elle n'existe pas)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_updated_at   ON quotes;
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;

CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- FONCTION : generate_numero_devis(societe, annee)
-- Usage :  SELECT generate_numero_devis('DTX');  → DTX-D-2026-0001
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_numero_devis(
  p_societe TEXT,
  p_annee   INT DEFAULT EXTRACT(YEAR FROM NOW())::INT
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val INT;
  prefix  TEXT;
BEGIN
  IF p_societe = 'DTX' THEN
    seq_val := nextval('seq_dtx_devis');
    prefix  := 'DTX-D';
  ELSIF p_societe = 'LODE' THEN
    seq_val := nextval('seq_lode_devis');
    prefix  := 'LODE-D';
  ELSE
    RAISE EXCEPTION 'Société inconnue : %', p_societe;
  END IF;
  RETURN format('%s-%s-%s', prefix, p_annee, LPAD(seq_val::TEXT, 4, '0'));
END;
$$;

-- ----------------------------------------------------------------
-- FONCTION : generate_numero_facture(societe, annee)
-- Usage :  SELECT generate_numero_facture('DTX');  → DTX-F-2026-0001
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_numero_facture(
  p_societe TEXT,
  p_annee   INT DEFAULT EXTRACT(YEAR FROM NOW())::INT
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val INT;
  prefix  TEXT;
BEGIN
  IF p_societe = 'DTX' THEN
    seq_val := nextval('seq_dtx_facture');
    prefix  := 'DTX-F';
  ELSIF p_societe = 'LODE' THEN
    seq_val := nextval('seq_lode_facture');
    prefix  := 'LODE-F';
  ELSE
    RAISE EXCEPTION 'Société inconnue : %', p_societe;
  END IF;
  RETURN format('%s-%s-%s', prefix, p_annee, LPAD(seq_val::TEXT, 4, '0'));
END;
$$;

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_events  ENABLE ROW LEVEL SECURITY;

-- quotes : lecture filtrée par société
DROP POLICY IF EXISTS quotes_select ON quotes;
CREATE POLICY quotes_select ON quotes FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_email = auth.jwt()->>'email'
        AND (up.societe = quotes.societe OR up.societe = 'ALL')
    )
  );

DROP POLICY IF EXISTS quotes_write ON quotes;
CREATE POLICY quotes_write ON quotes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- quote_lines : hérite de la société via quotes
DROP POLICY IF EXISTS quote_lines_all ON quote_lines;
CREATE POLICY quote_lines_all ON quote_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_lines.quote_id
        AND (
          is_admin() OR
          EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_email = auth.jwt()->>'email'
              AND (up.societe = q.societe OR up.societe = 'ALL')
          )
        )
    )
  );

-- invoices
DROP POLICY IF EXISTS invoices_select ON invoices;
CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_email = auth.jwt()->>'email'
        AND (up.societe = invoices.societe OR up.societe = 'ALL')
    )
  );

DROP POLICY IF EXISTS invoices_write ON invoices;
CREATE POLICY invoices_write ON invoices FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- invoice_lines
DROP POLICY IF EXISTS invoice_lines_all ON invoice_lines;
CREATE POLICY invoice_lines_all ON invoice_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i WHERE i.id = invoice_lines.invoice_id
        AND (
          is_admin() OR
          EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_email = auth.jwt()->>'email'
              AND (up.societe = i.societe OR up.societe = 'ALL')
          )
        )
    )
  );

-- quote_events : admin only (sécurité tracking)
DROP POLICY IF EXISTS quote_events_admin ON quote_events;
CREATE POLICY quote_events_admin ON quote_events FOR ALL
  USING (is_admin());

-- ----------------------------------------------------------------
-- TEST RAPIDE (optionnel — décommenter pour vérifier)
-- SELECT generate_numero_devis('DTX');
-- SELECT generate_numero_facture('LODE');
-- ----------------------------------------------------------------
