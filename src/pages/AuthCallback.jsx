import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { COUL } from '../lib/theme'

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
  const { user } = useAuth()
  const [erreur, setErreur] = useState(erreurDansUrl)
  const echangeTente = useRef(false)

  // Flux PKCE : Microsoft renvoie un `?code=...` qu'il faut échanger contre une
  // session. Le flux implicite (#access_token=...) est traité automatiquement
  // par supabase-js (detectSessionInUrl) et n'a rien à faire ici.
  useEffect(() => {
    if (erreur || echangeTente.current) return
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    echangeTente.current = true
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) setErreur(error.message)
    })
  }, [erreur])

  // Redirection automatique uniquement en cas de succès : en cas d'échec on
  // reste sur cet écran avec le motif, au lieu de rebasculer vers /login en
  // silence — c'est ce silence qui avait rendu la panne du 31/10/2026
  // indiagnosticable depuis l'application.
  useEffect(() => {
    if (!erreur && user) navigate('/', { replace: true })
  }, [erreur, user, navigate])

  const fond = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: COUL.marine, fontFamily: "'Source Sans Pro', sans-serif", color: COUL.blanc,
    flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center',
  }

  if (erreur) {
    return (
      <div style={fond}>
        <p style={{ fontSize: '15px', opacity: 0.9 }}>Échec de la connexion Microsoft :</p>
        <p style={{
          fontSize: '14px', background: 'rgba(255,255,255,0.1)', padding: '12px 16px',
          borderRadius: 8, maxWidth: 480, wordBreak: 'break-word',
        }}>{erreur}</p>
        <button
          onClick={() => navigate('/login', { replace: true })}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: COUL.blanc, color: COUL.marine, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Retour
        </button>
      </div>
    )
  }

  return (
    <div style={fond}>
      {!user && (
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: COUL.blanc,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      <p style={{ fontSize: '15px', opacity: 0.8 }}>
        {user ? 'Connecté — redirection...' : 'Connexion en cours...'}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
