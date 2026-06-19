// Coordonnées et paramètres de LODE SRL — utilisés sur devis et factures.
// ⚠️ Modifier ici met à jour automatiquement tous les documents générés.

export const LODE = {
  raison_sociale: 'LODE SRL',
  activite: 'Portes de garage · Stores · Pergolas',
  // ⚠️ À COMPLÉTER : adresse exacte du siège
  adresse: 'Adresse à compléter',
  cp: '',
  ville: '',
  pays: 'Belgique',
  tva: 'BE 1010.062.582',     // ⚠️ à confirmer
  iban: 'BE40 3632 4445 2063',
  bic: 'BBRUBEBB',            // ING
  banque: 'ING',
  email: 'info@lode-group.be',
  telephone: '0494 24 69 32',
  couleur: '#ea580c',         // orange LODE
}

// Taux de TVA proposés (LODE)
export const TVA_TAUX = [
  { val: 21, label: '21 % (standard)' },
  { val: 6,  label: '6 % (rénovation +10 ans)' },
  { val: 0,  label: '0 % (exonéré / cocontractant)' },
]

// Délai de paiement par défaut (jours) — validité devis laissée au choix
export const DELAI_PAIEMENT_JOURS = 30

// Conditions générales de vente — modèle standard belge (modifiable)
export const CGV = [
  "1. Validité — Le présent devis est valable jusqu'à la date de validité mentionnée. Passé ce délai, les prix et conditions sont susceptibles de révision.",
  "2. Commande & acompte — Toute commande implique l'acceptation des présentes conditions. Un acompte de 30 % est demandé à la commande, le solde étant payable à la livraison/fin des travaux.",
  "3. Délais — Les délais de livraison et d'installation sont donnés à titre indicatif. Un retard ne peut donner lieu à annulation de commande, dommages-intérêts ou indemnité.",
  "4. Paiement — Nos factures sont payables au comptant, au plus tard à la date d'échéance indiquée. Tout paiement par virement au compte " + 'BE40 3632 4445 2063' + ".",
  "5. Retard de paiement — À défaut de paiement à l'échéance, les sommes dues porteront de plein droit et sans mise en demeure un intérêt de retard de 10 % l'an, majoré d'une indemnité forfaitaire de 10 % avec un minimum de 50 €.",
  "6. Réserve de propriété — Les biens livrés restent la propriété de LODE SRL jusqu'au paiement intégral du prix.",
  "7. Garantie — Les produits bénéficient de la garantie légale. Les interventions consécutives à un usage anormal, un défaut d'entretien ou une intervention de tiers ne sont pas couvertes.",
  "8. Réclamations — Toute réclamation doit être formulée par écrit dans les 8 jours suivant la livraison ou la facturation.",
  "9. Litiges — Tout litige relève de la compétence exclusive des tribunaux de l'arrondissement du siège de LODE SRL, le droit belge étant seul applicable.",
]
