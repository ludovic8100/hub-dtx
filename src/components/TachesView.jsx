import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Layout from './Layout'
import { ENTITES } from '../lib/entites'
import { StatBanner } from './ui/AccountableUI'
import { useAuth } from '../lib/auth'

const NAVY = '#0D2F5E', BLUE = '#0080BD'
const OUVERT = ['todo', 'en_cours', 'en_attente', 'retard']
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ENTS = [['dynassur', 'Dynassur'], ['dtx', 'DTX'], ['lode', 'LODE'], ['hexagroup', 'Hexagroup'], ['prive', 'Privé'], ['groupe', 'Groupe']]
const PRIOS = [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute']]
const VIEWS = [['sem5', '5j'], ['sem7', '7j'], ['30j', '30j'], ['mois', 'Mois']]
const TAXO = { 'RDV': [], 'Production': ['IARD', 'VIE', 'Santé/DKV', 'Placement', 'Crédit'], 'Sinistre': ['Auto', 'Incendie', 'Autre'], 'Encaissement': [], 'Administratif': [], 'Autre': [] }
const ACC = { dynassur: 'acc_dynassur', dtx: 'acc_dtx', lode: 'acc_lode', hexagroup: 'acc_hexagroup', prive: 'acc_prive', groupe: 'acc_holding' }
const STATUT_STYLE = {
  retard: { bg: '#fee2e2', color: '#dc2626', label: 'En retard' },
  todo: { bg: '#dbeafe', color: '#1d4ed8', label: 'À faire' },
  en_cours: { bg: '#dbeafe', color: '#1d4ed8', label: 'En cours' },
  en_attente: { bg: '#f1f5f9', color: '#64748b', label: 'En attente' },
  terminee: { bg: '#dcfce7', color: '#15803d', label: 'Clôturée' },
}
const RDV_STYLE = { bg: '#ede9fe', color: '#7c3aed', label: 'RDV' }
const SOC = { dynassur: { s: 'DYN', c: '#0080BD' }, dtx: { s: 'DTX', c: '#94a3b8' }, lode: { s: 'LODE', c: '#ea580c' }, hexagroup: { s: 'HEXA', c: '#dc2626' }, prive: { s: 'PRIVÉ', c: '#0d9488' }, groupe: { s: 'GRP', c: '#7c3aed' } }

const pad = n => String(n).padStart(2, '0')
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ekey = t => (t.echeance || '').slice(0, 10)
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtDT = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const isOpen = t => OUVERT.includes(t.statut)
const styleOf = t => t._rdv ? RDV_STYLE : (isOpen(t) && ekey(t) && ekey(t) < key(new Date())) ? STATUT_STYLE.retard : (STATUT_STYLE[t.statut] || STATUT_STYLE.todo)

async function loadAll(table, select, fn) {
  let out = [], from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (fn) q = fn(q)
    const { data, error } = await q.range(from, from + 999)
    if (error || !data || !data.length) break
    out = out.concat(data); if (data.length < 1000) break; from += 1000
  }
  return out
}
function monthMatrix(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const startDow = (first.getDay() + 6) % 7
  const cur = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - startDow)
  const weeks = []
  for (let w = 0; w < 6; w++) { const week = []; for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1) } weeks.push(week) }
  return weeks
}
function periodDays(anchor, mode) {
  const d0 = new Date(anchor)
  if (mode === 'sem7' || mode === 'sem5') {
    const dow = (d0.getDay() + 6) % 7, monday = new Date(d0); monday.setDate(d0.getDate() - dow)
    return Array.from({ length: mode === 'sem5' ? 5 : 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x })
  }
  return Array.from({ length: 30 }, (_, i) => { const x = new Date(d0); x.setDate(d0.getDate() + i); return x })
}

const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box' }
const navBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1 }
const btn = (bg, col = '#fff', border = 'none') => ({ padding: '9px 16px', borderRadius: 9, border, background: bg, color: col, fontSize: 14, fontWeight: 700, cursor: 'pointer' })

