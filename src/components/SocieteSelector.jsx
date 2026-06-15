import { useAuth, SOCIETES_CONFIG } from '../lib/auth'

const LOGOS = {
  groupe:   null, // SVG inline
  dynassur: '/logo_dynassur.png',
  dtx:      '/logo_dtx.png',
  lode:     '/logo_lode.png',
}

function GroupeLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0080BD"/>
          <stop offset="50%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#ea580c"/>
        </linearGradient>
      </defs>
      <polygon points="50,8 86,28 86,72 50,92 14,72 14,28"
               fill="none" stroke="url(#sg)" strokeWidth="7" strokeLinejoin="round"/>
      <circle cx="50" cy="50" r="12" fill="url(#sg)" opacity="0.85"/>
      <circle cx="50" cy="14" r="5" fill="#0080BD"/>
      <circle cx="80" cy="67" r="5" fill="#ea580c"/>
      <circle cx="20" cy="67" r="5" fill="#7c3aed"/>
    </svg>
  )
}

function SocieteLogo({ societeKey, size = 28 }) {
  if (societeKey === 'groupe') return <GroupeLogo size={size} />
  const src = LOGOS[societeKey]
  if (!src) return null
  return (
    <div style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={src} alt={societeKey} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

export default function SocieteSelector() {
  const { societesDispo, activeSociete, setActiveSociete } = useAuth()
  if (!societesDispo || societesDispo.length === 0) return null

  const activeConfig = activeSociete ? SOCIETES_CONFIG[activeSociete] : null
  const accentColor = activeConfig?.color || '#0080BD'

  return (
    <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

      <div style={{
        fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
        padding: '0 6px', marginBottom: '8px'
      }}>
        Entité
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {societesDispo.map(s => {
          const active = activeSociete === s.key
          return (
            <button
              key={s.key}
              onClick={() => setActiveSociete(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 10px', borderRadius: '7px', border: 'none',
                cursor: 'pointer',
                background: active ? `${s.color}25` : 'transparent',
                outline: active ? `1px solid ${s.color}50` : 'none',
                transition: 'all 0.15s', width: '100%', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <SocieteLogo societeKey={s.key} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '13px', fontFamily: "'Source Sans Pro', sans-serif",
                  fontWeight: active ? '700' : '400',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                }}>
                  {s.label}
                </div>
              </div>
              {active && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: s.color, boxShadow: `0 0 6px ${s.color}`
                }} />
              )}
            </button>
          )
        })}
      </div>

      <div style={{
        height: '2px', marginTop: '10px', borderRadius: '2px', opacity: 0.5,
        background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
        transition: 'background 0.3s'
      }} />
    </div>
  )
}
