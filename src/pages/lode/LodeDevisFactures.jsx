import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE, TVA_TAUX, CGV, DELAI_PAIEMENT_JOURS } from '../../lib/lodeConfig'
import { I18N, CGV_I18N, LANGUES } from '../../lib/lodeI18n'

const ORANGE = LODE.couleur
const NAVY = '#1e293b'

// ── Chargement dynamique de libs via CDN (PDF / Excel) ──────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const todayISO = () => new Date().toISOString().slice(0, 10)
const addDays = (iso, d) => { const t = new Date(iso); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10) }
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-BE') : '—'

// ── Calcul des totaux d'un document ─────────────────────────────
function calcTotaux(lignes, remiseGlobalePct) {
  let ht = 0, tva = 0
  const parTaux = {}
  lignes.forEach(l => {
    const brut = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
    const apresRemiseLigne = brut * (1 - (Number(l.remise_pct) || 0) / 100)
    ht += apresRemiseLigne
  })
  // remise globale
  const rg = Number(remiseGlobalePct) || 0
  const htApresGlobal = ht * (1 - rg / 100)
  // TVA par taux (sur base après remises)
  lignes.forEach(l => {
    const brut = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0)
    const apresLigne = brut * (1 - (Number(l.remise_pct) || 0) / 100)
    const apresGlobal = apresLigne * (1 - rg / 100)
    const t = Number(l.tva_pct) || 0
    parTaux[t] = (parTaux[t] || 0) + apresGlobal * t / 100
    tva += apresGlobal * t / 100
  })
  return { ht: htApresGlobal, tva, ttc: htApresGlobal + tva, parTaux }
}

const STATUTS_DEVIS = {
  brouillon: { bg: '#f1f5f9', col: '#64748b', label: 'Brouillon' },
  'envoyé':  { bg: '#dbeafe', col: '#2563eb', label: 'Envoyé' },
  'accepté': { bg: '#dcfce7', col: '#16a34a', label: 'Accepté' },
  'refusé':  { bg: '#fee2e2', col: '#dc2626', label: 'Refusé' },
  'expiré':  { bg: '#fef3c7', col: '#92400e', label: 'Expiré' },
}
const STATUTS_FACT = {
  brouillon: { bg: '#f1f5f9', col: '#64748b', label: 'Brouillon' },
  'envoyée': { bg: '#dbeafe', col: '#2563eb', label: 'Envoyée' },
  'payée':   { bg: '#dcfce7', col: '#16a34a', label: 'Payée' },
  'partiellement payée': { bg: '#fef3c7', col: '#92400e', label: 'Partielle' },
  'en retard': { bg: '#fee2e2', col: '#dc2626', label: 'En retard' },
  'annulée': { bg: '#f1f5f9', col: '#94a3b8', label: 'Annulée' },
}

