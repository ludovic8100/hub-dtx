import { useState, useEffect } from 'react'
import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MODULES = {
  groupe: [
    { key: 'acc_holding', label: 'Tableau de bord général', icon: 'ti-layout-grid', path: '/groupe' },
    { key: 'grp_taches', label: 'Tâches', icon: 'ti-checkbox', path: '/groupe/taches' },
    { key: 'grp_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/groupe/notes-frais' },
  ],
  dynassur: [
    { key: 'dyn_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dynassur' },
    { key: 'dyn_taches',       label: 'Tâches',           icon: 'ti-checkbox',         path: '/dynassur/taches' },
    { key: 'dyn_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/dynassur/notes-frais' },
    { key: 'dyn_clients',      label: 'Clients',           icon: 'ti-users',            path: '/dynassur/clients' },
    { key: 'dyn_production',   label: 'Production',        icon: 'ti-chart-line',       path: '/dynassur/production' },
    { key: 'dyn_bordereaux',   label: 'Bordereaux',        icon: 'ti-file-invoice',     path: '/dynassur/bordereaux' },
    { key: 'dyn_chiffres',     label: 'Chiffres',          icon: 'ti-report-analytics', path: '/dynassur/chiffres' },
    { key: 'dyn_objectifs',    label: 'Objectifs',         icon: 'ti-target',           path: '/dynassur/objectifs' },
    { key: 'dyn_compagnies',   label: 'Compagnies',        icon: 'ti-building',         path: '/dynassur/compagnies' },
    { key: 'dyn_sinistres',    label: 'Sinistres',         icon: 'ti-alert-triangle',   path: '/dynassur/sinistres' },
    { key: 'dyn_rdv',          label: 'RDV / Agenda',      icon: 'ti-calendar',         path: '/dynassur/rdv' },
    { key: 'dyn_appels',       label: 'Appels',            icon: 'ti-phone',            path: '/dynassur/appels' },
    { key: 'dyn_comptabilite', label: 'Comptabilité',      icon: 'ti-calculator',       path: '/dynassur/comptabilite' },
    { key: 'dyn_rentabilite',  label: 'Rentabilité',       icon: 'ti-coin',             path: '/dynassur/rentabilite' },
    { key: 'dyn_devis',        label: 'Devis & Factures',  icon: 'ti-file-invoice',     path: '/dynassur/devis-factures' },
  ],
  dtx: [
    { key: 'dtx_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dtx' },
    { key: 'dtx_taches',       label: 'Tâches',          icon: 'ti-checkbox',         path: '/dtx/taches' },
    { key: 'dtx_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/dtx/notes-frais' },
    { key: 'dtx_immobilier',   label: 'Immobilier',       icon: 'ti-home',             path: '/dtx/immobilier' },
    { key: 'dtx_vehicules',    label: 'Véhicules',        icon: 'ti-car',              path: '/dtx/vehicules' },
    { key: 'dtx_trading',      label: 'Trading',          icon: 'ti-trending-up',      path: '/dtx/trading' },
    { key: 'dtx_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dtx/comptabilite' },
    { key: 'dtx_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/dtx/devis-factures' },
  ],
  lode: [
    { key: 'lode_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/lode' },
    { key: 'lode_taches',       label: 'Tâches',          icon: 'ti-checkbox',         path: '/lode/taches' },
    { key: 'lode_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/lode/notes-frais' },
    { key: 'lode_clients',      label: 'Clients',          icon: 'ti-users',            path: '/lode/clients' },
    { key: 'lode_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/lode/devis-factures' },
    { key: 'lode_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/lode/comptabilite' },
  ],
  hexagroup: [
    { key: 'hex_dashboard',      label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/hexagroup' },
    { key: 'hex_taches',         label: 'Tâches',          icon: 'ti-checkbox',         path: '/hexagroup/taches' },
    { key: 'hex_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/hexagroup/notes-frais' },
    { key: 'hex_comptabilite',   label: 'Comptabilité',     icon: 'ti-calculator',       path: '/hexagroup/comptabilite' },
  ],
  prive: [
    { key: 'prive_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/prive' },
    { key: 'prive_taches',       label: 'Tâches',          icon: 'ti-checkbox',         path: '/prive/taches' },
    { key: 'prive_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/prive/notes-frais' },
    { key: 'prive_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/prive/comptabilite' },
  ],
}

const MODULES_ADMIN = [
  { key: 'admin_config', label: 'Paramètres', icon: 'ti-settings', path: '/config' },
  { key: 'admin_sync', label: 'Synchronisation', icon: 'ti-refresh', path: '/admin/sync' },
  { key: 'admin_rdv_cat', label: 'Catégories RDV', icon: 'ti-tags', path: '/admin/rdv-categories' },
  { key: 'admin_liens', label: 'Liens cassés', icon: 'ti-unlink', path: '/admin/liens-casses' },
]

// Tri des modules d'une société : Tableau de bord toujours en tête, le reste par ordre alphabétique
const orderModules = arr => [...arr].sort((a, b) => {
  const ad = /dashboard/.test(a.key) || a.key === 'acc_holding'
  const bd = /dashboard/.test(b.key) || b.key === 'acc_holding'
  if (ad !== bd) return ad ? -1 : 1
  return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
})

// ── Recherche client universelle (Dynassur), intégrée au menu ──
function ClientSearch({ accentLight }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_clients_dynassur', { q: term, lim: 8 })
      setRes(error ? [] : (data || [])); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const go = d => { if (!d) return; navigate(`/dynassur/clients?dossier=${encodeURIComponent(d)}`); setQ(''); setRes([]) }

  return (
    <div style={{ margin: '12px 4px 4px', padding: '11px 11px 12px', borderRadius: 10,
        border: '1.5px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.07)' }}>
      <style>{`.dyn-cs-input::placeholder{color:rgba(255,255,255,0.65);}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <i className="ti ti-search" style={{ fontSize: 15, color: '#fff' }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>Recherche client</span>
      </div>
      <div style={{ position: 'relative' }}>
        <input className="dyn-cs-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Nom, plaque, n°, localité…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 26px 8px 11px', borderRadius: 7,
            border: '1.5px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.14)',
            color: '#fff', fontSize: 13, fontFamily: "'Source Sans Pro', sans-serif", outline: 'none', fontWeight: 500 }} />
        {q && <button onClick={() => { setQ(''); setRes([]) }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
      </div>
      {q.trim().length >= 2 && (
        <div style={{ marginTop: 6, maxHeight: 340, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '8px 4px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Recherche…</div>
            : !res.length ? <div style={{ padding: '8px 4px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Aucun résultat</div>
              : res.map((c, i) => (
                <div key={c.dossier || i} onClick={() => go(c.dossier)} style={{ padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom} {c.prenom}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{c.dossier}{c.localite ? ` · ${c.localite}` : ''}</div>
                  {c.match_info && <div style={{ fontSize: 11, color: accentLight, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.match_info}</div>}
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { perms, isAdmin, activeSociete } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  if (!perms) return null

  const cfg = activeSociete ? SOCIETES_CONFIG[activeSociete] : SOCIETES_CONFIG.groupe
  const accentColor = cfg.color
  const accentLight = cfg.colorAccent

  const currentModules = activeSociete && MODULES[activeSociete]
    ? orderModules(MODULES[activeSociete].filter(m => isAdmin || perms[m.key]))
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
      {activeSociete === 'dynassur' && <ClientSearch accentLight={accentLight} />}
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
