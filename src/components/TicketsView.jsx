import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const NAVY = '#1A3A6B', CYAN = '#29ABE2', MID = '#1E5799'
const C = { bg: '#F4F6F9', white: '#fff', border: '#DDE3ED', textM: '#4A5568', textL: '#8A9BBE', ok: '#27AE60', warn: '#F39C12', danger: '#E74C3C' }

const CATEGORIES = ['Gestion client', 'Sinistre', 'Commercial', 'Demande développement', 'Bug hub', 'Problème Outlook/M365', 'Demande administrative', 'Autre']
const SOCIETES = [
  { k: 'dynassur', label: 'Dynassur' },
  { k: 'dtx', label: 'DTX' },
  { k: 'lode', label: 'LODE' },
  { k: 'hexagroup', label: 'Hexagroup' },
  { k: 'prive', label: 'Privé' },
  { k: 'groupe', label: 'Groupe' },
]
const socLabel = k => (SOCIETES.find(s => s.k === (k || '').toLowerCase())?.label) || (k ? k : '—')
const STATUTS = [
  { k: 'nouveau', label: 'Nouveau', bg: '#E3F2FD', fg: '#1565C0' },
  { k: 'en_cours', label: 'En cours', bg: '#FFF3E0', fg: '#E65100' },
  { k: 'resolu', label: 'Résolu', bg: '#E8F5E9', fg: '#2E7D32' },
  { k: 'cloture', label: 'Clôturé', bg: '#ECEFF1', fg: '#546E7A' },
]
const STATUT_BAR = { nouveau: '#1565C0', en_cours: '#E65100', resolu: '#2E7D32', cloture: '#546E7A' }
const PRIOS = [
  { k: 'basse', label: 'Basse', col: '#95A5A6' },
  { k: 'moyenne', label: 'Normale', col: '#29ABE2' },
  { k: 'haute', label: 'Haute', col: '#F39C12' },
  { k: 'urgente', label: 'Urgente', col: '#E74C3C' },
]
const st = k => STATUTS.find(s => s.k === k) || STATUTS[0]
const pr = k => PRIOS.find(p => p.k === k) || PRIOS[1]
const URGENT_STYLE = { display: 'inline-block', background: '#E74C3C', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, marginRight: 8, letterSpacing: '.5px', verticalAlign: 'middle' }

const fmtDT = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const joursEntre = (a, b) => { if (!a || !b) return null; return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000)) }
const rel = d => {
  if (!d) return ''
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`
  return new Date(d).toLocaleDateString('fr-BE')
}
const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768

const S = {
  badge: (b, f) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: b, color: f }),
  avatar: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: MID, color: '#fff', fontSize: 10, fontWeight: 700 },
  btn: (v = 'primary') => ({ padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: 'none', ...(v === 'primary' ? { background: `linear-gradient(135deg,${CYAN},${MID})`, color: '#fff' } : v === 'ok' ? { background: `linear-gradient(135deg,#27AE60,#1e8449)`, color: '#fff' } : { background: '#fff', color: NAVY, border: `1px solid ${C.border}` }) }),
  input: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, color: NAVY, width: '100%', boxSizing: 'border-box', outline: 'none' },
  label: { fontSize: 11, fontWeight: 700, color: C.textM, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 5, display: 'block' },
}


// Carte stat avec répartition % par collaborateur au survol
function StatCard({ label, count, tickets, color }) {
  const [hover, setHover] = useState(false)
  // répartition par assigné
  const repartition = {}
  tickets.forEach(t => { const k = (t.gestionnaire || '').toUpperCase() || 'Non attribué'; repartition[k] = (repartition[k] || 0) + 1 })
  const lignes = Object.entries(repartition).sort((a, b) => b[1] - a[1])
  const total = count || 1
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', flex: 1, minWidth: 0, textAlign: 'center', cursor: 'default' }}>
      <div style={{ fontSize: 10, color: C.textL, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: color || NAVY, lineHeight: 1.1 }}>{count}</div>
      {hover && lignes.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 50, marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: C.textL, fontWeight: 700, marginBottom: 6 }}>Répartition</div>
          {lignes.map(([code, n]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '2px 0' }}>
              <span style={{ color: NAVY, fontWeight: 600 }}>{code}</span>
              <span style={{ color: C.textM }}>{n} · {Math.round(n / total * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { n8nWebhook, HUB_URL } from '../config/env'
const ALERTE_WEBHOOK = n8nWebhook('ticket-alerte')

// Envoie une alerte mail via le webhook n8n (ne bloque jamais l'UI)
async function envoyerAlerte(destEmails, subject, htmlBody) {
  const to = (destEmails || []).filter(Boolean)
  if (!to.length) return
  try {
    await fetch(ALERTE_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html: htmlBody }),
    })
  } catch (e) { /* silencieux : l'alerte ne doit pas casser l'action */ }
}
function mailClient(nom, message) {
  const corps = (message || '').replace(/\n/g, '<br>')
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#222;line-height:1.5">`
    + `${nom ? 'Bonjour ' + nom + ',' : 'Bonjour,'}<br><br>${corps}<br><br>`
    + `<span style="color:#666">Pour nous répondre, répondez simplement à ce message — votre réponse sera ajoutée à votre dossier.</span><br><br>`
    + `<b>Dynassur</b><br>info@dynassur.be</div>`
}
function mailTicket(t, intro, extraHtml = '', withClose = false) {
  return `<div style="font-family:Arial,sans-serif;color:#1A3A6B">
    <p>${intro}</p>
    <p style="margin:14px 0"><b>Ticket #${t.id}</b> — ${t.titre || ''}<br>
    <span style="color:#8A9BBE;font-size:13px">${t.ticket_categorie || ''}</span></p>
    ${extraHtml || ''}
    <p style="margin-top:14px"><a href="${HUB_URL}/tickets?ticket=${t.id}" style="background:#1E5799;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">Ouvrir le ticket</a>${withClose ? ` &nbsp; <a href="${HUB_URL}/tickets?ticket=${t.id}&do=resolve" style="background:#2E7D32;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;display:inline-block">✅ Clôturer (Résolu)</a>` : ''}</p>
    <p style="color:#8A9BBE;font-size:12px;margin-top:16px">Hub DTX — notification automatique</p>
  </div>`
}

// ── Pièces jointes (Supabase Storage, bucket 'tickets') ──
const sanitizeName = n => (n || 'fichier').replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 120)

async function uploadPiece(tacheId, file, who) {
  const path = `${tacheId}/${Date.now()}-${sanitizeName(file.name)}`
  const { error } = await supabase.storage.from('tickets').upload(path, file, { upsert: false })
  if (error) throw error
  await supabase.from('tickets_messages').insert({
    tache_id: tacheId, auteur_code: who.code, auteur_nom: who.nom, auteur_email: who.email,
    type: 'piece_jointe', message: file.name, piece_jointe_path: path, piece_jointe_nom: file.name,
  })
}

