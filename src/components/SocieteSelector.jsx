import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

const ROUTES = {
  groupe: '/groupe', dynassur: '/dynassur', dtx: '/dtx',
  lode: '/lode', hexagroup: '/hexagroup', prive: '/prive',
}

const LOGOS = {
  dynassur: '/logo_dynassur.png',
  dtx:      '/logo_dtx.png',
  lode:     '/logo_lode.png',
  hexagroup:'/logo_hexagroup.svg',
  prive:    '/logo_prive.svg',
}

function GroupeLogo({ size = 30 }) {
  return (
    <div style={{ width:size, height:size, flexShrink:0 }}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0080BD"/>
            <stop offset="50%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#ea580c"/>
          </linearGradient>
        </defs>
        <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" fill="none" stroke="url(#ggrad)" strokeWidth="6" strokeLinejoin="round"/>
        <circle cx="50" cy="50" r="13" fill="url(#ggrad)" opacity="0.9"/>
        <circle cx="50" cy="14" r="5" fill="#0080BD"/>
        <circle cx="80" cy="67" r="5" fill="#ea580c"/>
        <circle cx="20" cy="67" r="5" fill="#7c3aed"/>
      </svg>
    </div>
  )
}

export default function SocieteSelector() {
  const { societesDispo, activeSociete, setActiveSociete } = useAuth()
  const navigate = useNavigate()

  if (!societesDispo?.length) return null

  function select(key) {
    setActiveSociete(key)
    navigate(ROUTES[key] || '/')
  }

  const activeConfig = activeSociete ? SOCIETES_CONFIG[activeSociete] : null
  const accentColor = activeConfig?.color || '#7c3aed'

  return (
    <div style={{ padding:'12px 10px 8px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.3)', letterSpacing:'0.1em', textTransform:'uppercase', padding:'0 6px', marginBottom:'8px' }}>
        Entité
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
        {societesDispo.map(s => {
          const isActive = activeSociete === s.key
          const logo = LOGOS[s.key]
          return (
            <button key={s.key} onClick={() => select(s.key)} style={{
              display:'flex', alignItems:'center', gap:'10px',
              padding:'7px 10px', borderRadius:'7px', border:'none', cursor:'pointer',
              background: isActive ? `${s.color}22` : 'transparent',
              outline: isActive ? `1px solid ${s.color}55` : 'none',
              transition:'all 0.15s', width:'100%', textAlign:'left',
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {s.key === 'groupe'
                ? <GroupeLogo size={30} />
                : logo
                  ? <div style={{ width:30, height:30, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <img src={logo} alt={s.key} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                    </div>
                  : <div style={{ width:30, height:30, borderRadius:'6px', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'10px', fontWeight:'800', color:'#fff' }}>{s.short}</div>
              }
              <div style={{ flex:1, overflow:'hidden' }}>
                <div style={{ fontSize:'13px', fontWeight: isActive?'700':'400', color: isActive?'#fff':'rgba(255,255,255,0.65)', fontFamily:"'Source Sans Pro', sans-serif", whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {s.label}
                </div>
              </div>
              {isActive && <div style={{ width:6, height:6, borderRadius:'50%', background:s.color, flexShrink:0, boxShadow:`0 0 6px ${s.color}` }} />}
            </button>
          )
        })}
      </div>
      <div style={{ height:'2px', background:`linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`, borderRadius:'2px', marginTop:'10px', opacity:0.6, transition:'background 0.3s' }} />
    </div>
  )
}
