import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

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
  const { user, loading } = useAuth()
  const [erreur] = useState(erreurDansUrl)

  // IMPORTANT : ce composant n'appelle plus jamais le client Supabase
  // lui-même (ni getSession(), ni onAuthStateChange()). AuthProvider
  // (src/lib/auth.jsx) le fait déjà, une seule fois, pour toute
  // l'application — et le fait proprement (il documente lui-même pourquoi
  // un deuxième appel concurrent au client peut provoquer un verrou
  // (Web Lock) qui ne se libère jamais : getSession() ne se résout alors
  // plus jamais, ce qui expliquait le blocage persistant). On se contente
  // donc d'observer l'état déjà calculé par AuthProvider via useAuth().
  //
  // Course possible : le premier getSession() d'AuthProvider peut se
  // résoudre (loading=false, user=null) avant que le jeton présent dans
  // l'URL de cette page ait fini d'être traité par supabase-js — un
  // SIGNED_IN plus tardif mettra alors user à jour. On laisse donc une
  // marge avant d'abandonner vers /login plutôt que de trancher dès que
  // loading passe à false.
  useEffect(() => {
    if (erreur) return
    if (user) { navigate('/', { replace: true }); return }
    if (!loading) {
      const t = setTimeout(() => { if (!user) navigate('/login', { replace: true }) }, 4000)
      return () => clearTimeout(t)
    }
  }, [erreur, loading, user, navigate])

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
