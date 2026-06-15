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

const MODULES_LODE = [
  { key: 'lode_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/lode' },
  { key: 'lode_clients',      label: 'Clients',          icon: 'ti-users',            path: '/lode/clients' },
  { key: 'lode_banque',       label: 'Banque',           icon: 'ti-credit-card',      path: '/lode/banque' },
  { key: 'lode_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/lode/comptabilite' },
]

export default function Sidebar() {
  const { perms, isAdmin, activeSociete, setActiveSociete, societesDispo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!perms) return null

  const dynModules  = MODULES_DYNASSUR.filter(m => isAdmin || perms[m.key])
  const dtxModules  = MODULES_DTX.filter(m => isAdmin || perms[m.key])
  const lodeModules = MODULES_LODE.filter(m => isAdmin || perms[m.key])

  // Sociétés à afficher selon le filtre actif
  const showDyn  = !activeSociete || activeSociete === 'dynassur'
  const showDtx  = !activeSociete || activeSociete === 'dtx'
  const showLode = !activeSociete || activeSociete === 'lode'

  const NavItem = ({ item }) => {
    const active = location.pathname === item.path ||
      (item.path.split('/').length > 2 && location.pathname.startsWith(item.path))

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

  const SectionLabel = ({ label, color }) => (
    <div style={{
      fontSize: '11px',
      fontFamily: "'Source Sans Pro', sans-serif",
      fontWeight: '700',
      color: color || 'rgba(255,255,255,0.35)',
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
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>

      {/* ── SWITCHER SOCIÉTÉ ── */}
      <div style={{
        padding: '12px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Bouton "Groupe" = toutes les sociétés */}
        <button
          onClick={() => setActiveSociete(null)}
          style={{
            width: '100%',
            padding: '8px 12px',
            marginBottom: '6px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Source Sans Pro', sans-serif",
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeSociete === null
              ? 'rgba(255,255,255,0.15)'
              : 'rgba(255,255,255,0.05)',
            color: activeSociete === null ? '#fff' : 'rgba(255,255,255,0.55)',
            transition: 'all 0.15s',
            outline: activeSociete === null ? '1px solid rgba(255,255,255,0.2)' : 'none',
          }}
        >
          <i className="ti ti-building-community" style={{ fontSize: '15px' }} />
          Groupe complet
        </button>

        {/* Boutons par société accessible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {societesDispo.map(soc => {
            const isActive = activeSociete === soc.key
            return (
              <button
                key={soc.key}
                onClick={() => setActiveSociete(isActive ? null : soc.key)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Source Sans Pro', sans-serif",
                  fontSize: '13px',
                  fontWeight: isActive ? '700' : '400',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: isActive ? soc.color : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                  transition: 'all 0.15s',
                  outline: isActive ? `1px solid ${soc.color}` : 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              >
                <i className="ti ti-building" style={{ fontSize: '14px', opacity: 0.85 }} />
                {soc.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── NAVIGATION MODULES ── */}
      <div style={{ flex: 1, padding: '8px 8px 24px' }}>

        {showDyn && (perms.acc_dynassur || isAdmin) && dynModules.length > 0 && (
          <>
            {!activeSociete && <SectionLabel label="Dynassur" />}
            {dynModules.map(m => <NavItem key={m.key} item={m} />)}
          </>
        )}

        {showDtx && (perms.acc_dtx || isAdmin) && dtxModules.length > 0 && (
          <>
            {!activeSociete && <SectionLabel label="DTX SRL" />}
            {dtxModules.map(m => <NavItem key={m.key} item={m} />)}
          </>
        )}

        {showLode && (perms.acc_lode || isAdmin) && lodeModules.length > 0 && (
          <>
            {!activeSociete && <SectionLabel label="LODE SRL" />}
            {lodeModules.map(m => <NavItem key={m.key} item={m} />)}
          </>
        )}

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
      </div>
    </aside>
  )
}
