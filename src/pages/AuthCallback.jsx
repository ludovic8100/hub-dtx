import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Lit une éventuelle erreur renvoyée par Supabase/Microsoft dans l'URL de
// retour (#error=...&error_description=...), pour l'afficher directement à
// l'écran plutôt que de renvoyer silencieusement vers /login.
function erreurDansUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const code = hash.get('error') || query.get('error')
  const desc = hash.get('error_description') || query.get('error_description')
  if (!code && !desc) return null
  return [code, desc].filter(Boolean).join(' — ').replace(/\+/g, ' ')
}

export default function AuthCallback() {
  const navigate = useNavigate()
  const done = useRef(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    const urlErreur = erreurDansUrl()
    if (urlErreur) { setErreur(urlErreur); return }

    function finish(ok) {
      if (done.current) return
      done.current = true
      navigate(ok ? '/' : '/login', { replace: true })
    }

    // Supabase traite le jeton présent dans l'URL (#access_token=...) de façon
    // asynchrone après le retour de Microsoft : une vérification immédiate de
    // la session peut s'exécuter avant la fin de ce traitement et renvoyer
    // "pas de session" à tort. On écoute donc l'événement de connexion, ET on
    // vérifie la session par sondage répété (toutes les 300ms, 8 secondes max)
    // pour couvrir le cas où l'événement aurait déjà eu lieu avant la pose de
    // l'écouteur (course possible entre l'initialisation du client Supabase,
    // au chargement du module, et le montage de ce composant).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) finish(true)
    })

    let tentatives = 0
    const poll = setInterval(() => {
      tentatives += 1
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) { clearInterval(poll); finish(true) }
        else if (tentatives >= 26) { clearInterval(poll); finish(false) } // ~8s
      })
    }, 300)

    return () => { subscription.unsubscribe(); clearInterval(poll) }
  }, [navigate])

  if (erreur) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0D2F5E', fontFamily: "'Source Sans Pro', sans-serif", color: '#fff',
        flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: '15px', opacity: 0.9 }}>Échec de la connexion Microsoft :</p>
        <p style={{ fontSize: '14px', background: 'rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: 8, maxWidth: 480, wordBreak: 'break-word' }}>{erreur}</p>
        <button onClick={() => navigate('/login', { replace: true })} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#fff', color: '#0D2F5E', fontWeight: 700, cursor: 'pointer' }}>Retour</button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0D2F5E',
      fontFamily: "'Source Sans Pro', sans-serif",
      color: '#fff',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ fontSize: '15px', opacity: 0.8 }}>Connexion en cours...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