function Card({ titre, sous, right, children, id }) {
  return (
    <div id={id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
      {titre && <div style={{ padding: '11px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{titre}</div>{sous && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{sous}</div>}</div>
        {right}
      </div>}
      {children}
    </div>
  )
}
function Kpi({ label, value, col }) {
  return <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '12px 16px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
  </div>
}
function Pill({ on, onClick, children, col = BLUE }) {
  return <button onClick={onClick} style={{ padding: '5px 13px', borderRadius: 20, border: `2px solid ${on ? col : '#e2e8f0'}`, background: on ? col : '#fff', color: on ? '#fff' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{children}</button>
}
function Overlay({ onClose, children, w = 520 }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: w, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>{children}</div>
  </div>
}
function Info({ l, v }) { return <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{l}</div><div style={{ color: '#334155', fontWeight: 600 }}>{v}</div></div> }
function Field({ l, children }) { return <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{l}</div>{children}</div> }

function TaskRow({ t, onClick }) {
  const late = !t._rdv && isOpen(t) && ekey(t) && ekey(t) < key(new Date())
  const st = styleOf(t); const soc = t.entite ? SOC[t.entite] : null
  return <button onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: '1px solid #eef2f7', background: late ? '#fff5f5' : '#fff', cursor: 'pointer', marginBottom: 4 }}>
    <span style={{ minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: late ? 700 : 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titre}</span>
      <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
        {soc && <span style={{ background: soc.c + '1e', color: soc.c, fontWeight: 700, padding: '0 5px', borderRadius: 3, fontSize: 10 }}>{soc.s}</span>}
        {t.gestionnaire && <span>{t.gestionnaire}</span>}
        {(t._rdv ? t.debut : t.echeance) && <span>{t._rdv ? fmtDT(t.debut) : fmtD(t.echeance)}</span>}
        {t.categorie && !t._rdv && <span>• {t.categorie}</span>}
      </span>
    </span>
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
  </button>
}
function DayCell({ d, inMonth, parJour, todayKey, selDay, onPick, onTask, detailed }) {
  const k = key(d), items = parJour[k] || [], openCount = items.filter(x => x._rdv || isOpen(x)).length
  const isToday = k === todayKey, isSel = selDay && key(selDay) === k
  const late = items.some(t => !t._rdv && isOpen(t) && k < todayKey)
  return (
    <div onClick={() => onPick(d)} style={{
      minHeight: detailed ? 110 : undefined, aspectRatio: detailed ? undefined : '1',
      border: isSel ? `2px solid ${BLUE}` : '1px solid #eef2f7', borderRadius: 8, cursor: 'pointer',
      background: isToday ? '#eff6ff' : inMonth ? '#fff' : '#fafafa', color: inMonth ? '#334155' : '#cbd5e1',
      display: 'flex', flexDirection: 'column', alignItems: detailed ? 'stretch' : 'center', justifyContent: detailed ? 'flex-start' : 'center', gap: 3, padding: detailed ? 5 : 2, overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {detailed && <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>{JOURS[(d.getDay() + 6) % 7]}</span>}
        <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600 }}>{d.getDate()}</span>
        {!detailed && openCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: late ? '#dc2626' : BLUE, borderRadius: 10, padding: '0 5px', minWidth: 14, textAlign: 'center' }}>{openCount}</span>}
      </div>
      {detailed && items.slice(0, 4).map(t => { const st = styleOf(t); return (
        <span key={t.id} onClick={e => { e.stopPropagation(); onTask(t) }} title={t.titre}
          style={{ fontSize: 10.5, padding: '2px 5px', borderRadius: 4, background: st.bg, color: st.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{t._rdv ? '📅 ' : ''}{t.titre}</span>
      )})}
      {detailed && items.length > 4 && <span style={{ fontSize: 9, color: '#94a3b8' }}>+{items.length - 4}</span>}
    </div>
  )
}

export default function TachesView({ entiteKey = 'dynassur' }) {
  const { perms, isAdmin } = useAuth()
  const myCode = (perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const myEmail = (perms?.user_email || '').toLowerCase()
  const myEntites = isAdmin ? ENTS.map(e => e[0]) : ENTS.map(e => e[0]).filter(k => perms?.[ACC[k]])
  const ENT = ENTITES[entiteKey] || ENTITES.dynassur
  const isGroupe = entiteKey === 'groupe'
  const rdvEnabled = entiteKey === 'dynassur' || isGroupe
  const inEntite = t => isGroupe ? true : entiteKey === 'dynassur' ? (!t.entite || t.entite === 'dynassur') : t.entite === entiteKey

  const [loading, setLoading] = useState(true)
  const [taches, setTaches] = useState([])
  const [rdvs, setRdvs] = useState([])
  const [collabs, setCollabs] = useState([])
  const [users, setUsers] = useState([])
  const [scope, setScope] = useState('mine')
  const [anchor, setAnchor] = useState(() => new Date())
  const [viewMode, setViewMode] = useState('sem7')
  const [selDay, setSelDay] = useState(null)
  const [filtre, setFiltre] = useState('ouvertes')
  const [sel, setSel] = useState(null)
  const [suivi, setSuivi] = useState([]); const [hist, setHist] = useState([]); const [note, setNote] = useState('')
  const [catEdit, setCatEdit] = useState({ categorie: '', sousCats: [] })
  const [showCreate, setShowCreate] = useState(false)
  const defEntite = isGroupe ? (myEntites[0] || 'dynassur') : entiteKey
  const blankForm = { titre: '', description: '', echeance: '', priorite: 'moyenne', categorie: '', sousCats: [], gestionnaire: myCode, entite: defEntite }
  const [form, setForm] = useState(blankForm)
  const [busy, setBusy] = useState(false)
  const [paramDone, setParamDone] = useState(false)

  const TSEL = 'id,titre,description,categorie,statut,priorite,echeance,date_cloture,user_email,source,gestionnaire,cree_par,entite,updated_at,date_creation,sous_categories,dossier_client,lien_url'
  const reload = useCallback(async () => { setTaches(await loadAll('taches', TSEL, q => q.order('echeance', { ascending: true, nullsFirst: false }))) }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const t = await loadAll('taches', TSEL, q => q.order('echeance', { ascending: true, nullsFirst: false }))
      let r = []
      if (rdvEnabled) {
        try {
          const since = new Date(Date.now() - 31 * 864e5).toISOString()
          let rq = supabase.from('rdv').select('id,objet,debut,categorie,user_email,client_id,web_link,lieu,dossier_client').gte('debut', since).order('debut', { ascending: true }).limit(800)
          if (!isAdmin && myEmail) rq = rq.eq('user_email', myEmail)
          const { data } = await rq; r = data || []
        } catch (e) { r = [] }
      }
      let c = []; try { c = await loadAll('collaborateurs', 'code,nom_sa_data') } catch (e) { c = [] }
      let u = []
      if (isAdmin && entiteKey === 'dynassur') u = await loadAll('user_permissions', 'nom,user_email,actif,date_envoi_acces,premiere_connexion,derniere_connexion', q => q.order('nom', { nullsFirst: false }))
      if (alive) { setTaches(t); setRdvs(r); setCollabs(c); setUsers(u); setLoading(false) }
    })()
    return () => { alive = false }
  }, [isAdmin, myEmail, entiteKey, rdvEnabled])

  const scoped = taches.filter(inEntite)
  const mine = (isAdmin && scope === 'all') ? scoped : scoped.filter(t => (t.gestionnaire || '').toUpperCase() === myCode || (t.cree_par || '').toUpperCase() === myCode)
  const rdvScoped = (isAdmin && scope === 'all') ? rdvs : rdvs.filter(r => (r.user_email || '').toLowerCase() === myEmail)
  const rdvItems = rdvScoped.map(r => ({ _rdv: true, id: 'rdv_' + r.id, titre: r.objet || 'RDV', echeance: (r.debut || '').slice(0, 10), debut: r.debut, statut: 'rdv', categorie: r.categorie || 'RDV', entite: 'dynassur', web_link: r.web_link, lieu: r.lieu, user_email: r.user_email, dossier_client: r.dossier_client }))
  const todayKey = key(new Date())
  const open = mine.filter(isOpen)
  const retard = open.filter(t => ekey(t) && ekey(t) < todayKey)
  const cloturees = mine.filter(t => t.statut === 'terminee')
  const rdvFuturs = rdvItems.filter(r => ekey(r) >= todayKey).sort((a, b) => (a.debut || '').localeCompare(b.debut || ''))
  const calItems = [...mine, ...rdvItems]
  const parJour = {}; calItems.forEach(t => { const k = ekey(t); if (k) (parJour[k] = parJour[k] || []).push(t) })

  let liste = filtre === 'ouvertes' ? open : filtre === 'retard' ? retard : filtre === 'cloturees' ? cloturees : mine
  const grp = { 'En retard': [], 'Aujourd’hui': [], 'À venir': [], 'Sans échéance': [], 'Clôturées': [] }
  liste.forEach(t => {
    if (t.statut === 'terminee') grp['Clôturées'].push(t)
    else { const k = ekey(t); if (!k) grp['Sans échéance'].push(t); else if (k < todayKey) grp['En retard'].push(t); else if (k === todayKey) grp['Aujourd’hui'].push(t); else grp['À venir'].push(t) }
  })

  function shiftPeriod(dir) {
    setSelDay(null)
    if (viewMode === 'mois') setAnchor(a => new Date(a.getFullYear(), a.getMonth() + dir, 1))
    else { const step = viewMode === '30j' ? 30 : 7; setAnchor(a => { const x = new Date(a); x.setDate(a.getDate() + dir * step); return x }) }
  }
  const days = viewMode === 'mois' ? null : periodDays(anchor, viewMode)
  const periodLabel = viewMode === 'mois' ? `${MOIS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : days && days.length ? `${pad(days[0].getDate())}/${pad(days[0].getMonth() + 1)} – ${pad(days[days.length - 1].getDate())}/${pad(days[days.length - 1].getMonth() + 1)}/${days[days.length - 1].getFullYear()}` : ''

  const openTask = useCallback(async t => {
    setSel(t); setSuivi([]); setHist([]); setNote('')
    if (!t._rdv) {
      setCatEdit({ categorie: t.categorie || '', sousCats: t.sous_categories || [] })
      try { const { data } = await supabase.from('taches_suivi').select('*').eq('tache_id', t.id).order('cree_a', { ascending: false }); setSuivi(data || []) } catch (e) {}
      try { const { data } = await supabase.from('taches_historique').select('*').eq('tache_id', t.id).order('a', { ascending: false }); setHist(data || []) } catch (e) {}
    }
    setTimeout(() => document.getElementById('tache-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [])

  useEffect(() => {
    if (paramDone || loading || !taches.length) return
    const id = new URLSearchParams(window.location.search).get('tache')
    if (id) { const t = taches.find(x => String(x.id) === String(id)); if (t) { openTask(t); setParamDone(true) } }
  }, [loading, taches, paramDone, openTask])

  async function logHist(tache_id, action) { try { await supabase.from('taches_historique').insert({ tache_id, action, par: myCode }) } catch (e) {} }
  async function createTask() {
    if (!form.titre.trim()) return
    setBusy(true)
    const payload = { titre: form.titre.trim(), description: form.description || null, echeance: form.echeance || null, priorite: form.priorite, categorie: form.categorie || null, sous_categories: form.sousCats && form.sousCats.length ? form.sousCats : null, gestionnaire: (form.gestionnaire || myCode).toUpperCase(), cree_par: myCode, entite: form.entite, statut: 'todo', source: 'manuel' }
    const { data, error } = await supabase.from('taches').insert(payload).select().single()
    setBusy(false)
    if (error) { alert('Erreur création : ' + error.message); return }
    if (data) await logHist(data.id, 'Création')
    setShowCreate(false); setForm(blankForm); reload()
  }
  async function createTaskFromRdv(r) {
    setBusy(true)
    const payload = { titre: `Suivi RDV : ${r.titre}`, description: `RDV du ${fmtDT(r.debut)}${r.lieu ? ' — ' + r.lieu : ''}`, statut: 'todo', priorite: 'moyenne', categorie: 'RDV', source: 'rdv', gestionnaire: myCode, cree_par: myCode, entite: isGroupe ? 'dynassur' : entiteKey, echeance: r.echeance || null, dossier_client: r.dossier_client || null, lien_url: r.web_link || null }
    const { data, error } = await supabase.from('taches').insert(payload).select().single()
    setBusy(false)
    if (error) { alert('Erreur : ' + error.message); return }
    if (data) { await logHist(data.id, 'Création depuis RDV'); reload(); openTask(data) }
  }
  async function closeTask(t) {
    setBusy(true); const now = new Date().toISOString()
    const { error } = await supabase.from('taches').update({ statut: 'terminee', date_cloture: now, updated_at: now }).eq('id', t.id)
    setBusy(false); if (error) { alert('Erreur clôture : ' + error.message); return }
    await logHist(t.id, 'Clôture'); setSel(null); reload()
  }
  async function reopenTask(t) {
    setBusy(true); const now = new Date().toISOString()
    await supabase.from('taches').update({ statut: 'todo', date_cloture: null, updated_at: now }).eq('id', t.id)
    setBusy(false); await logHist(t.id, 'Réouverture'); setSel(null); reload()
  }
  async function updateCategorie() {
    if (!sel) return
    setBusy(true); const now = new Date().toISOString()
    const sc = catEdit.sousCats && catEdit.sousCats.length ? catEdit.sousCats : null
    const { error } = await supabase.from('taches').update({ categorie: catEdit.categorie || null, sous_categories: sc, updated_at: now }).eq('id', sel.id)
    setBusy(false); if (error) { alert('Erreur : ' + error.message); return }
    await logHist(sel.id, 'Catégorie modifiée'); setSel(s => ({ ...s, categorie: catEdit.categorie || null, sous_categories: sc, updated_at: now })); reload()
  }
  async function addSuivi() {
    if (!note.trim() || !sel) return
    setBusy(true)
    const { data, error } = await supabase.from('taches_suivi').insert({ tache_id: sel.id, auteur: myCode, note: note.trim() }).select().single()
    try { await supabase.from('taches').update({ updated_at: new Date().toISOString() }).eq('id', sel.id) } catch (e) {}
    setBusy(false); if (error) { alert('Suivi non enregistré : ' + error.message); return }
    setSuivi(s => [data, ...s]); setNote(''); await logHist(sel.id, 'Suivi ajouté')
  }

  const codeLabel = c => { const m = collabs.find(x => (x.code || '').toUpperCase() === (c || '').toUpperCase()); return c ? `${c}${m && m.nom_sa_data ? ' · ' + m.nom_sa_data : ''}` : '—' }
  const usersAcces = users.filter(u => u.date_envoi_acces || u.premiere_connexion)
  const auj = new Date()
  const showSoc = isGroupe && myEntites.length > 1

  return (
    <Layout currentPage="Tâches">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={ENT.color} colorDark={ENT.colorDark} logoUrl={ENT.logo}
          title="Tâches" subtitle={`${ENT.label || ''}${isAdmin ? '' : myCode ? ` — ${myCode}` : ''}`.trim()}
          action={<button onClick={() => { setForm({ ...blankForm, gestionnaire: myCode }); setShowCreate(true) }} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#fff', color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Nouvelle tâche</button>} />

        <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, textTransform: 'capitalize', margin: '4px 0 16px' }}>
          {auj.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div> : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
            <Kpi label="Ouvertes" value={open.length} col="#f59e0b" />
            <Kpi label="En retard" value={retard.length} col="#dc2626" />
            <Kpi label="Clôturées" value={cloturees.length} col="#16a34a" />
            {rdvEnabled && <Kpi label="RDV à venir" value={rdvFuturs.length} col="#7c3aed" />}
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Portée :</span>
              <Pill on={scope === 'mine'} onClick={() => setScope('mine')} col={NAVY}>Mes tâches</Pill>
              <Pill on={scope === 'all'} onClick={() => setScope('all')} col={NAVY}>Toutes</Pill>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
            <div>
              <Card titre={periodLabel}
                right={<div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {VIEWS.map(([k, l]) => <Pill key={k} on={viewMode === k} onClick={() => { setViewMode(k); setSelDay(null) }}>{l}</Pill>)}
                  <button onClick={() => shiftPeriod(-1)} style={navBtn}>‹</button>
                  <button onClick={() => { setAnchor(new Date()); setSelDay(new Date()) }} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: 12 }}>Auj.</button>
                  <button onClick={() => shiftPeriod(1)} style={navBtn}>›</button>
                </div>}>
                <div style={{ padding: 12 }}>
                  {viewMode === 'mois' ? <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                      {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{j}</div>)}
                    </div>
                    {monthMatrix(anchor).map((week, wi) => (
                      <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                        {week.map(d => <DayCell key={key(d)} d={d} inMonth={d.getMonth() === anchor.getMonth()} parJour={parJour} todayKey={todayKey} selDay={selDay} onPick={setSelDay} onTask={openTask} />)}
                      </div>
                    ))}
                  </> : (
                    <div style={{ display: 'grid', gridTemplateColumns: viewMode === '30j' ? 'repeat(auto-fill,minmax(120px,1fr))' : `repeat(${days.length},1fr)`, gap: 6 }}>
                      {days.map(d => <DayCell key={key(d)} d={d} inMonth parJour={parJour} todayKey={todayKey} selDay={selDay} onPick={setSelDay} onTask={openTask} detailed />)}
                    </div>
                  )}
                </div>
              </Card>

              {selDay && (
                <Card titre={`${selDay.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}`} sous={`${(parJour[key(selDay)] || []).length} élément(s)`}>
                  <div style={{ padding: 8 }}>
                    {(parJour[key(selDay)] || []).length === 0 && <div style={{ color: '#94a3b8', padding: 12, fontSize: 13 }}>Rien ce jour.</div>}
                    {(parJour[key(selDay)] || []).map(t => <TaskRow key={t.id} t={t} onClick={() => openTask(t)} />)}
                  </div>
                </Card>
              )}
            </div>

            <div>
              <Card titre="Toutes les tâches">
                <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
                  <Pill on={filtre === 'ouvertes'} onClick={() => setFiltre('ouvertes')}>Ouvertes</Pill>
                  <Pill on={filtre === 'retard'} onClick={() => setFiltre('retard')} col="#dc2626">En retard</Pill>
                  <Pill on={filtre === 'cloturees'} onClick={() => setFiltre('cloturees')} col="#16a34a">Clôturées</Pill>
                  <Pill on={filtre === 'toutes'} onClick={() => setFiltre('toutes')} col={NAVY}>Toutes</Pill>
                </div>
                <div style={{ padding: 8, maxHeight: '70vh', overflowY: 'auto' }}>
                  {Object.entries(grp).map(([sec, arr]) => arr.length === 0 ? null : (
                    <div key={sec} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: sec === 'En retard' ? '#dc2626' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 8px' }}>{sec} · {arr.length}</div>
                      {arr.map(t => <TaskRow key={t.id} t={t} onClick={() => openTask(t)} />)}
                    </div>
                  ))}
                  {rdvEnabled && (filtre === 'ouvertes' || filtre === 'toutes') && rdvFuturs.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 8px' }}>Rendez-vous · {rdvFuturs.length}</div>
                      {rdvFuturs.slice(0, 30).map(t => <TaskRow key={t.id} t={t} onClick={() => openTask(t)} />)}
                    </div>
                  )}
                  {liste.length === 0 && rdvFuturs.length === 0 && <div style={{ color: '#94a3b8', padding: 16, fontSize: 13 }}>Aucune tâche.</div>}
                </div>
              </Card>
            </div>
          </div>

          {isAdmin && entiteKey === 'dynassur' && scope === 'all' && (
            <Card titre="Suivi des accès & connexions" sous="Tâche créée à l'envoi des accès, clôturée à la 1ʳᵉ connexion.">
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Utilisateur</th><th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Accès</th><th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>1ʳᵉ cnx</th><th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Dernière</th></tr></thead>
                <tbody>
                  {usersAcces.map(u => <tr key={u.user_email}><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}><b style={{ color: NAVY }}>{u.nom || u.user_email}</b><div style={{ fontSize: 11, color: '#94a3b8' }}>{u.user_email}</div></td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{fmtD(u.date_envoi_acces)}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{fmtD(u.premiere_connexion)}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>{fmtD(u.derniere_connexion)}</td></tr>)}
                  {!usersAcces.length && <tr><td style={{ padding: 12, fontSize: 13, color: '#94a3b8' }} colSpan={4}>Aucun accès envoyé.</td></tr>}
                </tbody>
              </table></div>
            </Card>
          )}

          {sel && (
            <Card id="tache-detail" titre={sel._rdv ? 'Détail du rendez-vous' : 'Détail de la tâche'}
              right={<button onClick={() => setSel(null)} style={navBtn}>✕</button>}>
              <div style={{ padding: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: styleOf(sel).bg, color: styleOf(sel).color }}>{styleOf(sel).label}</span>
                <div style={{ fontSize: 19, fontWeight: 800, color: NAVY, marginTop: 8 }}>{sel.titre}</div>
                {sel._rdv ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 16, fontSize: 13 }}>
                      <Info l="Date" v={fmtDT(sel.debut)} />
                      <Info l="Catégorie" v={sel.categorie || '—'} />
                      <Info l="Lieu" v={sel.lieu || '—'} />
                      <Info l="Agenda" v={sel.user_email || '—'} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                      <button onClick={() => createTaskFromRdv(sel)} disabled={busy} style={btn('#16a34a')}>+ Transformer en tâche</button>
                      {sel.web_link && <a href={sel.web_link} target="_blank" rel="noreferrer" style={{ ...btn(BLUE), textDecoration: 'none', display: 'inline-block' }}>Ouvrir dans Outlook</a>}
                    </div>
                  </>
                ) : (
                  <>
                    {sel.description && <div style={{ fontSize: 14, color: '#475569', marginTop: 10, whiteSpace: 'pre-wrap' }}>{sel.description}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginTop: 16, fontSize: 13 }}>
                      <Info l="Assigné à" v={codeLabel(sel.gestionnaire)} />
                      <Info l="Attribué par" v={codeLabel(sel.cree_par)} />
                      <Info l="Échéance" v={fmtD(sel.echeance)} />
                      <Info l="Société" v={(ENTS.find(e => e[0] === sel.entite) || [])[1] || sel.entite || '—'} />
                      <Info l="Catégorie" v={sel.categorie ? sel.categorie + (sel.sous_categories && sel.sous_categories.length ? ' — ' + sel.sous_categories.join(', ') : '') : '—'} />
                      <Info l="Créée le" v={fmtD(sel.date_creation)} />
                      <Info l="Clôturée le" v={fmtD(sel.date_cloture)} />
                      <Info l="Dernière modif." v={fmtDT(sel.updated_at)} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                      {sel.statut === 'terminee'
                        ? <button onClick={() => reopenTask(sel)} disabled={busy} style={btn('#64748b')}>Rouvrir</button>
                        : <button onClick={() => closeTask(sel)} disabled={busy} style={btn('#16a34a')}>✓ Clôturer</button>}
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Catégorie</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select value={catEdit.categorie} onChange={e => setCatEdit({ categorie: e.target.value, sousCats: [] })} style={{ ...inp, width: 'auto' }}>
                          <option value="">— Aucune —</option>
                          {Object.keys(TAXO).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        {(TAXO[catEdit.categorie] || []).map(scn => { const on = (catEdit.sousCats || []).includes(scn); return <button key={scn} onClick={() => setCatEdit(c => ({ ...c, sousCats: on ? c.sousCats.filter(x => x !== scn) : [...(c.sousCats || []), scn] }))} style={{ padding: '4px 10px', borderRadius: 20, border: `2px solid ${on ? BLUE : '#e2e8f0'}`, background: on ? BLUE : '#fff', color: on ? '#fff' : '#64748b', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{scn}</button> })}
                        <button onClick={updateCategorie} disabled={busy} style={{ ...btn(BLUE), padding: '7px 12px', fontSize: 12 }}>Enregistrer</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Suivi</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ajouter une note de suivi…" style={inp} onKeyDown={e => { if (e.key === 'Enter') addSuivi() }} />
                        <button onClick={addSuivi} disabled={busy || !note.trim()} style={{ ...btn(BLUE), opacity: busy || !note.trim() ? .5 : 1 }}>Ajouter</button>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        {suivi.map(s => <div key={s.id} style={{ borderLeft: `3px solid ${BLUE}`, padding: '4px 10px', marginBottom: 6, background: '#f8fafc', borderRadius: 6 }}>
                          <div style={{ fontSize: 13, color: '#334155' }}>{s.note}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{s.auteur || '—'} · {fmtDT(s.cree_a)}</div>
                        </div>)}
                        {!suivi.length && <div style={{ fontSize: 12, color: '#94a3b8' }}>Aucun suivi pour l'instant.</div>}
                      </div>
                    </div>
                    {hist.length > 0 && <div style={{ marginTop: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Historique</div>
                      {hist.map(h => <div key={h.id} style={{ fontSize: 12, color: '#64748b' }}>• {h.action} — {h.par || '—'} · {fmtDT(h.a)}</div>)}
                    </div>}
                  </>
                )}
              </div>
            </Card>
          )}
        </>}
      </div>

      {showCreate && <Overlay onClose={() => setShowCreate(false)}>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 16 }}>Nouvelle tâche</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field l="Titre"><input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} style={inp} autoFocus /></Field>
            <Field l="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, minHeight: 70, resize: 'vertical' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field l="Échéance"><input type="date" value={form.echeance} onChange={e => setForm(f => ({ ...f, echeance: e.target.value }))} style={inp} /></Field>
              <Field l="Priorité"><select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))} style={inp}>{PRIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field l="Assigné à"><select value={form.gestionnaire} onChange={e => setForm(f => ({ ...f, gestionnaire: e.target.value }))} style={inp}>
                <option value={myCode}>{myCode} (moi)</option>
                {collabs.filter(c => (c.code || '').toUpperCase() !== myCode).map(c => <option key={c.code} value={c.code}>{c.code}{c.nom_sa_data ? ' · ' + c.nom_sa_data : ''}</option>)}
              </select></Field>
              {showSoc && <Field l="Société"><select value={form.entite} onChange={e => setForm(f => ({ ...f, entite: e.target.value }))} style={inp}>{ENTS.filter(([k]) => myEntites.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>}
            </div>
            <Field l="Catégorie">
              <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value, sousCats: [] }))} style={inp}>
                <option value="">— Aucune —</option>
                {Object.keys(TAXO).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            {(TAXO[form.categorie] || []).length > 0 && (
              <Field l={`Sous-catégorie · ${form.categorie} (plusieurs possibles)`}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TAXO[form.categorie].map(sc => {
                    const on = (form.sousCats || []).includes(sc)
                    return <button key={sc} onClick={() => setForm(f => ({ ...f, sousCats: on ? f.sousCats.filter(x => x !== sc) : [...(f.sousCats || []), sc] }))} style={{ padding: '5px 12px', borderRadius: 20, border: `2px solid ${on ? BLUE : '#e2e8f0'}`, background: on ? BLUE : '#fff', color: on ? '#fff' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{sc}</button>
                  })}
                </div>
              </Field>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowCreate(false)} style={btn('#fff', '#475569', '1px solid #e2e8f0')}>Annuler</button>
            <button onClick={createTask} disabled={busy || !form.titre.trim()} style={{ ...btn(BLUE), opacity: busy || !form.titre.trim() ? .5 : 1 }}>Créer</button>
          </div>
        </div>
      </Overlay>}
    </Layout>
  )
}
