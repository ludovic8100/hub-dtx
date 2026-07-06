import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)
const fmtDate = (d) => {
  if (!d) return '—'
  const p = String(d).substring(0, 10).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d
}

/* Sélecteur de factures d'achat non liées, pour rapprocher un mouvement bancaire.
   Props: societeCode, montantCible (montant du mouvement, souvent négatif),
          onChoisir(facture), onCollerUrl(url), onClose */
export default function SelecteurFactureAchat({ societeCode, montantCible, onChoisir, onCollerUrl, onClose }) {
  const [tous, setTous] = useState([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [urlManuelle, setUrlManuelle] = useState('')
  const cible = Math.abs(parseFloat(montantCible) || 0)

  // Charger une seule fois toutes les factures non liées de la société
  useEffect(() => {
    let annule = false
    setLoading(true)
    ;(async () => {
      let out = []; let from = 0
      for (;;) {
        let q = supabase.from('factures_achat').select('fichier_id,nom,montant,date_facture,url,societe').is('transaction_id', null)
        if (societeCode) q = q.eq('societe', societeCode)
        const { data, error } = await q.order('date_facture', { ascending: false }).range(from, from + 999)
        if (error || !data) break
        out = out.concat(data)
        if (data.length < 1000) break
        from += 1000
      }
      if (!annule) { setTous(out); setLoading(false) }
    })()
    return () => { annule = true }
  }, [societeCode])

  // Recherche sur TOUTES les données (multi-mots) ; sinon tri par proximité de montant
  const mots = recherche.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hayFor = (f) => [
    f.nom, f.societe, fmt(f.montant), String(f.montant),
    fmtDate(f.date_facture), f.date_facture
  ].filter(Boolean).join(' ').toLowerCase()
  let factures = mots.length ? tous.filter(f => { const h = hayFor(f); return mots.every(w => h.includes(w)) }) : tous
  factures = [...factures].sort((a, b) => Math.abs((parseFloat(a.montant) || 0) - cible) - Math.abs((parseFloat(b.montant) || 0) - cible)).slice(0, 80)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: 'min(620px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Lier une facture</div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>Mouvement de <strong>{fmt(montantCible)}</strong>{societeCode ? ` · ${societeCode}` : ''}</div>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher sur tout : nom, fournisseur, numéro, montant, date…" autoFocus
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }} />
          {!recherche && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{tous.length} factures non liées{cible > 0 ? ` · triées par montant proche de ${fmt(cible)}` : ''}</div>}
          {recherche && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{factures.length} résultat{factures.length > 1 ? 's' : ''}</div>}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Recherche…</div>}
          {!loading && factures.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Aucune facture correspondante.<br />Tu peux aussi coller l'URL ci-dessous.</div>}
          {!loading && factures.map(f => {
            const exact = Math.abs((parseFloat(f.montant) || 0) - cible) < 0.01
            return (
              <div key={f.fichier_id} onClick={() => onChoisir(f)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '11px 20px', borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(f.nom || '').replace(/\.pdf$/i, '')}</div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{fmtDate(f.date_facture)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {exact && <span style={{ fontSize: '10px', fontWeight: '700', color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: '12px' }}>montant exact</span>}
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>{f.montant == null ? '—' : fmt(f.montant)}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input value={urlManuelle} onChange={e => setUrlManuelle(e.target.value)} placeholder="…ou coller une URL SharePoint"
            style={{ flex: 1, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: FONT, boxSizing: 'border-box' }} />
          <button disabled={!urlManuelle.trim()} onClick={() => onCollerUrl(urlManuelle.trim())}
            style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: urlManuelle.trim() ? '#0f172a' : '#e2e8f0', color: '#fff', cursor: urlManuelle.trim() ? 'pointer' : 'default', fontSize: '13px', fontWeight: '600', fontFamily: FONT, whiteSpace: 'nowrap' }}>Lier l'URL</button>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
