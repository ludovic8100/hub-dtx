import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

// ── Coordonnées émetteur Hexagroup (pied de facture) ──
const HEX = {
  nom: 'Hexagroup', siege: 'Chauss\u00e9e de Tongres, 474 \u2013 4450 Juprelle',
  bce: 'BE 1019.092.589', iban: 'BE30 0689 5494 4011', bic: 'GKCCBEBB', email: 'Info@hexagroup.be',
}
// ── Palette du swoosh du logo (bleu \u2192 violet \u2192 magenta \u2192 orange) ──
const STOPS = [[0, [22, 117, 189]], [0.34, [122, 43, 144]], [0.66, [230, 0, 126]], [1, [246, 147, 0]]]
const cVIOLET = '#6E2C91'

const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac'
const eurPDF = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, '.') + ' \u20ac'
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '\u2014'
const today = () => new Date().toISOString().slice(0, 10)

function interp(stops, t) {
  t = Math.max(0, Math.min(1, t))
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1]
    if (t >= p0 && t <= p1) { const u = p1 > p0 ? (t - p0) / (p1 - p0) : 0; return [0, 1, 2].map(k => Math.round(c0[k] + (c1[k] - c0[k]) * u)) }
  }
  return stops[stops.length - 1][1]
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s)
  })
}
async function loadImageDataURL(url) {
  try { const r = await fetch(url); const b = await r.blob(); return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b) }) } catch { return null }
}

const BADGES = {
  a_envoyer: { bg: '#eef1f5', fg: '#64748b', ic: 'ti-clock', tx: '\u00c0 envoyer' },
  envoyee:   { bg: '#fef3c7', fg: '#b45309', ic: 'ti-send', tx: 'Envoy\u00e9e' },
  payee:     { bg: '#dcfce7', fg: '#15803d', ic: 'ti-check', tx: 'Pay\u00e9e' },
}

