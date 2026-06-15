import { useAuth, SOCIETES_CONFIG } from '../lib/auth'

export default function Header({ currentPage }) {
  const { user, perms, isAdmin, switchUser, signOut, societeActive } = useAuth()

  const displayName = perms?.nom || user?.user_metadata?.full_name || user?.email || ''
  const firstName = displayName.split(' ')[0]

  // Couleurs qui s'adaptent à la société active
  const cfg = societeActive || SOCIETES_CONFIG.dynassur
  const headerBg = cfg.colorDark
  const accentColor = cfg.color

  return (
    <header style={{
      height: '56px',
      background: headerBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px 0 0',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      borderBottom: `2px solid ${accentColor}`,
      transition: 'background 0.3s, border-color 0.3s'
    }}>

      {/* Logo + Nom société active */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {/* Bloc logo coloré — 232px pour aligner avec la sidebar */}
        <div style={{
          width: '232px',
          height: '100%',
          background: headerBg,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '10px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0
        }}>
          {/* Badge société */}
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '7px',
            background: accentColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Source Sans Pro', sans-serif",
            fontWeight: '800', fontSize: '11px', color: '#fff',
            letterSpacing: '0.02em',
            flexShrink: 0,
            boxShadow: `0 2px 8px ${accentColor}55`
          }}>
            {cfg.short}
          </div>
          <div>
            <div style={{
              fontFamily: "'Source Sans Pro', sans-serif",
              fontWeight: '700',
              fontSize: '15px',
              color: '#fff',
              letterSpacing: '0.01em',
              lineHeight: 1.1
            }}>
              {cfg.label}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
              Hub
            </div>
          </div>
        </div>

        {/* Breadcrumb page courante */}
        {currentPage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '20px'
          }}>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>/</span>
            <span style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '14px',
              fontFamily: "'Source Sans Pro', sans-serif",
            }}>
              {currentPage}
            </span>
          </div>
        )}
      </div>

      {/* Zone droite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {/* Badge admin */}
        {isAdmin && (
          <span style={{
            background: `${accentColor}30`,
            border: `1px solid ${accentColor}60`,
            color: cfg.colorAccent,
            fontSize: '10px',
            fontWeight: '700',
            padding: '3px 8px',
            borderRadius: '4px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase'
          }}>
            Admin
          </span>
        )}

        {/* Nom utilisateur */}
        <span style={{
          fontFamily: "'Source Sans Pro', sans-serif",
          fontSize: '14px',
          color: 'rgba(255,255,255,0.8)'
        }}>
          {firstName || displayName}
        </span>

        {/* Changer d'utilisateur */}
        {isAdmin && (
          <button
            onClick={switchUser}
            title="Changer d'utilisateur"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.7)',
              borderRadius: '6px',
              padding: '5px 11px',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontFamily: "'Source Sans Pro', sans-serif",
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
          >
            <i className="ti ti-switch-horizontal" style={{ fontSize: '14px' }} />
            Changer
          </button>
        )}

        {/* Déconnexion */}
        <button
          onClick={signOut}
          title="Se déconnecter"
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            padding: '5px',
            borderRadius: '6px',
            transition: 'color 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
        >
          <i className="ti ti-logout" style={{ fontSize: '17px' }} />
        </button>
      </div>
    </header>
  )
}
