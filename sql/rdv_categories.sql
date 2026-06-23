-- =====================================================================
-- HUB DTX — Catégories de RDV (pilote la synchro agenda Outlook)
-- Le workflow n8n ne synchronise QUE les événements 2026 portant une
-- catégorie Outlook listée ici avec sync_enabled = true.
-- Gérable depuis le hub : ajout / modif / suppression / couleur.
-- 'code' = nom EXACT de la catégorie Outlook (sensible à l'orthographe).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rdv_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,        -- nom exact de la catégorie Outlook (ex: DP)
  libelle       text NOT NULL,               -- libellé métier (ex: RDV client)
  entite        text,                         -- DYNASSUR | LODE | ...
  type          text,                         -- client | interne | formation ...
  couleur       text DEFAULT '#0080BD',
  sync_enabled  boolean NOT NULL DEFAULT true,
  actif         boolean NOT NULL DEFAULT true,
  ordre         integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rdv_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rdv_categories_read ON public.rdv_categories;
CREATE POLICY rdv_categories_read ON public.rdv_categories FOR SELECT USING (true);

-- Si la table existait déjà avec l'ancien seed, on ajoute la colonne entite
ALTER TABLE public.rdv_categories ADD COLUMN IF NOT EXISTS entite text;

-- Seed : Dynassur = DP / MANAGEMENT / FORMATION ; Lode = JIFU / LODE
INSERT INTO public.rdv_categories (code, libelle, entite, type, couleur, ordre) VALUES
  ('DP',         'RDV client',                     'DYNASSUR', 'client',    '#dc2626', 1),
  ('MANAGEMENT', 'Réunion équipe / RDV compagnie', 'DYNASSUR', 'interne',   '#0d9488', 2),
  ('FORMATION',  'Formation',                      'DYNASSUR', 'formation', '#7c3aed', 3),
  ('JIFU',       'RDV JIFU',                       'LODE',     'client',    '#ea580c', 4),
  ('LODE',       'RDV LODE',                       'LODE',     'client',    '#ea580c', 5)
ON CONFLICT (code) DO UPDATE
  SET libelle=EXCLUDED.libelle, entite=EXCLUDED.entite, type=EXCLUDED.type,
      couleur=EXCLUDED.couleur, ordre=EXCLUDED.ordre, updated_at=now();

-- On retire l'ancienne catégorie IPP du premier seed si présente
DELETE FROM public.rdv_categories WHERE code='IPP';
