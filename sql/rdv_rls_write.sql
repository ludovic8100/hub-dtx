-- =====================================================================
-- HUB DTX — Autoriser la liaison manuelle d'un RDV à un client
-- (mise à jour de rdv.client_id depuis le hub). Auth applicative O365 +
-- clé anon côté Supabase ; l'action est réservée aux utilisateurs du hub.
-- =====================================================================
GRANT UPDATE ON public.rdv TO anon, authenticated;

DROP POLICY IF EXISTS rdv_update ON public.rdv;
CREATE POLICY rdv_update ON public.rdv
  FOR UPDATE USING (true) WITH CHECK (true);
