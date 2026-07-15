import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Layout from './Layout'
import { ENTITES } from '../lib/entites'
import { StatBanner } from './ui/AccountableUI'
import { useAuth } from '../lib/auth'
import { genererPdfNote } from '../lib/notesFraisPdf'
import { ibanEspace } from '../lib/epc'
import QRCode from 'qrcode'
import SignaturePad from './ui/SignaturePad'

const NAVY = '#0D2F5E'
const KM_TAUX_DEFAUT = 0.4761 // barème belge secteur privé 01/07/2026–30/06/2027 (circ. 767) — ajustable par ligne
const CAT_KM = 'Kilométrique'
const CATEGORIES = ['Repas / restaurant', 'Carburant', CAT_KM, 'Parking / péage', 'Hôtel / déplacement', 'Fournitures', 'Télécom', 'Autre']
const TVA_TAUX = [0, 6, 12, 21]
const STATUTS = {
  brouillon: { label: 'Brouillon', bg: '#f1f5f9', color: '#64748b' },
  soumise: { label: 'Soumise', bg: '#fef3c7', color: '#b45309' },
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
const sheetInp = { border: 'none', borderBottom: '1px solid #e2e8f0', background: 'transparent', padding: '5px 3px', fontSize: 13, color: '#1e293b', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const tdS = { padding: '6px 8px', borderBottom: '1px solid #eef2f7', verticalAlign: 'middle' }
const thS = { padding: '9px 8px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.03em', whiteSpace: 'nowrap' }
const infoLbl = { fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }
const infoVal = { fontSize: 14, fontWeight: 700, color: '#1e293b' }
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
  const [qrUrl, setQrUrl] = useState('')
  const [benefIban, setBenefIban] = useState('')
  const [showSig, setShowSig] = useState(false)
  const [sigImage, setSigImage] = useState('')

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
  const lockEdit = sel && sel.statut !== 'brouillon'

  useEffect(() => {
    setBenefIban(''); setQrUrl('')
    const email = sel?.auteur_email
    if (!email) return
    let ok = true
    supabase.from('user_permissions').select('iban').ilike('user_email', email).maybeSingle()
      .then(({ data }) => { if (ok) setBenefIban((data?.iban || '').trim()) })
    return () => { ok = false }
  }, [sel?.id, sel?.auteur_email])

  useEffect(() => {
    const iban = (benefIban || '').replace(/\s+/g, '').toUpperCase()
    if (!sel || sel.statut !== 'validee' || iban.length < 15) { setQrUrl(''); return }
    const benef = (sel.auteur_nom || myNom || 'Beneficiaire').slice(0, 70)
    const montant = Number(sel.total || totTTC || 0)
    const payload = ['BCD', '002', '1', 'SCT', '', benef, iban, `EUR${montant.toFixed(2)}`, '', '', sel.numero || '', ''].join('\n')
    let ok = true
    QRCode.toDataURL(payload, { margin: 1, width: 260 }).then(u => { if (ok) setQrUrl(u) }).catch(() => { if (ok) setQrUrl('') })
    return () => { ok = false }
  }, [sel?.id, sel?.statut, sel?.numero, sel?.total, benefIban, myNom])

  async function save(mode = 'brouillon', p_sig = null) {
    if (!sel || busy) return
    if (mode === 'soumettre') {
      if (!calc.length) { alert('Ajoutez au moins une ligne avant de soumettre.'); return }
      const manq = calc.filter(l => !isKm(l) && !l.justificatif_path)
      if (manq.length) { alert(`Soumission impossible : ${manq.length} ligne(s) sans justificatif.\n\nChaque ligne doit avoir un justificatif joint, sauf les lignes kilométriques.`); return }
    }
    setBusy(true)
    const head = {
      societe: entiteKey, titre: (sel.titre || '').trim() || null, periode: (sel.periode || '').trim() || null, note: (sel.note || '').trim() || null,
      auteur_email: sel.auteur_email || myEmail, auteur_code: sel.auteur_code || myCode, auteur_nom: sel.auteur_nom || myNom,
      statut: 'brouillon',
    }
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
    if (mode === 'soumettre') {
      const { error: es } = await supabase.rpc('nf_soumettre', { p_note_id: noteId, p_sig_type: 'dessin', p_sig_image: p_sig, p_sig_ref: null })
      if (es) { setBusy(false); alert('Soumission échouée : ' + es.message); return }
    }
    setBusy(false); setShowSig(false); setSigImage(''); setSel(null); setLignes([]); loadNotes()
  }

  function demanderSignature() {
    if (!calc.length) { alert('Ajoutez au moins une ligne avant de soumettre.'); return }
    const manq = calc.filter(l => !isKm(l) && !l.justificatif_path)
    if (manq.length) { alert(`Soumission impossible : ${manq.length} ligne(s) sans justificatif.\n\nChaque ligne doit avoir un justificatif joint, sauf les lignes kilométriques.`); return }
    setSigImage(''); setShowSig(true)
  }

  async function delNote(n) {
    if (!window.confirm('Supprimer définitivement cette note de frais et ses justificatifs ?')) return
    if (n.facture_achat_id) { try { await supabase.rpc('nf_devalider', { p_note_id: n.id }) } catch { } }
    const { data: ls } = await supabase.from('notes_frais_lignes').select('justificatif_path').eq('note_id', n.id)
    const paths = (ls || []).map(x => x.justificatif_path).filter(Boolean)
    if (n.piece_pdf_path) paths.push(n.piece_pdf_path)
    if (paths.length) { try { await supabase.storage.from('notes-frais').remove(paths) } catch { } }
    await supabase.from('notes_frais').delete().eq('id', n.id)
    setSel(null); setLignes([]); loadNotes()
  }
  async function rouvrir() {
    if (!sel?.id) return
    const { error } = await supabase.rpc('nf_devalider', { p_note_id: sel.id })
    if (error) { alert('Erreur : ' + error.message); return }
    setSel(s => ({ ...s, statut: 'brouillon', validee_at: null, facture_achat_id: null })); loadNotes()
  }
  async function telechargerPiece() {
    if (!sel?.piece_pdf_path) { alert('Pi\u00e8ce PDF non disponible.'); return }
    const { data, error } = await supabase.storage.from('notes-frais').createSignedUrl(sel.piece_pdf_path, 3600)
    if (error || !data?.signedUrl) { alert('Impossible d\u2019ouvrir la pi\u00e8ce PDF.'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
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

        {/* ═══════════ VUE ÉDITION (feuille document) ═══════════ */}
        {sel && (
          <div style={{ maxWidth: 920, margin: '18px auto 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={() => { setSel(null); setLignes([]) }} style={btn('#fff', '#475569', '1px solid #e2e8f0')}>← Retour</button>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{sel.numero || (sel.id ? 'Note de frais' : 'Nouvelle note de frais')}</div>
              <Badge s={sel.statut} />
              {sel.id && isAdmin && scope === 'all' && sel.auteur_email?.toLowerCase() !== myEmail &&
                <span style={{ fontSize: 12, color: '#64748b' }}>· {sel.auteur_nom || sel.auteur_email}</span>}
            </div>

            {sel.statut === 'soumise' && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
              Note soumise le {fmtD(sel.soumise_at)} — en attente de validation par un administrateur (lecture seule).
            </div>}
            {sel.statut === 'validee' && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Note validée le {fmtD(sel.validee_at)}{sel.valide_par_nom ? ` par ${sel.valide_par_nom}` : ''} — lecture seule.</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sel.piece_pdf_path && <button onClick={telechargerPiece} style={{ ...btn('#166534'), padding: '6px 12px', fontSize: 12.5 }}>Télécharger la pièce PDF</button>}
                <button onClick={rouvrir} style={{ ...btn('#fff', '#166534', '1px solid #86efac'), padding: '6px 12px', fontSize: 12.5 }}>Repasser en brouillon</button>
              </div>
            </div>}
            {sel.statut === 'brouillon' && sel.refus_motif && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
              <b>Note renvoyée</b>{sel.refus_at ? ` le ${fmtD(sel.refus_at)}` : ''} : {sel.refus_motif}<br />Corrigez puis soumettez à nouveau.
            </div>}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,.07)' }}>

              <div style={{ background: ENT.color, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 54, height: 54, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {ENT.logo ? <img src={ENT.logo} alt="" style={{ maxWidth: '78%', maxHeight: '78%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 26, fontWeight: 800, color: ENT.color }}>{(ENT.label || '?').trim()[0]}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '.01em' }}>NOTE DE FRAIS</div>
                  <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 12.5 }}>Pièce justificative de remboursement</div>
                </div>
                <div style={{ textAlign: 'right', color: '#fff' }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{ENT.label}</div>
                  {sel.numero && <div style={{ fontSize: 12, opacity: .85, marginTop: 2 }}>{sel.numero}</div>}
                </div>
              </div>

              <div style={{ padding: '18px 24px', borderBottom: '1px solid #eef2f7' }}>
                <input disabled={lockEdit} value={sel.titre || ''} onChange={e => setSel(s => ({ ...s, titre: e.target.value }))} placeholder="Intitulé de la note (ex : Frais de juillet)"
                  style={{ ...sheetInp, fontSize: 19, fontWeight: 800, color: NAVY, borderBottom: lockEdit ? '1px solid transparent' : '1px solid #e2e8f0', marginBottom: 14 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 16 }}>
                  <div><div style={infoLbl}>Émetteur</div><div style={infoVal}>{ENT.label}</div></div>
                  <div><div style={infoLbl}>Collaborateur</div><div style={infoVal}>{sel.auteur_nom || myNom || myEmail}</div></div>
                  <div><div style={infoLbl}>Période</div><input disabled={lockEdit} value={sel.periode || ''} onChange={e => setSel(s => ({ ...s, periode: e.target.value }))} placeholder="Ex : Juillet 2026" style={{ ...sheetInp, borderBottom: lockEdit ? '1px solid transparent' : '1px solid #e2e8f0' }} /></div>
                  <div><div style={infoLbl}>Statut</div><div style={{ ...infoVal, display: 'flex', alignItems: 'center', gap: 8 }}><Badge s={sel.statut} />{sel.validee_at && <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>le {fmtD(sel.validee_at)}</span>}</div></div>
                </div>
                <div style={{ marginTop: 14 }}><div style={infoLbl}>Commentaire</div><input disabled={lockEdit} value={sel.note || ''} onChange={e => setSel(s => ({ ...s, note: e.target.value }))} placeholder="Remarque éventuelle" style={{ ...sheetInp, borderBottom: lockEdit ? '1px solid transparent' : '1px solid #e2e8f0' }} /></div>
              </div>

              <div style={{ padding: '16px 24px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Détail des dépenses</div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Un justificatif par ligne (sauf lignes kilométriques).</div>
                </div>
                <div style={{ overflowX: 'auto', border: '1px solid #eef2f7', borderRadius: 10 }}>
                  <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: ENT.color }}>
                        <th style={thS}>Date</th>
                        <th style={thS}>Catégorie</th>
                        <th style={{ ...thS, minWidth: 170 }}>Description</th>
                        <th style={thS}>Montant</th>
                        <th style={thS}>TVA</th>
                        <th style={{ ...thS, textAlign: 'right' }}>HT</th>
                        <th style={{ ...thS, textAlign: 'right' }}>TTC</th>
                        <th style={thS}>Justificatif</th>
                        <th style={{ ...thS, width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {!calc.length && <tr><td colSpan={9} style={{ padding: 18, textAlign: 'center', color: '#94a3b8' }}>Aucune ligne. Ajoutez une première dépense ci-dessous.</td></tr>}
                      {calc.map(l => {
                        const km = isKm(l)
                        const jm = !km && !l.justificatif_path
                        return (
                          <tr key={l._key} style={{ background: jm ? '#fff7f7' : '#fff' }}>
                            <td style={tdS}><input type="date" disabled={lockEdit} value={l.date || ''} onChange={e => updLigne(l._key, { date: e.target.value })} style={{ ...sheetInp, minWidth: 118 }} /></td>
                            <td style={tdS}>
                              <select disabled={lockEdit} value={l.categorie || ''} onChange={e => setCategorie(l._key, e.target.value)} style={{ ...sheetInp, minWidth: 118 }}>
                                <option value="">—</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td style={tdS}><input disabled={lockEdit} value={l.description || ''} onChange={e => updLigne(l._key, { description: e.target.value })} placeholder={km ? 'Trajet' : 'Description'} style={sheetInp} /></td>
                            <td style={tdS}>
                              {km
                                ? <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <input disabled={lockEdit} inputMode="decimal" value={l.km_distance ?? ''} onChange={e => updLigne(l._key, { km_distance: e.target.value })} placeholder="km" style={{ ...sheetInp, width: 46 }} />
                                    <span style={{ color: '#94a3b8', fontSize: 11 }}>×</span>
                                    <input disabled={lockEdit} inputMode="decimal" value={l.km_taux ?? ''} onChange={e => updLigne(l._key, { km_taux: e.target.value })} style={{ ...sheetInp, width: 56 }} />
                                  </div>
                                : <input disabled={lockEdit} inputMode="decimal" value={l.montant_ttc ?? ''} onChange={e => updLigne(l._key, { montant_ttc: e.target.value })} placeholder="0,00" style={{ ...sheetInp, width: 78 }} />}
                            </td>
                            <td style={tdS}>{km ? <span style={{ color: '#cbd5e1' }}>—</span>
                              : <select disabled={lockEdit} value={l.taux_tva} onChange={e => updLigne(l._key, { taux_tva: e.target.value })} style={{ ...sheetInp, width: 62 }}>{TVA_TAUX.map(t => <option key={t} value={t}>{t}%</option>)}</select>}</td>
                            <td style={{ ...tdS, textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{eur(l.montant_ht)}</td>
                            <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{eur(l.montant_ttc)}</td>
                            <td style={tdS}>
                              {km ? <span style={{ color: '#cbd5e1' }}>—</span>
                                : l.justificatif_path
                                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                      <button onClick={() => viewJustif(l.justificatif_path)} title={l.justificatif_nom || 'Justificatif'} style={{ ...btn('#fff', ACCENT, `1px solid ${ACCENT}`), padding: '3px 9px', fontSize: 11.5 }}>📎 Voir</button>
                                      {!lockEdit && <button onClick={() => removeJustif(l._key, l.justificatif_path)} title="Retirer" style={{ ...btn('#fff', '#dc2626', '1px solid #fecaca'), padding: '3px 8px', fontSize: 11.5 }}>✕</button>}
                                    </span>
                                  : (!lockEdit
                                      ? <label style={{ ...btn('#fff', '#dc2626', '1px solid #fecaca'), padding: '4px 10px', fontSize: 11.5, cursor: 'pointer', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                          📎 Joindre
                                          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => { uploadJustif(l._key, e.target.files?.[0]); e.target.value = '' }} />
                                        </label>
                                      : <span style={{ color: '#dc2626', fontSize: 12 }}>manquant</span>)}
                            </td>
                            <td style={{ ...tdS, textAlign: 'center' }}>{!lockEdit && <button onClick={() => delLigne(l._key)} title="Supprimer la ligne" style={{ border: 'none', background: 'transparent', color: '#cbd5e1', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>✕</button>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {!lockEdit && <button onClick={addLigne} style={{ ...btn('#fff', ACCENT, `1px dashed ${ACCENT}`), width: '100%', marginTop: 10, padding: '10px', fontWeight: 700 }}>+ Ajouter une ligne</button>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, padding: '14px 24px 20px', borderTop: '1px solid #eef2f7', flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}><div style={infoLbl}>Total HT</div><div style={{ fontSize: 16, fontWeight: 700 }}>{eur(totHT)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={infoLbl}>TVA</div><div style={{ fontSize: 16, fontWeight: 700 }}>{eur(totTVA)}</div></div>
                <div style={{ textAlign: 'right' }}><div style={infoLbl}>Total à rembourser</div><div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{eur(totTTC)}</div></div>
              </div>
              {sel.statut === 'validee' && (
                <div style={{ borderTop: '1px solid #eef2f7', background: '#f8fafc', padding: '18px 24px', display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Remboursement</div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
                      Bénéficiaire : <b style={{ color: '#1e293b' }}>{sel.auteur_nom || myNom || '—'}</b><br />
                      IBAN : {benefIban ? <b style={{ color: '#1e293b' }}>{ibanEspace(benefIban)}</b> : <b style={{ color: '#dc2626' }}>à renseigner</b>}<br />
                      Communication : <b style={{ color: '#1e293b' }}>{sel.numero || '—'}</b><br />
                      Montant : <b style={{ color: ACCENT }}>{eur(sel.total || totTTC)}</b>
                    </div>
                  </div>
                  {qrUrl
                    ? <div style={{ textAlign: 'center' }}>
                        <img src={qrUrl} alt="QR paiement SEPA" style={{ width: 154, height: 154, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: 6, boxSizing: 'border-box' }} />
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5 }}>Scannez avec votre appli bancaire</div>
                      </div>
                    : <div style={{ maxWidth: 230, fontSize: 12.5, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 12, padding: 14, lineHeight: 1.5 }}>
                        Pas de QR : renseignez l'IBAN du bénéficiaire dans <b>Administration › Utilisateurs</b>, puis rouvrez cette note (le QR s'affiche ici). Pour que le PDF téléchargeable contienne aussi le QR, repassez ensuite la note en brouillon et re-validez.
                      </div>}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <div>{sel.id && sel.statut === 'brouillon' && <button onClick={() => delNote(sel)} style={btn('#fff', '#dc2626', '1px solid #fecaca')}>Supprimer la note</button>}</div>
              {!lockEdit && <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => save('brouillon')} disabled={busy} style={{ ...btn('#fff', NAVY, '1px solid #cbd5e1'), opacity: busy ? .5 : 1 }}>Enregistrer le brouillon</button>
                <button onClick={demanderSignature} disabled={busy} style={{ ...btn('#16a34a'), opacity: busy ? .5 : 1 }}>Soumettre pour validation</button>
              </div>}
            </div>

            {showSig && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
                <div style={{ background: '#fff', borderRadius: 14, padding: 22, width: 'min(520px,100%)', boxShadow: '0 10px 40px rgba(0,0,0,.25)' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Signature — soumission de la note</div>
                  <div style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.5 }}>En signant, vous certifiez que les frais déclarés sont exacts et réellement engagés. Cette signature sera apposée sur la pièce justificative.</div>
                  <SignaturePad width={472} height={170} onChange={setSigImage} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                    <button onClick={() => { setShowSig(false); setSigImage('') }} disabled={busy} style={btn('#fff', '#475569', '1px solid #e2e8f0')}>Annuler</button>
                    <button onClick={() => save('soumettre', sigImage)} disabled={busy || !sigImage} style={{ ...btn('#16a34a'), opacity: (busy || !sigImage) ? .5 : 1 }}>Confirmer et soumettre</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
