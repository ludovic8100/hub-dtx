import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { COUL } from '../lib/theme'

export default function Login() {
  const { user, loading, signInWithMicrosoft, erreurConnexion } = useAuth()

  // Évite d'afficher à nouveau l'écran de login si une session existe déjà
  // (sinon un simple retour sur /login masque une connexion pourtant réussie).
  if (!loading && user) return <Navigate to="/" replace />

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0D2F5E 0%, #0080BD 100%)',
      fontFamily: "'Source Sans Pro', sans-serif"
    }}>
      <div style={{
        background: COUL.blanc,
        borderRadius: '16px',
        padding: '48px 40px',
        textAlign: 'center',
        width: '360px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)'
      }}>

        {/* Logo / Titre */}
        <div style={{
          width: '56px', height: '56px',
          background: COUL.bleu,
          borderRadius: '12px',
          margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="ti ti-building-bank" style={{ fontSize: '28px', color: COUL.blanc }} />
        </div>

        <h1 style={{
          fontSize: '22px', fontWeight: '700',
          color: COUL.marine, margin: '0 0 6px'
        }}>
          Dynassur Hub
        </h1>
        <p style={{
          fontSize: '14px', color: COUL.texteDoux,
          margin: '0 0 32px', lineHeight: '1.5'
        }}>
          Connecte-toi avec ton compte Microsoft
        </p>

        <button
          onClick={signInWithMicrosoft}
          style={{
            width: '100%',
            padding: '13px 16px',
            background: COUL.bleu,
            color: COUL.blanc,
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#006fa3'}
          onMouseLeave={e => e.currentTarget.style.background = COUL.bleu}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Se connecter avec Microsoft
        </button>

        {/* Deux cas aboutissent ici : un échec de connexion (provider désactivé,
            clé refusée, URL de redirection non autorisée — à voir, pas à taire),
            et une session expirée par la règle des 24 h / 4 h d'inactivité. */}
        {erreurConnexion && (
          <p style={{
            fontSize: '13px', color: COUL.dangerFonce, background: COUL.dangerFondDoux,
            border: '1px solid #fecaca', borderRadius: '8px',
            padding: '10px 12px', marginTop: '16px', marginBottom: 0,
            lineHeight: '1.45', textAlign: 'left', wordBreak: 'break-word',
          }}>
            {erreurConnexion}
          </p>
        )}

        <p style={{ fontSize: '12px', color: COUL.texteFaible, marginTop: '20px' }}>
          Seuls les comptes @dynassur.be et @dtx-group.be sont autorisés
        </p>
      </div>
    </div>
  )
}
