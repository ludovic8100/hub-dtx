import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100
const eur = (v) => r2(v).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const inp = { padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }

export default function VentilationEditor({ tx, categories = [], activitesSoc = [], color = '#0080BD', onSaved }) {
  const [ouvert, setOuvert] = useState(false)
  const [lignes, setLignes] = useState([])
  const [factures, setFactures] = useState([])
  const [nbExistant, setNbExistant] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const montantTx = parseFloat(tx?.montant) || 0
  const signe = montantTx < 0 ? -1 : 1
  const absTx = Math.abs(montantTx)
  const typeTx = montantTx < 0 ? 'depense' : 'recette'

  const pctDe = (m) => absTx > 0 ? String(r2((parseFloat(m) || 0) / absTx * 100)) : ''

  useEffect(() => { chargerResume() }, [tx?.id])

  async function chargerResume() {
    if (!tx?.id) return
    const { count } = await supabase.from('transaction_ventilation').select('id', { count: 'exact', head: true }).eq('transaction_id', tx.id)
    setNbExistant(count || 0)
  }

  async function ouvrir() {
    setOuvert(true); setMsg(null)
    const { data: v } = await supabase.from('transaction_ventilation').select('*').eq('transaction_id', tx.id)
    const { data: f } = await supabase.from('factures_achat').select('id, nom, montant').eq('transaction_id', tx.id)
    setFactures(f || [])
    const mk = (m, cat, act, fac) => ({ montant: String(m), pct: pctDe(m), categorie_id: cat || '', activite: act || '', facture_id: fac || '' })
    if (v && v.length) {
      setLignes(v.map(l => mk(Math.abs(parseFloat(l.montant) || 0), l.categorie_id, l.activite, l.facture_id)))
    } else if (f && f.length) {
      setLignes(f.map(fa => mk(Math.abs(parseFloat(fa.montant) || 0), '', '', fa.id)))
    } else {
      setLignes([mk(absTx, tx.categorie_id, tx.activite, '')])
    }
  }

  const catsOptions = []
  categories.filter(c => !c.parent_id && c.type === typeTx).forEach(p => {
    catsOptions.push({ id: p.id, label: p.nom })
    categories.filter(c => c.parent_id === p.id).forEach(e => catsOptions.push({ id: e.id, label: '\u00A0\u00A0\u21B3 ' + e.nom }))
  })

  const somme = lignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)
  const ecart = r2(absTx - somme)
  const equilibre = Math.abs(ecart) < 0.01
  const sommePct = lignes.reduce((s, l) => s + (parseFloat(l.pct) || 0), 0)

  function setField(i, key, val) { setLignes(prev => prev.map((l, j) => j === i ? { ...l, [key]: val } : l)) }
  function setMontant(i, val) { setLignes(prev => prev.map((l, j) => j === i ? { ...l, montant: val, pct: val === '' ? '' : pctDe(val) } : l)) }
  function setPct(i, val) { setLignes(prev => prev.map((l, j) => j === i ? { ...l, pct: val, montant: val === '' ? '' : String(r2((parseFloat(val) || 0) / 100 * absTx)) } : l)) }
  function ajouter() { setLignes(prev => [...prev, { montant: ecart > 0 ? ecart.toFixed(2) : '', pct: ecart > 0 ? pctDe(ecart) : '', categorie_id: '', activite: '', facture_id: '' }]) }
  function retirer(i) { setLignes(prev => prev.filter((_, j) => j !== i)) }
  function repartirParFacture() {
    if (!factures.length) return
    setLignes(factures.map(fa => { const m = Math.abs(parseFloat(fa.montant) || 0); return { montant: String(m), pct: pctDe(m), categorie_id: '', activite: '', facture_id: fa.id } }))
  }
  function repartirEgal() {
    const n = lignes.length
    if (!n) return
    const part = r2(absTx / n)
    setLignes(prev => prev.map((l, j) => {
      const m = j < n - 1 ? part : r2(absTx - part * (n - 1))
      return { ...l, montant: m.toFixed(2), pct: pctDe(m) }
    }))
  }

  async function enregistrer() {
    if (!equilibre) { setMsg('La somme des lignes doit être égale au montant payé.'); return }
    setBusy(true); setMsg(null)
    await supabase.from('transaction_ventilation').delete().eq('transaction_id', tx.id)
    const rows = lignes
      .filter(l => (parseFloat(l.montant) || 0) > 0)
      .map(l => ({
        transaction_id: tx.id,
        montant: signe * (parseFloat(l.montant) || 0),
        categorie_id: l.categorie_id || null,
        activite: l.activite || null,
        facture_id: l.facture_id || null
      }))
    if (rows.length) {
      const { error } = await supabase.from('transaction_ventilation').insert(rows)
      if (error) { setMsg('Erreur : ' + error.message); setBusy(false); return }
    }
    setBusy(false); setOuvert(false); setNbExistant(rows.length); setMsg(null)
    if (onSaved) onSaved()
  }

  async function annulerVentilation() {
    if (!window.confirm('Supprimer la ventilation de ce paiement ?')) return
    setBusy(true)
    await supabase.from('transaction_ventilation').delete().eq('transaction_id', tx.id)
    setBusy(false); setOuvert(false); setNbExistant(0); setLignes([])
    if (onSaved) onSaved()
  }

  if (!ouvert) {
    return (
      <div style={{ marginBottom: '18px' }}>
        <button onClick={ouvrir} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, border: nbExistant > 0 ? `1px solid ${color}` : '1px dashed #cbd5e1', background: nbExistant > 0 ? `${color}0d` : '#f8fafc', color: nbExistant > 0 ? color : '#475569' }}>
          {nbExistant > 0 ? `\u25A4 Paiement ventilé en ${nbExistant} ligne(s) — modifier` : '\u25A4 Découper ce paiement (plusieurs factures / activités)'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '18px', border: `1px solid ${color}`, borderRadius: '10px', padding: '12px', background: '#fbfdff' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Ventilation du paiement — {eur(absTx)}</div>

      {lignes.map((l, i) => (
        <div key={i} style={{ border: '1px solid #eef2f7', borderRadius: '8px', padding: '8px', marginBottom: '8px', background: '#fff' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
            <input type="number" step="0.01" value={l.pct} onChange={e => setPct(i, e.target.value)} placeholder="%" style={{ ...inp, width: '68px' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>%</span>
            <input type="number" step="0.01" value={l.montant} onChange={e => setMontant(i, e.target.value)} placeholder="Montant" style={{ ...inp, width: '108px' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>€</span>
            <button onClick={() => retirer(i)} title="Retirer" style={{ marginLeft: 'auto', width: '28px', height: '28px', border: '1px solid #fecaca', borderRadius: '7px', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select value={l.categorie_id} onChange={e => setField(i, 'categorie_id', e.target.value)} style={{ ...inp, flex: '1 1 150px' }}>
              <option value="">— Catégorie —</option>
              {catsOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {activitesSoc.length > 0 && (
              <select value={l.activite} onChange={e => setField(i, 'activite', e.target.value)} style={{ ...inp, flex: '1 1 110px' }}>
                <option value="">— Activité —</option>
                {activitesSoc.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            )}
            {factures.length > 0 && (
              <select value={l.facture_id} onChange={e => setField(i, 'facture_id', e.target.value)} style={{ ...inp, flex: '1 1 150px' }}>
                <option value="">— Facture —</option>
                {factures.map(f => <option key={f.id} value={f.id}>{(f.nom || 'facture').slice(0, 28)} · {eur(parseFloat(f.montant) || 0)}</option>)}
              </select>
            )}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <button onClick={ajouter} style={{ padding: '7px 12px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: '1px dashed #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: FONT }}>+ Ligne</button>
        {lignes.length > 1 && <button onClick={repartirEgal} style={{ padding: '7px 12px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: FONT }}>Répartir également ({lignes.length})</button>}
        {factures.length > 1 && <button onClick={repartirParFacture} style={{ padding: '7px 12px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: FONT }}>Répartir par facture ({factures.length})</button>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 4px', borderTop: '1px solid #eef2f7' }}>
        <span style={{ color: '#64748b' }}>Total{sommePct ? ` · ${r2(sommePct)} %` : ''}</span>
        <span style={{ fontWeight: 700, color: equilibre ? '#16a34a' : '#dc2626' }}>{eur(somme)} / {eur(absTx)}{!equilibre && ` (écart ${eur(Math.abs(ecart))})`}</span>
      </div>

      {msg && <div style={{ fontSize: '12.5px', color: '#dc2626', margin: '4px 0' }}>{msg}</div>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button onClick={enregistrer} disabled={busy || !equilibre} style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, border: 'none', background: (busy || !equilibre) ? '#94a3b8' : '#16a34a', color: '#fff', cursor: (busy || !equilibre) ? 'not-allowed' : 'pointer', fontFamily: FONT }}>Enregistrer la ventilation</button>
        <button onClick={() => setOuvert(false)} style={{ padding: '9px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: FONT }}>Fermer</button>
      </div>
      {nbExistant > 0 && <button onClick={annulerVentilation} style={{ marginTop: '8px', width: '100%', padding: '7px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', fontFamily: FONT }}>Supprimer la ventilation (repasser en catégorie unique)</button>}
    </div>
  )
}
