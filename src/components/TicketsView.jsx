import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const NAVY = '#1A3A6B', CYAN = '#29ABE2', MID = '#1E5799'
const C = { bg: '#F4F6F9', white: '#fff', border: '#DDE3ED', textM: '#4A5568', textL: '#8A9BBE', ok: '#27AE60', warn: '#F39C12', danger: '#E74C3C' }

const CATEGORIES = ['Bug hub', 'Demande développement', 'Problème Outlook/M365', 'Demande administrative', 'Autre']
const STATUTS = [
  { k: 'nouveau', label: 'Nouveau', bg: '#E3F2FD', fg: '#1565C0' },
  { k: 'en_cours', label: 'En cours', bg: '#FFF3E0', fg: '#E65100' },
  { k: 'en_attente', label: 'En attente', bg: '#F3E5F5', fg: '#7B1FA2' },
  { k: 'resolu', label: 'Résolu', bg: '#E8F5E9', fg: '#2E7D32' },
  { k: 'cloture', label: 'Clôturé', bg: '#ECEFF1', fg: '#546E7A' },
]
const PRIOS = [
  { k: 'basse', label: 'Basse', col: '#95A5A6' },
  { k: 'moyenne', label: 'Normale', col: '#29ABE2' },
  { k: 'haute', label: 'Haute', col: '#F39C12' },
  { k: 'urgente', label: 'Urgente', col: '#E74C3C' },
]
const st = k => STATUTS.find(s => s.k === k) || STATUTS[0]
const pr = k => PRIOS.find(p => p.k === k) || PRIOS[1]

const fmtDT = d => d ? new Date(d).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
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

