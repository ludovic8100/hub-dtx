-- ================================================================
-- TABLE : client_actions
-- Historique des actions par dossier client (Dynassur)
-- DEVE Suite Partie 4
-- ================================================================

CREATE TABLE IF NOT EXISTS client_actions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_dossier  TEXT NOT NULL,
  type_action     TEXT NOT NULL CHECK (type_action IN (
                    'appel','email','rencontre','tâche','note',
                    'sinistre','contrat','devis','facture','autre'
                  )),
  titre           TEXT NOT NULL,
  description     TEXT,
  statut          TEXT NOT NULL DEFAULT 'terminée'
                    CHECK (statut IN ('en_cours','terminée','en_attente')),
  priorite        TEXT DEFAULT 'normale'
                    CHECK (priorite IN ('basse','normale','haute','urgente')),
  date_action     TIMESTAMPTZ DEFAULT NOW(),
  date_echeance   TIMESTAMPTZ,
  created_by      TEXT,
  assigned_to     TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- FK vers clients.dossier (ajout si la table clients a dossier comme PK)
-- Si la FK échoue (dossier n'est pas PK dans clients), supprimer la ligne ALTER TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_actions_client_dossier_fkey'
  ) THEN
    ALTER TABLE client_actions
      ADD CONSTRAINT client_actions_client_dossier_fkey
      FOREIGN KEY (client_dossier) REFERENCES clients(dossier);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'FK clients(dossier) non ajoutée : %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_actions_dossier  ON client_actions(client_dossier);
CREATE INDEX IF NOT EXISTS idx_client_actions_date     ON client_actions(date_action DESC);
CREATE INDEX IF NOT EXISTS idx_client_actions_assigned ON client_actions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_client_actions_statut   ON client_actions(statut);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_client_actions_updated_at ON client_actions;
CREATE TRIGGER trg_client_actions_updated_at
  BEFORE UPDATE ON client_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE client_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_actions_select ON client_actions;
CREATE POLICY client_actions_select ON client_actions FOR SELECT
  USING (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS client_actions_insert ON client_actions;
CREATE POLICY client_actions_insert ON client_actions FOR INSERT
  WITH CHECK (is_admin() OR auth.jwt()->>'email' IS NOT NULL);

DROP POLICY IF EXISTS client_actions_update ON client_actions;
CREATE POLICY client_actions_update ON client_actions FOR UPDATE
  USING (
    is_admin() OR
    created_by = auth.jwt()->>'email' OR
    assigned_to = auth.jwt()->>'email'
  );
