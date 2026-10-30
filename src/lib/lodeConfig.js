import { LOGOS_URL } from '../config/env'
// Coordonnées et paramètres de LODE SRL — utilisés sur devis et factures.
// ⚠️ Modifier ici met à jour automatiquement tous les documents générés.

export const LODE = {
  entite: 'lode',
  raison_sociale: 'LODE SRL',
  activite: 'Portes de garage · Stores · Pergolas',
  adresse: 'Chaussée de Tongres 474',
  cp: '4450',
  ville: 'Juprelle',
  pays: 'Belgique',
  tva: 'BE 1010.062.582',
  iban: 'BE40 3632 4445 2063',
  bic: 'BBRUBEBB',            // ING
  banque: 'ING',
  email: 'info@lode-group.be',
  telephone: '0494 24 69 32',
  couleur: '#ea580c',         // orange LODE
  logo_url: LOGOS_URL + 'lode.png',
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
  "2. Commande & acompte — Toute commande implique l'acceptation des présentes conditions. Un acompte de 50 % est demandé à la commande, le solde étant payable à la livraison/fin des travaux.",
  "3. Délais — Les délais de livraison et d'installation sont donnés à titre indicatif. Un retard ne peut donner lieu à annulation de commande, dommages-intérêts ou indemnité.",
  "4. Paiement — Nos factures sont payables au comptant, au plus tard à la date d'échéance indiquée. Tout paiement par virement au compte " + 'BE40 3632 4445 2063' + ".",
  "5. Retard de paiement — Client particulier (consommateur) : à défaut de paiement à l'échéance, un premier rappel est envoyé sans frais ; à défaut de paiement dans les 14 jours calendrier suivant ce rappel, les sommes dues portent un intérêt de retard au taux directeur de la BCE majoré de 8 points de pourcentage et une indemnité forfaitaire plafonnée conformément au livre XIX du Code de droit économique (20 € jusqu'à 150 € ; 30 € + 10 % de la tranche de 150,01 € à 500 € ; 65 € + 5 % de la tranche au-delà de 500 €, maximum 2 000 €) ; les mêmes montants sont dus par LODE SRL au client en cas de manquement de sa part. Client professionnel : intérêt de retard de 10 % l'an et indemnité forfaitaire de 10 % (minimum 50 €).",
  "6. Réserve de propriété — Les biens livrés restent la propriété de LODE SRL jusqu'au paiement intégral du prix.",
  "7. Garantie — Les produits bénéficient de la garantie légale. Les interventions consécutives à un usage anormal, un défaut d'entretien ou une intervention de tiers ne sont pas couvertes.",
  "8. Réclamations — Toute réclamation doit être formulée par écrit dans les 8 jours suivant la livraison ou la facturation.",
  "9. Litiges — Tout litige relève de la compétence exclusive des tribunaux de l'arrondissement du siège de LODE SRL, le droit belge étant seul applicable.",
  "10. Droit de rétractation (consommateur) — Lorsque le contrat est conclu à distance ou hors de l'établissement de LODE SRL, le consommateur dispose d'un délai de 14 jours calendrier pour se rétracter sans motif ni pénalité. S'il demande expressément le commencement des prestations avant la fin de ce délai, il reste redevable du montant proportionnel aux prestations déjà fournies ; une fois le service pleinement exécuté à sa demande expresse, le droit de rétractation est épuisé.",
]
