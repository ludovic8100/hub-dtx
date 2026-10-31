import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  const [erreur, setErreur] = useState(erreurDansUrl)
  const echangeTente = useRef(false)

  // Flux PKCE : les versions récentes de supabase-js échangent un ?code=...
  // présent dans l'URL contre une session, plutôt que de lire un jeton déjà
  // prêt dans le hash (#access_token=...). Cet échange est explicite — rien
  // ne le déclenche tout seul. Sans lui, Microsoft/Supabase authentifiaient
  // bien la personne à chaque tentative (confirmé par auth.users.
  // last_sign_in_at mis à jour côté serveur), mais aucune session n'était
  // jamais créée côté navigateur : le blocage observé.
  // Appel ponctuel, hors de tout callback onAuthStateChange — donc sans le
  // risque de verrou (Web Lock) documenté dans auth.jsx pour les appels
  // faits DEPUIS un tel callback.
  useEffect(() => {
    if (erreur || echangeTente.current) return
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    echangeTente.current = true
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      if (error) setErreur(error.message)
    })
  }, [erreur])

  // IMPORTANT : en dehors de l'échange ponctuel ci-dessus, ce composant
  // n'appelle plus le client Supabase lui-même (ni getSession() en boucle,
  // ni onAuthStateChange()). AuthProvider (src/lib/auth.jsx) le fait déjà
  // pour toute l'application ; on se contente d'observer l'état qu'il
  // calcule via useAuth().
  //
  // Course possible : le premier getSession() d'AuthProvider peut se
  // résoudre (loading=false, user=null) avant que l'échange ci-dessus (ou
  // la détection automatique du hash, selon le flux) ait fini — un
  // SIGNED_IN plus tardif mettra alors user à jour. On laisse donc une
  // marge avant d'abandonner vers /login plutôt que de trancher dès que
  // loading passe à false.
  useEffect(() => {
    if (erreur) return
    if (user) { navigate('/', { replace: true }); return }
    if (!loading) {
      const t = setTimeout(() => { if (!user) navigate('/login', { replace: true }) }, 6000)
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
