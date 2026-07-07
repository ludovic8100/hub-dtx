// Détecte les fichiers qui ne sont PAS des factures mais des documents bancaires
// (extraits de compte, relevés, fichiers CODA…) rangés dans les dossiers SharePoint
// FACTURES. Ils doivent être exclus des listes de factures et du rapprochement.
export function estExtraitBancaire(nom) {
  if (!nom) return false
  return /extrait|relev[eé]|\bcoda\b|statement/i.test(nom)
}

// Filtre un tableau de factures pour retirer les extraits de compte
export function sansExtraits(factures) {
  return (factures || []).filter(f => !estExtraitBancaire(f?.nom))
}
