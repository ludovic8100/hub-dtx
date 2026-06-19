-- ================================================================
-- TABLE : client_relations
-- Liens familiaux et professionnels entre clients
-- ================================================================

CREATE TABLE IF NOT EXISTS client_relations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_a     TEXT NOT NULL,
  dossier_b     TEXT NOT NULL,
  type_relation TEXT NOT NULL CHECK (type_relation IN (
    'conjoint',       -- partenaire de vie (symétrique)
    'enfant',         -- A est parent de B
    'parent',         -- A est enfant de B (inverse de 'enfant')
    'fratrie',        -- frère/sœur (symétrique)
    'entreprise',     -- lien avec une personne morale
    'apporteur',      -- A a apporté B comme client
    'autre'
  )),
  label         TEXT,      -- ex: "Épouse", "Fils", "LODE SRL"
  note          TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uk_relation UNIQUE(dossier_a, dossier_b)
);

CREATE INDEX IF NOT EXISTS idx_cr_a ON client_relations(dossier_a);
CREATE INDEX IF NOT EXISTS idx_cr_b ON client_relations(dossier_b);

ALTER TABLE client_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cr_select ON client_relations;
CREATE POLICY cr_select ON client_relations FOR SELECT
  USING (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS cr_write ON client_relations;
CREATE POLICY cr_write ON client_relations FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- ----------------------------------------------------------------
-- Exemples à adapter et exécuter :
-- INSERT INTO client_relations (dossier_a, dossier_b, type_relation, label)
-- VALUES
--   ('LDE-001', 'LOR-001', 'conjoint', 'Épouse'),
--   ('LDE-001', 'CHA-001', 'enfant',   'Fille — Charline'),
--   ('LDE-001', 'ARN-001', 'enfant',   'Fils — Arnaud');
-- ----------------------------------------------------------------
