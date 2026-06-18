-- ============================================================
-- INSERT objectifs sous-agents 2026 dans objectives_global
-- scope = 'sous_agent', period_type = 'year', year = 2026
-- Les targets NA sont à adapter selon tes vraies cibles
-- Les primes/commissions sont à 0 pour l'instant
-- ============================================================

INSERT INTO objectives_global 
  (year, period_type, period_number, scope, agent_code, target_na, target_mandat_fav, target_primes, target_commissions)
VALUES
  -- Sous-agents IARD + VIE + CREDIT
  (2026, 'year', NULL, 'sous_agent', 'JFS',  150, 0, 0, 0),  -- Jean-François Simonis
  (2026, 'year', NULL, 'sous_agent', 'FMZ',  100, 0, 0, 0),  -- Fabrice Mammo
  (2026, 'year', NULL, 'sous_agent', 'ICE',  100, 0, 0, 0),  -- Ingrid Cezar
  (2026, 'year', NULL, 'sous_agent', 'RCA',   80, 0, 0, 0),  -- Raphael Carrea
  (2026, 'year', NULL, 'sous_agent', 'MVM',   80, 0, 0, 0),  -- Michael Van Muylder
  (2026, 'year', NULL, 'sous_agent', 'VPE',   80, 0, 0, 0),  -- Vincent Pesser
  (2026, 'year', NULL, 'sous_agent', 'LGM',   80, 0, 0, 0),  -- Luisa Gaen Munoz
  (2026, 'year', NULL, 'sous_agent', 'OBA',   80, 0, 0, 0),  -- Olivier Baudelet
  (2026, 'year', NULL, 'sous_agent', 'RDE',   80, 0, 0, 0),  -- Renaud Desclez
  (2026, 'year', NULL, 'sous_agent', 'DCO',   50, 0, 0, 0),  -- Didier Coco
  (2026, 'year', NULL, 'sous_agent', 'HML',   30, 0, 0, 0)   -- Homelinks
ON CONFLICT (year, period_type, period_number, scope, agent_code) DO NOTHING;

-- ============================================================
-- Vérification après insert
-- ============================================================
SELECT scope, agent_code, target_na, target_primes, target_commissions
FROM objectives_global
WHERE year = 2026 AND period_type = 'year'
ORDER BY scope, agent_code;