// ════════════════════════════════════════════════════════════════
//  ÉDITEUR (devis ou facture)
// ════════════════════════════════════════════════════════════════
function Editeur({ type, doc, onClose, onSaved }) {
  const isDevis = type === 'devis'
  const table = isDevis ? 'lode_devis' : 'lode_factures'
  const tableLignes = isDevis ? 'lode_devis_lignes' : 'lode_factures_lignes'
  const fk = isDevis ? 'devis_id' : 'facture_id'

  const [f, setF] = useState({
    client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
    client_email: '', client_telephone: '', client_tva: '',
    objet: '', notes: '', remise_pct: 0,
    date_devis: todayISO(), date_validite: addDays(todayISO(), 30),
    date_facture: todayISO(), date_echeance: addDays(todayISO(), DELAI_PAIEMENT_JOURS),
    statut: 'brouillon', langue: 'fr', ...(doc || {}),
  })
  const [lignes, setLignes] = useState([{ description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21 }])
  const [saving, setSaving] = useState(false)
  const [clientsList, setClientsList] = useState([])

  useEffect(() => {
    supabase.from('lode_clients').select('*').eq('actif', true).order('denomination', { nullsFirst: false })
      .then(({ data }) => setClientsList(data || []))
  }, [])

  const choisirClient = (id) => {
    if (!id) return
    const c = clientsList.find(x => x.id === id)
    if (!c) return
    setF(p => ({
      ...p,
      client_id: c.id,
      client_nom: c.type === 'entreprise' ? c.denomination : `${c.prenom || ''} ${c.nom || ''}`.trim(),
      client_adresse: c.adresse || '', client_cp: c.cp || '', client_ville: c.ville || '',
      client_email: c.email || '', client_telephone: c.telephone || c.gsm || '', client_tva: c.tva || '',
      langue: c.langue || p.langue || 'fr',
    }))
  }

  useEffect(() => {
    if (doc?.id) {
      supabase.from(tableLignes).select('*').eq(fk, doc.id).order('position')
        .then(({ data }) => { if (data?.length) setLignes(data) })
    }
  }, [doc])

  const tot = calcTotaux(lignes, f.remise_pct)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setLigne = (i, k, v) => setLignes(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l))
  const addLigne = () => setLignes(p => [...p, { description: '', quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_pct: 21 }])
  const delLigne = i => setLignes(p => p.filter((_, j) => j !== i))

  const save = async () => {
    if (!f.client_nom.trim()) { alert('Le nom du client est obligatoire'); return }
    setSaving(true)
    try {
      let docId = doc?.id
      const payload = {
        client_nom: f.client_nom, client_adresse: f.client_adresse, client_cp: f.client_cp,
        client_ville: f.client_ville, client_email: f.client_email, client_telephone: f.client_telephone,
        client_tva: f.client_tva, objet: f.objet, notes: f.notes,
        remise_pct: Number(f.remise_pct) || 0, statut: f.statut, langue: f.langue || 'fr',
        total_ht: tot.ht, total_tva: tot.tva, total_ttc: tot.ttc,
      }
      if (isDevis) { payload.date_devis = f.date_devis; payload.date_validite = f.date_validite }
      else { payload.date_facture = f.date_facture; payload.date_echeance = f.date_echeance; if (f.devis_id) payload.devis_id = f.devis_id }

      if (docId) {
        await supabase.from(table).update(payload).eq('id', docId)
        await supabase.from(tableLignes).delete().eq(fk, docId)
      } else {
        const { data: num } = await supabase.rpc('next_lode_numero', { p_type: type })
        payload.numero = num
        const { data, error } = await supabase.from(table).insert(payload).select('id').single()
        if (error) throw error
        docId = data.id
      }
      const lignesPayload = lignes.filter(l => l.description.trim()).map((l, i) => ({
        [fk]: docId, position: i, description: l.description,
        quantite: Number(l.quantite) || 0, prix_unitaire: Number(l.prix_unitaire) || 0,
        remise_pct: Number(l.remise_pct) || 0, tva_pct: Number(l.tva_pct) || 0,
        total_ht: (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100),
      }))
      if (lignesPayload.length) await supabase.from(tableLignes).insert(lignesPayload)
      onSaved()
    } catch (e) {
      alert('Erreur : ' + e.message)
    } finally { setSaving(false) }
  }

  const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 3, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 880, width: '100%', padding: 24, fontFamily: "'Source Sans Pro', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>
            {doc?.id ? 'Modifier' : 'Nouveau'} {isDevis ? 'devis' : 'facture'} {doc?.numero ? `· ${doc.numero}` : ''}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Client */}
        <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE, marginBottom: 8 }}>Client</div>
        {clientsList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Sélectionner un client encodé</label>
            <select style={inp} value={f.client_id || ''} onChange={e => choisirClient(e.target.value)}>
              <option value="">— Saisie manuelle ou choisir un client —</option>
              {clientsList.map(c => (
                <option key={c.id} value={c.id}>
                  {c.type === 'entreprise' ? '🏢 ' + (c.denomination || '') : '👤 ' + `${c.prenom || ''} ${c.nom || ''}`.trim()}{c.ville ? ' · ' + c.ville : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={lbl}>Nom / société *</label><input style={inp} value={f.client_nom} onChange={e => set('client_nom', e.target.value)} /></div>
          <div><label style={lbl}>N° TVA</label><input style={inp} value={f.client_tva} onChange={e => set('client_tva', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={lbl}>Adresse</label><input style={inp} value={f.client_adresse} onChange={e => set('client_adresse', e.target.value)} /></div>
          <div><label style={lbl}>Code postal</label><input style={inp} value={f.client_cp} onChange={e => set('client_cp', e.target.value)} /></div>
          <div><label style={lbl}>Ville</label><input style={inp} value={f.client_ville} onChange={e => set('client_ville', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label style={lbl}>Email</label><input style={inp} value={f.client_email} onChange={e => set('client_email', e.target.value)} /></div>
          <div><label style={lbl}>Téléphone</label><input style={inp} value={f.client_telephone} onChange={e => set('client_telephone', e.target.value)} /></div>
        </div>

        {/* Objet + dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label style={lbl}>Objet</label><input style={inp} value={f.objet} onChange={e => set('objet', e.target.value)} placeholder="ex: Installation porte sectionnelle" /></div>
          {isDevis ? <>
            <div><label style={lbl}>Date devis</label><input type="date" style={inp} value={f.date_devis} onChange={e => set('date_devis', e.target.value)} /></div>
            <div><label style={lbl}>Validité jusqu'au</label><input type="date" style={inp} value={f.date_validite} onChange={e => set('date_validite', e.target.value)} /></div>
          </> : <>
            <div><label style={lbl}>Date facture</label><input type="date" style={inp} value={f.date_facture} onChange={e => set('date_facture', e.target.value)} /></div>
            <div><label style={lbl}>Échéance</label><input type="date" style={inp} value={f.date_echeance} onChange={e => set('date_echeance', e.target.value)} /></div>
          </>}
        </div>

        {/* Lignes */}
        <div style={{ fontSize: 13, fontWeight: 800, color: ORANGE, marginBottom: 8 }}>Lignes</div>
        <div style={{ border: '1px solid #f1f5f9', borderRadius: 9, overflow: 'hidden', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>{['Description', 'Qté', 'P.U. €', 'Rem.%', 'TVA', 'Total HT', ''].map(h => (
                <th key={h} style={{ padding: '7px 8px', textAlign: h === 'Description' ? 'left' : 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const totLigne = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
                return (
                  <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 4 }}><input style={{ ...inp, padding: '6px 8px' }} value={l.description} onChange={e => setLigne(i, 'description', e.target.value)} /></td>
                    <td style={{ padding: 4, width: 60 }}><input type="number" style={{ ...inp, padding: '6px', textAlign: 'center' }} value={l.quantite} onChange={e => setLigne(i, 'quantite', e.target.value)} /></td>
                    <td style={{ padding: 4, width: 90 }}><input type="number" step="0.01" style={{ ...inp, padding: '6px', textAlign: 'right' }} value={l.prix_unitaire} onChange={e => setLigne(i, 'prix_unitaire', e.target.value)} /></td>
                    <td style={{ padding: 4, width: 60 }}><input type="number" style={{ ...inp, padding: '6px', textAlign: 'center' }} value={l.remise_pct} onChange={e => setLigne(i, 'remise_pct', e.target.value)} /></td>
                    <td style={{ padding: 4, width: 70 }}>
                      <select style={{ ...inp, padding: '6px' }} value={l.tva_pct} onChange={e => setLigne(i, 'tva_pct', e.target.value)}>
                        {TVA_TAUX.map(t => <option key={t.val} value={t.val}>{t.val}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: NAVY, whiteSpace: 'nowrap' }}>{eur(totLigne)}</td>
                    <td style={{ padding: 4, width: 30 }}><button onClick={() => delLigne(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={addLigne} style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 16 }}>+ Ajouter une ligne</button>

        {/* Totaux + remise globale */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Remise globale %</span>
              <input type="number" style={{ ...inp, width: 70, padding: '5px', textAlign: 'center' }} value={f.remise_pct} onChange={e => set('remise_pct', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}><span style={{ color: '#64748b' }}>Total HT</span><span style={{ fontWeight: 600 }}>{eur(tot.ht)}</span></div>
            {Object.entries(tot.parTaux).filter(([, v]) => v > 0).map(([t, v]) => (
              <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: '#64748b' }}><span>TVA {t}%</span><span>{eur(v)}</span></div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, color: ORANGE, padding: '8px 0', borderTop: '2px solid #f1f5f9', marginTop: 4 }}><span>Total TTC</span><span>{eur(tot.ttc)}</span></div>
          </div>
        </div>

        {/* Notes + statut */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div><label style={lbl}>Notes (optionnel)</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
          <div><label style={lbl}>Langue du document</label>
            <select style={inp} value={f.langue || 'fr'} onChange={e => set('langue', e.target.value)}>
              {LANGUES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Statut</label>
            <select style={inp} value={f.statut} onChange={e => set('statut', e.target.value)}>
              {Object.entries(isDevis ? STATUTS_DEVIS : STATUTS_FACT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ background: ORANGE, border: 'none', borderRadius: 9, padding: '10px 24px', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  EXPORTS PDF / EXCEL
// ════════════════════════════════════════════════════════════════
async function exportPDF(type, doc, lignes) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  const { jsPDF } = window.jspdf
  const d = new jsPDF()
  const isDevis = type === 'devis'
  const tot = calcTotaux(lignes, doc.remise_pct)
  const O = [234, 88, 12]
  const L = I18N[doc.langue] || I18N.fr
  const cgv = CGV_I18N[doc.langue] || CGV_I18N.fr

  // En-tête émetteur
  d.setFontSize(20); d.setTextColor(...O); d.setFont(undefined, 'bold')
  d.text(LODE.raison_sociale, 14, 20)
  d.setFontSize(9); d.setTextColor(100); d.setFont(undefined, 'normal')
  d.text(LODE.activite, 14, 26)
  d.text([`${LODE.adresse}`, `${LODE.cp} ${LODE.ville}`, `TVA ${LODE.tva}`, `${LODE.email} · ${LODE.telephone}`], 14, 32)

  // Titre document
  d.setFontSize(22); d.setTextColor(30); d.setFont(undefined, 'bold')
  d.text(isDevis ? L.devis : L.facture, 196, 20, { align: 'right' })
  d.setFontSize(11); d.setTextColor(...O)
  d.text(doc.numero || '', 196, 27, { align: 'right' })
  d.setFontSize(9); d.setTextColor(100); d.setFont(undefined, 'normal')
  if (isDevis) {
    d.text(`${L.date} : ${fmtDate(doc.date_devis)}`, 196, 34, { align: 'right' })
    d.text(`${L.validite} : ${fmtDate(doc.date_validite)}`, 196, 39, { align: 'right' })
  } else {
    d.text(`${L.date} : ${fmtDate(doc.date_facture)}`, 196, 34, { align: 'right' })
    d.text(`${L.echeance} : ${fmtDate(doc.date_echeance)}`, 196, 39, { align: 'right' })
  }

  // Client
  d.setFillColor(248, 250, 252); d.rect(14, 50, 90, 32, 'F')
  d.setFontSize(8); d.setTextColor(150); d.text(L.client, 18, 56)
  d.setFontSize(10); d.setTextColor(30); d.setFont(undefined, 'bold')
  d.text(doc.client_nom || '', 18, 62)
  d.setFont(undefined, 'normal'); d.setFontSize(9); d.setTextColor(80)
  const cl = []
  if (doc.client_adresse) cl.push(doc.client_adresse)
  if (doc.client_cp || doc.client_ville) cl.push(`${doc.client_cp || ''} ${doc.client_ville || ''}`.trim())
  if (doc.client_tva) cl.push(`TVA ${doc.client_tva}`)
  d.text(cl, 18, 68)

  if (doc.objet) { d.setFontSize(10); d.setTextColor(30); d.setFont(undefined, 'bold'); d.text(`${L.objet} : ${doc.objet}`, 14, 90) }

  // Tableau lignes
  const body = lignes.map(l => {
    const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
    return [l.description, String(l.quantite), eur(l.prix_unitaire), `${l.remise_pct || 0}%`, `${l.tva_pct}%`, eur(t)]
  })
  d.autoTable({
    startY: 96, head: [[L.description, L.qte, L.pu, L.remise, L.tva, L.totalHT]], body,
    theme: 'striped', headStyles: { fillColor: O, fontSize: 9 }, bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'right' } },
  })

  // Totaux
  let y = d.lastAutoTable.finalY + 8
  const tx = 140
  d.setFontSize(10); d.setTextColor(80); d.setFont(undefined, 'normal')
  if (doc.remise_pct > 0) { d.text(`${L.remiseGlobale} : ${doc.remise_pct}%`, tx, y); y += 6 }
  d.text(L.totalHT, tx, y); d.text(eur(tot.ht), 196, y, { align: 'right' }); y += 6
  Object.entries(tot.parTaux).filter(([, v]) => v > 0).forEach(([t, v]) => { d.text(`${L.totalTVA} ${t}%`, tx, y); d.text(eur(v), 196, y, { align: 'right' }); y += 6 })
  d.setFont(undefined, 'bold'); d.setFontSize(12); d.setTextColor(...O)
  d.text(L.totalTTC, tx, y + 2); d.text(eur(tot.ttc), 196, y + 2, { align: 'right' })

  // Paiement
  y += 14; d.setFontSize(9); d.setTextColor(80); d.setFont(undefined, 'normal')
  d.text(`${L.paiement} : ${LODE.iban} (${LODE.bic} – ${LODE.banque})`, 14, y)
  if (!isDevis) { y += 5; d.text(`${L.communication} : ${doc.numero}`, 14, y) }
  y += 8; d.setTextColor(120); d.text(L.merci, 14, y)

  // CGV (page 2)
  d.addPage()
  d.setFontSize(13); d.setTextColor(...O); d.setFont(undefined, 'bold')
  d.text(L.cgvTitre, 14, 20)
  d.setFontSize(8); d.setTextColor(70); d.setFont(undefined, 'normal')
  let cy = 30
  cgv.forEach(c => {
    const lines = d.splitTextToSize(c, 180)
    if (cy + lines.length * 4 > 285) { d.addPage(); cy = 20 }
    d.text(lines, 14, cy); cy += lines.length * 4 + 3
  })

  d.save(`${isDevis ? L.devis : L.facture}_${doc.numero}.pdf`)
}

async function exportExcel(type, doc, lignes) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
  const XLSX = window.XLSX
  const tot = calcTotaux(lignes, doc.remise_pct)
  const isDevis = type === 'devis'
  const L = I18N[doc.langue] || I18N.fr
  const rows = [
    [LODE.raison_sociale, '', '', isDevis ? L.devis : L.facture],
    [LODE.adresse, '', '', doc.numero],
    [`${LODE.cp} ${LODE.ville}`, '', '', isDevis ? `${L.validite} : ${fmtDate(doc.date_validite)}` : `${L.echeance} : ${fmtDate(doc.date_echeance)}`],
    [`TVA ${LODE.tva}`, '', '', ''],
    [], [L.client, doc.client_nom], ['', doc.client_adresse || ''], ['', `${doc.client_cp || ''} ${doc.client_ville || ''}`],
    doc.client_tva ? ['TVA', doc.client_tva] : [],
    [L.objet, doc.objet || ''], [],
    [L.description, L.qte, L.pu, L.remise + ' %', L.tva + ' %', L.totalHT],
    ...lignes.map(l => {
      const t = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (1 - (Number(l.remise_pct) || 0) / 100)
      return [l.description, Number(l.quantite), Number(l.prix_unitaire), Number(l.remise_pct) || 0, Number(l.tva_pct), Number(t.toFixed(2))]
    }),
    [],
    ['', '', '', '', L.remiseGlobale + ' %', Number(doc.remise_pct) || 0],
    ['', '', '', '', L.totalHT, Number(tot.ht.toFixed(2))],
    ['', '', '', '', L.totalTVA, Number(tot.tva.toFixed(2))],
    ['', '', '', '', L.totalTTC, Number(tot.ttc.toFixed(2))],
    [], [L.paiement, `${LODE.iban} (${LODE.bic})`],
  ].filter(r => r.length > 0)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, isDevis ? L.devis : L.facture)
  XLSX.writeFile(wb, `${isDevis ? L.devis : L.facture}_${doc.numero}.xlsx`)
}

// ════════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function LodeDevisFactures() {
  const [tab, setTab] = useState('devis')
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {type, doc}
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    const [d, fa] = await Promise.all([
      supabase.from('lode_devis').select('*').order('created_at', { ascending: false }),
      supabase.from('lode_factures').select('*').order('created_at', { ascending: false }),
    ])
    setDevis(d.data || []); setFactures(fa.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const getLignes = async (type, id) => {
    const t = type === 'devis' ? 'lode_devis_lignes' : 'lode_factures_lignes'
    const fk = type === 'devis' ? 'devis_id' : 'facture_id'
    const { data } = await supabase.from(t).select('*').eq(fk, id).order('position')
    return data || []
  }

  const doExport = async (fmt, type, doc) => {
    setBusy(doc.id + fmt)
    try {
      const lignes = await getLignes(type, doc.id)
      if (fmt === 'pdf') await exportPDF(type, doc, lignes)
      else await exportExcel(type, doc, lignes)
    } catch (e) { alert('Erreur export : ' + e.message) }
    finally { setBusy(null) }
  }

  // Envoi de la facture sur le réseau Peppol via le proxy Billit (n8n)
  const PEPPOL_WEBHOOK = 'https://n8n.srv1082740.hstgr.cloud/webhook/lode-peppol-send'
  const envoyerPeppol = async (doc) => {
    if (!confirm(`Envoyer la facture ${doc.numero} sur le réseau Peppol via Billit ?`)) return
    setBusy(doc.id + 'peppol')
    try {
      const lignes = await getLignes('facture', doc.id)
      const res = await fetch(PEPPOL_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facture: { ...doc, lignes } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json().catch(() => ({}))
      if (data && data.ok) {
        await supabase.from('lode_factures').update({ statut: 'envoyée' }).eq('id', doc.id)
        alert(`Facture ${doc.numero} envoyée sur Peppol ✓`)
        load()
      } else {
        throw new Error(data?.error || 'Réponse inattendue de Billit')
      }
    } catch (e) {
      alert(`Échec de l'envoi Peppol : ${e.message}\n\nVérifie que le workflow n8n « LODE - Peppol Send » est actif et que la clé API Billit est renseignée.`)
    } finally { setBusy(null) }
  }

  const convertir = async (devisDoc) => {
    if (!confirm(`Convertir le devis ${devisDoc.numero} en facture ?`)) return
    const lignes = await getLignes('devis', devisDoc.id)
    const { data: num } = await supabase.rpc('next_lode_numero', { p_type: 'facture' })
    const { data: fact, error } = await supabase.from('lode_factures').insert({
      numero: num, devis_id: devisDoc.id, statut: 'brouillon',
      client_nom: devisDoc.client_nom, client_adresse: devisDoc.client_adresse, client_cp: devisDoc.client_cp,
      client_ville: devisDoc.client_ville, client_email: devisDoc.client_email, client_telephone: devisDoc.client_telephone,
      client_tva: devisDoc.client_tva, objet: devisDoc.objet, notes: devisDoc.notes, remise_pct: devisDoc.remise_pct,
      total_ht: devisDoc.total_ht, total_tva: devisDoc.total_tva, total_ttc: devisDoc.total_ttc,
      langue: devisDoc.langue || 'fr',
      date_facture: todayISO(), date_echeance: addDays(todayISO(), DELAI_PAIEMENT_JOURS),
    }).select('id').single()
    if (error) { alert('Erreur : ' + error.message); return }
    if (lignes.length) {
      await supabase.from('lode_factures_lignes').insert(lignes.map((l, i) => ({
        facture_id: fact.id, position: i, description: l.description, quantite: l.quantite,
        prix_unitaire: l.prix_unitaire, remise_pct: l.remise_pct, tva_pct: l.tva_pct, total_ht: l.total_ht,
      })))
    }
    setTab('factures'); load()
  }

  const supprimer = async (type, id) => {
    if (!confirm('Supprimer définitivement ?')) return
    await supabase.from(type === 'devis' ? 'lode_devis' : 'lode_factures').delete().eq('id', id)
    load()
  }

  const liste = tab === 'devis' ? devis : factures
  const STAT = tab === 'devis' ? STATUTS_DEVIS : STATUTS_FACT

  const btn = (bg, col) => ({ background: bg, color: col, border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' })

  return (
    <Layout currentPage="Devis & Factures">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: 1150 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: '0 0 2px' }}>Devis & Factures</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>LODE SRL — {LODE.activite}</p>
          </div>
          <button onClick={() => setEditing({ type: tab === 'factures' ? 'facture' : 'devis', doc: null })} style={{ background: ORANGE, border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="ti ti-plus" /> Nouveau {tab === 'factures' ? 'facture' : 'devis'}
          </button>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #f1f5f9' }}>
          {[['devis', 'Devis', devis.length], ['factures', 'Factures', factures.length]].map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: 'none', border: 'none', padding: '10px 18px', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, color: tab === k ? ORANGE : '#94a3b8',
              borderBottom: tab === k ? `2px solid ${ORANGE}` : '2px solid transparent', marginBottom: -2,
            }}>{label} <span style={{ fontSize: 11, opacity: 0.7 }}>({n})</span></button>
          ))}
        </div>

        {loading ? <p style={{ color: '#94a3b8' }}>Chargement…</p> :
          liste.length === 0 ? <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucun {tab === 'devis' ? 'devis' : 'facture'} pour le moment.</p> :
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>{['N°', 'Client', 'Objet', 'Date', 'Total TTC', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Total TTC' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {liste.map((doc, i) => {
                    const s = STAT[doc.statut] || STAT.brouillon
                    return (
                      <tr key={doc.id} style={{ background: i % 2 ? '#fafafe' : '#fff', borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: ORANGE }}>{doc.numero}</td>
                        <td style={{ padding: '9px 12px', color: '#1e293b', fontWeight: 600 }}>{doc.client_nom}</td>
                        <td style={{ padding: '9px 12px', color: '#64748b' }}>{doc.objet || '—'}</td>
                        <td style={{ padding: '9px 12px', color: '#64748b' }}>{fmtDate(tab === 'devis' ? doc.date_devis : doc.date_facture)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{eur(doc.total_ttc)}</td>
                        <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: s.bg, color: s.col }}>{s.label}</span></td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button onClick={() => setEditing({ type: tab === 'devis' ? 'devis' : 'facture', doc })} style={btn('#f1f5f9', '#64748b')}>Modifier</button>
                            <button onClick={() => doExport('pdf', tab === 'devis' ? 'devis' : 'facture', doc)} disabled={busy === doc.id + 'pdf'} style={btn('#fef2f2', '#dc2626')}>{busy === doc.id + 'pdf' ? '…' : 'PDF'}</button>
                            <button onClick={() => doExport('excel', tab === 'devis' ? 'devis' : 'facture', doc)} disabled={busy === doc.id + 'excel'} style={btn('#f0fdf4', '#16a34a')}>{busy === doc.id + 'excel' ? '…' : 'Excel'}</button>
                            {tab === 'factures' && doc.client_tva && doc.statut !== 'payée' && doc.statut !== 'annulée' && (
                              <button onClick={() => envoyerPeppol(doc)} disabled={busy === doc.id + 'peppol'} style={btn('#eff6ff', '#2563eb')}>{busy === doc.id + 'peppol' ? '…' : '📨 Peppol'}</button>
                            )}
                            {tab === 'devis' && doc.statut === 'accepté' && <button onClick={() => convertir(doc)} style={btn('#fff7ed', ORANGE)}>→ Facture</button>}
                            <button onClick={() => supprimer(tab === 'devis' ? 'devis' : 'facture', doc.id)} style={btn('#fff', '#dc2626')}>×</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}
      </div>

      {editing && <Editeur type={editing.type} doc={editing.doc} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </Layout>
  )
}
