import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useNavigate, useLocation } from 'react-router-dom'

const MODULES = {
  groupe: [
    { key: 'acc_holding', label: 'Tableau de bord général', icon: 'ti-layout-grid', path: '/groupe' },
  ],
  dynassur: [
    { key: 'dyn_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dynassur' },
    { key: 'dyn_taches',       label: 'Tâches',           icon: 'ti-checkbox',         path: '/dynassur/taches' },
    { key: 'dyn_clients',      label: 'Clients',           icon: 'ti-users',            path: '/dynassur/clients' },
    { key: 'dyn_production',   label: 'Production',        icon: 'ti-chart-line',       path: '/dynassur/production' },
    { key: 'dyn_bordereaux',   label: 'Bordereaux',        icon: 'ti-file-invoice',     path: '/dynassur/bordereaux' },
    { key: 'dyn_chiffres',     label: 'Chiffres',          icon: 'ti-report-analytics', path: '/dynassur/chiffres' },
    { key: 'dyn_objectifs',    label: 'Objectifs',         icon: 'ti-target',           path: '/dynassur/objectifs' },
    { key: 'dyn_compagnies',   label: 'Compagnies',        icon: 'ti-building',         path: '/dynassur/compagnies' },
    { key: 'dyn_sinistres',    label: 'Sinistres',         icon: 'ti-alert-triangle',   path: '/dynassur/sinistres' },
    { key: 'dyn_rdv',          label: 'RDV / Agenda',      icon: 'ti-calendar',         path: '/dynassur/rdv' },
    { key: 'dyn_comptabilite', label: 'Comptabilité',      icon: 'ti-calculator',       path: '/dynassur/comptabilite' },
    { key: 'dyn_devis',        label: 'Devis & Factures',  icon: 'ti-file-invoice',     path: '/dynassur/devis-factures' },
  ],
  dtx: [
    { key: 'dtx_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dtx' },
    { key: 'dtx_immobilier',   label: 'Immobilier',       icon: 'ti-home',             path: '/dtx/immobilier' },
    { key: 'dtx_vehicules',    label: 'Véhicules',        icon: 'ti-car',              path: '/dtx/vehicules' },
    { key: 'dtx_trading',      label: 'Trading',          icon: 'ti-trending-up',      path: '/dtx/trading' },
    { key: 'dtx_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dtx/comptabilite' },
    { key: 'dtx_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/dtx/devis-factures' },
  ],
  lode: [
    { key: 'lode_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/lode' },
    { key: 'lode_clients',      label: 'Clients',          icon: 'ti-users',            path: '/lode/clients' },
    { key: 'lode_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/lode/devis-factures' },
    { key: 'lode_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/lode/comptabilite' },
  ],
  hexagroup: [
    { key: 'hex_dashboard',      label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/hexagroup' },
    { key: 'hex_comptabilite',   label: 'Comptabilité',     icon: 'ti-calculator',       path: '/hexagroup/comptabilite' },
  ],
  prive: [
    { key: 'prive_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/prive' },
    { key: 'prive_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/prive/comptabilite' },
  ],
}

const MODULES_ADMIN = [
  { key: 'admin_users', label: 'Utilisateurs', icon: 'ti-users-group', path: '/admin/users' },
  { key: 'admin_sync', label: 'Synchronisation', icon: 'ti-refresh', path: '/admin/sync' },
  { key: 'admin_rdv_cat', label: 'Catégories RDV', icon: 'ti-tags', path: '/admin/rdv-categories' },
]

export default function Sidebar() {
  const { perms, isAdmin, activeSociete } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  if (!perms) return null

  const cfg = activeSociete ? SOCIETES_CONFIG[activeSociete] : SOCIETES_CONFIG.groupe
  const accentColor = cfg.color
  const accentLight = cfg.colorAccent

  const currentModules = activeSociete && MODULES[activeSociete]
    ? MODULES[activeSociete].filter(m => isAdmin || perms[m.key])
    : []

  const NavItem = ({ item }) => {
    const active = location.pathname === item.path ||
      (item.path.length > 1 && location.pathname.startsWith(item.path + '/'))
    return (
      <div onClick={() => navigate(item.path)} style={{
        display:'flex', alignItems:'center', gap:'10px',
        padding:'8px 12px', borderRadius:'7px', cursor:'pointer',
        background: active ? `${accentColor}20` : 'transparent',
        borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
        transition:'all 0.15s', marginBottom:'1px'
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <i className={`ti ${item.icon}`} style={{ fontSize:'16px', color: active ? accentLight : 'rgba(255,255,255,0.45)', width:'18px', flexShrink:0 }} />
        <span style={{ fontSize:'13.5px', fontFamily:"'Source Sans Pro', sans-serif", color: active ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: active ? '600' : '400' }}>
          {item.label}
        </span>
      </div>
    )
  }

  return (
    <nav style={{ flex:1, padding:'8px 8px 16px', overflowY:'auto' }}>
      {currentModules.map(m => <NavItem key={m.key} item={m} />)}
      {isAdmin && (
        <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.25)', letterSpacing:'0.1em', textTransform:'uppercase', padding:'8px 12px 5px' }}>
            Administration
          </div>
          {MODULES_ADMIN.map(m => <NavItem key={m.key} item={m} />)}
        </div>
      )}
    </nav>
  )
}
