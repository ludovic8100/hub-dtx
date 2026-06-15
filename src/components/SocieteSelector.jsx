import { useAuth, SOCIETES_CONFIG } from '../lib/auth'

// Logo par société — image réelle ou SVG fallback
function SocieteLogo({ societeKey, size = 32 }) {
  const logos = {
    dynassur: '/logo_dynassur.png',
    dtx:      '/logo_dtx.png',
    lode:     '/logo_lode.png',
    holding:  '/logo_holding.svg',
  }

  const src = logos[societeKey]
  if (!src) return null

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '6px',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      background: 'transparent',
    }}>
      <img
        src={src}
        alt={societeKey}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}

// Logo groupe — hexagone SVG inline avec les 3 couleurs
function GroupeLogo({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0080BD"/>
            <stop offset="50%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#ea580c"/>
          </linearGradient>
        </defs>
        <polygon points="50,8 86,28 86,72 50,92 14,72 14,28"
                 fill="none" stroke="url(#ggrad)" strokeWidth="6" strokeLinejoin="round"/>
        <circle cx="50" cy="50" r="13" fill="url(#ggrad)" opacity="0.9"/>
        <circle cx="50" cy="14" r="5" fill="#0080BD"/>
        <circle cx="80" cy="67" r="5" fill="#ea580c"/>
        <circle cx="20" cy="67" r="5" fill="#7c3aed"/>
      </svg>
    </div>
  )
}

export default function SocieteSelector() {
  const { societesDispo, activeSociete, setActiveSociete, isAdmin } = useAuth()

  if (!societesDispo || societesDispo.length === 0) return null

  const activeConfig = activeSociete ? SOCIETES_CONFIG[activeSociete] : null
  const accentColor = activeConfig?.color || '#0080BD'

  return (
    <div style={{
      padding: '12px 10px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>

      <div style={{
        fontSize: '10px', fontWeight: '700',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '0 6px', marginBottom: '8px'
      }}>
        Entité
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>

        {/* Groupe — admin seulement */}
        {isAdmin && (
          <button
            onClick={() => setActiveSociete(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 10px', borderRadius: '7px', border: 'none',
              cursor: 'pointer',
              background: activeSociete === null ? 'rgba(255,255,255,0.1)' : 'transparent',
              outline: activeSociete === null ? '1px solid rgba(255,255,255,0.15)' : 'none',
              transition: 'all 0.15s', width: '100%', textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeSociete !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (activeSociete !== null) e.currentTarget.style.background = 'transparent' }}
          >
            <GroupeLogo size={30} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: activeSociete === null ? '700' : '400',
                color: activeSociete === null ? '#fff' : 'rgba(255,255,255,0.65)',
                fontFamily: "'Source Sans Pro', sans-serif",
              }}>
                Groupe
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                Toutes les entités
              </div>
            </div>
            {activeSociete === null && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
            )}
          </button>
        )}

        {/* Sociétés accessibles */}
        {societesDispo.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSociete(s.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 10px', borderRadius: '7px', border: 'none',
              cursor: 'pointer',
              background: activeSociete === s.key ? `${s.color}22` : 'transparent',
              outline: activeSociete === s.key ? `1px solid ${s.color}55` : 'none',
              transition: 'all 0.15s', width: '100%', textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeSociete !== s.key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (activeSociete !== s.key) e.currentTarget.style.background = 'transparent' }}
          >
            <SocieteLogo societeKey={s.key} size={30} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: activeSociete === s.key ? '700' : '400',
                color: activeSociete === s.key ? '#fff' : 'rgba(255,255,255,0.65)',
                fontFamily: "'Source Sans Pro', sans-serif",
              }}>
                {s.label}
              </div>
            </div>
            {activeSociete === s.key && (
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: s.color, flexShrink: 0,
                boxShadow: `0 0 6px ${s.color}`
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Barre couleur active */}
      <div style={{
        height: '2px',
        background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
        borderRadius: '2px', marginTop: '10px', opacity: 0.6,
        transition: 'background 0.3s'
      }} />
    </div>
  )
}
