// Coordonnées et paramètres de Dynassur SRL — utilisés sur devis et factures.
export const DYN = {
  entite: 'dyn',
  raison_sociale: 'Dynassur SRL',
  activite: '',
  adresse: 'Chaussée de Tongres 489',
  cp: '4450',
  ville: 'Juprelle',
  pays: 'Belgique',
  tva: 'BE 0677.519.858',
  iban: '',                   // À compléter
  bic: '',                    // À compléter
  banque: '',
  email: 'info@dynassur.be',
  telephone: '',              // Aucun pour l'instant
  couleur: '#0080BD',         // bleu Dynassur
  logo_url: 'https://tndwonqdbeszkcztkzqe.supabase.co/storage/v1/object/public/logos/Dynassur_logo.png',
}

export const TVA_TAUX = [
  { val: 21, label: '21 % (standard)' },
  { val: 6,  label: '6 % (rénovation +10 ans)' },
  { val: 0,  label: '0 % (exonéré / cocontractant)' },
]

export const DELAI_PAIEMENT_JOURS = 30

export const CGV = [
  "1. Validité — Le présent devis est valable jusqu'à la date de validité mentionnée. Passé ce délai, les prix et conditions sont susceptibles de révision.",
  "2. Commande & acompte — Toute commande implique l'acceptation des présentes conditions. Un acompte peut être demandé à la commande, le solde étant payable à la livraison/fin des travaux.",
  "3. Délais — Les délais de livraison et d'installation sont donnés à titre indicatif. Un retard ne peut donner lieu à annulation de commande, dommages-intérêts ou indemnité.",
  "4. Paiement — Nos factures sont payables au comptant, au plus tard à la date d'échéance indiquée.",
  "5. Retard de paiement — À défaut de paiement à l'échéance, les sommes dues porteront de plein droit et sans mise en demeure un intérêt de retard de 10 % l'an, majoré d'une indemnité forfaitaire de 10 % avec un minimum de 50 €.",
  "6. Réserve de propriété — Les biens livrés restent la propriété de Dynassur SRL jusqu'au paiement intégral du prix.",
  "7. Garantie — Les produits et services bénéficient de la garantie légale.",
  "8. Réclamations — Toute réclamation doit être formulée par écrit dans les 8 jours suivant la livraison ou la facturation.",
  "9. Litiges — Tout litige relève de la compétence exclusive des tribunaux de l'arrondissement du siège de Dynassur SRL, le droit belge étant seul applicable.",
]
