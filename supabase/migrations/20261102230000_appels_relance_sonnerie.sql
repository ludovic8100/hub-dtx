-- Un appel qui sonne trois fois n'est pas trois appels manqués.
--
-- Constaté le 02/11/2026 sur le journal : le 27/10 à 09:07, trois lignes
-- « Notanswered » du même numéro vers le poste 22, à 08:07:06, 08:07:13 et
-- 08:07:27 UTC — sept puis quatorze secondes d'écart, durée nulle. Ce ne sont
-- pas des doublons d'insertion (chaque ligne a son propre cree_le, deux
-- secondes après son debut) : c'est 3CX qui rapporte chaque coup de sonnerie
-- comme un événement distinct via le scénario ReportCall.
--
-- Mesuré sur l'ensemble : 11 des 93 appels manqués sont des relances de
-- sonnerie à moins de 60 s (9 à moins de 30 s). Soit 12 % du compteur.
--
-- On ne supprime rien : le journal doit montrer ce qui s'est passé. On marque,
-- et les statistiques excluent les relances.
--
-- Vérifié au passage : aucun cas de « non répondu » suivi d'un appel répondu
-- du même numéro dans les deux minutes. Le taux de décroché n'était donc pas
-- faussé dans l'autre sens.

DROP VIEW IF EXISTS public.v_appels;

CREATE VIEW public.v_appels WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    a.*,
    (lower(coalesce(a.direction, '')) IN ('missed', 'notanswered'))      AS manque_brut,
    nullif(split_part(coalesce(a.agent, ''), '.', 1), '')                AS ext,
    coalesce(nullif(a.numero_e164, ''), nullif(a.numero_externe, ''))    AS num
  FROM public.appels a
),
sonneries AS (
  SELECT
    id,
    -- Relance = non répondu, précédé d'un non répondu du même numéro vers le
    -- même poste moins de 60 s avant. Un appel répondu entre les deux rompt
    -- la chaîne, puisqu'on regarde la ligne immédiatement précédente.
    (
      manque_brut
      AND num IS NOT NULL
      AND lag(manque_brut) OVER w
      AND (debut - lag(debut) OVER w) < interval '60 seconds'
    ) AS relance_sonnerie
  FROM base
  WINDOW w AS (PARTITION BY num, ext ORDER BY debut)
)
SELECT
  b.id,
  b.debut,
  b.direction,
  CASE WHEN b.manque_brut OR lower(coalesce(b.direction, '')) = 'inbound'
       THEN 'entrant' ELSE 'sortant' END AS sens,
  b.manque_brut AS manque,
  coalesce(s.relance_sonnerie, false) AS relance_sonnerie,
  b.num AS numero,
  CASE
    WHEN b.duree ~ '^[0-9]+$'                       THEN b.duree::int
    WHEN b.duree ~ '^[0-9]{1,2}:[0-9]{2}$'          THEN split_part(b.duree, ':', 1)::int * 60
                                                       + split_part(b.duree, ':', 2)::int
    WHEN b.duree ~ '^[0-9]{1,3}:[0-9]{2}:[0-9]{2}$' THEN split_part(b.duree, ':', 1)::int * 3600
                                                       + split_part(b.duree, ':', 2)::int * 60
                                                       + split_part(b.duree, ':', 3)::int
    ELSE NULL
  END AS duree_s,
  b.ext AS extension,
  b.agent AS agent_brut,
  co.code        AS collaborateur_code,
  co.nom_complet AS collaborateur,
  pt.libelle     AS poste_libelle,
  pt.categorie   AS poste_categorie,
  b.client_id,
  cl.dossier AS client_dossier,
  nullif(btrim(coalesce(cl.nom, '') || ' ' || coalesce(cl.prenom, '')), '') AS client_nom,
  nullif(b.nom_3cx, '') AS nom_3cx,
  coalesce(
    nullif(btrim(coalesce(cl.nom, '') || ' ' || coalesce(cl.prenom, '')), ''),
    nullif(b.nom_3cx, '')
  ) AS contact
FROM base b
JOIN      sonneries             s  ON s.id = b.id
LEFT JOIN public.collaborateurs    co ON co.extension = b.ext
LEFT JOIN public.postes_telephonie pt ON pt.extension = b.ext
LEFT JOIN public.clients           cl ON cl.id = b.client_id;

COMMENT ON VIEW public.v_appels IS
  'Journal 3CX normalisé : sens, appel manqué, relance de sonnerie, durée en secondes, poste nommé, contact résolu.';

GRANT SELECT ON public.v_appels TO authenticated;
