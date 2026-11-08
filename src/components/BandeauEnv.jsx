import { useEffect, useRef } from 'react'
import { IS_TEST, ENV_LABEL, SUPABASE_PROJECT_REF } from '../config/env'

// Bandeau affiché en permanence hors production (VITE_APP_ENV=test) pour qu'aucun
// utilisateur ne confonde l'environnement de test avec le Hub réel.
export default function BandeauEnv() {
  const el = useRef(null)
  useEffect(() => {
    if (!IS_TEST || typeof document === 'undefined') return
    if (!document.title.startsWith('[')) document.title = `[${ENV_LABEL}] ${document.title}`

    // ⚠️ LE BANDEAU PASSAIT PAR-DESSUS LES FENÊTRES, ET DONC PAR-DESSUS
    // LEURS BOUTONS.
    //
    // Il est en z-index 10000 pour une bonne raison : on ne doit jamais
    // pouvoir confondre le test et la production, surtout au moment d'un
    // geste irréversible. Mais les fenêtres modales sont en `position:
    // fixed; inset: 0`, donc collées au haut de l'écran — et les 26 px du
    // bandeau recouvraient leur en-tête, croix de fermeture comprise.
    //
    // Baisser le z-index serait le mauvais correctif : le bandeau
    // disparaîtrait précisément quand on envoie un devis. On décale donc les
    // surcouches vers le bas plutôt que de masquer l'avertissement.
    //
    // Le sélecteur vise l'attribut `style` parce que React y écrit les
    // styles en ligne du projet (« position: fixed; inset: 0px »). C'est
    // fragile, et c'est assumé : cette règle n'existe QU'EN TEST, et au pire
    // elle rate une fenêtre — elle n'en casse aucune.
    const id = 'hub-bandeau-decalage'
    if (!document.getElementById(id)) {
      const st = document.createElement('style')
      st.id = id
      st.textContent =
        'div[style*="position: fixed"][style*="inset: 0"] { top: var(--hub-bandeau, 0px) !important; }'
      document.head.appendChild(st)
    }

    // ⚠️ LA HAUTEUR SE MESURE, ELLE NE SE DEVINE PAS.
    //
    // J'avais écrit 26 px en dur. Mesuré : 33. Il restait donc 7 px de
    // recouvrement — le défaut corrigé à moitié, ce qui est pire que pas
    // corrigé du tout parce qu'on croit l'affaire réglée.
    //
    // Et la hauteur BOUGE : l'en-tête du Hub propose un réglage de taille de
    // texte. Un nombre en dur redeviendrait faux au premier clic dessus.
    const mesurer = () => {
      const h = el.current?.offsetHeight
      if (h) document.documentElement.style.setProperty('--hub-bandeau', h + 'px')
    }
    mesurer()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null
    if (ro && el.current) ro.observe(el.current)
    window.addEventListener('resize', mesurer)
    return () => { ro?.disconnect(); window.removeEventListener('resize', mesurer) }
  }, [])

  if (!IS_TEST) return null
  return (
    <>
    {/* La cale occupe dans le flux la place que le bandeau fixe n'occupe plus.
        Sans elle, le bandeau recouvrirait le haut de l'application. */}
    <div aria-hidden="true" style={{ height: 'var(--hub-bandeau, 0px)' }} />
    <div ref={el} role="status" style={{
      // FIXE, et non collant.
      //
      // En « sticky », le bandeau héritait de la marge par défaut du body :
      // il commençait à 8 px et finissait à 33, alors que sa hauteur propre
      // était 25. Décaler les fenêtres de sa hauteur laissait donc 8 px de
      // recouvrement — mesuré, pas supposé. En « fixed », il va de 0 à sa
      // hauteur, et le calcul redevient exact quel que soit le défilement.
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
      background: 'repeating-linear-gradient(135deg, #f59e0b 0 14px, #fbbf24 14px 28px)',
      color: '#1f1300', textAlign: 'center', fontSize: 12, fontWeight: 700,
      letterSpacing: 1, padding: '5px 10px', textTransform: 'uppercase',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    }}>
      Environnement de {ENV_LABEL} — base {SUPABASE_PROJECT_REF || '?'} — aucune donnée réelle
    </div>
    </>
  )
}
