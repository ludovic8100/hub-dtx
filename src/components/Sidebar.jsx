import { useState, useEffect } from 'react'
import { useAuth, SOCIETES_CONFIG } from '../lib/auth'
import { useTicketsBadge } from '../lib/useTicketsBadge'
import { useNotesFraisBadge } from '../lib/useNotesFraisBadge'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

// Icônes métal du menu (public/icons/hub-dtx-metal/, 24 px, PNG transparents).
// La correspondance se fait sur le suffixe de la clé, donc une même icône sert
// à toutes les sociétés : dyn_notesfrais et lode_notesfrais partagent « notes-de-frais ».
// Une entrée sans correspondance garde son icône Tabler d'origine.
const ICONES = {
  dashboard: 'tableau-de-bord', notesfrais: 'notes-de-frais',
  notes_frais: 'notes-de-frais', clients: 'clients', production: 'production',
  compagnies: 'compagnies-bordereaux', credits: 'credits', sinistres: 'sinistres',
  appels: 'appels', comptabilite: 'comptabilite',
  devis: 'devis-factures', rentabilite: 'rentabilite', config: 'parametres',
  tools: 'outils', tickets: 'tickets',
}
const iconePng = (key) => {
  if (!key) return null
  if (ICONES[key]) return ICONES[key]
  const suffixe = key.slice(key.indexOf('_') + 1)   // dyn_clients -> clients
  return ICONES[suffixe] || null
}

