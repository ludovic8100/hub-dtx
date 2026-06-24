-- ================================================================
-- FONCTION RPC : get_clients_kpis()
-- KPIs pour le module Clients — Dynassur
-- À EXÉCUTER dans Supabase SQL Editor
-- ================================================================

CREATE OR REPLACE FUNCTION get_clients_kpis()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  annee_en_cours INT := EXTRACT(YEAR FROM NOW())::INT;
BEGIN
  SELECT json_build_object(

    -- Total clients uniques (sans doublons)
    'total_clients',
    (SELECT COUNT(DISTINCT dossier) FROM clients WHERE dossier IS NOT NULL),

    -- Clients avec alerte active
    'avec_alerte',
    (SELECT COUNT(DISTINCT dossier) FROM clients
     WHERE alerte IS NOT NULL AND alerte != '' AND alerte != ' '),

    -- Clients sans contrat actif
    'sans_contrat',
    (SELECT COUNT(DISTINCT c.dossier) FROM clients c
     WHERE dossier IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM contrats ct
         WHERE ct.dossier = c.dossier
           AND (ct.situation IS NULL OR ct.situation = 'En cours')
       )),

    -- Clients sans commissions cette année
    'sans_commissions',
    (SELECT COUNT(DISTINCT c.dossier) FROM clients c
     WHERE dossier IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM quittances q
         WHERE q.dossier = c.dossier
           AND EXTRACT(YEAR FROM q.date_comptable::date) = annee_en_cours
       ))

  ) INTO result;
  RETURN result;
END;
$$;

-- Test : SELECT get_clients_kpis();
