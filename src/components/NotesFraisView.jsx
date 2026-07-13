import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Layout from './Layout'
import { ENTITES } from '../lib/entites'
import { StatBanner } from './ui/AccountableUI'
import { useAuth } from '../lib/auth'

const NAVY = '#0D2F5E'
const KM_TAUX_DEFAUT = 0.4761 // barème belge secteur privé 01/07/2026–30/06/2027 (circ. 767) — ajustable par ligne
const CAT_KM = 'Kilométrique'
const CATEGORIES = ['Repas / restaurant', 'Carburant', CAT_KM, 'Parking / péage', 'Hôtel / déplacement', 'Fournitures', 'Télécom', 'Autre']
const TVA_TAUX = [0, 6, 12, 21]
const STATUTS = {
  brouillon: { label: 'Brouillon', bg: '#f1f5f9', color: '#64748b' },
  validee: { label: 'Validée', bg: '#dcfce7', color: '#16a34a' },
}

const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n }
const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const todayISO = () => new Date().toISOString().slice(0, 10)
const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))
const isKm = l => l.categorie === CAT_KM

function calcLigne(l) {
  if (isKm(l)) {
    const ttc = Math.round(num(l.km_distance) * num(l.km_taux) * 100) / 100
    return { montant_ttc: ttc, taux_tva: 0, montant_tva: 0, montant_ht: ttc }
  }
  const ttc = num(l.montant_ttc), t = num(l.taux_tva)
  const tva = Math.round(ttc * t / (100 + t) * 100) / 100
  return { montant_ttc: ttc, taux_tva: t, montant_tva: tva, montant_ht: Math.round((ttc - tva) * 100) / 100 }
}

// ── styles partagés ──
const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const btn = (bg, col = '#fff', border = 'none') => ({ padding: '9px 16px', borderRadius: 9, border, background: bg, color: col, fontSize: 14, fontWeight: 700, cursor: 'pointer' })
function Card({ titre, sous, right, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 20 }}>
      {titre && <div style={{ padding: '11px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{titre}</div>{sous && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{sous}</div>}</div>
        {right}
      </div>}
      <div style={{ padding: 15 }}>{children}</div>
    </div>
  )
}
function Kpi({ label, value, col }) {
  return <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '12px 16px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
  </div>
}
function Field({ l, children }) { return <div><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{l}</div>{children}</div> }
function Badge({ s }) { const st = STATUTS[s] || STATUTS.brouillon; return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span> }