// Zone de dépôt réutilisable : glisser-déposer OU clic
function DropZone({ onFiles, disabled, compact }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  const handle = list => { const arr = Array.from(list || []).filter(Boolean); if (arr.length) onFiles(arr) }
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setOver(true) }}
      onDragLeave={e => { e.preventDefault(); setOver(false) }}
      onDrop={e => { e.preventDefault(); setOver(false); if (!disabled) handle(e.dataTransfer.files) }}
      onClick={() => { if (!disabled) inputRef.current?.click() }}
      style={{ border: `2px dashed ${over ? CYAN : C.border}`, borderRadius: 10, padding: compact ? '10px 12px' : '18px 14px', textAlign: 'center', cursor: disabled ? 'not-allowed' : 'pointer', background: over ? '#EAF6FD' : '#FAFBFD', color: over ? MID : C.textL, fontSize: 12.5, fontWeight: 600, transition: 'all .15s', opacity: disabled ? 0.5 : 1 }}>
      <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { handle(e.target.files); e.target.value = '' }} />
      📎 Glisse un fichier ici ou clique pour choisir
    </div>
  )
}

// Affiche une pièce jointe (lien signé + aperçu image)
function PieceJointe({ path, nom }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { let ok = true; if (path) supabase.storage.from('tickets').createSignedUrl(path, 3600).then(({ data }) => { if (ok) setUrl(data?.signedUrl || null) }); return () => { ok = false } }, [path])
  const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(nom || path || '')
  if (!url) return <span style={{ fontSize: 12, color: C.textL }}>📎 {nom || 'pièce jointe'}…</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ color: MID, textDecoration: 'none', fontWeight: 600 }}>
      {isImg && <img src={url} alt={nom} style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, display: 'block', marginBottom: 5 }} />}
      📎 {nom || 'Télécharger'}
    </a>
  )
}

