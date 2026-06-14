import { useAuth } from '../lib/auth'

export default function Login() {
  const { signInWithMicrosoft } = useAuth()

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
        background: '#fff',
        borderRadius: '16px',
        padding: '48px 40px',
        textAlign: 'center',
        width: '360px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)'
      }}>

        {/* Logo / Titre */}
        <div style={{
          width: '56px', height: '56px',
          background: '#0080BD',
          borderRadius: '12px',
          margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="ti ti-building-bank" style={{ fontSize: '28px', color: '#fff' }} />
        </div>

        <h1 style={{
          fontSize: '22px', fontWeight: '700',
          color: '#0D2F5E', margin: '0 0 6px'
        }}>
          Dynassur Hub
        </h1>
        <p style={{
          fontSize: '14px', color: '#64748b',
          margin: '0 0 32px', lineHeight: '1.5'
        }}>
          Connecte-toi avec ton compte Microsoft
        </p>

        <button
          onClick={signInWithMicrosoft}
          style={{
            width: '100%',
            padding: '13px 16px',
            background: '#0080BD',
            color: '#fff',
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
          onMouseLeave={e => e.currentTarget.style.background = '#0080BD'}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          Se connecter avec Microsoft
        </button>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '20px' }}>
          Seuls les comptes @dynassur.be et @dtx-group.be sont autorisés
        </p>
      </div>
    </div>
  )
}
