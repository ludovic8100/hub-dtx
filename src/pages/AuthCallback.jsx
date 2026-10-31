import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    function finish(ok) {
      if (done.current) return
      done.current = true
      navigate(ok ? '/' : '/login', { replace: true })
    }

    // Supabase traite le jeton présent dans l'URL (#access_token=...) de façon
    // asynchrone après le retour de Microsoft : un getSession() immédiat peut
    // s'exécuter avant la fin de ce traitement et renvoyer "pas de session" à
    // tort, ce qui renvoyait systématiquement vers /login. On écoute donc
    // l'événement de connexion plutôt qu'un sondage unique, avec un filet de
    // sécurité (timeout + vérification finale) si l'événement a déjà eu lieu
    // avant la pose de l'écouteur.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) finish(true)
    })

    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => finish(!!session))
    }, 3000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [navigate])

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