export default function TicketsView() {
  const { perms, isAdmin, activeSociete } = useAuth()
  const entiteScope = (activeSociete && activeSociete !== 'groupe') ? activeSociete : null
  const myCode = (perms?.collab_code || perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const myEmail = (perms?.user_email || '').toLowerCase()
  const myNom = perms?.nom || myCode

  const [tickets, setTickets] = useState([])
  const [collabs, setCollabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('mine')       // mine / unassigned / all
  const [fStatut, setFStatut] = useState('actifs') // actifs / tous / <statut>
  const [q, setQ] = useState('')          // recherche plein-texte
  const [fSoc, setFSoc] = useState('tous')
  const [fCat, setFCat] = useState('tous')
  const [fCollab, setFCollab] = useState('tous')
  const [sort, setSort] = useState({ col: 'created', dir: 'desc' })
  const [cats, setCats] = useState(CATEGORIES)
  const [catType, setCatType] = useState({})
  const [showCreate, setShowCreate] = useState(false)
  const [createPrefill, setCreatePrefill] = useState(null)
  const [sel, setSel] = useState(null)             // ticket ouvert (détail)
  const [mobile, setMobile] = useState(isMobile())
  const [unread, setUnread] = useState({})

  useEffect(() => { const h = () => setMobile(isMobile()); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const sel = 'id,titre,description,entite,ticket_categorie,ticket_statut,ticket_origine,priorite,gestionnaire,cree_par,cloture_par,user_email,derniere_activite,date_creation,created_at,dossier_client,client_id,participants,checklist,date_cloture,ticket_echeance'
    let all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('taches').select(sel).eq('is_ticket', true).order('derniere_activite', { ascending: false }).range(from, from + 999)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < 1000) break
    }
    setTickets(all)
    let c = []
    try {
      const r = await supabase.from('user_permissions').select('collab_code,nom,o365_display_name,user_email,actif,est_employe').eq('actif', true)
      const EXCLUS = new Set(['INF', 'SIN', 'SEC', 'CON', 'GH', 'TES'])   // boîtes partagées / génériques / test
      const vus = new Set()
      c = (r.data || [])
        .filter(u => u.collab_code && u.user_email && !EXCLUS.has((u.collab_code || '').toUpperCase()))
        .filter(u => { const k = u.collab_code.toUpperCase(); if (vus.has(k)) return false; vus.add(k); return true })
        .map(u => ({ code: u.collab_code.toUpperCase(), nom_complet: u.nom || u.o365_display_name || u.collab_code, email: u.user_email, actif: u.actif }))
        .sort((a, b) => (a.nom_complet || '').localeCompare(b.nom_complet || ''))
    } catch (e) { c = [] }
    setCollabs(c)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  // Non-lus pour moi (messages d'un autre que moi, pas encore dans lu_par)
  useEffect(() => {
    if (!myCode || !tickets.length) { setUnread({}); return }
    let on = true
    ;(async () => {
      const ids = tickets.map(t => t.id); const map = {}
      for (let i = 0; i < ids.length; i += 300) {
        const { data } = await supabase.from('tickets_messages').select('tache_id,auteur_code,lu_par').in('tache_id', ids.slice(i, i + 300))
        for (const m of (data || [])) {
          const au = (m.auteur_code || '').toUpperCase()
          const lus = (Array.isArray(m.lu_par) ? m.lu_par : []).map(x => (x || '').toUpperCase())
          if (au && au !== myCode && !lus.includes(myCode)) map[m.tache_id] = (map[m.tache_id] || 0) + 1
        }
      }
      if (on) setUnread(map)
    })()
    return () => { on = false }
  }, [tickets, myCode])
  useEffect(() => { supabase.from('ticket_categories').select('label,type').eq('actif', true).order('ordre').then(({ data }) => { if (data && data.length) { setCats(data.map(r => r.label)); setCatType(Object.fromEntries(data.map(r => [r.label, r.type || 'gestion']))) } }) }, [])

  // Ouverture directe d'un ticket via le lien e-mail (?ticket=ID)
  const ouvertParUrl = useRef(false)
  useEffect(() => {
    if (ouvertParUrl.current || !tickets.length) return
    const tid = new URLSearchParams(window.location.search).get('ticket')
    if (!tid) return
    const found = tickets.find(x => String(x.id) === String(tid))
    if (found) { ouvertParUrl.current = true; setSel(found) }
  }, [tickets])

  // Ouverture directe du formulaire de création via lien (?new=1&dossier=...&client_id=...&titre=...)
  const ouvertNewUrl = useRef(false)
  useEffect(() => {
    if (ouvertNewUrl.current) return
    const q = new URLSearchParams(window.location.search)
    if (q.get('new') !== '1') return
    ouvertNewUrl.current = true
    const dossier = q.get('dossier') || ''
    const client_id = q.get('client_id') || ''
    const titre = q.get('titre') || (dossier ? `${dossier} - ` : '')
    setCreatePrefill({ titre, dossier_client: dossier || null, client_id: client_id || null })
    setShowCreate(true)
  }, [])

  const codeLabel = code => { if (!code) return '—'; const c = collabs.find(x => (x.code || '').toUpperCase() === (code || '').toUpperCase()); return c ? (c.nom_complet || c.nom_sa_data || c.code) : code }

  // Filtrage
  const visibles = tickets.filter(t => {
    const assigne = (t.gestionnaire || '').toUpperCase()
    const auteur = (t.cree_par || '').toUpperCase()
    const parts = Array.isArray(t.participants) ? t.participants.map(x => (x || '').toUpperCase()) : []
    if (scope === 'mine' && !(assigne === myCode || auteur === myCode || parts.includes(myCode))) return false
    if (scope === 'unassigned' && assigne) return false
    // scope 'all' : tout (réservé admin)
    if (entiteScope && (t.entite || '').toLowerCase() !== entiteScope) return false
    if (fSoc !== 'tous' && (t.entite || '').toLowerCase() !== fSoc) return false
    if (fCat !== 'tous' && t.ticket_categorie !== fCat) return false
    if (fCollab !== 'tous' && (t.gestionnaire || '').toUpperCase() !== fCollab.toUpperCase()) return false
    if (fStatut === 'actifs' && ['cloture', 'resolu'].includes(t.ticket_statut)) return false
    else if (fStatut !== 'actifs' && fStatut !== 'tous' && t.ticket_statut !== fStatut) return false
    if (q.trim()) {
      const n = q.trim().toLowerCase()
      const hay = ['#' + t.id, String(t.id), t.titre, t.dossier_client, socLabel(t.entite), t.ticket_categorie, codeLabel(t.gestionnaire), codeLabel(t.cree_par), ...(Array.isArray(t.participants) ? t.participants.map(codeLabel) : [])].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(n)) return false
    }
    return true
  })
  const COLS = [
    { key: 'id', label: '#' },
    { key: 'titre', label: 'Titre' },
    { key: 'societe', label: 'Société' },
    { key: 'categorie', label: 'Catégorie' },
    { key: 'priorite', label: 'Priorité' },
    { key: 'statut', label: 'Statut' },
    { key: 'assigne', label: 'Assigné à' },
    { key: 'cree', label: 'Créé par' },
    { key: 'participants', label: 'Participants' },
    { key: 'dossier', label: 'Dossier' },
    { key: 'created', label: 'Créé le' },
    { key: 'maj', label: 'Maj' },
  ]
  const sortVal = (t, key) => {
    switch (key) {
      case 'id': return t.id
      case 'titre': return (t.titre || '').toLowerCase()
      case 'societe': return socLabel(t.entite).toLowerCase()
      case 'categorie': return (t.ticket_categorie || '').toLowerCase()
      case 'priorite': return PRIOS.findIndex(p => p.k === t.priorite)
      case 'statut': return STATUTS.findIndex(s => s.k === t.ticket_statut)
      case 'assigne': return (codeLabel(t.gestionnaire) || '').toLowerCase()
      case 'cree': return (codeLabel(t.cree_par) || '').toLowerCase()
      case 'participants': return Array.isArray(t.participants) ? t.participants.length : 0
      case 'dossier': return t.dossier_client || ''
      case 'created': return new Date(t.created_at || t.date_creation || 0).getTime()
      case 'maj': return new Date(t.derniere_activite || t.created_at || 0).getTime()
      default: return ''
    }
  }
  const rows = [...visibles].sort((a, b) => {
    const va = sortVal(a, sort.col), vb = sortVal(b, sort.col)
    const r = va < vb ? -1 : va > vb ? 1 : 0
    return sort.dir === 'asc' ? r : -r
  })
  const toggleSort = key => setSort(s => s.col === key ? { col: key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col: key, dir: 'asc' })
  const nbUnassigned = tickets.filter(t => !(t.gestionnaire || '')).length

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement des tickets…</div>

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['mine', 'Mes tickets'], ['unassigned', 'À attribuer'], ...(isAdmin ? [['all', 'Tous']] : [])].map(([k, l]) => (
          <button key={k} onClick={() => { setScope(k); setFStatut(k === 'all' ? 'tous' : 'actifs') }} style={{ ...S.btn(scope === k ? 'primary' : 'ghost'), padding: '8px 14px', borderRadius: 20, position: 'relative' }}>
            {l}{k === 'unassigned' && nbUnassigned > 0 && <span style={{ background: C.danger, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 5 }}>{nbUnassigned}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={S.btn('primary')} onClick={() => setShowCreate(true)}>+ Nouvelle demande</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <input style={{ ...S.input, width: 240, paddingRight: 26 }} placeholder="🔎 Rechercher (n°, titre, dossier, nom…)" value={q} onChange={e => setQ(e.target.value)} />
          {q && <span onClick={() => setQ('')} title="Effacer" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: C.textL, fontWeight: 700 }}>×</span>}
        </div>
        <select style={{ ...S.input, width: 'auto' }} value={fStatut} onChange={e => setFStatut(e.target.value)}>
          <option value="actifs">Tickets actifs</option>
          <option value="tous">Tous statuts</option>
          {STATUTS.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
        </select>
        {entiteScope
          ? <span style={{ ...S.input, width: 'auto', display: 'inline-flex', alignItems: 'center', background: '#EAF6FD', borderColor: '#BFE3F5', color: MID, fontWeight: 700 }}>Société : {socLabel(entiteScope)}</span>
          : <select style={{ ...S.input, width: 'auto' }} value={fSoc} onChange={e => setFSoc(e.target.value)}>
              <option value="tous">Toutes sociétés</option>
              {SOCIETES.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
            </select>}
        <select style={{ ...S.input, width: 'auto' }} value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="tous">Toutes catégories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...S.input, width: 'auto' }} value={fCollab} onChange={e => setFCollab(e.target.value)}>
          <option value="tous">Assigné à : tous</option>
          {collabs.map(c => <option key={c.code} value={c.code}>{c.nom_complet}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.textL, alignSelf: 'center' }}>{visibles.length} ticket(s)</span>
      </div>

      {/* Stats */}
      {(() => {
        const base = scope === 'all' ? tickets : visibles
        const parStatut = k => base.filter(t => t.ticket_statut === k)
        const actifs = base.filter(t => !['cloture', 'resolu'].includes(t.ticket_statut))
        return (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'nowrap' }}>
            <StatCard label="Total" count={base.length} tickets={base} color={NAVY} />
            <StatCard label="Actifs" count={actifs.length} tickets={actifs} color={CYAN} />
            <StatCard label="En cours" count={parStatut('en_cours').length} tickets={parStatut('en_cours')} color="#E65100" />
            <StatCard label="Résolus" count={parStatut('resolu').length} tickets={parStatut('resolu')} color="#2E7D32" />
            <StatCard label="Clôturés" count={parStatut('cloture').length} tickets={parStatut('cloture')} color="#546E7A" />
          </div>
        )
      })()}

      {/* Liste */}
      {visibles.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.textL }}>
          Aucun ticket. Cliquez sur « + Nouvelle demande » pour en créer un.
        </div>
      ) : mobile ? (
        <div>{visibles.map(t => <TicketCard key={t.id} t={t} codeLabel={codeLabel} onOpen={() => setSel(t)} />)}</div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: C.bg, color: C.textM }}>
              {COLS.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {c.label}<span style={{ marginLeft: 4, fontSize: 10, opacity: sort.col === c.key ? 1 : 0.3 }}>{sort.col === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                </th>
              ))}
            </tr></thead>
            <tbody>
              {rows.map(t => {
                const s = st(t.ticket_statut), p = pr(t.priorite)
                return (
                  <tr key={t.id} onClick={() => setSel(t)} style={{ borderTop: `1px solid #EEF1F6`, cursor: 'pointer', opacity: ['cloture', 'resolu'].includes(t.ticket_statut) ? 0.6 : 1 }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: C.textL, fontWeight: 700, whiteSpace: 'nowrap' }}>{unread[t.id] ? <span title={`${unread[t.id]} message(s) non lu(s)`} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.danger, marginRight: 6, verticalAlign: 'middle' }} /> : null}#{t.id}</td>
                    <td style={{ padding: '11px 14px', fontWeight: unread[t.id] ? 800 : 600, color: NAVY }}>{t.priorite === 'urgente' && <span style={URGENT_STYLE}>URGENT</span>}{t.ticket_echeance && !['cloture', 'resolu'].includes(t.ticket_statut) && new Date(t.ticket_echeance) < new Date(new Date().toDateString()) && <span style={{ display: 'inline-block', background: '#E74C3C', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, marginRight: 6 }}>⏱ RETARD</span>}<span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.col, marginRight: 8 }} />{t.titre}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: C.textM }}>{socLabel(t.entite)}</td>
                    <td style={{ padding: '11px 14px', color: C.textL, fontSize: 12 }}>{t.ticket_categorie || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={{ fontSize: 11, fontWeight: 700, color: p.col }}>{p.label}</span></td>
                    <td style={{ padding: '11px 14px' }}><span style={S.badge(s.bg, s.fg)}>{s.label}</span></td>
                    <td style={{ padding: '11px 14px' }}>{t.gestionnaire ? <span style={S.avatar} title={codeLabel(t.gestionnaire)}>{(t.gestionnaire || '').slice(0, 3)}</span> : <span style={{ color: C.danger, fontWeight: 600, fontSize: 12 }}>⚠ À attribuer</span>}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: C.textM }}>{codeLabel(t.cree_par) || t.cree_par || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>{(Array.isArray(t.participants) && t.participants.length) ? <span style={{ fontSize: 11, color: C.textM }}>{t.participants.map(codeLabel).join(', ')}</span> : <span style={{ color: C.textL, fontSize: 12 }}>—</span>}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: MID, fontWeight: 600 }}>{t.dossier_client ? '#' + t.dossier_client : '—'}</td>
                    <td style={{ padding: '11px 14px', color: C.textL, fontSize: 12, whiteSpace: 'nowrap' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString('fr-BE') : '—'}</td>
                    <td style={{ padding: '11px 14px', color: C.textL, fontSize: 12, whiteSpace: 'nowrap' }}>{rel(t.derniere_activite || t.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateModal collabs={collabs} cats={cats} catType={catType} lockedSociete={entiteScope} myCode={myCode} myNom={myNom} myEmail={myEmail} prefill={createPrefill} onClose={() => { setShowCreate(false); setCreatePrefill(null) }} onCreated={() => { setShowCreate(false); setCreatePrefill(null); load() }} />}
      {sel && <DetailModal ticket={sel} collabs={collabs} codeLabel={codeLabel} myCode={myCode} myNom={myNom} myEmail={myEmail} isAdmin={isAdmin} onClose={() => setSel(null)} onChanged={() => load()} />}
    </div>
  )
}

