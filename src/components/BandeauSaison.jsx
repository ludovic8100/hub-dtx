import { useEffect, useState } from 'react'
import { AMBIANCES } from '../lib/themes'
import { usePetitEcran } from '../lib/ecran'

/**
 * L'ambiance posée sur <html> par `appliquer()`.
 *
 * On LIT l'attribut au lieu de recalculer l'ambiance : `appliquer()` est le
 * seul geste qui change l'apparence, et tout le CSS en dépend. Recalculer de
 * son côté, c'est se donner une deuxième source de vérité qui finira par
 * diverger — et le bandeau montrerait une saison que la page n'a pas.
 */
function useAmbianceAffichee() {
  const [code, setCode] = useState(
    () => (typeof document === 'undefined' ? 'standard'
      : document.documentElement.getAttribute('data-ambiance') || 'standard'))
  useEffect(() => {
    if (typeof document === 'undefined') return
    const r = document.documentElement
    const lire = () => setCode(r.getAttribute('data-ambiance') || 'standard')
    lire()
    const obs = new MutationObserver(lire)
    obs.observe(r, { attributes: true, attributeFilter: ['data-ambiance'] })
    return () => obs.disconnect()
  }, [])
  return code
}

/**
 * Le bandeau de saison, sous l'en-tête.
 *
 * POURQUOI UNE BANDE À ELLE, ET PAS UN MOTIF DERRIÈRE LE CONTENU.
 * J'avais d'abord saupoudré la décoration derrière les écrans : un motif dans
 * le menu, une lueur dans la zone de travail. Pour ne pas gêner la lecture il
 * fallait rester à 10 % d'opacité, donc rester invisible — c'était exactement
 * le reproche de Ludovic. Une bande qui n'appartient qu'à la saison peut être
 * franche, parce qu'elle ne passe sous aucun chiffre.
 *
 * SUR TÉLÉPHONE, ELLE DISPARAÎT. À 390 px de large, 120 px de décor, c'est un
 * tiers de l'écran avant la première donnée utile.
 */
export default function BandeauSaison() {
  const petitEcran = usePetitEcran()
  const code = useAmbianceAffichee()
  const amb = AMBIANCES[code]

  // En Standard il n'y a rien à montrer : pas d'ambiance, pas de bandeau.
  if (petitEcran || !amb || code === 'standard' || !amb.titre) return null

  return (
    <div className="hub-saison-bandeau" aria-hidden="true" style={{
      position: 'relative',
      height: 118,
      flex: '0 0 auto',
      overflow: 'hidden',
      borderRadius: 14,
      marginBottom: 22,
    }}>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 28px', color: '#fff',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em',
          textTransform: 'uppercase', opacity: .72, marginBottom: 5,
        }}>{amb.label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, textShadow: '0 1px 12px rgba(0,0,0,.45)' }}>
          {amb.titre}
        </div>
        {amb.sousTitre && (
          <div style={{ fontSize: 13, opacity: .88, marginTop: 4, textShadow: '0 1px 10px rgba(0,0,0,.45)' }}>
            {amb.sousTitre}
          </div>
        )}
      </div>
    </div>
  )
}
