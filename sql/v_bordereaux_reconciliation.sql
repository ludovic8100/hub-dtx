-- =====================================================================
-- VUE : v_bordereaux_reconciliation
-- Croise les bordereaux (SharePoint) avec les commissions encaissees
-- sur les comptes bancaires (table transactions, categorie commission).
-- Numero de producteur extrait de la communication bancaire pour
-- identifier la compagnie via la table producteurs.
-- =====================================================================

CREATE OR REPLACE VIEW v_bordereaux_reconciliation AS

WITH bordereaux_presents AS (
  SELECT
    annee, mois, type, compagnie, compte_producteur,
    id AS bordereau_id, montant, commission, net,
    url_sharepoint, source, nom_fichier
  FROM bordereaux
  WHERE annee >= 2020
),

commissions_bancaires AS (
  SELECT
    t.id                                AS transaction_id,
    t.date_valeur                       AS date_transaction,
    EXTRACT(YEAR  FROM t.date_valeur)::INT              AS annee,
    LPAD(EXTRACT(MONTH FROM t.date_valeur)::TEXT, 2, '0') AS mois,
    t.montant                           AS montant_recu,
    COALESCE(t.information_paiement,'') || ' ' || COALESCE(t.description,'') AS communication,
    t.contrepartie_nom,
    -- numero de producteur : 1ere suite de 4 a 8 chiffres trouvee
    (regexp_match(
        COALESCE(t.information_paiement,'') || ' ' || COALESCE(t.description,''),
        '(\d{4,8})'))[1]                AS num_producteur_extrait
  FROM transactions t
  WHERE t.montant > 0
    AND t.date_valeur >= '2020-01-01'
    AND t.categorie_id IN (
        SELECT id FROM categories WHERE nom ILIKE '%commission%'
    )
),

commissions_avec_compagnie AS (
  SELECT
    cb.*,
    p.compagnie AS compagnie_identifiee
  FROM commissions_bancaires cb
  LEFT JOIN producteurs p
    ON p.numero_producteur = cb.num_producteur_extrait
)

SELECT
  COALESCE(bp.annee, cac.annee)        AS annee,
  COALESCE(bp.mois,  cac.mois)         AS mois,
  COALESCE(bp.type, 'RCP')             AS type,
  COALESCE(bp.compagnie, cac.compagnie_identifiee) AS compagnie,
  bp.compte_producteur, bp.bordereau_id, bp.nom_fichier,
  bp.montant, bp.commission, bp.net, bp.url_sharepoint,
  cac.transaction_id,
  cac.montant_recu        AS commission_bancaire,
  cac.communication       AS communication_bancaire,
  cac.date_transaction,
  CASE
    WHEN bp.bordereau_id IS NOT NULL AND cac.transaction_id IS NOT NULL THEN 'complet'
    WHEN bp.bordereau_id IS NOT NULL AND bp.montant IS NOT NULL AND cac.transaction_id IS NULL THEN 'fichier_ok_non_encaisse'
    WHEN bp.bordereau_id IS NOT NULL AND bp.montant IS NULL THEN 'fichier_sans_chiffres'
    WHEN bp.bordereau_id IS NULL AND cac.transaction_id IS NOT NULL THEN 'commission_sans_fichier'
    ELSE 'manquant'
  END AS statut_reconciliation
FROM bordereaux_presents bp
FULL OUTER JOIN commissions_avec_compagnie cac
  ON  bp.annee = cac.annee
  AND bp.mois  = cac.mois
  AND bp.compagnie = cac.compagnie_identifiee
ORDER BY annee DESC, mois DESC, compagnie;
