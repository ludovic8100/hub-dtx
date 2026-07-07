import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { sansExtraits } from '../lib/factures'

const FONT = "'Source Sans Pro', sans-serif"
const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = (d) => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

function ecartJours(a, b) {
  if (!a || !b) return null
  const ta = new Date(a).getTime(), tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null
  return Math.abs(ta - tb) / 86400000
}

const JOURS_MAX = 60 // au-delà, on ne considère plus la correspondance comme fiable

/* Rapprochement automatique par lot : ne retient que les paires mouvement <-> facture d'achat
   sans AUCUNE ambiguïté (même montant exact, un seul candidat de chaque côté à ce montant).
   Les cas ambigus (doublons de montant) restent au lien manuel ("+").
   Props: societeCode, transactions (mouvements déjà chargés de la société active), onClose, onTermine(paires) */
export default function RapprochementAuto({ societeCode, transactions, onClose, onTermine }) {
  const [factures, setFactures] = useState([])
  const [loading, setLoading] = useState(true)
  const [coches, setCoches] = useState(new Set())
  const [validation, setValidation] = useState(false)

  useEffect(() => {
    let annule = false
    setLoading(true)
    ;(async () => {
      let out = []; let from = 0
      for (;;) {
        const { data, error } = await supabase.from('factures_achat')
          .select('fichier_id,nom,montant,date_facture,url,societe').is('transaction_id', null)
          .eq('societe', societeCode).range(from, from + 999)
        if (error || !data) break
        out = out.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      if (!annule) { setFactures(sansExtraits(out)); setLoading(false) }
    })()
    return () => { annule = true }
  }, [societeCode])

  // Mouvements candidats : sortants, non justifiés, pas marqués "sans facture nécessaire"
  const candidats = useMemo(() => transactions.filter(t => !t.facture_url && !t.sans_facture && parseFloat(t.montant) < 0), [transactions])

  // Une correspondance n'est retenue que si UN SEUL mouvement et UNE SEULE facture
  // partagent exactement ce montant — sinon ambiguïté, on laisse la main à l'utilisateur
  const paires = useMemo(() => {
    const parMontantTx = new Map()
    candidats.forEach(t => {
      const cle = Math.abs(parseFloat(t.montant) || 0).toFixed(2)
      if (!parMontantTx.has(cle)) parMontantTx.set(cle, [])
      parMontantTx.get(cle).push(t)
    })
    const parMontantF = new Map()
    factures.forEach(f => {
      const cle = Math.abs(parseFloat(f.montant) || 0).toFixed(2)
      if (!parMontantF.has(cle)) parMontantF.set(cle, [])
      parMontantF.get(cle).push(f)
    })
    const out = []
    parMontantTx.forEach((txs, cle) => {
      if (txs.length !== 1 || cle === '0.00') return
      const fs = parMontantF.get(cle)
      if (!fs || fs.length !== 1) return
      const tx = txs[0], facture = fs[0]
      const jours = ecartJours(tx.date_valeur || tx.date_execution, facture.date_facture)
      if (jours != null && jours > JOURS_MAX) return
      out.push({ tx, facture, jours })
    })
    return out.sort((a, b) => (b.tx.date_valeur || b.tx.date_execution || '').localeCompare(a.tx.date_valeur || a.tx.date_execution || ''))
  }, [candidats, factures])

  useEffect(() => { setCoches(new Set(paires.map((_, i) => i))) }, [paires.length])

  function toggle(i) {
    setCoches(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })
  }

  async function confirmer() {
    setValidation(true)
    const selection = paires.filter((_, i) => coches.has(i))
    for (const { tx, facture } of selection) {
      await supabase.from('transactions').update({ facture_url: facture.url, rapproche: true, facture_thumb_url: null }).eq('id', tx.id)
      await supabase.from('factures_achat').update({ transaction_id: tx.id }).eq('fichier_id', facture.fichier_id)
    }
    if (selection.length > 0) {
      fetch('https://n8n.srv1082740.hstgr.cloud/webhook/backfill-thumbs2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {})
    }
    setValidation(false)
    onTermine(selection)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: 'min(680px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Rapprochement automatique</div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
            {loading ? 'Analyse en cours…' : paires.length === 0
              ? 'Aucune correspondance fiable trouvée.'
              : `${paires.length} correspondance${paires.length > 1 ? 's' : ''} trouvée${paires.length > 1 ? 's' : ''} (montant exact, sans ambiguïté)`}
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Analyse…</div>}
          {!loading && paires.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
              Pas de correspondance sans ambiguïté entre mouvements et factures non liés.<br />
              Utilise le lien manuel (« + ») pour les cas ambigus (plusieurs candidats au même montant).
            </div>
          )}
          {!loading && paires.map(({ tx, facture, jours }, i) => (
            <label key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
              <input type="checkbox" checked={coches.has(i)} onChange={() => toggle(i)} style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.contrepartie_nom || tx.information_paiement || 'Mouvement'}</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fmtDate(tx.date_valeur || tx.date_execution)} → {(facture.nom || '').replace(/\.pdf$/i, '')} ({fmtDate(facture.date_facture)})
                  {jours != null && jours > 0 && <span> · écart {Math.round(jours)}j</span>}
                </div>
              </div>
              <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', flexShrink: 0 }}>{fmt(tx.montant)}</span>
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Annuler</button>
          <button disabled={coches.size === 0 || validation} onClick={confirmer} style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: coches.size === 0 || validation ? 'default' : 'pointer',
            background: coches.size === 0 || validation ? '#e2e8f0' : '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '700', fontFamily: FONT
          }}>{validation ? 'Liaison…' : `Lier ${coches.size} mouvement${coches.size > 1 ? 's' : ''}`}</button>
        </div>
      </div>
    </div>
  )
}
