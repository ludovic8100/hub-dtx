import { useAuth } from '../lib/auth'
import { useNavigate, useLocation } from 'react-router-dom'

const MODULES_DYNASSUR = [
  { key: 'dyn_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dynassur' },
  { key: 'dyn_taches',       label: 'Tâches',          icon: 'ti-checkbox',         path: '/dynassur/taches' },
  { key: 'dyn_clients',      label: 'Clients',          icon: 'ti-users',            path: '/dynassur/clients' },
  { key: 'dyn_production',   label: 'Production',       icon: 'ti-chart-line',       path: '/dynassur/production' },
  { key: 'dyn_bordereaux',   label: 'Bordereaux',       icon: 'ti-file-invoice',     path: '/dynassur/bordereaux' },
  { key: 'dyn_chiffres',     label: 'Chiffres',         icon: 'ti-report-analytics', path: '/dynassur/chiffres' },
  { key: 'dyn_objectifs',    label: 'Objectifs',        icon: 'ti-target',           path: '/dynassur/objectifs' },
  { key: 'dyn_compagnies',   label: 'Compagnies',       icon: 'ti-building',         path: '/dynassur/compagnies' },
  { key: 'dyn_sinistres',    label: 'Sinistres',        icon: 'ti-alert-triangle',   path: '/dynassur/sinistres' },
  { key: 'dyn_banque',       label: 'Banque',           icon: 'ti-credit-card',      path: '/dynassur/banque' },
  { key: 'dyn_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dynassur/comptabilite' },
]

const MODULES_DTX = [
  { key: 'dtx_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dtx' },
  { key: 'dtx_immobilier',   label: 'Immobilier',       icon: 'ti-home',             path: '/dtx/immobilier' },
  { key: 'dtx_vehicules',    label: 'Véhicules',        icon: 'ti-car',              path: '/dtx/vehicules' },
  { key: 'dtx_trading',      label: 'Trading',          icon: 'ti-trending-up',      path: '/dtx/trading' },
  { key: 'dtx_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dtx/comptabilite' },
]

export default function Sidebar() {
  const { perms, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!perms) return null

  const dynModules = MODULES_DYNASSUR.filter(m => isAdmin || perms[m.key])
  const dtxModules = MODULES_DTX.filter(m => isAdmin || perms[m.key])

  const NavItem = ({ item }) => {
    const active = location.pathname === item.path ||
      (item.path !== '/dynassur' && item.path !== '/dtx' && location.pathname.startsWith(item.path))

    return (
      <div
        onClick={() => navigate(item.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '9px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          background: active ? 'rgba(0,128,189,0.15)' : 'transparent',
          borderLeft: active ? '3px solid #0080BD' : '3px solid transparent',
          transition: 'all 0.15s',
          marginBottom: '2px'
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <i className={`ti ${item.icon}`} style={{
          fontSize: '17px',
          color: active ? '#5DC3E8' : 'rgba(255,255,255,0.55)',
          width: '20px',
          flexShrink: 0
        }} />
        <span style={{
          fontSize: '14px',
          fontFamily: "'Source Sans Pro', sans-serif",
          color: active ? '#fff' : 'rgba(255,255,255,0.7)',
          fontWeight: active ? '600' : '400'
        }}>
          {item.label}
        </span>
      </div>
    )
  }

  const SectionLabel = ({ label }) => (
    <div style={{
      fontSize: '11px',
      fontFamily: "'Source Sans Pro', sans-serif",
      fontWeight: '700',
      color: 'rgba(255,255,255,0.35)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '16px 16px 6px',
      marginTop: '4px'
    }}>
      {label}
    </div>
  )

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      background: '#0D2F5E',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      overflowY: 'auto',
      padding: '8px 8px 24px'
    }}>

      {/* Dynassur */}
      {(perms.acc_dynassur || isAdmin) && dynModules.length > 0 && (
        <>
          <SectionLabel label="Dynassur" />
          {dynModules.map(m => <NavItem key={m.key} item={m} />)}
        </>
      )}

      {/* DTX */}
      {(perms.acc_dtx || isAdmin) && dtxModules.length > 0 && (
        <>
          <SectionLabel label="DTX SRL" />
          {dtxModules.map(m => <NavItem key={m.key} item={m} />)}
        </>
      )}

      {/* Admin — gestion users */}
      {isAdmin && (
        <>
          <SectionLabel label="Administration" />
          <NavItem item={{
            key: 'admin_users',
            label: 'Utilisateurs',
            icon: 'ti-users-group',
            path: '/admin/users'
          }} />
        </>
      )}
    </aside>
  )
}
