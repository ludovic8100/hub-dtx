// Configuration visuelle centrale de chaque entité du groupe.
// Couleurs alignées sur SOCIETES_CONFIG (auth.jsx) + logos Supabase Storage.
// Sert à alimenter le StatBanner et les composants AccountableUI partout dans le Hub.

import { LOGOS_URL as LOGO_BASE } from '../config/env'

export const ENTITES = {
  // Le Groupe, c'est le Hub lui-même : il porte donc l'icône DTX.
  // Ludovic : « tu as l'icône DTX maintenant pour le nom de la société du
  // Hub ». Elle est servie depuis /public et non depuis le stockage Supabase :
  // c'est l'identité de l'application, elle doit s'afficher même si le
  // stockage est injoignable.
  groupe:    { key: 'groupe',    label: 'Groupe',         color: '#7c3aed', colorDark: '#3b1f6e', logo: '/logo_dtx.svg' },
  dynassur:  { key: 'dynassur',  label: 'Dynassur SRL',   color: '#0080BD', colorDark: '#0D2F5E', logo: LOGO_BASE + 'Dynassur_logo.png' },
  dtx:       { key: 'dtx',       label: 'DTX SRL',        color: '#94a3b8', colorDark: '#334155', logo: LOGO_BASE + 'dtx.png' },
  lode:      { key: 'lode',      label: 'LODE SRL',       color: '#ea580c', colorDark: '#7c2d12', logo: LOGO_BASE + 'lode.png' },
  // Hexagroup n'avait pas de logo alors que le fichier existe dans /public
  // depuis le début : une case vide par oubli, pas par choix.
  hexagroup: { key: 'hexagroup', label: 'Hexagroup ASBL', color: '#dc2626', colorDark: '#7f1d1d', logo: '/hexagroup-logo.jpg' },
  prive:     { key: 'prive',     label: 'Privé',          color: '#0d9488', colorDark: '#134e4a', logo: LOGO_BASE + 'logo_prive.svg' },
}

export function entite(key) {
  return ENTITES[key] || ENTITES.groupe
}
