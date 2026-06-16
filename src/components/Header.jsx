import { useAuth, SOCIETES_CONFIG } from '../lib/auth'

const LOGOS = {
  dynassur: '/logo_dynassur.png',
  dtx:      '/logo_dtx.png',
  lode:     '/logo_lode.png',
  holding:  '/logo_holding.svg',
}

function HeaderLogo({ societeKey, size = 36 }) {
  const src = LOGOS[societeKey]
  if (!src) return null
  return (
    <img
      src={src}
      alt={societeKey}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  )
}

function GroupeLogoHeader({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hgrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0080BD"/>
          <stop offset="50%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#ea580c"/>
        </linearGradient>
      </defs>
      <polygon points="50,8 86,28 86,72 50,92 14,72 14,28"
               fill="none" stroke="url(#hgrad)" strokeWidth="6" strokeLinejoin="round"/>
      <circle cx="50" cy="50" r="13" fill="url(#hgrad)" opacity="0.9"/>
      <circle cx="50" cy="14" r="5" fill="#0080BD"/>
      <circle cx="80" cy="67" r="5" fill="#ea580c"/>
      <circle cx="20" cy="67" r="5" fill="#7c3aed"/>
    </svg>
  )
}

export default function Header({ currentPage, onToggleMenu, menuOuvert }) {
  const { user, perms, isAdmin, switchUser, signOut, societeActive, activeSociete } = useAuth()

  const displayName = perms?.nom || user?.user_metadata?.full_name || user?.email || ''
  const firstName = displayName.split(' ')[0]

  const cfg = societeActive || SOCIETES_CONFIG.dynassur
  const headerBg = cfg.colorDark
  const accentColor = cfg.color

  return (
    <header style={{
      height: '56px',
      background: headerBg,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px 0 0',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      borderBottom: `2px solid ${accentColor}`,
      transition: 'background 0.3s, border-color 0.3s'
    }}>

      {/* Logo + nom société */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        {/* Bouton menu (mobile) */}
        {onToggleMenu && (
          <button onClick={onToggleMenu} aria-label="Menu" style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: '22px', cursor: 'pointer', padding: '0 14px', height: '100%',
            display: 'flex', alignItems: 'center'
          }}>
            {menuOuvert ? '✕' : '☰'}
          </button>
        )}
        <div style={{
          width: onToggleMenu ? 'auto' : '232px', height: '100%',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: '12px',
          borderRight: onToggleMenu ? 'none' : '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}>
          {/* Logo */}
          {activeSociete
            ? <HeaderLogo societeKey={activeSociete} size={34} />
            : <GroupeLogoHeader size={34} />
          }

          <div>
            <div style={{
              fontFamily: "'Source Sans Pro', sans-serif",
              fontWeight: '700', fontSize: '15px',
              color: '#fff', letterSpacing: '0.01em', lineHeight: 1.1
            }}>
              {activeSociete ? cfg.label : 'Groupe'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>
              Hub
            </div>
          </div>
        </div>

        {/* Breadcrumb */}
        {currentPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '20px' }}>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontFamily: "'Source Sans Pro', sans-serif" }}>
              {currentPage}
            </span>
          </div>
        )}
      </div>

      {/* Zone droite */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

        {isAdmin && (
          <span style={{
            background: `${accentColor}30`, border: `1px solid ${accentColor}60`,
            color: cfg.colorAccent, fontSize: '10px', fontWeight: '700',
            padding: '3px 8px', borderRadius: '4px',
            letterSpacing: '0.06em', textTransform: 'uppercase'
          }}>
            Admin
          </span>
        )}

        <span style={{ fontFamily: "'Source Sans Pro', sans-serif", fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
          {firstName || displayName}
        </span>

        {isAdmin && (
          <button onClick={switchUser} title="Changer d'utilisateur" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)', borderRadius: '6px',
            padding: '5px 11px', cursor: 'pointer', fontSize: '12.5px',
            fontFamily: "'Source Sans Pro', sans-serif", transition: 'all 0.15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          >
            <i className="ti ti-switch-horizontal" style={{ fontSize: '14px' }} />
            Changer
          </button>
        )}

        <button onClick={signOut} title="Se déconnecter" style={{
          display: 'flex', alignItems: 'center',
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          padding: '5px', borderRadius: '6px', transition: 'color 0.15s'
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
