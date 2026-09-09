import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Champs communs à dyn_clients / lode_clients / dtx_clients (mappables 1:1 sur les formulaires)
const COLS = 'type,denomination,nom,prenom,adresse,cp,ville,pays,tva,numero_bce,email,telephone,gsm,langue'

// Recherche un client DÉJÀ encodé dans d'autres BD clients internes, pour éviter le multi-encodage.
// sources : [{ table:'dyn_clients', label:'Dynassur', color:'#0080BD' }, ...]
// onSelect(record, sourceLabel) : le parent mappe les champs qu'il veut.
export default function InternalClientSearch({ sources = [], onSelect, placeholder = 'Reprendre un client déjà encodé (autre entité)…' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) { setResults(null); setLoading(false); return }
    setLoading(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      const safe = query.replace(/[,%()*]/g, ' ').trim()
      const filter = `denomination.ilike.%${safe}%,nom.ilike.%${safe}%,numero_bce.ilike.%${safe}%`
      try {
        const all = await Promise.all(sources.map(async s => {
          const { data } = await supabase.from(s.table).select(COLS).or(filter).limit(6)
          return (data || []).map(r => ({ ...r, _src: s.label, _color: s.color }))
        }))
        if (!cancelled) setResults(all.flat().slice(0, 12))
      } catch { if (!cancelled) setResults([]) }
      finally { if (!cancelled) setLoading(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [q])

  const pick = (r) => { onSelect?.(r, r._src); setResults(null); setQ('') }
  const inp = { width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} autoComplete="off"
        style={{ ...inp, borderColor: '#ddd6fe', background: '#faf5ff' }} />
      {loading && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>Recherche…</div>}
      {results && results.length === 0 && !loading && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Aucun client existant trouvé.</div>}
      {results && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto' }}>
          {results.map((r, i) => {
            const nom = r.denomination || [r.nom, r.prenom].filter(Boolean).join(' ') || '(sans nom)'
            const meta = [r.numero_bce, r.ville].filter(Boolean).join(' · ')
            return (
              <div key={i} onClick={() => pick(r)} style={{ padding: '9px 11px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={ev => ev.currentTarget.style.background = '#faf5ff'} onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: r._color || '#7c3aed', borderRadius: 5, padding: '2px 6px', flexShrink: 0 }}>{r._src}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</div>
                  {meta && <div style={{ fontSize: 11, color: '#94a3b8' }}>{meta}</div>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
