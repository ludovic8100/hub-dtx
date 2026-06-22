-- =====================================================================
-- HUB DTX — Module RDV (agenda Outlook -> suivi commercial/gestionnaire)
-- Modèle : le RDV est un ÉVÉNEMENT (pas une tâche). Il peut générer une
-- tâche de suivi dans public.taches (lien via tache_suivi_id).
-- Synchro : Outlook (Microsoft Graph) -> Supabase, via n8n.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rdv (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identité Outlook (clé d'upsert anti-doublon)
  outlook_event_id   text UNIQUE,
  user_email         text,            -- agenda d'origine (multi-utilisateurs)
  web_link           text,            -- deep-link vers l'événement Outlook

  -- Contenu
  objet              text NOT NULL,
  description        text,
  lieu               text,
  debut              timestamptz NOT NULL,
  fin                timestamptz,
  journee_entiere    boolean DEFAULT false,
  is_recurring       boolean DEFAULT false,

  -- Suivi métier
  statut             text DEFAULT 'planifie',   -- planifie | realise | annule | no_show
  categorie          text,                       -- catégorie Outlook / type de RDV
  dossier_client     text,                       -- rattachement au dossier
  client_id          bigint,                     -- FK logique -> clients.id
  commercial_code    text,                       -- collaborateurs.code
  gestionnaire_code  text,                       -- collaborateurs.code
  organisateur_email text,
  participants       jsonb,

  -- Boucle de suivi
  tache_suivi_id     bigint,                     -- FK logique -> taches.id

  societe_id         uuid,
  source             text DEFAULT 'outlook',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Index de consultation
CREATE INDEX IF NOT EXISTS idx_rdv_debut             ON public.rdv (debut DESC);
CREATE INDEX IF NOT EXISTS idx_rdv_dossier           ON public.rdv (dossier_client);
CREATE INDEX IF NOT EXISTS idx_rdv_gestionnaire      ON public.rdv (gestionnaire_code);
CREATE INDEX IF NOT EXISTS idx_rdv_commercial        ON public.rdv (commercial_code);
CREATE INDEX IF NOT EXISTS idx_rdv_user_email        ON public.rdv (user_email);

-- RLS : lecture ouverte (app via clé anon), écritures via service_role (n8n) qui bypass la RLS.
-- (À ajuster si ta convention RLS diffère.)
ALTER TABLE public.rdv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rdv_read ON public.rdv;
CREATE POLICY rdv_read ON public.rdv FOR SELECT USING (true);

-- Trigger updated_at (optionnel, si tu as déjà une fonction set_updated_at réutilise-la)
-- CREATE TRIGGER trg_rdv_updated BEFORE UPDATE ON public.rdv
--   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