function TicketCard({ t, codeLabel, onOpen }) {
  const s = st(t.ticket_statut), p = pr(t.priorite)
  return (
    <div onClick={onOpen} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer', opacity: ['cloture', 'resolu'].includes(t.ticket_statut) ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.textL, fontWeight: 700 }}>#{t.id}</span>
        <span style={S.badge(s.bg, s.fg)}>{s.label}</span>
        <span style={{ marginLeft: 'auto', width: 9, height: 9, borderRadius: '50%', background: p.col }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 8, color: NAVY }}>{t.priorite === 'urgente' && <span style={URGENT_STYLE}>URGENT</span>}{t.titre}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: C.textL }}>
        <span>{t.ticket_categorie || '—'}</span>·<span>par {t.cree_par || '—'}</span>·
        {t.gestionnaire ? <span style={{ ...S.avatar, width: 20, height: 20 }}>{(t.gestionnaire || '').slice(0, 3)}</span> : <span style={{ color: C.danger, fontWeight: 600 }}>⚠ À attribuer</span>}
        <span>· {rel(t.derniere_activite || t.created_at)}</span>
      </div>
    </div>
  )
}

function Overlay({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: wide ? 760 : 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function CreateModal({ collabs, cats = CATEGORIES, catType = {}, lockedSociete = null, myCode, myNom, myEmail, prefill, onClose, onCreated }) {
  const [f, setF] = useState({ titre: prefill?.titre || '', description: '', entite: lockedSociete || '', ticket_categorie: (cats && cats[0]) || 'Gestion client', priorite: 'moyenne', gestionnaire: '', dossier_client: prefill?.dossier_client || '', client_id: prefill?.client_id || null, participants: [] })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const nameOf = code => collabs.find(c => (c.code || '').toUpperCase() === (code || '').toUpperCase())?.nom_complet || code
  const addPart = code => { const c = (code || '').toUpperCase(); if (c && !f.participants.includes(c) && c !== (f.gestionnaire || '').toUpperCase()) set('participants', [...f.participants, c]) }
  const removePart = code => set('participants', f.participants.filter(x => x !== code))
  const [selClient, setSelClient] = useState(prefill?.dossier_client ? { id: prefill.client_id || null, dossier: prefill.dossier_client, nom: '' } : null)
  const [cq, setCq] = useState(''); const [cres, setCres] = useState(null); const [cbusy, setCbusy] = useState(false)
  useEffect(() => {
    const query = cq.trim()
    if (query.length < 2) { setCres(null); setCbusy(false); return }
    setCbusy(true); let cancelled = false
    const timer = setTimeout(async () => {
      const safe = query.replace(/[,%()*]/g, ' ').trim()
      try { const { data } = await supabase.from('clients').select('id,nom,prenom,dossier,cp,localite,gestionnaire_code,gestionnaire_nom,sa_code,sa_nom').or(`nom.ilike.%${safe}%,prenom.ilike.%${safe}%,dossier.ilike.%${safe}%`).limit(10); if (!cancelled) setCres(data || []) }
      catch { if (!cancelled) setCres([]) } finally { if (!cancelled) setCbusy(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [cq])
  const routeFor = (client, categorie) => {
    if (!client) return {}
    const type = catType[categorie] || 'gestion'
    if (type === 'neutre') return {}
    const has = code => !!code && collabs.some(c => (c.code || '').toUpperCase() === code.toUpperCase())
    const gest = (client.gestionnaire_code || '').toUpperCase()
    const com = (client.sa_code || '').toUpperCase()
    const assigne = type === 'commercial' ? com : gest
    const suiveur = type === 'commercial' ? gest : com
    const res = {}
    if (has(assigne)) res.gestionnaire = assigne
    if (has(suiveur) && suiveur !== (has(assigne) ? assigne : null)) res.participants = [suiveur]
    return res
  }
  const pickClient = c => {
    setSelClient({ id: c.id, dossier: c.dossier, nom: `${c.nom || ''} ${c.prenom || ''}`.trim(), gestionnaire_code: c.gestionnaire_code, sa_code: c.sa_code })
    const r = routeFor(c, f.ticket_categorie)
    setF(x => ({ ...x, client_id: c.id, dossier_client: c.dossier, ...('gestionnaire' in r ? { gestionnaire: r.gestionnaire } : {}), ...('participants' in r ? { participants: r.participants } : {}) }))
    setCq(''); setCres(null)
  }
  const clearClient = () => { setSelClient(null); setF(x => ({ ...x, client_id: null, dossier_client: '' })) }
  const save = async () => {
    if (!f.titre.trim()) { setErr('Le titre est obligatoire'); return }
    if (!f.entite) { setErr('La société est obligatoire'); return }
    setSaving(true); setErr('')
    try {
      const now = new Date().toISOString()
      const asgUp = f.gestionnaire ? f.gestionnaire.toUpperCase() : null
      const partsUp = [...new Set((f.participants || []).map(x => (x || '').toUpperCase()).filter(Boolean))].filter(c => c !== asgUp)
      if (myCode && myCode !== asgUp && !partsUp.includes(myCode)) partsUp.push(myCode)
      const payload = {
        titre: f.titre.trim(), description: f.description || null,
        is_ticket: true, entite: f.entite || null, ticket_categorie: f.ticket_categorie, ticket_statut: 'nouveau', ticket_origine: 'interne',
        priorite: f.priorite, gestionnaire: asgUp,
        participants: partsUp, cree_par: myCode, statut: 'todo', source: 'ticket', derniere_activite: now,
        dossier_client: (f.dossier_client || '').trim() || prefill?.dossier_client || null, client_id: f.client_id || prefill?.client_id || null,
      }
      const { data, error } = await supabase.from('taches').insert(payload).select().single()
      if (error) throw error
      // message système initial
      await supabase.from('tickets_messages').insert({
        tache_id: data.id, auteur_code: myCode, type: 'systeme',
        message: f.gestionnaire ? `Ticket créé et assigné à ${f.gestionnaire.toUpperCase()}` : 'Ticket créé (non attribué)',
      })
      for (const file of files) { try { await uploadPiece(data.id, file, { code: myCode, nom: myNom, email: myEmail }) } catch (e) { /* une PJ ne doit pas faire échouer la création */ } }
      // Alerte aux concernés (assigné + participants), sauf le créateur
      const dest = [...new Set([asgUp, ...partsUp].filter(cc => cc && cc !== myCode))]
      const emails = dest.map(code => collabs.find(x => (x.code || '').toUpperCase() === code)?.email).filter(Boolean)
      if (emails.length) envoyerAlerte(emails, `[#${data.id}] 🆕 Nouveau${data.titre ? ' — ' + (data.titre || '').slice(0, 60) : ''}`, mailTicket({ ...data }, `Un nouveau ticket a été créé par <b>${myCode}</b>${data.dossier_client ? ` (dossier #${data.dossier_client})` : ''}.<br>Vous y êtes associé. Cliquez ci-dessous pour le consulter.`))
      onCreated()
    } catch (e) { setErr('Erreur : ' + (e.message || '')) }
    setSaving(false)
  }
  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, fontSize: 16, fontWeight: 800, color: NAVY }}>Nouvelle demande</div>
      <div style={{ padding: 22, overflowY: 'auto' }}>
        {err && <div style={{ background: '#FDECEA', color: '#721C24', border: '1px solid #F5C6CB', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>{err}</div>}
        {prefill?.dossier_client && <div style={{ background: '#EAF6FD', color: MID, border: '1px solid #BFE3F5', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, fontWeight: 600 }}>🔗 Ticket lié au dossier client #{prefill.dossier_client}</div>}
        <div style={{ marginBottom: 14 }}><label style={S.label}>Titre *</label><input style={S.input} value={f.titre} onChange={e => set('titre', e.target.value)} placeholder="Résumé court de la demande" /></div>
        <div style={{ marginBottom: 14 }}><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={f.description} onChange={e => set('description', e.target.value)} placeholder="Détaille ta demande ou le problème…" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={S.label}>Société *</label><select style={{ ...S.input, ...(lockedSociete ? { background: '#EEF1F6', color: MID, fontWeight: 700 } : {}) }} value={f.entite} disabled={!!lockedSociete} onChange={e => set('entite', e.target.value)}><option value="">— Choisir —</option>{SOCIETES.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</select></div>
          <div style={{ position: 'relative' }}>
            <label style={S.label}>Dossier client (nom ou n° — vide = néant)</label>
            {selClient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#EAF6FD', border: '1px solid #BFE3F5', borderRadius: 8, padding: '8px 11px', fontSize: 13 }}>
                <span style={{ flex: 1, color: MID, fontWeight: 600 }}>🔗 {selClient.nom || 'Dossier'} #{selClient.dossier}</span>
                <span onClick={clearClient} style={{ cursor: 'pointer', color: C.danger, fontWeight: 800 }}>×</span>
              </div>
            ) : (<>
              <input style={S.input} value={cq} onChange={e => setCq(e.target.value)} placeholder="Nom du client ou n° de dossier…" autoComplete="off" />
              {cbusy && <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>Recherche…</div>}
              {cres && cres.length === 0 && !cbusy && <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>Aucun client trouvé.</div>}
              {cres && cres.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
                  {cres.map(c => (
                    <div key={c.id} onClick={() => pickClient(c)} style={{ padding: '8px 11px', cursor: 'pointer', borderBottom: `1px solid #F1F4F8`, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: NAVY }}>{c.nom} {c.prenom}</span> <span style={{ color: C.textL }}>#{c.dossier} · {c.cp} {c.localite}</span>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={S.label}>Catégorie</label><select style={S.input} value={f.ticket_categorie} onChange={e => { const v = e.target.value; const r = routeFor(selClient, v); setF(x => ({ ...x, ticket_categorie: v, ...('gestionnaire' in r ? { gestionnaire: r.gestionnaire } : {}), ...('participants' in r ? { participants: r.participants } : {}) })) }}>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={S.label}>Priorité</label><select style={S.input} value={f.priorite} onChange={e => set('priorite', e.target.value)}>{PRIOS.map(p => <option key={p.k} value={p.k}>{p.label}</option>)}</select></div>
        </div>
        <div><label style={S.label}>Assigner à (optionnel)</label>
          <select style={S.input} value={f.gestionnaire} onChange={e => set('gestionnaire', e.target.value)}>
            <option value="">— Laisser à attribuer —</option>
            {collabs.map(c => <option key={c.code} value={c.code}>{c.nom_complet || c.nom_sa_data || c.code} ({c.code})</option>)}
          </select>
          <div style={{ fontSize: 11, color: C.textL, marginTop: 6 }}>Si tu laisses vide, le ticket ira dans « À attribuer ».</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={S.label}>En suivi (participants)</label>
          {selClient && <div style={{ fontSize: 11, color: MID, marginBottom: 6 }}>Assigné et suivi pré-remplis depuis le dossier selon la catégorie — modifiables.</div>}
          {f.participants.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {f.participants.map(pc => (
                <span key={pc} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#E3F2FD', color: '#1565C0', borderRadius: 14, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {nameOf(pc)}<span onClick={() => removePart(pc)} style={{ cursor: 'pointer', fontWeight: 800 }}>×</span>
                </span>
              ))}
            </div>
          )}
          <select style={S.input} value="" onChange={e => { addPart(e.target.value); e.target.value = '' }}>
            <option value="">+ Mettre une personne en suivi…</option>
            {collabs.filter(c => !f.participants.includes((c.code || '').toUpperCase()) && (c.code || '').toUpperCase() !== (f.gestionnaire || '').toUpperCase()).map(c => <option key={c.code} value={c.code}>{c.nom_complet}</option>)}
          </select>
          <div style={{ fontSize: 11, color: C.textL, marginTop: 6 }}>Ils reçoivent les mises à jour et la clôture, et peuvent commenter.</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={S.label}>Pièces jointes</label>
          <DropZone onFiles={fs => setFiles(prev => [...prev, ...fs])} />
          {files.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {files.map((file, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, padding: '5px 9px' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: NAVY }}>📎 {file.name}</span>
                  <span style={{ color: C.textL }}>{Math.round(file.size / 1024)} Ko</span>
                  <span onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: C.danger, fontWeight: 700 }}>×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={S.btn('ghost')} onClick={onClose}>Annuler</button>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? '…' : 'Créer le ticket'}</button>
      </div>
    </Overlay>
  )
}

function DetailModal({ ticket, collabs, codeLabel, myCode, myNom, myEmail, isAdmin, onClose, onChanged }) {
  const [t, setT] = useState(ticket)
  const [msgs, setMsgs] = useState([])
  const [reply, setReply] = useState('')
  const [cli, setCli] = useState(null)
  const [auClient, setAuClient] = useState(false)
  const [filFiltre, setFilFiltre] = useState('tout')
  useEffect(() => {
    let on = true
    ;(async () => {
      let c = null
      if (t.client_id) { const { data } = await supabase.from('clients').select('id,email,prenom,nom').eq('id', t.client_id).maybeSingle(); c = data }
      if (!c && t.dossier_client) { const { data } = await supabase.from('clients').select('id,email,prenom,nom').eq('dossier', t.dossier_client).not('email', 'is', null).limit(1); c = (data && data[0]) || null }
      if (on) setCli(c)
    })()
    return () => { on = false }
  }, [t.client_id, t.dossier_client])
  const [checklist, setChecklist] = useState(Array.isArray(t.checklist) ? t.checklist : [])
  const [newItem, setNewItem] = useState('')
  const [commentDrafts, setCommentDrafts] = useState({})
  // Enregistre la checklist ET notifie les participants (via touch)
  const saveChecklistNotify = async (next, sysMsg) => {
    setChecklist(next)
    await touch({ checklist: next }, sysMsg)
  }
  const addItem = () => {
    if (!newItem.trim()) return
    const txt = newItem.trim()
    saveChecklistNotify([...checklist, { id: Date.now(), texte: txt, fait: false, commentaires: [] }], `Point ajouté à la checklist : « ${txt} » (par ${myCode})`)
    setNewItem('')
  }
  const toggleItem = (id) => {
    const it = checklist.find(c => c.id === id)
    const next = checklist.map(c => c.id === id ? { ...c, fait: !c.fait, fait_par: !c.fait ? myCode : null, fait_le: !c.fait ? new Date().toISOString() : null } : c)
    saveChecklistNotify(next, `Point « ${it?.texte || ''} » ${it?.fait ? 'décoché' : 'coché'} (par ${myCode})`)
  }
  const removeItem = (id) => {
    const it = checklist.find(c => c.id === id)
    saveChecklistNotify(checklist.filter(c => c.id !== id), `Point « ${it?.texte || ''} » retiré (par ${myCode})`)
  }
  const addComment = (id) => {
    const txt = (commentDrafts[id] || '').trim()
    if (!txt) return
    const it = checklist.find(c => c.id === id)
    const com = { id: Date.now(), code: myCode, nom: myNom, texte: txt, date: new Date().toISOString() }
    const next = checklist.map(c => c.id === id ? { ...c, commentaires: [...(Array.isArray(c.commentaires) ? c.commentaires : []), com] } : c)
    setCommentDrafts(d => ({ ...d, [id]: '' }))
    saveChecklistNotify(next, `💬 ${myCode} a commenté « ${it?.texte || ''} » : ${txt.slice(0, 140)}`)
  }
  const [sending, setSending] = useState(false)
  const [upBusy, setUpBusy] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(true)

  const loadMsgs = useCallback(async () => {
    setLoadingMsgs(true)
    const { data } = await supabase.from('tickets_messages').select('*').eq('tache_id', t.id).order('created_at', { ascending: true })
    setMsgs(data || [])
    setLoadingMsgs(false)
    // marquer comme lus pour moi les messages que je n'ai pas encore lus
    const nonLus = (data || []).filter(m => !(Array.isArray(m.lu_par) ? m.lu_par : []).map(x => (x||'').toUpperCase()).includes(myCode))
    if (nonLus.length) {
      await Promise.all(nonLus.map(m => {
        const lp = [...new Set([...(Array.isArray(m.lu_par) ? m.lu_par : []), myCode])]
        return supabase.from('tickets_messages').update({ lu_par: lp }).eq('id', m.id)
      }))
      onChanged()
    }
  }, [t.id, myCode, onChanged])
  useEffect(() => { loadMsgs() }, [loadMsgs])

  const filRecentHtml = () => {
    const list = (msgs || []).filter(m => m.type === 'message' || m.type === 'email').slice(-6)
    if (!list.length) return ''
    const esc = x => (x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div style="margin-top:12px;border-top:1px solid #E6EAF2;padding-top:10px"><div style="font-size:11px;color:#8A9BBE;text-transform:uppercase;font-weight:700;margin-bottom:8px">Derniers échanges</div>`
      + list.map(m => `<div style="margin-bottom:10px"><b>${esc(m.auteur_nom || m.auteur_code || '?')}</b> <span style="color:#8A9BBE;font-size:11px">${fmtDT(m.created_at)}</span><br><span style="color:#2D3748">${esc(m.message).replace(/\n/g, '<br>')}</span></div>`).join('')
      + `</div>`
  }
  const touch = async (patch, sysMsg) => {
    const now = new Date().toISOString()
    setT(x => ({ ...x, ...patch }))
    await supabase.from('taches').update({ ...patch, derniere_activite: now }).eq('id', t.id)
    if (sysMsg) await supabase.from('tickets_messages').insert({ tache_id: t.id, auteur_code: myCode, type: 'systeme', message: sysMsg })
    if (sysMsg) {
      const merged = { ...t, ...patch }
      const p2 = Array.isArray(merged.participants) ? merged.participants.map(x => (x || '').toUpperCase()) : []
      const dest = [...new Set([(merged.gestionnaire || '').toUpperCase(), (merged.cree_par || '').toUpperCase(), ...p2].filter(cc => cc && cc !== myCode))]
      const emails = emailsOf(dest)
      const _tc = (merged.titre || '').slice(0, 60)
      let _tag = 'Mise à jour'
      if (patch.ticket_statut) {
        const _emo = (patch.ticket_statut === 'resolu' || patch.ticket_statut === 'cloture') ? '✅' : patch.ticket_statut === 'en_cours' ? '🟠' : patch.ticket_statut === 'nouveau' ? '🔵' : '•'
        _tag = `${_emo} ${st(patch.ticket_statut).label}`
      }
      if (emails.length) envoyerAlerte(emails, `[#${t.id}] ${_tag}${_tc ? ' — ' + _tc : ''}`, mailTicket(merged, `Une adaptation a été apportée à ce ticket par <b>${myCode}</b>.<br><i>${sysMsg}</i>`, filRecentHtml(), true))
    }
    await loadMsgs(); onChanged()
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    const txt = reply.trim()
    await supabase.from('tickets_messages').insert({ tache_id: t.id, auteur_code: myCode, auteur_nom: myNom, auteur_email: myEmail, message: txt, type: 'message' })
    await supabase.from('taches').update({ derniere_activite: new Date().toISOString() }).eq('id', t.id)
    if ((t.ticket_statut || 'nouveau') === 'nouveau') {
      await supabase.from('taches').update({ ticket_statut: 'en_cours' }).eq('id', t.id)
      await supabase.from('tickets_messages').insert({ tache_id: t.id, auteur_code: myCode, type: 'systeme', message: `Statut : Nouveau → En cours (1re réponse de ${myCode})` })
      setT(x => ({ ...x, ticket_statut: 'en_cours' }))
    }
    // Alerte : concernés sauf auteur
    const concernes = [...new Set([(t.gestionnaire||'').toUpperCase(), (t.cree_par||'').toUpperCase(), ...parts].filter(c => c && c !== myCode))]
    const emails = emailsOf(concernes)
    if (emails.length) envoyerAlerte(emails, `[#${t.id}] 💬 Suivi${t.titre ? ' — ' + (t.titre || '').slice(0, 60) : ''}`, mailTicket(t, `Bonjour,<br>${myCode} a écrit un message sur ce ticket :<br><i>"${txt.slice(0,200)}"</i>`, filRecentHtml(), true))
    if (auClient && cli?.email) { const nomCli = [cli.prenom, cli.nom].filter(Boolean).join(' '); envoyerAlerte([cli.email], `Ticket [#${t.id}] — ${t.titre}`, mailClient(nomCli, txt)) }
    setReply(''); setAuClient(false); setSending(false); await loadMsgs(); onChanged()
  }

  const attachFiles = async (fileList) => {
    const arr = Array.from(fileList || [])
    if (!arr.length) return
    setUpBusy(true)
    try {
      for (const file of arr) await uploadPiece(t.id, file, { code: myCode, nom: myNom, email: myEmail })
      await supabase.from('taches').update({ derniere_activite: new Date().toISOString() }).eq('id', t.id)
      const concernes = [...new Set([(t.gestionnaire || '').toUpperCase(), (t.cree_par || '').toUpperCase(), ...parts].filter(c => c && c !== myCode))]
      const emails = emailsOf(concernes)
      if (emails.length) envoyerAlerte(emails, `[#${t.id}] 📎 Pièce jointe${t.titre ? ' — ' + (t.titre || '').slice(0, 60) : ''}`, mailTicket(t, `Bonjour,<br>${myCode} a ajouté ${arr.length > 1 ? arr.length + ' pièces jointes' : 'une pièce jointe'} au ticket.`, filRecentHtml(), true))
    } catch (e) { alert("Échec de l'envoi de la pièce jointe : " + (e.message || '')) }
    setUpBusy(false); await loadMsgs(); onChanged()
  }

  const changeStatut = async (nk) => {
    const ancien = st(t.ticket_statut).label
    const reouvre = (t.ticket_statut === 'resolu' || t.ticket_statut === 'cloture')
    const extra = reouvre ? { cloture_par: null, date_cloture: null, statut: 'en_cours' } : {}
    await touch({ ticket_statut: nk, ...extra }, `Statut : ${ancien} → ${st(nk).label} (${myCode})`)
  }
  const assigner = async (code) => {
    const c = code ? code.toUpperCase() : null
    const patch = { gestionnaire: c }
    if (c && parts.includes(c)) patch.participants = parts.filter(p => p !== c)
    await touch(patch, c ? `Assigné à ${c} (par ${myCode})` : `Attribution retirée (par ${myCode})`)
  }
  const changerSociete = async (v) => {
    await touch({ entite: v || null }, v ? `Société → ${socLabel(v)} (par ${myCode})` : `Société retirée (par ${myCode})`)
  }
  const parts = Array.isArray(t.participants) ? t.participants.map(x => (x || '').toUpperCase()) : []
  const emailOf = code => { const c = collabs.find(x => (x.code || '').toUpperCase() === (code || '').toUpperCase()); return c?.email || null }
  const emailsOf = codes => codes.map(emailOf).filter(Boolean)
  const addParticipant = async (code) => {
    if (!code) return
    const c = code.toUpperCase()
    if (parts.includes(c) || c === (t.gestionnaire || '').toUpperCase()) return
    const next = [...parts, c]
    await touch({ participants: next }, `${c} ajouté aux participants (par ${myCode})`)
  }
  const removeParticipant = async (code) => {
    const c = (code || '').toUpperCase()
    const next = parts.filter(x => x !== c)
    await touch({ participants: next }, `${c} retiré des participants (par ${myCode})`)
  }
  const cloturer = async () => {
    await touch({ ticket_statut: 'cloture', cloture_par: myCode, statut: 'terminee', date_cloture: new Date().toISOString() }, `Ticket clôturé par ${myCode}`)
  }
  const resoudre = async () => {
    await touch({ ticket_statut: 'resolu', cloture_par: myCode, statut: 'terminee', date_cloture: new Date().toISOString() }, `Ticket marqué Résolu (clôturé) par ${myCode}`)
  }
  const setEcheance = async (v) => {
    await touch({ ticket_echeance: v || null }, v ? `Échéance fixée au ${fmtD(v)} (par ${myCode})` : `Échéance retirée (par ${myCode})`)
  }

  const s = st(t.ticket_statut), p = pr(t.priorite)
  const canManage = isAdmin || (t.gestionnaire || '').toUpperCase() === myCode
  const estClos = t.ticket_statut === 'resolu' || t.ticket_statut === 'cloture'
  const enRetard = !estClos && t.ticket_echeance && new Date(t.ticket_echeance) < new Date(new Date().toDateString())
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('do') === 'resolve' && String(q.get('ticket')) === String(t.id)) {
      q.delete('do'); window.history.replaceState({}, '', window.location.pathname + (q.toString() ? '?' + q.toString() : ''))
      if (canManage && !estClos && window.confirm('Clôturer ce ticket (le passer en Résolu) ?')) resoudre()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Overlay onClose={onClose} wide>
      {/* En-tête */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.textL }}>#{t.id}</span>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.col }} /><span style={{ fontSize: 11, color: p.col, fontWeight: 700 }}>{p.label}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: C.bg, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{t.priorite === 'urgente' && <span style={URGENT_STYLE}>URGENT</span>}{t.titre}</div>
        <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>{t.ticket_categorie} · ouvert par {codeLabel(t.cree_par)}</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: C.textM, marginTop: 8 }}>
          <span>📅 Créé le <b>{fmtD(t.date_creation || t.created_at)}</b></span>
          {estClos
            ? <span>✅ Résolu le <b>{fmtD(t.date_cloture)}</b>{joursEntre(t.date_creation || t.created_at, t.date_cloture) != null ? <> · traité en <b>{joursEntre(t.date_creation || t.created_at, t.date_cloture)} j</b></> : null}</span>
            : <span>⏳ Ouvert depuis <b>{joursEntre(t.date_creation || t.created_at, new Date()) ?? 0} j</b></span>}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>🎯 Échéance&nbsp;:
            {canManage && !estClos
              ? <input type="date" value={t.ticket_echeance || ''} onChange={e => setEcheance(e.target.value)} style={{ ...S.input, width: 'auto', padding: '3px 6px', fontSize: 12 }} />
              : <b>{t.ticket_echeance ? fmtD(t.ticket_echeance) : '—'}</b>}
            {enRetard && <span style={{ background: C.danger, color: '#fff', fontWeight: 800, fontSize: 10, padding: '2px 7px', borderRadius: 6 }}>EN RETARD</span>}
          </span>
        </div>
      </div>

      {/* Statut — pleine largeur, coloré (Résolu = clôture auto) */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 20px', background: '#fff', borderBottom: `1px solid #EEF1F6` }}>
        {STATUTS.filter(x => x.k !== 'cloture').map(x => {
          const active = t.ticket_statut === x.k || (x.k === 'resolu' && t.ticket_statut === 'cloture')
          const col = STATUT_BAR[x.k]
          return (
            <button key={x.k} onClick={() => { if (!canManage || active) return; if (x.k === 'resolu') resoudre(); else changeStatut(x.k) }} disabled={!canManage} style={{ flex: 1, padding: '9px 6px', borderRadius: 8, border: `1.5px solid ${col}`, background: active ? col : '#fff', color: active ? '#fff' : col, fontWeight: 700, fontSize: 12, cursor: canManage ? 'pointer' : 'default', opacity: (!active && !canManage) ? 0.4 : 1 }}>{x.label}</button>
          )
        })}
      </div>

      {/* Assigné + Société */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 20px', background: '#fff', borderBottom: `1px solid #EEF1F6`, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: C.textL, fontWeight: 700 }}>Assigné</span>
          {canManage ? (
            <select style={{ ...S.input, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={t.gestionnaire || ''} onChange={e => assigner(e.target.value)}>
              <option value="">— À attribuer —</option>
              {collabs.map(c => <option key={c.code} value={c.code}>{c.nom_complet}</option>)}
            </select>
          ) : <b style={{ fontSize: 13, color: t.gestionnaire ? NAVY : C.danger }}>{t.gestionnaire ? codeLabel(t.gestionnaire) : '⚠ personne'}</b>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', color: C.textL, fontWeight: 700 }}>Société</span>
          {canManage ? (
            <select style={{ ...S.input, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={t.entite || ''} onChange={e => changerSociete(e.target.value)}>
              <option value="">— Société —</option>
              {SOCIETES.map(so => <option key={so.k} value={so.k}>{so.label}</option>)}
            </select>
          ) : <b style={{ fontSize: 13, color: t.entite ? MID : C.danger }}>{t.entite ? socLabel(t.entite) : '⚠ aucune'}</b>}
        </div>
      </div>

      {/* Participants */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 20px', background: '#fff', borderBottom: `1px solid #EEF1F6`, alignItems: 'center' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', color: C.textL, fontWeight: 700 }}>Participants</span>
        {parts.map(pc => (
          <span key={pc} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E3F2FD', color: '#1565C0', borderRadius: 14, padding: '4px 11px', fontSize: 12, fontWeight: 600 }}>
            {codeLabel(pc)}
            {!estClos && <span onClick={() => removeParticipant(pc)} title="Retirer du suivi" style={{ cursor: 'pointer', color: '#1565C0', fontWeight: 700 }}>×</span>}
          </span>
        ))}
        {parts.length === 0 && <span style={{ fontSize: 12, color: C.textL }}>aucun</span>}
        {!estClos && (
          <select style={{ ...S.input, width: 'auto', padding: '4px 8px', fontSize: 12 }} value="" onChange={e => { addParticipant(e.target.value); e.target.value = '' }}>
            <option value="">+ Ajouter…</option>
            {collabs.filter(c => !parts.includes((c.code || '').toUpperCase()) && (c.code || '').toUpperCase() !== (t.gestionnaire || '').toUpperCase()).map(c => <option key={c.code} value={c.code}>{c.nom_complet}</option>)}
          </select>
        )}
      </div>

      {/* Description initiale */}
      {t.description && <div style={{ padding: '12px 20px', fontSize: 13, color: '#2D3748', borderBottom: `1px solid #EEF1F6`, background: '#fff' }}>{t.description}</div>}

      {/* Barre historique */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 20px', background: '#fff', borderBottom: `1px solid #EEF1F6`, alignItems: 'center' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', color: C.textL, fontWeight: 700, marginRight: 4 }}>Historique</span>
        {[['tout', 'Tout'], ['conversation', 'Conversation'], ['historique', 'Journal']].map(([k, lbl]) => (
          <button key={k} onClick={() => setFilFiltre(k)} style={{ border: `1px solid ${filFiltre === k ? MID : C.border}`, background: filFiltre === k ? MID : '#fff', color: filFiltre === k ? '#fff' : C.textM, borderRadius: 14, padding: '3px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{lbl}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: C.bg, minHeight: 200 }}>
        {loadingMsgs ? <div style={{ textAlign: 'center', color: C.textL }}>…</div> : (msgs.filter(m => filFiltre === 'tout' ? true : filFiltre === 'conversation' ? (m.type === 'message' || m.type === 'email') : (m.type !== 'message' && m.type !== 'email')).length === 0 ? <div style={{ textAlign: 'center', color: C.textL, fontSize: 12, paddingTop: 20 }}>Rien à afficher ici.</div> : msgs.filter(m => filFiltre === 'tout' ? true : filFiltre === 'conversation' ? (m.type === 'message' || m.type === 'email') : (m.type !== 'message' && m.type !== 'email')).map(m => {
          if (m.type === 'systeme') return <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', margin: '5px 0', color: C.textL, fontSize: 12 }}><span style={{ color: MID }}>•</span><span style={{ flex: 1 }}>{m.message}</span><span style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{fmtDT(m.created_at)}</span></div>
          if (m.type === 'piece_jointe') {
            const ownPj = (m.auteur_code || '').toUpperCase() === myCode
            return (
              <div key={m.id} style={{ marginBottom: 14, textAlign: ownPj ? 'right' : 'left' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, justifyContent: ownPj ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{m.auteur_nom || m.auteur_code}</span>
                  <span style={{ fontSize: 10, color: C.textL }}>{fmtDT(m.created_at)}</span>
                </div>
                <div style={{ display: 'inline-block', textAlign: 'left', maxWidth: '80%', background: '#fff', border: `1px solid #EEF1F6`, borderRadius: 10, padding: '9px 12px' }}>
                  <PieceJointe path={m.piece_jointe_path} nom={m.piece_jointe_nom} />
                </div>
              </div>
            )
          }
          const own = (m.auteur_code || '').toUpperCase() === myCode
          return (
            <div key={m.id} style={{ marginBottom: 14, textAlign: own ? 'right' : 'left' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, justifyContent: own ? 'flex-end' : 'flex-start' }}>
                {!own && <span style={{ ...S.avatar, width: 22, height: 22 }}>{(m.auteur_code || '?').slice(0, 3)}</span>}
                <span style={{ fontWeight: 700, fontSize: 12 }}>{m.auteur_nom || m.auteur_code}</span>
                <span style={{ fontSize: 10, color: C.textL }}>{fmtDT(m.created_at)}</span>
                {m.type === 'email' && <span style={{ fontSize: 9, fontWeight: 700, color: '#1565C0', background: '#E3F2FD', borderRadius: 8, padding: '1px 6px' }}>✉ MAIL</span>}
                {own && <span style={{ ...S.avatar, width: 22, height: 22 }}>{(m.auteur_code || '?').slice(0, 3)}</span>}
              </div>
              <div style={{ display: 'inline-block', textAlign: 'left', maxWidth: '80%', background: own ? '#E3F2FD' : '#fff', border: own ? 'none' : `1px solid #EEF1F6`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#2D3748' }}>{m.message}</div>
            </div>
          )
        }))}
      </div>

      {/* Actions bas */}
      {!estClos ? (
        <>
          <div style={{ padding: '10px 16px 0' }}>
            <DropZone compact disabled={upBusy} onFiles={attachFiles} />
            {upBusy && <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>Envoi de la pièce jointe…</div>}
          </div>
          {cli?.email && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px 0', fontSize: 12, color: C.textM, cursor: 'pointer' }}>
              <input type="checkbox" checked={auClient} onChange={e => setAuClient(e.target.checked)} />
              ✉ Envoyer aussi au client ({cli.email})
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
            <input style={{ ...S.input, borderRadius: 20 }} value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }} placeholder="Écrire une réponse…" />
            <button onClick={sendReply} disabled={sending} style={{ ...S.btn('primary'), borderRadius: '50%', width: 42, height: 42, padding: 0, fontSize: 16 }}>➤</button>
          </div>
        </>
      ) : (
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, textAlign: 'center', color: C.textL, fontSize: 13 }}>
          Ticket résolu / clôturé par {t.cloture_par || '—'}{canManage && <button style={{ ...S.btn('ghost'), marginLeft: 12 }} onClick={() => changeStatut('en_cours')}>Rouvrir</button>}
        </div>
      )}
    </Overlay>
  )
}
