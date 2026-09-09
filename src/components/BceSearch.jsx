import { useState, useEffect } from 'react'

// Recherche entreprise via CBE API (BCE/KBO belge). Autocomplétion debounce 350ms.
// onSelect(company) reçoit l'objet brut cbeapi ; au parent de mapper les champs.
// NB : clé API exposée côté front (comme dans le module clients) — à passer côté serveur à terme.
const KEY = 'WecYIpno6XvAgZY9jIbyakcL9XfPc1wg'

export default function BceSearch({ onSelect, placeholder = 'Rechercher une entreprise (nom ou n° BCE à 10 chiffres)…' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const query = q.trim()
    if (query.length < 3) { setResults(null); setError(null); setLoading(false); return }
    setLoading(true); setError(null)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      const digits = query.replace(/\D/g, '')
      const isNum = digits.length === 10
      const url = isNum
        ? `https://cbeapi.be/api/v1/company/${digits}`
        : `https://cbeapi.be/api/v1/company/search?name=${encodeURIComponent(query)}`
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }, signal: ctrl.signal })
        if (!res.ok) {
          if (res.status === 404) { setResults([]); setError('Aucune entreprise trouvée.'); return }
          throw new Error(`HTTP ${res.status}`)
        }
        const json = await res.json()
        const data = json.data
        const list = Array.isArray(data) ? data : (data ? [data] : [])
        setResults(list.slice(0, 8))
        if (!list.length) setError('Aucune entreprise trouvée.')
      } catch (e) {
        if (e.name !== 'AbortError') setError('Recherche BCE indisponible : ' + e.message)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q])

  const pick = (e) => { onSelect?.(e); setResults(null); setQ('') }

  const inp = { width: '100%', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }

  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder}
        style={{ ...inp, borderColor: '#bae6fd', background: '#f0f9ff' }} />
      {loading && <div style={{ fontSize: 11, color: '#0369a1', marginTop: 4 }}>Recherche…</div>}
      {error && !loading && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{error}</div>}
      {results && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto' }}>
          {results.map((e, i) => {
            const nom = e.denomination_with_legal_form || e.denomination || '(sans dénomination)'
            const bce = e.cbe_number_formatted || e.cbe_number || ''
            const a = e.address || {}
            const lieu = [a.post_code, a.city].filter(Boolean).join(' ')
            return (
              <div key={i} onClick={() => pick(e)}
                style={{ padding: '9px 11px', cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                onMouseEnter={ev => ev.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{nom}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{[bce, lieu].filter(Boolean).join(' · ')}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
