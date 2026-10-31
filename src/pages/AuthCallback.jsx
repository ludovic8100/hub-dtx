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

// Masque la partie secrète d'un jeton/code pour un affichage de diagnostic
// sans l'exposer en entier (on garde juste de quoi savoir quelle forme il a).
function tronque(v) { return v ? `${v.slice(0, 12)}…(${v.length} car.)` : '(absent)' }

export default function AuthCallback() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [erreur, setErreur] = useState(erreurDansUrl)
  const echangeTente = useRef(false)
  const [diag, setDiag] = useState(null)

  // Diagnostic — capturé une seule fois, à l'arrivée sur cette page, avant
  // toute redirection : la forme exacte de l'URL de retour nous dit quel
  // flux Supabase utilise réellement (PKCE avec ?code=..., implicite avec
  // #access_token=..., ou une erreur), ce qu'on ne pouvait pas observer
  // depuis la base de données (qui ne voit que l'authentification côté
  // serveur, toujours réussie jusqu'ici).
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    setDiag({
      code: tronque(query.get('code')),
      accessToken: tronque(hash.get('access_token')),
      hashComplet: window.location.hash ? tronque(window.location.hash) : '(absent)',
      queryComplet: window.location.search || '(absent)',
    })
  }, [])

  useEffect(() => {
    if (erreur || echangeTente.current) return
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    echangeTente.current = true
    supabase.auth.exchangeCodeForSession(window.location.href).then(({ error }) => {
      setDiag(d => ({ ...d, echange: error ? `erreur : ${error.message}` : 'réussi' }))
    })
  }, [erreur])

  // Redirection automatique UNIQUEMENT en cas de succès — en cas d'échec on
  // reste affiché avec le diagnostic au lieu de rebasculer vers /login en
  // silence, le temps de comprendre la cause exacte du blocage.
  useEffect(() => {
    if (!erreur && user) navigate('/', { replace: true })
  }, [erreur, user, navigate])

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
      gap: '16px',
      padding: '24px',
      textAlign: 'center',
    }}>
      {!user && (
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      )}
      <p style={{ fontSize: '15px', opacity: 0.8 }}>{user ? 'Connecté — redirection...' : 'Connexion en cours...'}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {!user && diag && (
        <div style={{ marginTop: 24, fontSize: '12px', opacity: 0.85, background: 'rgba(255,255,255,0.08)', padding: '14px 18px', borderRadius: 10, maxWidth: 520, textAlign: 'left', fontFamily: 'monospace' }}>
          <div>code (?code=...) : {diag.code}</div>
          <div>access_token (#access_token=...) : {diag.accessToken}</div>
          <div>hash complet : {diag.hashComplet}</div>
          <div>query complet : {diag.queryComplet}</div>
          <div>échange de code : {diag.echange || 'non applicable / en attente'}</div>
          <div>session (useAuth) : {loading ? 'chargement...' : (user ? 'oui' : 'absente')}</div>
          <button onClick={() => navigate('/login', { replace: true })} style={{ marginTop: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#fff', color: '#0D2F5E', fontWeight: 700, cursor: 'pointer', fontFamily: "'Source Sans Pro', sans-serif" }}>Retour au login</button>
        </div>
      )}
    </div>
  )
}
