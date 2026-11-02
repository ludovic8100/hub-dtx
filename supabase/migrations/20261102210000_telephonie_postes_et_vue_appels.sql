-- Téléphonie 3CX : nommer les postes, et normaliser le journal des appels.
--
-- Trois problèmes dans `appels`, tous visibles à l'écran :
--
-- 1. La colonne « Contact » était vide pour presque tout le monde : elle
--    n'affichait que `nom_3cx` (rempli 2 115 fois sur 6 796), alors que
--    `client_id` est rattaché 4 215 fois. Le nom du client était en base,
--    simplement jamais lu.
--
-- 2. `direction` a quatre valeurs — Inbound, Outbound, Notanswered, Missed —
--    et le front testait `direction.startsWith('in')`. Les 93 appels manqués
--    étaient donc comptés comme SORTANTS. La notion même d'appel manqué,
--    première métrique d'un centre d'appels, n'existait pas.
--
-- 3. `duree` est du texte, dans deux formats qui cohabitent : « MM:SS »
--    (4 132 lignes, 01/07 → aujourd'hui) et un nombre de secondes brut
--    (2 664 lignes, 13/08 → 30/09, venues d'un second importateur depuis
--    arrêté). Impossible d'additionner ou de moyenner quoi que ce soit.
--
-- Et `agent` porte le poste, parfois suffixé du code collaborateur
-- (« 22.NGI »), format abandonné le 30/09. Ce suffixe nous donne le mapping
-- poste → collaborateur sans avoir à le saisir : on le récupère ci-dessous.

-- ── 1. Le poste d'un collaborateur ────────────────────────────────────────
ALTER TABLE public.collaborateurs ADD COLUMN IF NOT EXISTS extension text;

COMMENT ON COLUMN public.collaborateurs.extension IS
  'Numéro de poste 3CX (ex. « 22 »). Se saisit dans Paramètres → fiche collaborateur.';

CREATE UNIQUE INDEX IF NOT EXISTS collaborateurs_extension_uniq
  ON public.collaborateurs (extension) WHERE extension IS NOT NULL;

-- ── 2. Les postes qui ne sont pas des personnes ───────────────────────────
-- Files d'attente, SVI, « bureau fermé » : 86, 80, 91, 92, 93, 30… reçoivent
-- des appels sans appartenir à quelqu'un. Ils se nomment ici.
CREATE TABLE IF NOT EXISTS public.postes_telephonie (
  extension   text PRIMARY KEY,
  libelle     text NOT NULL,
  categorie   text NOT NULL DEFAULT 'service',   -- service | file | svi | hors_horaires | inconnu
  actif       boolean NOT NULL DEFAULT true,
  commentaire text,
  cree_le     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.postes_telephonie IS
  'Libellé des postes 3CX qui ne sont pas rattachés à un collaborateur (files, SVI, bureau fermé).';

ALTER TABLE public.postes_telephonie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS postes_telephonie_read  ON public.postes_telephonie;
DROP POLICY IF EXISTS postes_telephonie_write ON public.postes_telephonie;

-- Même porte que `appels` : lisible et modifiable par les collaborateurs
-- connectés. Ce ne sont que des étiquettes de postes, pas des données clients.
CREATE POLICY postes_telephonie_read  ON public.postes_telephonie
  FOR SELECT TO authenticated USING (true);
CREATE POLICY postes_telephonie_write ON public.postes_telephonie
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.postes_telephonie TO authenticated;

-- ── 3. Reprise du mapping poste → collaborateur depuis l'historique ───────
-- L'ancien format « 22.NGI » porte le code du collaborateur : on le lit plutôt
-- que de le faire ressaisir. Un poste réattribué depuis donnerait une valeur
-- périmée — d'où le choix du poste le plus récemment vu pour chaque code.
WITH vus AS (
  SELECT split_part(agent, '.', 1) AS ext,
         split_part(agent, '.', 2) AS code,
         max(debut)                AS dernier
  FROM public.appels
  WHERE agent ~ '^[0-9]+\.[A-Z]{3}$'
  GROUP BY 1, 2
),
retenu AS (
  SELECT DISTINCT ON (code) code, ext FROM vus ORDER BY code, dernier DESC
)
UPDATE public.collaborateurs c
   SET extension = r.ext
  FROM retenu r
 WHERE c.code = r.code
   AND c.extension IS NULL;

-- Le poste 21 est entré en service le 06/10, après l'abandon du format suffixé :
-- il n'apparaît nulle part dans l'historique. Attribution indiquée par Ludovic.
UPDATE public.collaborateurs SET extension = '21'
 WHERE code = 'ICA' AND extension IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.collaborateurs WHERE extension = '21');

-- ── 4. Les postes de service observés dans le journal ─────────────────────
-- Seul 86 est identifié (« bureau fermé », indiqué par Ludovic). Les autres
-- sont créés en catégorie « inconnu » pour qu'ils apparaissent à l'écran et
-- puissent être nommés, plutôt que de rester des numéros nus.
INSERT INTO public.postes_telephonie (extension, libelle, categorie, commentaire)
VALUES ('86', 'Bureau fermé', 'hors_horaires', 'Appels arrivés en dehors des heures d''ouverture')
ON CONFLICT (extension) DO NOTHING;

INSERT INTO public.postes_telephonie (extension, libelle, categorie)
SELECT ext, 'Poste ' || ext, 'inconnu'
  FROM (
    SELECT DISTINCT nullif(split_part(coalesce(agent, ''), '.', 1), '') AS ext
      FROM public.appels
  ) t
 WHERE ext IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.collaborateurs c WHERE c.extension = t.ext)
