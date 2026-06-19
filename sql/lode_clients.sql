-- ================================================================
-- TABLE : lode_clients — clients LODE (particuliers & entreprises)
-- ================================================================
CREATE TABLE IF NOT EXISTS lode_clients (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT NOT NULL DEFAULT 'particulier'
                    CHECK (type IN ('particulier','entreprise')),
  -- Entreprise
  numero_bce      TEXT,                     -- ex: 0123.456.789
  denomination    TEXT,                     -- raison sociale
  forme_juridique TEXT,
  -- Particulier / contact
  nom             TEXT,
  prenom          TEXT,
  -- Coordonnées
  adresse         TEXT,
  cp              TEXT,
  ville           TEXT,
  pays            TEXT DEFAULT 'Belgique',
  tva             TEXT,                      -- BE0123456789
  email           TEXT,
  telephone       TEXT,
  gsm             TEXT,
  -- Divers
  notes           TEXT,
  peppol_id       TEXT,                      -- identifiant Peppol (0208:numéro BCE) si applicable
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lode_clients_nom   ON lode_clients(nom);
CREATE INDEX IF NOT EXISTS idx_lode_clients_bce   ON lode_clients(numero_bce);
CREATE INDEX IF NOT EXISTS idx_lode_clients_denom ON lode_clients(denomination);

ALTER TABLE lode_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_lode_clients ON lode_clients;
CREATE POLICY p_lode_clients ON lode_clients FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_lode_clients_ts ON lode_clients;
CREATE TRIGGER trg_lode_clients_ts BEFORE UPDATE ON lode_clients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Lien optionnel devis/facture → client (on garde aussi les champs texte pour l'historique)
ALTER TABLE lode_devis    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES lode_clients(id);
ALTER TABLE lode_factures ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES lode_clients(id);
