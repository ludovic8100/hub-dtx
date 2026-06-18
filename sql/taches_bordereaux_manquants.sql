-- ================================================================
-- FONCTION : sync_taches_bordereaux_manquants()
-- 
-- Pour chaque commission bancaire sans RCP correspondant
-- (statut = 'commission_sans_fichier'), crée une tâche pour LDE
-- si elle n'existe pas déjà (évite les doublons par ref_externe)
-- ================================================================

CREATE OR REPLACE FUNCTION sync_taches_bordereaux_manquants()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec     RECORD;
  nb      INTEGER := 0;
  ref_ext TEXT;
  titre_t TEXT;
  desc_t  TEXT;
BEGIN

  FOR rec IN
    SELECT
      annee,
      mois,
      type,
      compagnie,
      commission_bancaire,
      communication_bancaire,
      date_transaction,
      statut_reconciliation
    FROM v_bordereaux_reconciliation
    WHERE statut_reconciliation IN ('commission_sans_fichier', 'manquant')
      AND annee >= EXTRACT(YEAR FROM NOW())::INT - 1  -- max 1 an en arrière
    ORDER BY annee DESC, mois DESC, compagnie
  LOOP

    -- Clé unique pour éviter les doublons
    ref_ext := 'BOR-' || rec.annee || '-' || rec.mois || '-' || COALESCE(rec.compagnie, 'INCONNU') || '-' || rec.statut_reconciliation;

    -- Ne créer que si pas déjà existante
    IF NOT EXISTS (
      SELECT 1 FROM taches WHERE ref_externe = ref_ext
    ) THEN

      -- Titre selon le statut
      IF rec.statut_reconciliation = 'commission_sans_fichier' THEN
        titre_t := 'RCP manquant — ' || COALESCE(rec.compagnie, '?') || ' — ' || rec.mois || '/' || rec.annee;
        desc_t  := 'Commission reçue en banque (' || COALESCE(rec.commission_bancaire::TEXT, '?') || ' €) sans bordereau RCP correspondant.'
                || COALESCE(' Comm: ' || rec.communication_bancaire, '');
      ELSE
        titre_t := 'Bordereau introuvable — ' || COALESCE(rec.compagnie, '?') || ' — ' || rec.mois || '/' || rec.annee;
        desc_t  := 'Ni bordereau ni commission bancaire trouvés pour ' || COALESCE(rec.compagnie, '?') || ' (' || rec.mois || '/' || rec.annee || ').';
      END IF;

      INSERT INTO taches (
        titre,
        description,
        gestionnaire,
        statut,
        priorite,
        code_type,
        ref_externe,
        echeance,
        created_at
      ) VALUES (
        titre_t,
        desc_t,
        'LDE',
        'en_attente',
        CASE rec.statut_reconciliation
          WHEN 'commission_sans_fichier' THEN 'haute'
          ELSE 'normale'
        END,
        'BOR',
        ref_ext,
        -- Échéance : fin du mois suivant la période
        (TO_DATE(rec.annee || '-' || rec.mois || '-01', 'YYYY-MM-DD') + INTERVAL '2 months')::DATE,
        NOW()
      );

      nb := nb + 1;
    END IF;

  END LOOP;

  RETURN nb;  -- retourne le nombre de tâches créées
END;
$$;

-- ================================================================
-- Pour ajouter ref_externe à la table taches si elle n'existe pas
-- ================================================================
ALTER TABLE taches ADD COLUMN IF NOT EXISTS ref_externe TEXT UNIQUE;
ALTER TABLE taches ADD COLUMN IF NOT EXISTS description  TEXT;
ALTER TABLE taches ADD COLUMN IF NOT EXISTS priorite     TEXT DEFAULT 'normale';

-- ================================================================
-- Test : appel manuel
-- SELECT sync_taches_bordereaux_manquants();
-- ================================================================

-- ================================================================
-- Vue utile : tâches bordereaux en attente pour LDE
-- ================================================================
CREATE OR REPLACE VIEW v_taches_bordereaux AS
SELECT
  id, titre, description, statut, priorite, echeance,
  ref_externe, created_at
FROM taches
WHERE gestionnaire = 'LDE'
  AND code_type = 'BOR'
  AND statut NOT IN ('terminee', 'annulee')
ORDER BY echeance ASC;