export default function HexagroupCotisations() {
  const E = ENTITES.hexagroup
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState(null)   // cotisation en cours d'\u00e9dition
  const [form, setForm] = useState(null)

  const charger = async () => {
    setLoading(true)
    const { data } = await supabase.from('hex_cotisations')
      .select('*, membre:hex_membres(*), lignes:hex_cotisations_lignes(*), rappels:hex_cotisations_rappels(*)')
      .eq('annee', annee).order('numero')
    const r = (data || []).map(c => ({ ...c, lignes: (c.lignes || []).sort((a, b) => (a.position || 0) - (b.position || 0)) }))
    setRows(r); setLoading(false)
  }
  useEffect(() => { charger() }, [annee])

  const totalEmis = rows.reduce((s, r) => s + Number(r.total || 0), 0)
  const totalPaye = rows.filter(r => r.statut === 'payee').reduce((s, r) => s + Number(r.total || 0), 0)
  const enAttente = totalEmis - totalPaye
  const taux = totalEmis ? Math.round(totalPaye / totalEmis * 100) : 0

  const basculerPaye = async (r) => {
    const payee = r.statut !== 'payee'
    await supabase.from('hex_cotisations').update({ statut: payee ? 'payee' : 'envoyee', date_paiement: payee ? today() : null }).eq('id', r.id)
    charger()
  }
  const ajouterRappel = async (r) => {
    const note = prompt('Note du rappel (facultatif) :', '')
    if (note === null) return
    await supabase.from('hex_cotisations_rappels').insert({ cotisation_id: r.id, date_rappel: today(), canal: 'email', note })
    if (r.statut === 'a_envoyer') await supabase.from('hex_cotisations').update({ statut: 'envoyee' }).eq('id', r.id)
    charger()
  }

  const nouvelleCampagne = async () => {
    if (!confirm(`Cr\u00e9er la campagne ${annee} pour les membres actifs (en copiant les lignes de ${annee - 1}) ?`)) return
    setBusy(true)
    const { data: mem } = await supabase.from('hex_membres').select('*').eq('actif', true).order('created_at')
    const dejaSet = new Set(rows.map(r => r.membre_id))
    const { data: prev } = await supabase.from('hex_cotisations').select('membre_id, lignes:hex_cotisations_lignes(*)').eq('annee', annee - 1)
    const prevBy = {}; (prev || []).forEach(p => { prevBy[p.membre_id] = p.lignes || [] })
    let seq = rows.length ? Math.max(...rows.map(r => parseInt(String(r.numero).slice(4)) || 0)) : 0
    for (const m of (mem || [])) {
      if (dejaSet.has(m.id)) continue
      seq++
      const numero = `${annee}${String(seq).padStart(2, '0')}`
      const src = prevBy[m.id] || []
      const total = src.reduce((s, l) => s + Number(l.total || 0), 0)
      const { data: cot } = await supabase.from('hex_cotisations').insert({ membre_id: m.id, annee, numero, date_facture: `${annee}-09-01`, statut: 'a_envoyer', total }).select('id').single()
      if (cot && src.length) {
        await supabase.from('hex_cotisations_lignes').insert(src.map((l, i) => ({ cotisation_id: cot.id, position: i, libelle: (l.libelle || '').replaceAll(String(annee - 1), String(annee)), quantite: l.quantite, prix_unitaire: l.prix_unitaire })))
      }
    }
    setBusy(false); charger()
  }

  // ── Édition ──
  const ouvrirEdition = (r) => {
    setEdit(r)
    setForm({
      statut: r.statut, date_facture: r.date_facture || '', date_envoi: r.date_envoi || '', date_paiement: r.date_paiement || '',
      notes: r.notes || '', email: r.membre?.email || '',
      lignes: (r.lignes || []).map(l => ({ libelle: l.libelle || '', quantite: Number(l.quantite || 1), prix_unitaire: Number(l.prix_unitaire || 0) })),
    })
  }
  const setL = (i, k, v) => setForm(p => ({ ...p, lignes: p.lignes.map((l, j) => j === i ? { ...l, [k]: v } : l) }))
  const addL = () => setForm(p => ({ ...p, lignes: [...p.lignes, { libelle: '', quantite: 1, prix_unitaire: 0 }] }))
  const delL = (i) => setForm(p => ({ ...p, lignes: p.lignes.filter((_, j) => j !== i) }))
  const totalForm = () => (form?.lignes || []).reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0)

  const sauverEdition = async () => {
    setBusy(true)
    const total = totalForm()
    if (edit.membre?.id) await supabase.from('hex_membres').update({ email: form.email || null }).eq('id', edit.membre.id)
    await supabase.from('hex_cotisations_lignes').delete().eq('cotisation_id', edit.id)
    if (form.lignes.length) await supabase.from('hex_cotisations_lignes').insert(form.lignes.map((l, i) => ({ cotisation_id: edit.id, position: i, libelle: l.libelle, quantite: Number(l.quantite || 0), prix_unitaire: Number(l.prix_unitaire || 0) })))
    await supabase.from('hex_cotisations').update({
      statut: form.statut, total,
      date_facture: form.date_facture || null, date_envoi: form.date_envoi || null, date_paiement: form.date_paiement || null, notes: form.notes || null,
    }).eq('id', edit.id)
    setBusy(false); setEdit(null); setForm(null); charger()
  }

  // ── Génération PDF (design validé) ──
  const genererPDF = async (r) => {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
    const { jsPDF } = window.jspdf
    const d = new jsPDF()            // mm, A4 portrait (210 x 297)
    const W = 210, LM = 14, RM = 196
    const grad = (x, y, w, h) => { const n = Math.max(4, Math.round(w * 2)); const bw = w / n; for (let i = 0; i < n; i++) { const [cr, cg, cb] = interp(STOPS, i / (n - 1)); d.setFillColor(cr, cg, cb); d.rect(x + i * bw, y, bw + 0.4, h, 'F') } }
    const tri = (p, c) => { d.setFillColor(c[0], c[1], c[2]); d.triangle(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], 'F') }

    // Header : chevrons multicolores coin haut-gauche
    tri([[0, 0], [56, 0], [22, 26]], [230, 0, 126])
    tri([[0, 0], [40, 0], [15, 24]], [122, 43, 144])
    tri([[42, 0], [56, 0], [50, 13]], [246, 147, 0])
    tri([[0, 26], [26, 26], [0, 44]], [22, 117, 189])

    // Tag FACTURE (dégradé) coin haut-droit
    grad(150, 9, RM - 150, 13)
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(15); d.text('FACTURE', RM - 4, 18, { align: 'right' })
    d.setTextColor(30, 30, 40); d.setFontSize(10); d.text(`N\u00b0 ${r.numero}`, RM, 30, { align: 'right' })
    d.setTextColor(110, 110, 120); d.setFont('helvetica', 'normal'); d.setFontSize(9); d.text(`Date : ${fmtD(r.date_facture)}`, RM, 35, { align: 'right' })

    // Logo réel
    const logo = await loadImageDataURL('/hexagroup-logo.jpg')
    if (logo) { try { d.addImage(logo, 'JPEG', LM, 34, 62, 62 * 205 / 1600) } catch (e) { /* */ } }

    // Destinataire
    const m = r.membre || {}
    let y = 62
    d.setTextColor(110, 44, 145); d.setFont('helvetica', 'bold'); d.setFontSize(8); d.text('FACTUR\u00c9 \u00c0', LM, y)
    d.setTextColor(30, 30, 40); d.setFontSize(11); d.text(m.contact || m.societe || '', LM, y + 6)
    d.setFont('helvetica', 'normal'); d.setFontSize(9.5)
    let yy = y + 11
    if (m.societe && m.contact) { d.text(m.societe, LM, yy); yy += 5 }
    d.setTextColor(105, 105, 115)
    if (m.numero_bce) { d.text('TVA ' + m.numero_bce, LM, yy); yy += 5 }
    const adr = [m.adresse, [m.cp, m.ville].filter(Boolean).join(' ')].filter(Boolean).join(' \u2013 ')
    if (adr) { d.text(adr, LM, yy); yy += 5 }
    d.text(`Juprelle, le ${fmtD(r.date_facture)}`, RM, y, { align: 'right' })

    // Tableau
    let ty = 96
    grad(LM, ty, RM - LM, 9)
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(9.5)
    d.text('D\u00e9signation', LM + 3, ty + 6); d.text('Qt\u00e9', 120, ty + 6, { align: 'center' }); d.text('P.U.', 156, ty + 6, { align: 'right' }); d.text('Total', RM - 3, ty + 6, { align: 'right' })
    let ry = ty + 9
    const lignes = r.lignes || []
    lignes.forEach((l, i) => {
      const t = Number(l.quantite || 0) * Number(l.prix_unitaire || 0)
      if (i % 2 === 1) { d.setFillColor(244, 240, 249); d.rect(LM, ry, RM - LM, 9, 'F') }
      d.setTextColor(30, 30, 40); d.setFont('helvetica', 'normal'); d.setFontSize(9.5)
      d.text(String(l.libelle || ''), LM + 3, ry + 6)
      d.text(String(l.quantite), 120, ry + 6, { align: 'center' })
      d.setTextColor(105, 105, 115); d.text(eurPDF(l.prix_unitaire), 156, ry + 6, { align: 'right' })
      d.setTextColor(30, 30, 40); d.setFont('helvetica', 'bold'); d.text(eurPDF(t), RM - 3, ry + 6, { align: 'right' })
      ry += 9
    })

    // Totaux
    let yt = ry + 8
    d.setFont('helvetica', 'normal'); d.setFontSize(9.5); d.setTextColor(105, 105, 115)
    d.text('Total HTVA', 120, yt); d.setTextColor(30, 30, 40); d.text(eurPDF(r.total), RM, yt, { align: 'right' })
    d.setTextColor(105, 105, 115); d.text('T.V.A.', 120, yt + 6); d.setTextColor(30, 30, 40); d.text('N.A.', RM, yt + 6, { align: 'right' })
    grad(116, yt + 11, RM - 116, 11)
    d.setTextColor(255, 255, 255); d.setFont('helvetica', 'bold'); d.setFontSize(10.5); d.text('TOTAL \u00c0 PAYER', 120, yt + 18)
    d.setFontSize(13); d.text(eurPDF(r.total), RM - 3, yt + 18.5, { align: 'right' })
    d.setTextColor(110, 44, 145); d.setFont('helvetica', 'italic'); d.setFontSize(10); d.text('\u00c0 payer comptant.', LM, yt + 18)

    // Footer : lames multicolores + coordonnées
    const H = 297
    tri([[0, H], [0, H - 46], [78, H]], [22, 117, 189])
    tri([[0, H], [0, H - 34], [62, H]], [122, 43, 144])
    tri([[0, H], [0, H - 22], [46, H]], [230, 0, 126])
    tri([[0, H], [0, H - 11], [28, H]], [246, 147, 0])
    grad(RM - 34, H - 9, 34, 9)
    d.setTextColor(30, 30, 40); d.setFont('helvetica', 'bold'); d.setFontSize(11); d.text('Merci pour votre confiance.', RM, H - 30, { align: 'right' })
    d.setTextColor(110, 110, 120); d.setFont('helvetica', 'normal'); d.setFontSize(8.5)
    d.text(`IBAN ${HEX.iban}  \u2014  ${HEX.bic}`, RM, H - 22, { align: 'right' })
    d.text(`Si\u00e8ge : ${HEX.siege}`, RM, H - 18, { align: 'right' })
    d.text(`N\u00b0 ${HEX.bce}   \u2022   ${HEX.email}`, RM, H - 14, { align: 'right' })

    d.save(`Cotisation_${HEX.nom}_${r.numero}.pdf`)
  }

  // ── UI ──
  const card = { background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }
  const metric = (label, val, col) => (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: col || '#0f172a' }}>{val}</div>
    </div>
  )
  const ibtn = (icon, label, onClick, col) => (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ width: 30, height: 30, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid #e2e8f0', background: '#fff', borderRadius: 6, cursor: 'pointer', color: col || '#475569' }}>
      <i className={`ti ${icon}`} style={{ fontSize: 16 }} />
    </button>
  )

  return (
    <Layout currentPage="Cotisations">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Cotisations"
          subtitle="Hexagroup ASBL"
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={annee} onChange={e => setAnnee(Number(e.target.value))} style={{ padding: '7px 10px', borderRadius: 8, border: 'none' }}>
                {[annee + 1, annee, annee - 1, annee - 2].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <button onClick={nouvelleCampagne} disabled={busy} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#fff', color: cVIOLET, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                <i className="ti ti-plus" style={{ fontSize: 15, verticalAlign: -2, marginRight: 4 }} />Nouvelle campagne
              </button>
            </div>
          } />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '18px 0' }}>
          {metric('\u00c9mis', eur(totalEmis))}
          {metric('Encaiss\u00e9', eur(totalPaye), '#15803d')}
          {metric('En attente', eur(enAttente), '#b45309')}
          {metric('Recouvrement', taux + ' %')}
        </div>

        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: 66 }} /><col /><col style={{ width: 100 }} /><col style={{ width: 116 }} /><col style={{ width: 72 }} /><col style={{ width: 150 }} /></colgroup>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '11px 12px', fontWeight: 700 }}>N\u00b0</th>
                <th style={{ padding: '11px 12px', fontWeight: 700 }}>Membre</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, textAlign: 'right' }}>Montant</th>
                <th style={{ padding: '11px 12px', fontWeight: 700 }}>Statut</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, textAlign: 'center' }}>Rappels</th>
                <th style={{ padding: '11px 12px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Chargement\u2026</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Aucune cotisation pour {annee}. Utilise \u00ab Nouvelle campagne \u00bb.</td></tr>}
              {rows.map(r => {
                const b = BADGES[r.statut] || BADGES.a_envoyer
                const nbR = (r.rappels || []).length
                return (
                  <tr key={r.id} style={{ borderTop: '0.5px solid #eef2f7' }}>
                    <td style={{ padding: '11px 12px', fontFamily: 'monospace', color: '#64748b' }}>{r.numero}</td>
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.membre?.societe || r.membre?.contact || '\u2014'}</td>
                    <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700 }}>{eur(r.total)}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: b.bg, color: b.fg, padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        <i className={`ti ${b.ic}`} style={{ fontSize: 13 }} />{b.tx}
                      </span>
                      {r.statut === 'payee' && r.date_paiement && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>le {fmtD(r.date_paiement)}</div>}
                    </td>
                    <td style={{ padding: '11px 12px', textAlign: 'center' }}>
                      {nbR > 0
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: nbR >= 2 ? '#dc2626' : '#64748b' }}><i className="ti ti-bell" style={{ fontSize: 14 }} />{nbR}</span>
                        : <span style={{ color: '#cbd5e1' }}>\u2014</span>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {ibtn(r.statut === 'payee' ? 'ti-rotate' : 'ti-check', r.statut === 'payee' ? 'Annuler le paiement' : 'Marquer pay\u00e9', () => basculerPaye(r), r.statut === 'payee' ? '#64748b' : '#15803d')}{' '}
                      {ibtn('ti-bell-plus', 'Ajouter un rappel', () => ajouterRappel(r), '#b45309')}{' '}
                      {ibtn('ti-pencil', '\u00c9diter', () => ouvrirEdition(r))}{' '}
                      {ibtn('ti-file-type-pdf', 'T\u00e9l\u00e9charger le PDF', () => genererPDF(r), cVIOLET)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="ti ti-info-circle" style={{ fontSize: 14 }} />
          Envoi par e-mail (depuis Info@hexagroup.be) et export Word : arrivent prochainement.
        </div>
      </div>

      {/* ── Panneau d'édition ── */}
      {edit && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 60, overflowY: 'auto', padding: '40px 16px' }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 'min(680px,100%)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Cotisation {edit.numero} \u2014 {edit.membre?.societe || edit.membre?.contact}</div>
              <button onClick={() => { setEdit(null); setForm(null) }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}><i className="ti ti-x" /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
              <div><label style={lbl}>Statut</label>
                <select value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value }))} style={inp}>
                  <option value="a_envoyer">\u00c0 envoyer</option><option value="envoyee">Envoy\u00e9e</option><option value="payee">Pay\u00e9e</option>
                </select></div>
              <div><label style={lbl}>Date facture</label><input type="date" value={form.date_facture || ''} onChange={e => setForm(p => ({ ...p, date_facture: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Date envoi</label><input type="date" value={form.date_envoi || ''} onChange={e => setForm(p => ({ ...p, date_envoi: e.target.value }))} style={inp} /></div>
              <div><label style={lbl}>Date paiement</label><input type="date" value={form.date_paiement || ''} onChange={e => setForm(p => ({ ...p, date_paiement: e.target.value }))} style={inp} /></div>
            </div>
            <div style={{ marginBottom: 16 }}><label style={lbl}>E-mail du membre (pour l'envoi)</label>
              <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="nom@societe.be" style={inp} /></div>

            <div style={{ fontWeight: 700, fontSize: 13, margin: '4px 0 8px' }}>Lignes de cotisation</div>
            {form.lignes.map((l, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 90px 30px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input value={l.libelle} onChange={e => setL(i, 'libelle', e.target.value)} placeholder="Cotisation 2026 \u2013 RD" style={inp} />
                <input type="number" value={l.quantite} onChange={e => setL(i, 'quantite', e.target.value)} style={inp} />
                <input type="number" value={l.prix_unitaire} onChange={e => setL(i, 'prix_unitaire', e.target.value)} style={inp} />
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{eur(Number(l.quantite || 0) * Number(l.prix_unitaire || 0))}</div>
                <button onClick={() => delL(i)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}><i className="ti ti-trash" /></button>
              </div>
            ))}
            <button onClick={addL} style={{ marginTop: 4, border: '0.5px dashed #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#475569' }}>
              <i className="ti ti-plus" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} />Ajouter une ligne
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, borderTop: '0.5px solid #eef2f7', paddingTop: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Total : <span style={{ color: cVIOLET }}>{eur(totalForm())}</span></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEdit(null); setForm(null) }} style={{ padding: '9px 16px', borderRadius: 8, border: '0.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
                <button onClick={sauverEdition} disabled={busy} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: cVIOLET, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{busy ? 'Enregistrement\u2026' : 'Enregistrer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const lbl = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }
