-- =====================================================================
-- HUB DTX — Catégories de RDV (pilote la synchro agenda Outlook)
-- Le workflow n8n ne synchronise QUE les événements portant une
-- catégorie Outlook listée ici avec sync_enabled = true.
-- Gérable depuis le hub : ajout / modif / suppression / couleur.
-- 'code' doit correspondre EXACTEMENT au nom de la catégorie Outlook.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rdv_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,        -- nom exact de la catégorie Outlook (ex: DP)
  libelle       text NOT NULL,               -- libellé métier (ex: RDV client)
  type          text,                        -- client | fiscalite | interne | compagnie ...
  couleur       text DEFAULT '#0080BD',
  sync_enabled  boolean NOT NULL DEFAULT true,  -- inclure dans la synchro agenda
  actif         boolean NOT NULL DEFAULT true,
  ordre         integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rdv_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rdv_categories_read ON public.rdv_categories;
CREATE POLICY rdv_categories_read ON public.rdv_categories FOR SELECT USING (true);

-- Seed initial (modifiable depuis le hub ensuite)
INSERT INTO public.rdv_categories (code, libelle, type, couleur, ordre) VALUES
  ('DP',         'RDV client',                    'client',   '#dc2626', 1),
  ('IPP',        'RDV fiscalité client',          'fiscalite','#16a34a', 2),
  ('MANAGEMENT', 'Réunion équipe / RDV compagnie','interne',  '#0d9488', 3)
ON CONFLICT (code) DO NOTHING;
