import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { useAuth } from '../../lib/auth'

const NAVY = '#0D2F5E', BLUE = '#0080BD'
const OUVERT = ['todo', 'en_cours', 'en_attente', 'retard']
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const ENTS = [['dynassur', 'Dynassur'], ['dtx', 'DTX'], ['lode', 'LODE'], ['hexagroup', 'Hexagroup'], ['prive', 'Privé'], ['groupe', 'Groupe']]
const PRIOS = [['basse', 'Basse'], ['moyenne', 'Moyenne'], ['haute', 'Haute']]

const pad = n => String(n).padStart(2, '0')
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const ekey = t => (t.echeance || '').slice(0, 10)
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtDT = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const isOpen = t => OUVERT.includes(t.statut)

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
function monthMatrix(view) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const startDow = (first.getDay() + 6) % 7
  const cur = new Date(view.getFullYear(), view.getMonth(), 1 - startDow)
  const weeks = []
  for (let w = 0; w < 6; w++) { const week = []; for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1) } weeks.push(week) }
  return weeks
}

const th = { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const td = { padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box' }
const STATUT_LBL = { todo: 'À faire', en_cours: 'En cours', en_attente: 'En attente', retard: 'En retard', terminee: 'Clôturée' }

function Card({ titre, sous, right, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
      {titre && <div style={{ padding: '11px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
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
function Badge({ statut }) {
  const closed = statut === 'terminee'
  const c = closed ? ['#dcfce7', '#15803d'] : statut === 'retard' ? ['#fee2e2', '#b91c1c'] : ['#dbeafe', '#1d4ed8']
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c[0], color: c[1] }}>{STATUT_LBL[statut] || statut}</span>
}
function Pill({ on, onClick, children, col = BLUE }) {
  return <button onClick={onClick} style={{ padding: '5px 13px', borderRadius: 20, border: `2px solid ${on ? col : '#e2e8f0'}`, background: on ? col : '#fff', color: on ? '#fff' : '#64748b', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{children}</button>
}
function Overlay({ onClose, children, w = 560 }) {
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto' }}>
    <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: w, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>{children}</div>
  </div>
}

export default function DynassurTaches() {
  const { perms, isAdmin } = useAuth()
  const myCode = (perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const [loading, setLoading] = useState(true)
  const [taches, setTaches] = useState([])
  const [collabs, setCollabs] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [scope, setScope] = useState('mine')
  const [view, setView] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [selDay, setSelDay] = useState(null)
  const [filtre, setFiltre] = useState('ouvertes')
  const [sel, setSel] = useState(null)         // tâche ouverte en détail
  const [suivi, setSuivi] = useState([]); const [hist, setHist] = useState([]); const [note, setNote] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const blankForm = { titre: '', description: '', echeance: '', priorite: 'moyenne', categorie: '', gestionnaire: myCode, entite: 'dynassur' }
  const [form, setForm] = useState(blankForm)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const t = await loadAll('taches', 'id,titre,description,categorie,statut,priorite,echeance,date_cloture,user_email,source,gestionnaire,cree_par,entite,updated_at,dossier_client,lien_url', q => q.order('echeance', { ascending: true, nullsFirst: false }))
    setTaches(t)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const t = await loadAll('taches', 'id,titre,description,categorie,statut,priorite,echeance,date_cloture,user_email,source,gestionnaire,cree_par,entite,updated_at,dossier_client,lien_url', q => q.order('echeance', { ascending: true, nullsFirst: false }))
      let c = []
      try { c = await loadAll('collaborateurs', 'code,nom_sa_data') } catch (e) { c = [] }
      let u = [], l = []
      if (isAdmin) {
        u = await loadAll('user_permissions', 'nom,user_email,actif,date_envoi_acces,premiere_connexion,derniere_connexion', q => q.order('nom', { nullsFirst: false }))
        try { const { data } = await supabase.from('connexions_log').select('user_email,connecte_a').order('connecte_a', { ascending: false }).limit(20); l = data || [] } catch (e) { l = [] }
      }
      if (alive) { setTaches(t); setCollabs(c); setUsers(u); setLogs(l); setLoading(false) }
    })()
    return () => { alive = false }
  }, [isAdmin])

  // ── filtrage par utilisateur (assigné OU créateur) ──
  const mine = (isAdmin && scope === 'all') ? taches : taches.filter(t => (t.gestionnaire || '').toUpperCase() === myCode || (t.cree_par || '').toUpperCase() === myCode)
  const todayKey = key(new Date())
  const open = mine.filter(isOpen)
  const retard = open.filter(t => ekey(t) && ekey(t) < todayKey)
  const cloturees = mine.filter(t => t.statut === 'terminee')
  const parJour = {}; mine.forEach(t => { const k = ekey(t); if (k) (parJour[k] = parJour[k] || []).push(t) })

  // liste de droite selon le filtre (boutons)
  let liste = []
  if (filtre === 'ouvertes') liste = open
  else if (filtre === 'retard') liste = retard
  else if (filtre === 'cloturees') liste = cloturees
  else liste = mine
  const grp = { 'En retard': [], 'Aujourd’hui': [], 'À venir': [], 'Sans échéance': [], 'Clôturées': [] }
  liste.forEach(t => {
    if (t.statut === 'terminee') grp['Clôturées'].push(t)
    else { const k = ekey(t); if (!k) grp['Sans échéance'].push(t); else if (k < todayKey) grp['En retard'].push(t); else if (k === todayKey) grp['Aujourd’hui'].push(t); else grp['À venir'].push(t) }
  })

  async function openTask(t) {
    setSel(t); setSuivi([]); setHist([]); setNote('')
    try { const { data } = await supabase.from('taches_suivi').select('*').eq('tache_id', t.id).order('cree_a', { ascending: false }); setSuivi(data || []) } catch (e) {}
    try { const { data } = await supabase.from('taches_historique').select('*').eq('tache_id', t.id).order('a', { ascending: false }); setHist(data || []) } catch (e) {}
  }
  async function logHist(tache_id, action) { try { await supabase.from('taches_historique').insert({ tache_id, action, par: myCode }) } catch (e) {} }

  async function createTask() {
    if (!form.titre.trim()) return
    setBusy(true)
    const payload = { titre: form.titre.trim(), description: form.description || null, echeance: form.echeance || null, priorite: form.priorite, categorie: form.categorie || null, gestionnaire: (form.gestionnaire || myCode).toUpperCase(), cree_par: myCode, entite: form.entite, statut: 'todo', source: 'manuel' }
    const { data, error } = await supabase.from('taches').insert(payload).select().single()
    setBusy(false)
    if (error) { alert('Erreur création : ' + error.message); return }
    if (data) await logHist(data.id, 'Création')
    setShowCreate(false); setForm(blankForm); reload()
  }
  async function closeTask(t) {
    setBusy(true)
    const now = new Date().toISOString()
    const { error } = await supabase.from('taches').update({ statut: 'terminee', date_cloture: now, updated_at: now }).eq('id', t.id)
    setBusy(false)
    if (error) { alert('Erreur clôture : ' + error.message); return }
    await logHist(t.id, 'Clôture')
    setSel(s => s && s.id === t.id ? { ...s, statut: 'terminee', date_cloture: now } : s); reload()
  }
  async function reopenTask(t) {
    setBusy(true)
    const now = new Date().toISOString()
    await supabase.from('taches').update({ statut: 'todo', date_cloture: null, updated_at: now }).eq('id', t.id)
    setBusy(false); await logHist(t.id, 'Réouverture')
    setSel(s => s && s.id === t.id ? { ...s, statut: 'todo', date_cloture: null } : s); reload()
  }
  async function addSuivi() {
    if (!note.trim() || !sel) return
    setBusy(true)
    const { data, error } = await supabase.from('taches_suivi').insert({ tache_id: sel.id, auteur: myCode, note: note.trim() }).select().single()
    try { await supabase.from('taches').update({ updated_at: new Date().toISOString() }).eq('id', sel.id) } catch (e) {}
    setBusy(false)
    if (error) { alert('Suivi non enregistré : ' + error.message); return }
    setSuivi(s => [data, ...s]); setNote(''); await logHist(sel.id, 'Suivi ajouté')
  }

  const codeLabel = c => { const m = collabs.find(x => (x.code || '').toUpperCase() === (c || '').toUpperCase()); return c ? `${c}${m && m.nom_sa_data ? ' · ' + m.nom_sa_data : ''}` : '—' }
  const usersAcces = users.filter(u => u.date_envoi_acces || u.premiere_connexion)

  return (
    <Layout currentPage="Tâches">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title="Tâches" subtitle={isAdmin ? 'Calendrier, suivi et connexions' : `Tes tâches${myCode ? ` — ${myCode}` : ''}`}
          action={<button onClick={() => { setForm({ ...blankForm, gestionnaire: myCode }); setShowCreate(true) }} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#fff', color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>+ Nouvelle tâche</button>} />

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div> : <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
            <Kpi label="Ouvertes" value={open.length} col="#f59e0b" />
            <Kpi label="En retard" value={retard.length} col="#dc2626" />
            <Kpi label="Clôturées" value={cloturees.length} col="#16a34a" />
            {isAdmin && <Kpi label="Accès en attente" value={usersAcces.filter(u => !u.premiere_connexion).length} col={BLUE} />}
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Portée :</span>
              <Pill on={scope === 'mine'} onClick={() => setScope('mine')} col={NAVY}>Mes tâches</Pill>
              <Pill on={scope === 'all'} onClick={() => setScope('all')} col={NAVY}>Toutes</Pill>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
            {/* ── Calendrier ── */}
            <div>
              <Card titre={`${MOIS[view.getMonth()]} ${view.getFullYear()}`}
                right={<div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} style={navBtn}>‹</button>
                  <button onClick={() => { const d = new Date(); setView(new Date(d.getFullYear(), d.getMonth(), 1)); setSelDay(new Date(d.getFullYear(), d.getMonth(), d.getDate())) }} style={{ ...navBtn, width: 'auto', padding: '0 10px', fontSize: 12 }}>Auj.</button>
                  <button onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} style={navBtn}>›</button>
                </div>}>
                <div style={{ padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                    {JOURS.map(j => <div key={j} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{j}</div>)}
                  </div>
                  {monthMatrix(view).map((week, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
                      {week.map(d => {
                        const k = key(d), inMonth = d.getMonth() === view.getMonth()
                        const dayTasks = (parJour[k] || []); const openCount = dayTasks.filter(isOpen).length
                        const isToday = k === todayKey, isSel = selDay && key(selDay) === k
                        const late = dayTasks.some(t => isOpen(t) && k < todayKey)
                        return (
                          <button key={k} onClick={() => setSelDay(d)} style={{
                            aspectRatio: '1', border: isSel ? `2px solid ${BLUE}` : '1px solid #eef2f7', borderRadius: 8, cursor: 'pointer',
                            background: isToday ? '#eff6ff' : inMonth ? '#fff' : '#fafafa', color: inMonth ? '#334155' : '#cbd5e1',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2, position: 'relative',
                          }}>
                            <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600 }}>{d.getDate()}</span>
                            {openCount > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: late ? '#dc2626' : BLUE, borderRadius: 10, padding: '0 5px', minWidth: 14 }}>{openCount}</span>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Détail du jour sélectionné */}
              {selDay && (
                <Card titre={`Tâches du ${selDay.toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}`} sous={`${(parJour[key(selDay)] || []).length} tâche(s)`}>
                  <div style={{ padding: 8 }}>
                    {(parJour[key(selDay)] || []).length === 0 && <div style={{ color: '#94a3b8', padding: 12, fontSize: 13 }}>Aucune tâche ce jour.</div>}
                    {(parJour[key(selDay)] || []).map(t => <TaskRow key={t.id} t={t} onClick={() => openTask(t)} codeLabel={codeLabel} />)}
                  </div>
                </Card>
              )}
            </div>

            {/* ── Liste de droite ── */}
            <div>
              <Card titre="Toutes les tâches"
                right={null}>
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
                      {arr.map(t => <TaskRow key={t.id} t={t} onClick={() => openTask(t)} codeLabel={codeLabel} showDate />)}
                    </div>
                  ))}
                  {liste.length === 0 && <div style={{ color: '#94a3b8', padding: 16, fontSize: 13 }}>Aucune tâche.</div>}
                </div>
              </Card>
            </div>
          </div>

          {/* ── Sections admin (onboarding + connexions) ── */}
          {isAdmin && scope === 'all' && (
            <Card titre="Suivi des accès & connexions" sous="Tâche créée à l'envoi des accès, clôturée à la 1ʳᵉ connexion.">
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Utilisateur</th><th style={th}>Accès envoyés</th><th style={th}>1ʳᵉ connexion</th><th style={th}>Dernière</th></tr></thead>
                <tbody>
                  {usersAcces.map(u => <tr key={u.user_email}><td style={td}><b style={{ color: NAVY }}>{u.nom || u.user_email}</b><div style={{ fontSize: 11, color: '#94a3b8' }}>{u.user_email}</div></td><td style={td}>{fmtD(u.date_envoi_acces)}</td><td style={td}>{fmtD(u.premiere_connexion)}</td><td style={td}>{fmtD(u.derniere_connexion)}</td></tr>)}
                  {!usersAcces.length && <tr><td style={td} colSpan={4}>Aucun accès envoyé.</td></tr>}
                </tbody>
              </table></div>
            </Card>
          )}
        </>}
      </div>

      {/* ── Modal détail tâche ── */}
      {sel && <Overlay onClose={() => setSel(null)}>
        <div style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div><Badge statut={sel.statut} /><div style={{ fontSize: 19, fontWeight: 800, color: NAVY, marginTop: 8 }}>{sel.titre}</div></div>
            <button onClick={() => setSel(null)} style={{ ...navBtn, border: '1px solid #e2e8f0' }}>✕</button>
          </div>
          {sel.description && <div style={{ fontSize: 14, color: '#475569', marginTop: 10, whiteSpace: 'pre-wrap' }}>{sel.description}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, fontSize: 13 }}>
            <Info l="Assigné à" v={codeLabel(sel.gestionnaire)} />
            <Info l="Attribué par" v={codeLabel(sel.cree_par)} />
            <Info l="Échéance" v={fmtD(sel.echeance)} />
            <Info l="Société" v={(ENTS.find(e => e[0] === sel.entite) || [])[1] || sel.entite || '—'} />
            <Info l="Catégorie" v={sel.categorie || '—'} />
            <Info l="Clôturée le" v={fmtD(sel.date_cloture)} />
            <Info l="Dernière modif." v={fmtDT(sel.updated_at)} />
            <Info l="Priorité" v={(PRIOS.find(p => p[0] === sel.priorite) || [])[1] || sel.priorite || '—'} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {sel.statut === 'terminee'
              ? <button onClick={() => reopenTask(sel)} disabled={busy} style={btn('#64748b')}>Rouvrir</button>
              : <button onClick={() => closeTask(sel)} disabled={busy} style={btn('#16a34a')}>✓ Clôturer</button>}
          </div>

          {/* Suivi */}
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

          {/* Historique */}
          {hist.length > 0 && <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Historique</div>
            {hist.map(h => <div key={h.id} style={{ fontSize: 12, color: '#64748b' }}>• {h.action} — {h.par || '—'} · {fmtDT(h.a)}</div>)}
          </div>}
        </div>
      </Overlay>}

      {/* ── Modal création ── */}
      {showCreate && <Overlay onClose={() => setShowCreate(false)} w={520}>
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
              <Field l="Société"><select value={form.entite} onChange={e => setForm(f => ({ ...f, entite: e.target.value }))} style={inp}>{ENTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            </div>
            <Field l="Catégorie (optionnel)"><input value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} style={inp} /></Field>
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

const navBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: NAVY, lineHeight: 1 }
const btn = (bg, col = '#fff', border = 'none') => ({ padding: '9px 16px', borderRadius: 9, border, background: bg, color: col, fontSize: 14, fontWeight: 700, cursor: 'pointer' })
function Info({ l, v }) { return <div><div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{l}</div><div style={{ color: '#334155', fontWeight: 600 }}>{v}</div></div> }
function Field({ l, children }) { return <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{l}</div>{children}</div> }
function TaskRow({ t, onClick, codeLabel, showDate }) {
  const late = OUVERT.includes(t.statut) && (t.echeance || '').slice(0, 10) && (t.echeance || '').slice(0, 10) < key(new Date())
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid #eef2f7', background: '#fff', cursor: 'pointer', marginBottom: 4 }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.statut === 'terminee' ? '#16a34a' : late ? '#dc2626' : BLUE, flexShrink: 0 }} />
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titre}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>{(t.gestionnaire || '—')}{showDate && t.echeance ? ` · ${fmtD(t.echeance)}` : ''}{t.categorie ? ` · ${t.categorie}` : ''}</span>
    </span>
  </button>
}
