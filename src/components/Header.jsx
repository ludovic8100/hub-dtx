import { useAuth } from '../lib/auth'

const SOCIETE_LABELS = {
  dynassur: 'Dynassur',
  dtx:      'DTX SRL',
  lode:     'LODE SRL',
  null:     'Groupe',
}

export default function Header({ currentPage }) {
  const { user, perms, isAdmin, activeSociete, switchUser, signOut } = useAuth()

  const displayName = perms?.nom || user?.user_metadata?.full_name || user?.email || ''
  const societeLabel = activeSociete ? SOCIETE_LABELS[activeSociete] : null

  return (
    <header style={{
      height: '60px',
      background: '#0D2F5E',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>

      {/* Logo + Titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px', height: '32px',
          background: '#0080BD',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="ti ti-building-bank" style={{ fontSize: '18px', color: '#fff' }} />
        </div>
        <span style={{
          fontFamily: "'Source Sans Pro', sans-serif",
          fontWeight: '700',
          fontSize: '17px',
          color: '#fff',
          letterSpacing: '0.01em'
        }}>
          Dynassur Hub
        </span>

        {/* Société active */}
        {societeLabel && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>/</span>
            <span style={{
              background: 'rgba(0,128,189,0.25)',
              border: '1px solid rgba(0,128,189,0.4)',
              color: '#5DC3E8',
              fontSize: '12px',
              fontWeight: '600',
              padding: '3px 9px',
              borderRadius: '5px',
              letterSpacing: '0.03em'
            }}>
              {societeLabel}
            </span>
          </>
        )}

        {/* Page courante */}
        {currentPage && (
          <>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '16px' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>{currentPage}</span>
          </>
        )}
      </div>

      {/* Zone droite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {isAdmin && (
          <span style={{
            background: 'rgba(0,128,189,0.3)',
            border: '1px solid rgba(0,128,189,0.5)',
            color: '#5DC3E8',
            fontSize: '11px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '4px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Admin
          </span>
        )}

        <span style={{
          fontFamily: "'Source Sans Pro', sans-serif",
          fontSize: '14px',
          color: 'rgba(255,255,255,0.85)'
        }}>
          {displayName}
        </span>

        {isAdmin && (
          <button
            onClick={switchUser}
            title="Changer d'utilisateur"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: "'Source Sans Pro', sans-serif",
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
          >
            <i className="ti ti-switch-horizontal" style={{ fontSize: '15px' }} />
            Changer d'utilisateur
          </button>
        )}

        <button
          onClick={signOut}
          title="Se déconnecter"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            transition: 'color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
        >
          <i className="ti ti-logout" style={{ fontSize: '18px' }} />
        </button>
      </div>
    </header>
  )
}
