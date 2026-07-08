import { useState, useEffect } from 'react'
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

// Nombre de jours entre deux dates (ISO), ou null si l'une manque/est invalide
function ecartJours(a, b) {
  if (!a || !b) return null
  const ta = new Date(a).getTime(), tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null
  return Math.abs(ta - tb) / 86400000
}

// Le nom du tiers (contrepartie du mouvement) apparaît-il dans le nom du fichier facture ?
function nomCorrespond(contrepartie, nomFichier) {
  if (!contrepartie || !nomFichier) return false
  const normalise = s => s.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const mots = normalise(contrepartie).split(/[^a-z0-9]+/).filter(w => w.length >= 4)
  const hay = normalise(nomFichier)
  return mots.some(w => hay.includes(w))
}

// Score de correspondance d'une facture avec le mouvement à rapprocher (plus haut = meilleur)
function scoreCorrespondance(f, cible, dateCible, contrepartieCible) {
  let score = 0
  const montant = parseFloat(f.montant)
  if (cible > 0 && !Number.isNaN(montant)) {
    const diff = Math.abs(montant - cible)
    score += diff < 0.01 ? 100 : Math.max(0, 40 - diff)
  }
  const jours = ecartJours(f.date_facture, dateCible)
  if (jours != null) score += Math.max(0, 30 - jours)
  if (nomCorrespond(contrepartieCible, f.nom)) score += 40
  return score
}

/* Sélecteur de factures d'achat non liées, pour rapprocher un mouvement bancaire.
   Props: societeCode, montantCible (montant du mouvement, souvent négatif),
          dateCible (date du mouvement), contrepartieCible (nom du tiers),
          onChoisir(facture), onClose, sousTitre (libellé optionnel) */
export default function SelecteurFactureAchat({ societeCode, montantCible, dateCible, contrepartieCible, onChoisir, onClose, sousTitre }) {
  const [tous, setTous] = useState([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
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
      if (!annule) { setTous(sansExtraits(out)); setLoading(false) }
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
  factures = [...factures].sort((a, b) => scoreCorrespondance(b, cible, dateCible, contrepartieCible) - scoreCorrespondance(a, cible, dateCible, contrepartieCible)).slice(0, 80)

  // Suggestion automatique : la facture arrivant en tête si sa correspondance est forte (montant exact et une seule candidate à ce montant)
  const suggestion = (!recherche && factures.length > 0) ? factures[0] : null
  const montantExactCount = tous.filter(f => Math.abs((parseFloat(f.montant) || 0) - cible) < 0.01).length
  const suggestionForte = suggestion && cible > 0 && Math.abs((parseFloat(suggestion.montant) || 0) - cible) < 0.01 && montantExactCount === 1

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: 'min(620px, 94vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Lier une facture</div>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>{sousTitre ? sousTitre : (<>Mouvement de <strong>{fmt(montantCible)}</strong>{societeCode ? ` · ${societeCode}` : ''}</>)}</div>
        </div>
        {suggestionForte && (
          <div style={{ margin: '12px 20px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="ti ti-sparkles" style={{ fontSize: '16px', color: '#16a34a' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Correspondance trouvée</div>
              <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(suggestion.nom || '').replace(/\.pdf$/i, '')} · {fmtDate(suggestion.date_facture)}</div>
            </div>
            <button onClick={() => onChoisir(suggestion)} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700', fontFamily: FONT, whiteSpace: 'nowrap' }}>Lier cette facture</button>
          </div>
        )}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher sur tout : nom, fournisseur, numéro, montant, date…" autoFocus
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: FONT, boxSizing: 'border-box' }} />
          {!recherche && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{tous.length} factures non liées{cible > 0 ? ` · triées par montant proche de ${fmt(cible)}` : ''}</div>}
          {recherche && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{factures.length} résultat{factures.length > 1 ? 's' : ''}</div>}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Recherche…</div>}
          {!loading && factures.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Aucune facture correspondante.</div>}
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: FONT }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
