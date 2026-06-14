import { useAuth } from '../lib/auth'

export default function AccessDenied() {
  const { user, signOut } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: "'Source Sans Pro', sans-serif"
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '48px 40px',
        textAlign: 'center',
        width: '400px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          width: '56px', height: '56px',
          background: '#fef2f2',
          borderRadius: '12px',
          margin: '0 auto 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="ti ti-lock" style={{ fontSize: '28px', color: '#dc2626' }} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0D2F5E', margin: '0 0 8px' }}>
          Accès non autorisé
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 8px', lineHeight: '1.6' }}>
          Ton compte <strong>{user?.email}</strong> n'a pas encore accès au Hub.
        </p>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 28px', lineHeight: '1.6' }}>
          Contacte l'administrateur pour activer tes droits.
        </p>

        <button
          onClick={signOut}
          style={{
            padding: '10px 24px',
            background: '#0080BD',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