export default function NotesFraisView({ entiteKey = 'dynassur' }) {
  const { user, perms, isAdmin } = useAuth()
  const myEmail = (user?.email || perms?.user_email || '').toLowerCase()
  const myCode = (perms?.collab_code || (myEmail.split('@')[0] || '')).toUpperCase()
  const myNom = perms?.nom || ''
  const ENT = ENTITES[entiteKey] || ENTITES.dynassur
  const ACCENT = ENT.color

  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState([])
  const [scope, setScope] = useState('mine') // admin : mine | all
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)       // note en cours d'édition (id=null = nouvelle)
  const [lignes, setLignes] = useState([])
  const [busy, setBusy] = useState(false)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('notes_frais').select('*').eq('societe', entiteKey).order('created_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }, [entiteKey])
  useEffect(() => { loadNotes() }, [loadNotes])

  async function openNote(n) {
    const { data } = await supabase.from('notes_frais_lignes').select('*').eq('note_id', n.id).order('ordre', { ascending: true })
    setLignes((data || []).map(l => ({ ...l, _key: l.id })))
    setSel(n)
  }
  function newNote() {
    const periode = new Date().toLocaleDateString('fr-BE', { month: 'long', year: 'numeric' })
    setSel({ id: null, societe: entiteKey, titre: '', periode, statut: 'brouillon', note: '', auteur_email: myEmail, auteur_code: myCode, auteur_nom: myNom })
    setLignes([])
  }
  function addLigne() {
    setLignes(ls => [...ls, { _key: uid(), id: null, date: todayISO(), categorie: '', description: '', montant_ttc: '', taux_tva: 21, km_distance: '', km_taux: KM_TAUX_DEFAUT, justificatif_path: null, justificatif_nom: null }])
  }
  const updLigne = (k, patch) => setLignes(ls => ls.map(l => l._key === k ? { ...l, ...patch } : l))
  const delLigne = async (k) => {
    const l = lignes.find(x => x._key === k)
    if (l?.justificatif_path) { try { await supabase.storage.from('notes-frais').remove([l.justificatif_path]) } catch { } }
    setLignes(ls => ls.filter(x => x._key !== k))
  }
  function setCategorie(k, v) {
    const patch = { categorie: v }
    if (v === CAT_KM) { const cur = lignes.find(l => l._key === k); if (!num(cur?.km_taux)) patch.km_taux = KM_TAUX_DEFAUT }
    updLigne(k, patch)
  }

  async function uploadJustif(k, file) {
    if (!file) return
    const safe = file.name.replace(/[^\w.\-]/g, '_')
    const path = `${entiteKey}/${uid()}-${safe}`
    const { error } = await supabase.storage.from('notes-frais').upload(path, file, { upsert: false, contentType: file.type || undefined })
    if (error) { alert('Upload du justificatif échoué : ' + error.message); return }
    updLigne(k, { justificatif_path: path, justificatif_nom: file.name })
  }
  async function viewJustif(path) {
    const { data, error } = await supabase.storage.from('notes-frais').createSignedUrl(path, 3600)
    if (error || !data?.signedUrl) { alert('Impossible d\u2019ouvrir le justificatif.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function removeJustif(k, path) {
    if (path) { try { await supabase.storage.from('notes-frais').remove([path]) } catch { } }
    updLigne(k, { justificatif_path: null, justificatif_nom: null })
  }

  const calc = lignes.map(l => ({ ...l, ...calcLigne(l) }))
  const totTTC = calc.reduce((s, l) => s + l.montant_ttc, 0)
  const totTVA = calc.reduce((s, l) => s + l.montant_tva, 0)
  const totHT = totTTC - totTVA
  const lockEdit = sel && sel.statut === 'validee'

  async function save(valider = false) {
    if (!sel || busy) return
    if (valider) {
      if (!calc.length) { alert('Ajoutez au moins une ligne avant de valider.'); return }
      const manq = calc.filter(l => !isKm(l) && !l.justificatif_path)
      if (manq.length) { alert(`Validation impossible : ${manq.length} ligne(s) sans justificatif.\n\nChaque ligne doit avoir un justificatif joint, sauf les lignes kilométriques.`); return }
    }
    setBusy(true)
    const head = {
      societe: entiteKey, titre: (sel.titre || '').trim() || null, periode: (sel.periode || '').trim() || null, note: (sel.note || '').trim() || null,
      auteur_email: sel.auteur_email || myEmail, auteur_code: sel.auteur_code || myCode, auteur_nom: sel.auteur_nom || myNom,
      statut: valider ? 'validee' : (sel.statut || 'brouillon'),
    }
    if (valider) head.validee_at = new Date().toISOString()
    let noteId = sel.id
    if (noteId) {
      const { error } = await supabase.from('notes_frais').update(head).eq('id', noteId)
      if (error) { setBusy(false); alert('Erreur (en-tête) : ' + error.message); return }
    } else {
      const { data, error } = await supabase.from('notes_frais').insert(head).select('id').single()
      if (error) { setBusy(false); alert('Erreur (création) : ' + error.message); return }
      noteId = data.id
    }
    await supabase.from('notes_frais_lignes').delete().eq('note_id', noteId)
    if (calc.length) {
      const rows = calc.map((l, i) => ({
        note_id: noteId, date: l.date || null, categorie: l.categorie || null, description: (l.description || '').trim() || null,
        est_km: isKm(l), montant_ttc: l.montant_ttc, taux_tva: l.taux_tva,
        km_distance: isKm(l) ? num(l.km_distance) : null, km_taux: isKm(l) ? num(l.km_taux) : null,
        justificatif_path: l.justificatif_path || null, justificatif_nom: l.justificatif_nom || null, ordre: i,
      }))
      const { error } = await supabase.from('notes_frais_lignes').insert(rows)
      if (error) { setBusy(false); alert('Erreur (lignes) : ' + error.message); return }
    }
    setBusy(false); setSel(null); setLignes([]); loadNotes()
  }

  async function delNote(n) {
    if (!window.confirm('Supprimer définitivement cette note de frais et ses justificatifs ?')) return
    const { data: ls } = await supabase.from('notes_frais_lignes').select('justificatif_path').eq('note_id', n.id)
    const paths = (ls || []).map(x => x.justificatif_path).filter(Boolean)
    if (paths.length) { try { await supabase.storage.from('notes-frais').remove(paths) } catch { } }
    await supabase.from('notes_frais').delete().eq('id', n.id)
    setSel(null); setLignes([]); loadNotes()
  }
  async function rouvrir() {
    if (!sel?.id) return
    await supabase.from('notes_frais').update({ statut: 'brouillon', validee_at: null }).eq('id', sel.id)
    setSel(s => ({ ...s, statut: 'brouillon' })); loadNotes()
  }

  // ── liste filtrée ──
  const visibles = notes.filter(n => {
    if (isAdmin && scope === 'mine' && (n.auteur_email || '').toLowerCase() !== myEmail) return false
    if (q.trim()) {
      const t = q.toLowerCase()
      if (!`${n.titre || ''} ${n.periode || ''} ${n.auteur_nom || ''} ${n.auteur_email || ''}`.toLowerCase().includes(t)) return false
    }
    return true
  })
  const nBrouillon = visibles.filter(n => n.statut === 'brouillon').length
  const nValidee = visibles.filter(n => n.statut === 'validee').length
  const totEnCours = visibles.filter(n => n.statut === 'brouillon').reduce((s, n) => s + Number(n.total || 0), 0)
  const totValide = visibles.filter(n => n.statut === 'validee').reduce((s, n) => s + Number(n.total || 0), 0)

  return (
    <Layout currentPage="Notes de frais">
      <div style={{ padding: '0 4px' }}>
        <StatBanner color={ENT.color} colorDark={ENT.colorDark} logoUrl={ENT.logo}
          title="Notes de frais" subtitle={`${ENT.label || ''}${isAdmin ? '' : myCode ? ` — ${myCode}` : ''}`.trim()} />

        {/* ═══════════ VUE LISTE ═══════════ */}
        {!sel && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '18px 0' }}>
              <Kpi label="Brouillons" value={nBrouillon} col="#64748b" />
              <Kpi label="Validées" value={nValidee} col="#16a34a" />
              <Kpi label="Total en cours" value={eur(totEnCours)} col={ACCENT} />
              <Kpi label="Total validé" value={eur(totValide)} col="#16a34a" />
            </div>

            <Card titre="Mes notes de frais" sous={isAdmin ? 'Admin : vous voyez toutes les notes de cette société.' : 'Vous voyez et gérez vos propres notes.'}
              right={<button onClick={newNote} style={btn(ACCENT)}>+ Nouvelle note</button>}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (titre, période, auteur…)" style={{ ...inp, maxWidth: 300 }} />
                {isAdmin && <div style={{ display: 'flex', gap: 0, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {[['mine', 'Mes notes'], ['all', 'Toutes']].map(([v, l]) => (
                    <button key={v} onClick={() => setScope(v)} style={{ padding: '8px 14px', border: 'none', background: scope === v ? ACCENT : '#fff', color: scope === v ? '#fff' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{l}</button>
                  ))}
                </div>}
              </div>
              {loading ? <div style={{ padding: 20, color: '#94a3b8' }}>Chargement…</div>
                : !visibles.length ? <div style={{ padding: 20, color: '#94a3b8' }}>Aucune note de frais pour le moment.</div>
                  : <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                      <thead><tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px' }}>Titre</th>
                        <th style={{ padding: '8px 10px' }}>Période</th>
                        {isAdmin && scope === 'all' && <th style={{ padding: '8px 10px' }}>Auteur</th>}
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total TTC</th>
                        <th style={{ padding: '8px 10px' }}>Statut</th>
                        <th style={{ padding: '8px 10px' }}>Créée</th>
                        <th style={{ padding: '8px 10px' }}></th>
                      </tr></thead>
                      <tbody>
                        {visibles.map(n => (
                          <tr key={n.id} style={{ borderTop: '1px solid #eef2f7' }}>
                            <td style={{ padding: '9px 10px', fontWeight: 600, color: '#1e293b' }}>{n.titre || <span style={{ color: '#cbd5e1' }}>(sans titre)</span>}</td>
                            <td style={{ padding: '9px 10px', color: '#475569' }}>{n.periode || '—'}</td>
                            {isAdmin && scope === 'all' && <td style={{ padding: '9px 10px', color: '#475569' }}>{n.auteur_nom || n.auteur_code || n.auteur_email}</td>}
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{eur(n.total)}</td>
                            <td style={{ padding: '9px 10px' }}><Badge s={n.statut} /></td>
                            <td style={{ padding: '9px 10px', color: '#94a3b8' }}>{fmtD(n.created_at)}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                              <button onClick={() => openNote(n)} style={{ ...btn('#fff', ACCENT, `1px solid ${ACCENT}`), padding: '5px 12px', fontSize: 12.5 }}>{n.statut === 'validee' ? 'Voir' : 'Ouvrir'}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </Card>
          </>
        )}

        {/* ═══════════ VUE ÉDITION ═══════════ */}
        {sel && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={() => { setSel(null); setLignes([]) }} style={btn('#fff', '#475569', '1px solid #e2e8f0')}>← Retour</button>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{sel.id ? 'Note de frais' : 'Nouvelle note de frais'}</div>
              <Badge s={sel.statut} />
              {sel.id && isAdmin && scope === 'all' && sel.auteur_email?.toLowerCase() !== myEmail &&
                <span style={{ fontSize: 12, color: '#64748b' }}>· {sel.auteur_nom || sel.auteur_email}</span>}
            </div>

            {lockEdit && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Note validée le {fmtD(sel.validee_at)} — lecture seule.</span>
              <button onClick={rouvrir} style={{ ...btn('#fff', '#166534', '1px solid #86efac'), padding: '6px 12px', fontSize: 12.5 }}>Repasser en brouillon</button>
            </div>}

            <Card titre="Informations">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                <Field l="Titre"><input disabled={lockEdit} value={sel.titre || ''} onChange={e => setSel(s => ({ ...s, titre: e.target.value }))} placeholder="Ex : Déplacements juillet" style={inp} /></Field>
                <Field l="Période"><input disabled={lockEdit} value={sel.periode || ''} onChange={e => setSel(s => ({ ...s, periode: e.target.value }))} placeholder="Ex : Juillet 2026" style={inp} /></Field>
                <Field l="Commentaire"><input disabled={lockEdit} value={sel.note || ''} onChange={e => setSel(s => ({ ...s, note: e.target.value }))} style={inp} /></Field>
              </div>
            </Card>

            <Card titre="Lignes de frais" sous="Justificatif obligatoire sur chaque ligne, sauf les lignes kilométriques."
              right={!lockEdit && <button onClick={addLigne} style={btn(ACCENT)}>+ Ajouter une ligne</button>}>
              {!calc.length ? <div style={{ padding: 14, color: '#94a3b8' }}>Aucune ligne. Cliquez sur « Ajouter une ligne ».</div>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {calc.map(l => {
                    const km = isKm(l)
                    const justifManquant = !km && !l.justificatif_path
                    return (
                      <div key={l._key} style={{ border: `1px solid ${justifManquant ? '#fecaca' : '#e2e8f0'}`, borderRadius: 10, padding: 12, background: justifManquant ? '#fff7f7' : '#fff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, alignItems: 'end' }}>
                          <Field l="Date"><input type="date" disabled={lockEdit} value={l.date || ''} onChange={e => updLigne(l._key, { date: e.target.value })} style={inp} /></Field>
                          <Field l="Catégorie">
                            <select disabled={lockEdit} value={l.categorie || ''} onChange={e => setCategorie(l._key, e.target.value)} style={inp}>
                              <option value="">— Choisir —</option>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </Field>
                          <Field l="Description"><input disabled={lockEdit} value={l.description || ''} onChange={e => updLigne(l._key, { description: e.target.value })} style={inp} /></Field>

                          {km ? <>
                            <Field l="Distance (km)"><input disabled={lockEdit} inputMode="decimal" value={l.km_distance ?? ''} onChange={e => updLigne(l._key, { km_distance: e.target.value })} style={inp} /></Field>
                            <Field l="Taux (€/km)"><input disabled={lockEdit} inputMode="decimal" value={l.km_taux ?? ''} onChange={e => updLigne(l._key, { km_taux: e.target.value })} style={inp} /></Field>
                            <Field l="Montant"><div style={{ ...inp, background: '#f8fafc', fontWeight: 700 }}>{eur(l.montant_ttc)}</div></Field>
                          </> : <>
                            <Field l="Montant TTC (€)"><input disabled={lockEdit} inputMode="decimal" value={l.montant_ttc ?? ''} onChange={e => updLigne(l._key, { montant_ttc: e.target.value })} style={inp} /></Field>
                            <Field l="TVA">
                              <select disabled={lockEdit} value={l.taux_tva} onChange={e => updLigne(l._key, { taux_tva: e.target.value })} style={inp}>
                                {TVA_TAUX.map(t => <option key={t} value={t}>{t} %</option>)}
                              </select>
                            </Field>
                            <Field l="HT / TVA"><div style={{ ...inp, background: '#f8fafc', fontSize: 12.5 }}>{eur(l.montant_ht)} <span style={{ color: '#94a3b8' }}>· TVA {eur(l.montant_tva)}</span></div></Field>
                          </>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                          {km ? <span style={{ fontSize: 12, color: '#94a3b8' }}>Ligne kilométrique — aucun justificatif requis.</span>
                            : l.justificatif_path ? <>
                              <span style={{ fontSize: 12.5, color: '#16a34a', fontWeight: 600 }}>✓ {l.justificatif_nom || 'Justificatif joint'}</span>
                              <button onClick={() => viewJustif(l.justificatif_path)} style={{ ...btn('#fff', ACCENT, `1px solid ${ACCENT}`), padding: '4px 10px', fontSize: 12 }}>Voir</button>
                              {!lockEdit && <button onClick={() => removeJustif(l._key, l.justificatif_path)} style={{ ...btn('#fff', '#dc2626', '1px solid #fecaca'), padding: '4px 10px', fontSize: 12 }}>Retirer</button>}
                            </> : <>
                              <span style={{ fontSize: 12.5, color: '#dc2626', fontWeight: 600 }}>Justificatif requis</span>
                              {!lockEdit && <label style={{ ...btn('#fff', ACCENT, `1px solid ${ACCENT}`), padding: '5px 12px', fontSize: 12.5, cursor: 'pointer', display: 'inline-block' }}>
                                Joindre un fichier
                                <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { uploadJustif(l._key, e.target.files?.[0]); e.target.value = '' }} />
                              </label>}
                            </>}
                          <div style={{ flex: 1 }} />
                          {!lockEdit && <button onClick={() => delLigne(l._key)} style={{ ...btn('#fff', '#dc2626', '1px solid #fecaca'), padding: '5px 12px', fontSize: 12.5 }}>Supprimer la ligne</button>}
                        </div>
                      </div>
                    )
                  })}
                </div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total HT</div><div style={{ fontSize: 16, fontWeight: 700 }}>{eur(totHT)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>TVA</div><div style={{ fontSize: 16, fontWeight: 700 }}>{eur(totTVA)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total TTC</div><div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{eur(totTTC)}</div></div>
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 30 }}>
              <div>{sel.id && <button onClick={() => delNote(sel)} style={btn('#fff', '#dc2626', '1px solid #fecaca')}>Supprimer la note</button>}</div>
              {!lockEdit && <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => save(false)} disabled={busy} style={{ ...btn('#fff', NAVY, '1px solid #cbd5e1'), opacity: busy ? .5 : 1 }}>Enregistrer le brouillon</button>
                <button onClick={() => save(true)} disabled={busy} style={{ ...btn('#16a34a'), opacity: busy ? .5 : 1 }}>Valider la note</button>
              </div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