const MODULES = {
  groupe: [
    { key: 'acc_holding', label: 'Tableau de bord général', icon: 'ti-layout-grid', path: '/groupe' },
    { key: 'acc_holding', label: 'Comptabilité', icon: 'ti-calculator', path: '/groupe/comptabilite' },
    { key: 'grp_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/groupe/notes-frais' },
  ],
  dynassur: [
    { key: 'dyn_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dynassur' },
    { key: 'dyn_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/dynassur/notes-frais' },
    { key: 'dyn_clients',      label: 'Clients',           icon: 'ti-users',            path: '/dynassur/clients' },
    { key: 'dyn_production',   label: 'Performance',       icon: 'ti-chart-line',       path: '/dynassur/production', anyKeys: ['dyn_production','dyn_chiffres','dyn_rentabilite','dyn_objectifs'] },
    { key: 'dyn_encaissements', label: 'Encaissements',   icon: 'ti-cash',             path: '/dynassur/encaissements' },
    { key: 'dyn_compagnies',   label: 'Compagnies',        icon: 'ti-building',         path: '/dynassur/compagnies' },
    { key: 'dyn_credits',      label: 'Crédits',           icon: 'ti-cash-banknote',    path: '/dynassur/credits' },
    { key: 'dyn_sinistres',    label: 'Sinistres',         icon: 'ti-alert-triangle',   path: '/dynassur/sinistres' },
    { key: 'dyn_appels',       label: 'Appels',            icon: 'ti-phone',            path: '/dynassur/appels' },
    { key: 'dyn_comptabilite', label: 'Comptabilité',      icon: 'ti-calculator',       path: '/dynassur/comptabilite' },
  ],
  dtx: [
    { key: 'dtx_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/dtx' },
    { key: 'dtx_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/dtx/notes-frais' },
    { key: 'dtx_immobilier',   label: 'Immobilier',       icon: 'ti-home',             path: '/dtx/immobilier' },
    { key: 'dtx_vehicules',    label: 'Véhicules',        icon: 'ti-car',              path: '/dtx/vehicules' },
    { key: 'dtx_trading',      label: 'Trading',          icon: 'ti-trending-up',      path: '/dtx/trading' },
    { key: 'dtx_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/dtx/comptabilite' },
    { key: 'dtx_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/dtx/devis-factures' },
  ],
  lode: [
    { key: 'lode_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/lode' },
    { key: 'lode_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/lode/notes-frais' },
    { key: 'lode_clients',      label: 'Clients',          icon: 'ti-users',            path: '/lode/clients' },
    { key: 'lode_comptabilite', label: 'Dossiers',         icon: 'ti-folders',          path: '/lode/dossiers' },
    { key: 'lode_devis',        label: 'Devis & Factures', icon: 'ti-file-invoice',     path: '/lode/devis-factures' },
    { key: 'lode_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/lode/comptabilite' },
    { key: 'lode_rentabilite',  label: 'Rentabilité',      icon: 'ti-coin',             path: '/lode/rentabilite' },
  ],
  hexagroup: [
    { key: 'hex_dashboard',      label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/hexagroup' },
    { key: 'hex_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/hexagroup/notes-frais' },
    { key: 'hex_comptabilite',   label: 'Comptabilité',     icon: 'ti-calculator',       path: '/hexagroup/comptabilite' },
    { key: 'hex_membres',        label: 'Membres',          icon: 'ti-users-group',      path: '/hexagroup/membres' },
    { key: 'hex_cotisations',    label: 'Cotisations',      icon: 'ti-receipt-2',        path: '/hexagroup/cotisations' },
  ],
  prive: [
    { key: 'prive_dashboard',    label: 'Tableau de bord', icon: 'ti-layout-dashboard', path: '/prive' },
    { key: 'prive_notesfrais', label: 'Notes de frais', icon: 'ti-receipt', path: '/prive/notes-frais' },
    { key: 'prive_comptabilite', label: 'Comptabilité',     icon: 'ti-calculator',       path: '/prive/comptabilite' },
  ],
}

const MODULES_ADMIN = [
  { key: 'admin_config', label: 'Paramètres', icon: 'ti-settings', path: '/config' },
  { key: 'admin_notes_frais', label: 'Notes de frais', icon: 'ti-receipt', path: '/admin/notes-frais' },
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
  // Une recherche qui ECHOUE et une recherche qui ne TROUVE RIEN affichaient
  // le meme « Aucun resultat ». Session expiree, panne reseau, droit refuse :
  // tout ressortait identique a un nom mal orthographie. On ne pouvait ni le
  // voir ni le diagnostiquer.
  const [erreur, setErreur] = useState(null)
  // LE CURSEUR CLAVIER. Chercher un client au clavier puis devoir attraper la
  // souris pour choisir, c'est un geste de trop à chaque appel téléphonique.
  // -1 = aucun choix en cours : la flèche bas prend le premier.
  const [curseur, setCurseur] = useState(-1)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setRes([]); setErreur(null); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc('search_clients_dynassur', { q: term, lim: 8 })
        if (error) throw error
        setRes(data || []); setErreur(null); setCurseur(-1)
      } catch (e) {
        setRes([]); setErreur(e?.message || String(e))
      } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const go = d => { if (!d) return; navigate(`/dynassur/clients?dossier=${encodeURIComponent(d)}`); setQ(''); setRes([]); setErreur(null); setCurseur(-1) }

  // Entrée sans sélection ouvre le PREMIER résultat : c'est ce qu'on attend
  // quand on a tapé un nom et qu'il n'y a qu'une évidence à l'écran.
  const auClavier = e => {
    if (!res.length) return
    if (e.key === 'ArrowDown')      { e.preventDefault(); setCurseur(i => (i + 1) % res.length) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setCurseur(i => (i <= 0 ? res.length : i) - 1) }
    else if (e.key === 'Enter')     { e.preventDefault(); go(res[curseur < 0 ? 0 : curseur]?.dossier) }
    else if (e.key === 'Escape')    { setQ(''); setRes([]); setCurseur(-1) }
  }

  return (
    <div style={{ margin: '12px 4px 4px', padding: '11px 11px 12px', borderRadius: 10,
        border: '1.5px solid rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.07)' }}>
      <style>{`.dyn-cs-input::placeholder{color:rgba(255,255,255,0.65);}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <img src="/icons/hub-dtx-metal/recherche-client.png" alt="" width={24} height={24} style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COUL.blanc, letterSpacing: '0.02em' }}>Recherche client</span>
      </div>
      <div style={{ position: 'relative' }}>
        <input className="dyn-cs-input" value={q} onChange={e => setQ(e.target.value)} onKeyDown={auClavier}
          placeholder="Nom, plaque, n°, localité…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 26px 8px 11px', borderRadius: 7,
            border: '1.5px solid rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.14)',
            color: COUL.blanc, fontSize: 13, fontFamily: "'Source Sans Pro', sans-serif", outline: 'none', fontWeight: 500 }} />
        {q && <button onClick={() => { setQ(''); setRes([]); setErreur(null) }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15 }}>✕</button>}
      </div>
      {q.trim().length >= 2 && (
        <div style={{ marginTop: 6, maxHeight: 340, overflowY: 'auto' }}>
          {searching ? <div style={{ padding: '8px 4px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Recherche…</div>
            : erreur ? <div style={{ padding: '8px 9px', fontSize: 11.5, lineHeight: 1.45, color: COUL.blanc,
                background: 'rgba(220,38,38,0.35)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 7 }}>
                <strong>La recherche n'a pas abouti.</strong><br />{erreur}<br />
                <span style={{ opacity: 0.85 }}>Recharge la page (Ctrl+Maj+R). Si ça persiste, envoie-moi ce message.</span>
              </div>
            : !res.length ? <div style={{ padding: '8px 4px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Aucun résultat</div>
              : res.map((c, i) => (
                <div key={c.dossier || i} onClick={() => go(c.dossier)}
                  ref={el => { if (el && i === curseur) el.scrollIntoView({ block: 'nearest' }) }}
                  onMouseEnter={() => setCurseur(i)}
                  style={{ padding: '7px 9px', borderRadius: 7, cursor: 'pointer', marginBottom: 3,
                    background: i === curseur ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                    border: i === curseur ? '1px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontSize: 13, color: COUL.blanc, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom} {c.prenom}</div>
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
  const ticketsBadge = useTicketsBadge()
  const notesFraisBadge = useNotesFraisBadge()
  const navigate = useNavigate()
  const location = useLocation()
  if (!perms) return null

  const cfg = activeSociete ? SOCIETES_CONFIG[activeSociete] : SOCIETES_CONFIG.groupe
  const accentColor = cfg.color
  const accentLight = cfg.colorAccent

  const currentModules = activeSociete && MODULES[activeSociete]
    ? orderModules(MODULES[activeSociete].filter(m => isAdmin || (m.anyKeys ? m.anyKeys.some(k => perms[k]) : perms[m.key])))
    : []

  const NavItem = ({ item }) => {
    const active = location.pathname === item.path ||
      (item.path.length > 1 && location.pathname.startsWith(item.path + '/'))
    return (
      // L'entrée sélectionnée s'inverse : fond blanc et texte bleu nuit, elle « sort »
      // du panneau sombre. Les icônes métal, qui gardent leurs couleurs en permanence,
      // ressortent mieux sur ce fond clair. Le survol reste un gris translucide discret :
      // la sélection doit toujours être plus marquée que le survol.
      <div onClick={() => navigate(item.path)} style={{
        display:'flex', alignItems:'center', gap:'10px',
        padding:'8px 12px', borderRadius:'7px', cursor:'pointer',
        background: active ? '#fff' : 'transparent',
        borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
        transition:'all 0.15s', marginBottom:'1px'
      }}
        onMouseEnter={e => {
          if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
          const img = e.currentTarget.querySelector('img')
          if (img) img.style.opacity = '1'
        }}
        onMouseLeave={e => {
          if (!active) e.currentTarget.style.background = 'transparent'
          const img = e.currentTarget.querySelector('img')
          if (img && !active) img.style.opacity = '0.6'
        }}
      >
        {iconePng(item.key)
          ? <img src={`/icons/hub-dtx-metal/${iconePng(item.key)}.png`} alt="" width={24} height={24}
              style={{ width:'20px', height:'20px', flexShrink:0, opacity: active ? 1 : 0.6, transition:'opacity 0.15s' }} />
          : <i className={`ti ${item.icon}`} style={{ fontSize:'16px', color: active ? accentColor : 'rgba(255,255,255,0.45)', width:'20px', flexShrink:0 }} />}
        <span style={{ fontSize:'13.5px', fontFamily:"'Source Sans Pro', sans-serif", color: active ? '#0D2F5E' : 'rgba(255,255,255,0.65)', fontWeight: active ? '700' : '400', flex:1 }}>
          {item.label}
        </span>
        {item.badge > 0 && <span style={{ background:'#E74C3C', color:COUL.blanc, borderRadius:'10px', fontSize:'11px', fontWeight:700, padding:'1px 7px', minWidth:'18px', textAlign:'center' }}>{item.badge}</span>}
      </div>
    )
  }

  return (
    <nav style={{ flex:1, padding:'8px 8px 16px', overflowY:'auto' }}>
      {/* ⚠️ LA CLÉ EST LE CHEMIN, PAS LA PERMISSION (14/11/2026).
          Ludovic a vu QUATRE « Comptabilité » dans le menu LODE.
          Cause : deux entrées partagent la même `key` de permission —
          `lode_comptabilite` sert à la fois à « Dossiers » et à
          « Comptabilité », `acc_holding` au tableau de bord du groupe et à sa
          comptabilité. Donnée à React comme clé de liste, dans une liste que
          `orderModules` RÉORDONNE, elle lui faisait réutiliser le mauvais
          élément : des libellés dupliqués, et hors de l'ordre alphabétique.
          Le chemin, lui, est unique par société — vérifié, aucun doublon. */}
      {currentModules.map(m => <NavItem key={m.path} item={m} />)}
      {activeSociete === 'dynassur' && <ClientSearch accentLight={accentLight} />}
      <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
        {(isAdmin || perms.acc_tools) && <NavItem item={{ key:'tools', label:'Outils', icon:'ti-tools', path:'/tools' }} />}
        <NavItem item={{ key:'tickets', label:'Tickets', icon:'ti-ticket', path:'/tickets', badge: ticketsBadge }} />
      </div>
      {isAdmin && (
        <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'rgba(255,255,255,0.25)', letterSpacing:'0.1em', textTransform:'uppercase', padding:'8px 12px 5px' }}>
            Administration
          </div>
          {MODULES_ADMIN.map(m => <NavItem key={m.key} item={m.key === 'admin_notes_frais' ? { ...m, badge: notesFraisBadge } : m} />)}
        </div>
      )}
    </nav>
  )
}
