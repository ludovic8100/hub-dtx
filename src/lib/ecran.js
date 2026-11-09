import { useEffect, useState } from 'react'

// Les styles du Hub sont en ligne : on ne peut pas y mettre de media query.
// Ce hook rend la largeur lisible depuis le composant, ce qui permet de
// passer une grille à une seule colonne sur téléphone au lieu de laisser
// une fiche de 280 px se faire écraser à 90.
//
// `matchMedia` plutôt qu'un écouteur de `resize` : le navigateur ne nous
// réveille qu'au franchissement du seuil, pas à chaque pixel.
export function usePetitEcran(seuil = 820) {
  const requete = `(max-width:${seuil}px)`
  const [petit, setPetit] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(requete).matches)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(requete)
    const surChangement = e => setPetit(e.matches)
    setPetit(mq.matches)
    mq.addEventListener('change', surChangement)
    return () => mq.removeEventListener('change', surChangement)
  }, [requete])

  return petit
}