ON CONFLICT (extension) DO NOTHING;

-- ── 5. La vue normalisée ──────────────────────────────────────────────────
-- security_invoker : la vue applique les droits de celui qui l'interroge, et
-- non ceux de son propriétaire. Sans cela elle contournerait la RLS de
-- `appels` et de `clients` et exposerait le journal — et les noms de clients —
-- à un visiteur non connecté. À conserver.
DROP VIEW IF EXISTS public.v_appels;
CREATE VIEW public.v_appels WITH (security_invoker = true) AS
SELECT
  a.id,
  a.debut,
  a.direction,

  -- Inbound / Missed / Notanswered sont tous des appels ENTRANTS.
  CASE WHEN lower(coalesce(a.direction, '')) IN ('inbound', 'missed', 'notanswered')
       THEN 'entrant' ELSE 'sortant' END AS sens,

  -- Manqué = la personne n'a pas décroché. C'est la métrique qui manquait.
  (lower(coalesce(a.direction, '')) IN ('missed', 'notanswered')) AS manque,

  coalesce(nullif(a.numero_e164, ''), nullif(a.numero_externe, '')) AS numero,

  -- Durée en secondes, quel que soit le format d'origine.
  CASE
    WHEN a.duree ~ '^[0-9]+$'                      THEN a.duree::int
    WHEN a.duree ~ '^[0-9]{1,2}:[0-9]{2}$'         THEN split_part(a.duree, ':', 1)::int * 60
                                                      + split_part(a.duree, ':', 2)::int
    WHEN a.duree ~ '^[0-9]{1,3}:[0-9]{2}:[0-9]{2}$' THEN split_part(a.duree, ':', 1)::int * 3600
                                                      + split_part(a.duree, ':', 2)::int * 60
                                                      + split_part(a.duree, ':', 3)::int
    ELSE NULL
  END AS duree_s,

  nullif(split_part(coalesce(a.agent, ''), '.', 1), '') AS extension,
  a.agent AS agent_brut,

  co.code        AS collaborateur_code,
  co.nom_complet AS collaborateur,

  pt.libelle   AS poste_libelle,
  pt.categorie AS poste_categorie,

  -- Qui afficher dans « Contact » : le client rattaché d'abord, le nom
  -- remonté par 3CX ensuite, rien sinon.
  a.client_id,
  cl.dossier AS client_dossier,
  nullif(btrim(coalesce(cl.nom, '') || ' ' || coalesce(cl.prenom, '')), '') AS client_nom,
  nullif(a.nom_3cx, '') AS nom_3cx,
  coalesce(
    nullif(btrim(coalesce(cl.nom, '') || ' ' || coalesce(cl.prenom, '')), ''),
    nullif(a.nom_3cx, '')
  ) AS contact

FROM public.appels a
LEFT JOIN public.collaborateurs  co ON co.extension = nullif(split_part(coalesce(a.agent, ''), '.', 1), '')
LEFT JOIN public.postes_telephonie pt ON pt.extension = nullif(split_part(coalesce(a.agent, ''), '.', 1), '')
LEFT JOIN public.clients         cl ON cl.id = a.client_id;

COMMENT ON VIEW public.v_appels IS
  'Journal 3CX normalisé : sens, appel manqué, durée en secondes, poste nommé, contact résolu.';

GRANT SELECT ON public.v_appels TO authenticated;

CREATE INDEX IF NOT EXISTS appels_debut_idx ON public.appels (debut DESC);
