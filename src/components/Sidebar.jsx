import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useNavigate, useLocation } from 'react-router-dom'

const MODULES = {
  dynassur: [
    { key: 'dyn_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dynassur' },
    { key: 'dyn_taches',       label: 'Tâches',          icon: 'ti-checkbox',          path: '/dynassur/taches' },
    { key: 'dyn_clients',      label: 'Clients',          icon: 'ti-users',             path: '/dynassur/clients' },
    { key: 'dyn_production',   label: 'Production',       icon: 'ti-chart-line',        path: '/dynassur/production' },
    { key: 'dyn_bordereaux',   label: 'Bordereaux',       icon: 'ti-file-invoice',      path: '/dynassur/bordereaux' },
    { key: 'dyn_chiffres',     label: 'Chiffres',         icon: 'ti-report-analytics',  path: '/dynassur/chiffres' },
    { key: 'dyn_objectifs',    label: 'Objectifs',        icon: 'ti-target',            path: '/dynassur/objectifs' },
    { key: 'dyn_compagnies',   label: 'Compagnies',       icon: 'ti-building',          path: '/dynassur/compagnies' },
    { key: 'dyn_sinistres',    label: 'Sinistres',        icon: 'ti-alert-triangle',    path: '/dynassur/sinistres' },
    { key: 'dyn_banque',       label: 'Banque',           icon: 'ti-credit-card',       path: '/dynassur/banque' },
    { key: 'dyn_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',        path: '/dynassur/comptabilite' },
  ],
  dtx: [
    { key: 'dtx_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dtx' },
    { key: 'dtx_immobilier',   label: 'Immobilier',       icon: 'ti-home',             path: '/dtx/immobilier' },
    { key: 'dtx_vehicules',    label: 'Véhicules',        icon: 'ti-car',              path: '/dtx/vehicules' },
    { key: 'dtx_trading',      label: 'Trading',          icon: 'ti-trending-up',      path: '/dtx/trading' },
    { key: 'dtx_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dtx/comptabilite' },
  ],
  lode: [
    { key: 'lode_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/lode' },
    { key: 'lode_clients',      label: 'Clients',          icon: 'ti-users',            path: '/lode/clients' },
    { key: 'lode_banque',       label: 'Banque',           icon: 'ti-credit-card',      path: '/lode/banque' },
    { key: 'lode_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/lode/comptabilite' },
  ],
  holding: [
    { key: 'acc_holding', label: 'Vue consolidée',  icon: 'ti-layout-dashboard', path: '/holding' },
  ],
}

// Modules admin — toujours visibles pour admin
const MODULES_ADMIN = [
  { key: 'admin_users', label: 'Utilisateurs', icon: 'ti-users-group', path: '/admin/users' },
]

export default function Sidebar() {
  const { perms, isAdmin, activeSociete } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!perms) return null

  // Couleur accent selon société active
  const cfg = activeSociete ? SOCIETES_CONFIG[activeSociete] : null
  const accentColor = cfg?.color || '#0080BD'
  const accentLight = cfg?.colorAccent || '#5DC3E8'

  // Modules à afficher : soit ceux de la société active, soit TOUT si "Groupe"
  let modulesToShow = []

  if (activeSociete && MODULES[activeSociete]) {
    modulesToShow = [{
      sectionKey: activeSociete,
      items: MODULES[activeSociete].filter(m => isAdmin || perms[m.key])
    }]
  } else if (!activeSociete) {
    // Vue groupe : afficher toutes les sections accessibles
    modulesToShow = Object.entries(MODULES)
      .map(([key, items]) => ({
        sectionKey: key,
        items: items.filter(m => isAdmin || perms[m.key])
      }))
      .filter(s => s.items.length > 0)
  }

  const NavItem = ({ item, color, colorLight }) => {
    const active = location.pathname === item.path ||
      (item.path.length > 1 && location.pathname.startsWith(item.path))

    return (
      <div
        onClick={() => navigate(item.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          borderRadius: '7px',
          cursor: 'pointer',
          background: active ? `${color}20` : 'transparent',
          borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
          transition: 'all 0.15s',
          marginBottom: '1px'
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <i className={`ti ${item.icon}`} style={{
          fontSize: '16px',
          color: active ? colorLight : 'rgba(255,255,255,0.45)',
          width: '18px',
          flexShrink: 0
        }} />
        <span style={{
          fontSize: '13.5px',
          fontFamily: "'Source Sans Pro', sans-serif",
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          fontWeight: active ? '600' : '400'
        }}>
          {item.label}
        </span>
      </div>
    )
  }

  const SectionLabel = ({ sectionKey }) => {
    const s = SOCIETES_CONFIG[sectionKey]
    if (!s || activeSociete) return null // Pas de label si vue mono-société
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '14px 12px 5px',
        marginTop: '4px'
      }}>
        <div style={{
          width: 16, height: 16,
          borderRadius: '3px',
          background: s.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '8px', fontWeight: '800', color: '#fff',
          flexShrink: 0
        }}>
          {s.short[0]}
        </div>
        <span style={{
          fontSize: '10.5px',
          fontWeight: '700',
          color: `${s.color}cc`,
          letterSpacing: '0.07em',
          textTransform: 'uppercase'
        }}>
          {s.label}
        </span>
      </div>
    )
  }

  return (
    <nav style={{ flex: 1, padding: '8px 8px 16px', overflowY: 'auto' }}>

      {modulesToShow.map(section => {
        const sectionCfg = SOCIETES_CONFIG[section.sectionKey]
        const color = sectionCfg?.color || accentColor
        const colorLight = sectionCfg?.colorAccent || accentLight

        return (
          <div key={section.sectionKey}>
            <SectionLabel sectionKey={section.sectionKey} />
            {section.items.map(m => (
              <NavItem key={m.key} item={m} color={color} colorLight={colorLight} />
            ))}
          </div>
        )
      })}

      {/* Admin */}
      {isAdmin && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '8px 12px 5px'
          }}>
            Administration
          </div>
          {MODULES_ADMIN.map(m => (
            <NavItem key={m.key} item={m} color='#7c3aed' colorLight='#a78bfa' />
          ))}
        </div>
      )}
    </nav>
  )
}
