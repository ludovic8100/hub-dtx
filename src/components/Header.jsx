import { useState, useRef, useEffect } from 'react'
import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

const LOGOS = {
  dynassur: '/logo_dynassur.png',
  dtx:      '/logo_dtx.png',
  lode:     '/logo_lode.png',
}

const ROUTES = {
  groupe: '/groupe', dynassur: '/dynassur', dtx: '/dtx',
  lode: '/lode', hexagroup: '/hexagroup', prive: '/prive',
}

function GroupeLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hgrad_h" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0080BD"/>
          <stop offset="50%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#ea580c"/>
        </linearGradient>
      </defs>
      <polygon points="50,8 86,28 86,72 50,92 14,72 14,28"
               fill="none" stroke="url(#hgrad_h)" strokeWidth="6" strokeLinejoin="round"/>
      <circle cx="50" cy="50" r="13" fill="url(#hgrad_h)" opacity="0.9"/>
      <circle cx="50" cy="14" r="5" fill="#0080BD"/>
      <circle cx="80" cy="67" r="5" fill="#ea580c"/>
      <circle cx="20" cy="67" r="5" fill="#7c3aed"/>
    </svg>
  )
}

function EntityLogo({ societeKey, size = 26 }) {
  const src = LOGOS[societeKey]
  if (!src) return null
  return <img src={src} alt={societeKey} style={{ width: size, height: size, objectFit: 'contain' }} />
}

// ── Dropdown sélecteur d'entité ──
function EntityDropdown({ activeSociete, societesDispo, onSelect, accentColor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const cfg = activeSociete ? SOCIETES_CONFIG[activeSociete] : SOCIETES_CONFIG.groupe

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bouton principal */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid rgba(255,255,255,0.15)`,
          borderRadius: 8, padding: '5px 10px 5px 8px',
          cursor: 'pointer', transition: 'all 0.15s',
          minWidth: 160,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      >
        {/* Logo entité active */}
        <div style={{ width: 26, height: 26, flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {activeSociete && activeSociete !== 'groupe'
            ? (LOGOS[activeSociete]
                ? <EntityLogo societeKey={activeSociete} size={26} />
                : <div style={{ width:26, height:26, borderRadius:5, background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff' }}>{cfg.short}</div>
              )
            : <GroupeLogo size={24} />
          }
        </div>
        <div style={{ flex:1, textAlign:'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{cfg.label}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1 }}>Entité active</div>
        </div>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`}
           style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', flexShrink:0 }} />
      </button>

      {/* Dropdown liste */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          minWidth: 200, zIndex: 200, overflow: 'hidden',
          animation: 'fadeInDown 0.12s ease'
        }}>
          <style>{`@keyframes fadeInDown { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <div style={{ padding: '6px' }}>
            {societesDispo.map(s => {
              const isActive = activeSociete === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => { onSelect(s.key); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '8px 10px', borderRadius: 7,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: isActive ? `${s.color}25` : 'transparent',
                    outline: isActive ? `1px solid ${s.color}50` : 'none',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Logo */}
                  <div style={{ width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {s.key === 'groupe'
                      ? <GroupeLogo size={26} />
                      : LOGOS[s.key]
                        ? <img src={LOGOS[s.key]} alt={s.key} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                        : <div style={{ width:28, height:28, borderRadius:6, background:s.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff' }}>{s.short}</div>
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight: isActive?700:400, color: isActive?'#fff':'rgba(255,255,255,0.7)', fontFamily:"'Source Sans Pro', sans-serif" }}>
                      {s.label}
                    </div>
                  </div>
                  {/* Pastille couleur */}
                  <div style={{ width:8, height:8, borderRadius:'50%', background: s.color, opacity: isActive?1:0.4, flexShrink:0 }} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Header principal ──
export default function Header({ currentPage, onToggleMenu, menuOuvert }) {
  const { user, perms, isAdmin, switchUser, signOut, societeActive, activeSociete, societesDispo, setActiveSociete } = useAuth()
  const navigate = useNavigate()

  const displayName = perms?.nom || user?.user_metadata?.full_name || user?.email || ''
  const firstName = displayName.split(' ')[0]

  const cfg = societeActive || SOCIETES_CONFIG.dynassur
  const headerBg = cfg.colorDark
  const accentColor = cfg.color

  function handleSelectEntity(key) {
    setActiveSociete(key)
    navigate(ROUTES[key] || '/')
  }

  return (
    <header style={{
      height: '56px',
      background: headerBg,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px 0 0',
      position: 'sticky', top: 0, zIndex: 100,
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      borderBottom: `2px solid ${accentColor}`,
      transition: 'background 0.3s, border-color 0.3s'
    }}>

      {/* Gauche : hamburger (mobile) + dropdown entité + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%', paddingLeft: 12 }}>

        {/* Bouton hamburger mobile */}
        {onToggleMenu && (
          <button onClick={onToggleMenu} aria-label="Menu" style={{
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: '22px', cursor: 'pointer', padding: '0 4px',
            display: 'flex', alignItems: 'center'
          }}>
            {menuOuvert ? '✕' : '☰'}
          </button>
        )}

        {/* Dropdown entités */}
        {societesDispo?.length > 0 && (
          <EntityDropdown
            activeSociete={activeSociete}
            societesDispo={societesDispo}
            onSelect={handleSelectEntity}
            accentColor={accentColor}
          />
        )}

        {/* Séparateur + breadcrumb */}
        {currentPage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16 }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: "'Source Sans Pro', sans-serif" }}>
              {currentPage}
            </span>
          </div>
        )}
      </div>

      {/* Droite : badge admin + nom + boutons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

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
