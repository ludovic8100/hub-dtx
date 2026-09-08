import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const BLEU = '#0080BD'
const STATUTS = {
  actif:   { label: 'Actif',    couleur: '#27AE60' },
  runoff:  { label: 'Run-off',  couleur: '#F39C12' },
  cloture: { label: 'Clôturé',  couleur: '#8A9BBE' },
}
const td = { padding: '7px 10px', borderBottom: '1px solid #eef2f7', fontSize: 13 }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4, background: '#f8fafc' }

export default function ProducteursView() {
  const [prods, setProds] = useState([])
  const [cies, setCies] = useState([])
  const [search, setSearch] = useState('')
  const [filtreComp, setFiltreComp] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('producteurs').select('id,numero_producteur,fsma,compagnie_id,compagnie_nom,statut').order('compagnie_nom'),
      supabase.from('compagnies').select('id,nom').order('nom'),
    ])
    setProds(Array.isArray(p.data) ? p.data : [])
    setCies(Array.isArray(c.data) ? c.data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cieNom = useMemo(() => { const m = {}; cies.forEach(c => m[c.id] = c.nom); return m }, [cies])

  const setStatut = async (id, statut) => {
    setProds(ps => ps.map(p => p.id === id ? { ...p, statut } : p))
    await supabase.from('producteurs').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
  }
  const setCompagnie = async (id, compagnie_id) => {
    const nom = compagnie_id ? cieNom[compagnie_id] : null
    setProds(ps => ps.map(p => p.id === id ? { ...p, compagnie_id: compagnie_id || null, compagnie_nom: nom } : p))
    await supabase.from('producteurs').update({ compagnie_id: compagnie_id || null, compagnie_nom: nom, updated_at: new Date().toISOString() }).eq('id', id)
  }
  const del = async (id) => {
    if (!window.confirm('Supprimer ce numéro de producteur ?')) return
    setProds(ps => ps.filter(p => p.id !== id))
    await supabase.from('producteurs').delete().eq('id', id)
  }

  const rows = useMemo(() => prods.filter(p => {
    if (filtreComp === '__none__' && p.compagnie_id) return false
    if (filtreComp && filtreComp !== '__none__' && p.compagnie_id !== filtreComp) return false
    if (search && !`${p.numero_producteur} ${p.compagnie_nom || ''} ${p.fsma || ''}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [prods, filtreComp, search])

  const nonRatt = prods.filter(p => !p.compagnie_id).length

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un numéro…"
          style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, minWidth: 220 }} />
        <select value={filtreComp} onChange={e => setFiltreComp(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
          <option value="">Toutes les compagnies</option>
          {cies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          <option value="__none__">— non rattaché ({nonRatt}) —</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>{rows.length} producteur(s)</span>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>N° producteur</th><th style={th}>FSMA</th><th style={th}>Compagnie</th><th style={th}>Statut</th><th style={{ ...th, textAlign: 'right' }}>Actions</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td style={td} colSpan={5}>Chargement…</td></tr>}
            {!loading && rows.length === 0 && <tr><td style={td} colSpan={5}>Aucun producteur.</td></tr>}
            {rows.map(p => {
              const st = STATUTS[p.statut] || STATUTS.actif
              return (
                <tr key={p.id} style={p.statut === 'cloture' ? { opacity: .55 } : undefined}>
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: '#0D2F5E' }}>{p.numero_producteur}</td>
                  <td style={{ ...td, color: '#94a3b8' }}>{p.fsma || '—'}</td>
                  <td style={td}>
                    <select value={p.compagnie_id || ''} onChange={e => setCompagnie(p.id, e.target.value)}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 6px', fontSize: 12, maxWidth: 220 }}>
                      <option value="">— non rattaché —</option>
                      {cies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <select value={p.statut || 'actif'} onChange={e => setStatut(p.id, e.target.value)}
                      style={{ border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 12, fontWeight: 600, color: '#fff', background: st.couleur, cursor: 'pointer' }}>
                      <option value="actif" style={{ color: '#000', background: '#fff' }}>Actif</option>
                      <option value="runoff" style={{ color: '#000', background: '#fff' }}>Run-off</option>
                      <option value="cloture" style={{ color: '#000', background: '#fff' }}>Clôturé</option>
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => del(p.id)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }} title="Supprimer">🗑</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
        La gestion fine (ajout de numéros) se fait aussi dans chaque compagnie (onglet Compagnies → ouvrir une compagnie). Ici c'est la vue d'ensemble pour nettoyer.
      </p>
    </div>
  )
}
