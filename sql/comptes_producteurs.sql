-- ================================================================
-- TABLE : comptes_producteurs
-- Associe un compte bancaire (IBAN) à chaque compte producteur
-- pour permettre le matching dans la réconciliation bordereaux
-- DEVE Suite Partie 4
-- ================================================================

CREATE TABLE IF NOT EXISTS comptes_producteurs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_producteur   TEXT NOT NULL,            -- ex: 58824
  compagnie_nom       TEXT NOT NULL,            -- ex: AG Insurance
  iban                TEXT,                     -- IBAN du compte de paiement compagnie
  bic                 TEXT,
  banque              TEXT,
  actif               BOOLEAN DEFAULT TRUE,
  notes               TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_compte_producteur UNIQUE (compte_producteur)
);

-- Optionnel : FK vers producteurs si la table existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'producteurs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'comptes_producteurs_fkey'
    ) THEN
      ALTER TABLE comptes_producteurs
        ADD CONSTRAINT comptes_producteurs_fkey
        FOREIGN KEY (compte_producteur)
        REFERENCES producteurs(numero_compte);
    END IF;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK producteurs non ajoutée : %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_cp_compte ON comptes_producteurs(compte_producteur);
CREATE INDEX IF NOT EXISTS idx_cp_compagnie ON comptes_producteurs(compagnie_nom);

ALTER TABLE comptes_producteurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cp_select ON comptes_producteurs;
CREATE POLICY cp_select ON comptes_producteurs FOR SELECT
  USING (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS cp_write ON comptes_producteurs;
CREATE POLICY cp_write ON comptes_producteurs FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
