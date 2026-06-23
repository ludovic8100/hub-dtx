-- =====================================================================
-- HUB DTX — Autoriser la gestion des catégories RDV depuis le hub
-- (ajout / modif / suppression / couleur). Cohérent avec l'architecture
-- du hub : auth applicative O365 + clé anon côté Supabase. L'écran de
-- gestion est réservé aux admins côté UI.
-- =====================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdv_categories TO anon, authenticated;

DROP POLICY IF EXISTS rdv_categories_write ON public.rdv_categories;
CREATE POLICY rdv_categories_write ON public.rdv_categories
  FOR ALL USING (true) WITH CHECK (true);