export default function TicketsView() {
  const { perms, isAdmin } = useAuth()
  const myCode = (perms?.collab_code || perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const myEmail = (perms?.user_email || '').toLowerCase()
  const myNom = perms?.nom || myCode

  const [tickets, setTickets] = useState([])
  const [collabs, setCollabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('mine')       // mine / unassigned / all
  const [fStatut, setFStatut] = useState('actifs') // actifs / tous / <statut>
  const [fCat, setFCat] = useState('tous')
  const [showCreate, setShowCreate] = useState(false)
  const [sel, setSel] = useState(null)             // ticket ouvert (détail)
  const [mobile, setMobile] = useState(isMobile())

  useEffect(() => { const h = () => setMobile(isMobile()); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const sel = 'id,titre,description,ticket_categorie,ticket_statut,ticket_origine,priorite,gestionnaire,cree_par,cloture_par,user_email,derniere_activite,date_creation,created_at,dossier_client,client_id,participants'
    let all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('taches').select(sel).eq('is_ticket', true).order('derniere_activite', { ascending: false }).range(from, from + 999)
      if (error || !data) break
      all = all.concat(data)
      if (data.length < 1000) break
    }
    setTickets(all)
    let c = []; try { const r = await supabase.from('collaborateurs').select('code,nom_complet,nom_sa_data,actif').eq('actif', true); c = r.data || [] } catch (e) { c = [] }
    setCollabs(c)
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const codeLabel = code => { if (!code) return '—'; const c = collabs.find(x => (x.code || '').toUpperCase() === (code || '').toUpperCase()); return c ? (c.nom_complet || c.nom_sa_data || c.code) : code }

  // Filtrage
  const visibles = tickets.filter(t => {
    const assigne = (t.gestionnaire || '').toUpperCase()
    const auteur = (t.cree_par || '').toUpperCase()
    const parts = Array.isArray(t.participants) ? t.participants.map(x => (x || '').toUpperCase()) : []
    if (scope === 'mine' && !(assigne === myCode || auteur === myCode || parts.includes(myCode))) return false
    if (scope === 'unassigned' && assigne) return false
    // scope 'all' : tout (réservé admin)
    if (fCat !== 'tous' && t.ticket_categorie !== fCat) return false
    if (fStatut === 'actifs' && t.ticket_statut === 'cloture') return false
    else if (fStatut !== 'actifs' && fStatut !== 'tous' && t.ticket_statut !== fStatut) return false
    return true
  })
  const nbUnassigned = tickets.filter(t => !(t.gestionnaire || '')).length

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.textL }}>Chargement des tickets…</div>

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['mine', 'Mes tickets'], ['unassigned', 'À attribuer'], ...(isAdmin ? [['all', 'Tous']] : [])].map(([k, l]) => (
          <button key={k} onClick={() => setScope(k)} style={{ ...S.btn(scope === k ? 'primary' : 'ghost'), padding: '8px 14px', borderRadius: 20, position: 'relative' }}>
            {l}{k === 'unassigned' && nbUnassigned > 0 && <span style={{ background: C.danger, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 5 }}>{nbUnassigned}</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button style={S.btn('primary')} onClick={() => setShowCreate(true)}>+ Nouvelle demande</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select style={{ ...S.input, width: 'auto' }} value={fStatut} onChange={e => setFStatut(e.target.value)}>
          <option value="actifs">Tickets actifs</option>
          <option value="tous">Tous statuts</option>
          {STATUTS.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
        </select>
        <select style={{ ...S.input, width: 'auto' }} value={fCat} onChange={e => setFCat(e.target.value)}>
          <option value="tous">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.textL, alignSelf: 'center' }}>{visibles.length} ticket(s)</span>
      </div>

      {/* Liste */}
      {visibles.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.textL }}>
          Aucun ticket. Cliquez sur « + Nouvelle demande » pour en créer un.
        </div>
      ) : mobile ? (
        <div>{visibles.map(t => <TicketCard key={t.id} t={t} codeLabel={codeLabel} onOpen={() => setSel(t)} />)}</div>
      ) : (
        <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: C.bg, color: C.textM }}>
              {['#', 'Titre', 'Catégorie', 'Statut', 'Créé par', 'Assigné à', 'Maj'].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {visibles.map(t => {
                const s = st(t.ticket_statut), p = pr(t.priorite)
                return (
                  <tr key={t.id} onClick={() => setSel(t)} style={{ borderTop: `1px solid #EEF1F6`, cursor: 'pointer', opacity: t.ticket_statut === 'cloture' ? 0.6 : 1 }}>
                    <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: C.textL, fontWeight: 700 }}>#{t.id}</td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: NAVY }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: p.col, marginRight: 8 }} />{t.titre}</td>
                    <td style={{ padding: '11px 14px', color: C.textL, fontSize: 12 }}>{t.ticket_categorie || '—'}</td>
                    <td style={{ padding: '11px 14px' }}><span style={S.badge(s.bg, s.fg)}>{s.label}</span></td>
                    <td style={{ padding: '11px 14px', fontSize: 12 }}>{t.cree_par || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>{t.gestionnaire ? <span style={S.avatar}>{(t.gestionnaire || '').slice(0, 3)}</span> : <span style={{ color: C.danger, fontWeight: 600, fontSize: 12 }}>⚠ À attribuer</span>}</td>
                    <td style={{ padding: '11px 14px', color: C.textL, fontSize: 12 }}>{rel(t.derniere_activite || t.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateModal collabs={collabs} myCode={myCode} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {sel && <DetailModal ticket={sel} collabs={collabs} codeLabel={codeLabel} myCode={myCode} myNom={myNom} myEmail={myEmail} isAdmin={isAdmin} onClose={() => setSel(null)} onChanged={() => load()} />}
    </div>
  )
}

function TicketCard({ t, codeLabel, onOpen }) {
  const s = st(t.ticket_statut), p = pr(t.priorite)
  return (
    <div onClick={onOpen} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer', opacity: t.ticket_statut === 'cloture' ? 0.65 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: C.textL, fontWeight: 700 }}>#{t.id}</span>
        <span style={S.badge(s.bg, s.fg)}>{s.label}</span>
        <span style={{ marginLeft: 'auto', width: 9, height: 9, borderRadius: '50%', background: p.col }} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 8, color: NAVY }}>{t.titre}</div>
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

function CreateModal({ collabs, myCode, onClose, onCreated }) {
  const [f, setF] = useState({ titre: '', description: '', ticket_categorie: 'Bug hub', priorite: 'moyenne', gestionnaire: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const save = async () => {
    if (!f.titre.trim()) { setErr('Le titre est obligatoire'); return }
    setSaving(true); setErr('')
    try {
      const now = new Date().toISOString()
      const payload = {
        titre: f.titre.trim(), description: f.description || null,
        is_ticket: true, ticket_categorie: f.ticket_categorie, ticket_statut: 'nouveau', ticket_origine: 'interne',
        priorite: f.priorite, gestionnaire: f.gestionnaire ? f.gestionnaire.toUpperCase() : null,
        cree_par: myCode, statut: 'todo', source: 'ticket', derniere_activite: now,
      }
      const { data, error } = await supabase.from('taches').insert(payload).select().single()
      if (error) throw error
      // message système initial
      await supabase.from('tickets_messages').insert({
        tache_id: data.id, auteur_code: myCode, type: 'systeme',
        message: f.gestionnaire ? `Ticket créé et assigné à ${f.gestionnaire.toUpperCase()}` : 'Ticket créé (non attribué)',
      })
      onCreated()
    } catch (e) { setErr('Erreur : ' + (e.message || '')) }
    setSaving(false)
  }
  return (
    <Overlay onClose={onClose}>
      <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, fontSize: 16, fontWeight: 800, color: NAVY }}>Nouvelle demande</div>
      <div style={{ padding: 22, overflowY: 'auto' }}>
        {err && <div style={{ background: '#FDECEA', color: '#721C24', border: '1px solid #F5C6CB', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>{err}</div>}
        <div style={{ marginBottom: 14 }}><label style={S.label}>Titre *</label><input style={S.input} value={f.titre} onChange={e => set('titre', e.target.value)} placeholder="Résumé court de la demande" /></div>
        <div style={{ marginBottom: 14 }}><label style={S.label}>Description</label><textarea style={{ ...S.input, minHeight: 90, resize: 'vertical' }} value={f.description} onChange={e => set('description', e.target.value)} placeholder="Détaille ta demande ou le problème…" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div><label style={S.label}>Catégorie</label><select style={S.input} value={f.ticket_categorie} onChange={e => set('ticket_categorie', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={S.label}>Priorité</label><select style={S.input} value={f.priorite} onChange={e => set('priorite', e.target.value)}>{PRIOS.map(p => <option key={p.k} value={p.k}>{p.label}</option>)}</select></div>
        </div>
        <div><label style={S.label}>Assigner à (optionnel)</label>
          <select style={S.input} value={f.gestionnaire} onChange={e => set('gestionnaire', e.target.value)}>
            <option value="">— Laisser à attribuer —</option>
            {collabs.map(c => <option key={c.code} value={c.code}>{c.nom_complet || c.nom_sa_data || c.code} ({c.code})</option>)}
          </select>
          <div style={{ fontSize: 11, color: C.textL, marginTop: 6 }}>Si tu laisses vide, le ticket ira dans « À attribuer ».</div>
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
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(true)

  const loadMsgs = useCallback(async () => {
    setLoadingMsgs(true)
    const { data } = await supabase.from('tickets_messages').select('*').eq('tache_id', t.id).order('created_at', { ascending: true })
    setMsgs(data || [])
    setLoadingMsgs(false)
  }, [t.id])
  useEffect(() => { loadMsgs() }, [loadMsgs])

  const touch = async (patch, sysMsg) => {
    const now = new Date().toISOString()
    await supabase.from('taches').update({ ...patch, derniere_activite: now }).eq('id', t.id)
    if (sysMsg) await supabase.from('tickets_messages').insert({ tache_id: t.id, auteur_code: myCode, type: 'systeme', message: sysMsg })
    setT(x => ({ ...x, ...patch }))
    await loadMsgs(); onChanged()
  }

  const sendReply = async () => {
    if (!reply.trim()) return
    setSending(true)
    await supabase.from('tickets_messages').insert({ tache_id: t.id, auteur_code: myCode, auteur_nom: myNom, auteur_email: myEmail, message: reply.trim(), type: 'message' })
    await supabase.from('taches').update({ derniere_activite: new Date().toISOString() }).eq('id', t.id)
    setReply(''); setSending(false); await loadMsgs(); onChanged()
  }

  const changeStatut = async (nk) => {
    await touch({ ticket_statut: nk }, `Statut : ${st(t.ticket_statut).label} → ${st(nk).label} (${myCode})`)
  }
  const assigner = async (code) => {
    await touch({ gestionnaire: code ? code.toUpperCase() : null }, code ? `Assigné à ${code.toUpperCase()} (par ${myCode})` : `Attribution retirée (par ${myCode})`)
  }
  const parts = Array.isArray(t.participants) ? t.participants.map(x => (x || '').toUpperCase()) : []
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

  const s = st(t.ticket_statut), p = pr(t.priorite)
  const canManage = isAdmin || (t.gestionnaire || '').toUpperCase() === myCode

  return (
    <Overlay onClose={onClose} wide>
      {/* En-tête */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.textL }}>#{t.id}</span>
          <span style={S.badge(s.bg, s.fg)}>{s.label}</span>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.col }} /><span style={{ fontSize: 11, color: p.col, fontWeight: 700 }}>{p.label}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: C.bg, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{t.titre}</div>
        <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>{t.ticket_categorie} · ouvert par {t.cree_par} · {fmtDT(t.date_creation || t.created_at)}</div>
      </div>

      {/* Chips infos + actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 20px', background: '#FAFBFD', borderBottom: `1px solid #EEF1F6`, alignItems: 'center' }}>
        <div style={{ fontSize: 12 }}>Assigné : <b>{t.gestionnaire ? codeLabel(t.gestionnaire) : '⚠ personne'}</b></div>
        {canManage && (
          <select style={{ ...S.input, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={t.gestionnaire || ''} onChange={e => assigner(e.target.value)}>
            <option value="">— À attribuer —</option>
            {collabs.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
        {canManage && t.ticket_statut !== 'cloture' && (
          <select style={{ ...S.input, width: 'auto', padding: '5px 8px', fontSize: 12 }} value={t.ticket_statut} onChange={e => changeStatut(e.target.value)}>
            {STATUTS.filter(x => x.k !== 'cloture').map(x => <option key={x.k} value={x.k}>{x.label}</option>)}
          </select>
        )}
      </div>

      {/* Participants */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 20px', background: '#FAFBFD', borderBottom: `1px solid #EEF1F6`, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.textM, fontWeight: 600 }}>Participants :</span>
        {parts.length === 0 && <span style={{ fontSize: 12, color: C.textL }}>aucun</span>}
        {parts.map(pc => (
          <span key={pc} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#E3F2FD', color: '#1565C0', borderRadius: 14, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
            {pc}
            {t.ticket_statut !== 'cloture' && <span onClick={() => removeParticipant(pc)} style={{ cursor: 'pointer', color: '#1565C0', fontWeight: 700 }}>×</span>}
          </span>
        ))}
        {t.ticket_statut !== 'cloture' && (
          <select style={{ ...S.input, width: 'auto', padding: '4px 8px', fontSize: 12 }} value="" onChange={e => { addParticipant(e.target.value); e.target.value = '' }}>
            <option value="">+ Ajouter…</option>
            {collabs.filter(c => !parts.includes((c.code || '').toUpperCase()) && (c.code || '').toUpperCase() !== (t.gestionnaire || '').toUpperCase()).map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
        )}
      </div>

      {/* Description initiale */}
      {t.description && <div style={{ padding: '12px 20px', fontSize: 13, color: '#2D3748', borderBottom: `1px solid #EEF1F6`, background: '#fff' }}>{t.description}</div>}

      {/* Fil de suivi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: C.bg, minHeight: 200 }}>
        {loadingMsgs ? <div style={{ textAlign: 'center', color: C.textL }}>…</div> : msgs.map(m => {
          if (m.type === 'systeme') return <div key={m.id} style={{ textAlign: 'center', margin: '10px 0' }}><span style={{ fontSize: 11, color: C.textL, fontStyle: 'italic', border: `1px dashed ${C.border}`, borderRadius: 20, padding: '3px 12px' }}>{m.message}</span></div>
          const own = (m.auteur_code || '').toUpperCase() === myCode
          return (
            <div key={m.id} style={{ marginBottom: 14, textAlign: own ? 'right' : 'left' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, justifyContent: own ? 'flex-end' : 'flex-start' }}>
                {!own && <span style={{ ...S.avatar, width: 22, height: 22 }}>{(m.auteur_code || '?').slice(0, 3)}</span>}
                <span style={{ fontWeight: 700, fontSize: 12 }}>{m.auteur_nom || m.auteur_code}</span>
                <span style={{ fontSize: 10, color: C.textL }}>{fmtDT(m.created_at)}</span>
                {own && <span style={{ ...S.avatar, width: 22, height: 22 }}>{(m.auteur_code || '?').slice(0, 3)}</span>}
              </div>
              <div style={{ display: 'inline-block', textAlign: 'left', maxWidth: '80%', background: own ? '#E3F2FD' : '#fff', border: own ? 'none' : `1px solid #EEF1F6`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#2D3748' }}>{m.message}</div>
            </div>
          )
        })}
      </div>

      {/* Actions bas */}
      {t.ticket_statut !== 'cloture' ? (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
            <input style={{ ...S.input, borderRadius: 20 }} value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }} placeholder="Écrire une réponse…" />
            <button onClick={sendReply} disabled={sending} style={{ ...S.btn('primary'), borderRadius: '50%', width: 42, height: 42, padding: 0, fontSize: 16 }}>➤</button>
          </div>
          {canManage && <div style={{ padding: '0 16px 14px' }}><button style={{ ...S.btn('ok'), width: '100%' }} onClick={cloturer}>✓ Clôturer le ticket</button></div>}
        </>
      ) : (
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, textAlign: 'center', color: C.textL, fontSize: 13 }}>
          Ticket clôturé par {t.cloture_par || '—'}{canManage && <button style={{ ...S.btn('ghost'), marginLeft: 12 }} onClick={() => changeStatut('en_cours')}>Rouvrir</button>}
        </div>
      )}
    </Overlay>
  )
}
