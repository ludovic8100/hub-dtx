import { useAuth, SOCIETES_CONFIG } from '../lib/auth'

// Logos initiales stylisés par société (pas d'icônes génériques)
function SocieteLogo({ config, size = 28 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '6px',
      background: config.color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: "'Source Sans Pro', sans-serif",
      fontWeight: '800',
      fontSize: size === 28 ? '10px' : '9px',
      color: '#fff',
      letterSpacing: '0.03em'
    }}>
      {config.short}
    </div>
  )
}

export default function SocieteSelector() {
  const { societesDispo, activeSociete, setActiveSociete, isAdmin } = useAuth()

  if (!societesDispo || societesDispo.length === 0) return null

  const activeConfig = activeSociete ? SOCIETES_CONFIG[activeSociete] : null

  // Couleur de la barre active
  const accentColor = activeConfig?.color || '#0080BD'

  return (
    <div style={{
      padding: '12px 10px 8px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>

      {/* Label section */}
      <div style={{
        fontSize: '10px',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '0 6px',
        marginBottom: '8px'
      }}>
        Entité
      </div>

      {/* Boutons société */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>

        {/* Option "Tout le groupe" — admin seulement */}
        {isAdmin && (
          <button
            onClick={() => setActiveSociete(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              background: activeSociete === null ? 'rgba(255,255,255,0.1)' : 'transparent',
              outline: activeSociete === null ? '1px solid rgba(255,255,255,0.15)' : 'none',
              transition: 'all 0.15s',
              width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeSociete !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (activeSociete !== null) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Logo groupe */}
            <div style={{
              width: 28, height: 28,
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #0080BD 0%, #7c3aed 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: "'Source Sans Pro', sans-serif",
              fontWeight: '800', fontSize: '9px', color: '#fff',
              letterSpacing: '0.03em'
            }}>
              GRP
            </div>
            <div>
              <div style={{
                fontSize: '13px',
                fontWeight: activeSociete === null ? '700' : '400',
                color: activeSociete === null ? '#fff' : 'rgba(255,255,255,0.65)',
                fontFamily: "'Source Sans Pro', sans-serif",
              }}>
                Groupe
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                Toutes les entités
              </div>
            </div>
            {activeSociete === null && (
              <div style={{
                marginLeft: 'auto',
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#fff',
                flexShrink: 0
              }} />
            )}
          </button>
        )}

        {/* Une société par bouton */}
        {societesDispo.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSociete(s.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '7px 10px',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              background: activeSociete === s.key
                ? `${s.color}22`
                : 'transparent',
              outline: activeSociete === s.key
                ? `1px solid ${s.color}55`
                : 'none',
              transition: 'all 0.15s',
              width: '100%',
              textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeSociete !== s.key) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (activeSociete !== s.key) e.currentTarget.style.background = 'transparent' }}
          >
            <SocieteLogo config={s} />
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
                width: 6, height: 6,
                borderRadius: '50%',
                background: s.color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${s.color}`
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Barre de couleur active en bas du sélecteur */}
      <div style={{
        height: '2px',
        background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
        borderRadius: '2px',
        marginTop: '10px',
        opacity: 0.6,
        transition: 'background 0.3s'
      }} />
    </div>
  )
}
