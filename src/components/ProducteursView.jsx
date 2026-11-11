import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { COUL } from '../lib/theme'

const BLEU = COUL.bleu
const STATUTS = {
  actif:   { label: 'Actif',    couleur: '#27AE60' },
  runoff:  { label: 'Run-off',  couleur: '#F39C12' },
  cloture: { label: 'Clôturé',  couleur: '#8A9BBE' },
}
const td = { padding: '7px 10px', borderBottom: '1px solid #eef2f7', fontSize: 13 }
const th = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: COUL.texteDoux, textTransform: 'uppercase', letterSpacing: .4, background: COUL.fond }

export default function ProducteursView() {
  const [prods, setProds] = useState([])
  const [cies, setCies] = useState([])
  const [search, setSearch] = useState('')
  const [filtreComp, setFiltreComp] = useState('')
  const [loading, setLoading] = useState(true)
  const [nouveau, setNouveau] = useState({ numero: '', compagnie_id: '' })
  const [msg, setMsg] = useState(null)

  const load = async () => {
    setLoading(true)
    const [p, c] = await Promise.all([
      supabase.from('producteurs').select('id,numero_producteur,fsma,compagnie_id,compagnie_nom,statut').order('compagnie_nom'),
      supabase.from('compagnies').select('id,nom,numero').order('nom'),
    ])
    setProds(Array.isArray(p.data) ? p.data : [])
    setCies(Array.isArray(c.data) ? c.data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const cieNom = useMemo(() => { const m = {}; cies.forEach(c => m[c.id] = c.nom); return m }, [cies])
  // La FSMA vient de la compagnie, jamais de la saisie.
  const cieFsma = useMemo(() => { const m = {}; cies.forEach(c => m[c.id] = c.numero); return m }, [cies])

  const setStatut = async (id, statut) => {
    setProds(ps => ps.map(p => p.id === id ? { ...p, statut } : p))
    await supabase.from('producteurs').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
  }
  const setCompagnie = async (id, compagnie_id) => {
    const nom = compagnie_id ? cieNom[compagnie_id] : null
    setProds(ps => ps.map(p => p.id === id ? { ...p, compagnie_id: compagnie_id || null, compagnie_nom: nom } : p))
    await supabase.from('producteurs').update({ compagnie_id: compagnie_id || null, compagnie_nom: nom, updated_at: new Date().toISOString() }).eq('id', id)
  }
  // CORRIGER LE NUMÉRO, et pas seulement ajouter ou supprimer. Une faute de
  // frappe obligeait à supprimer la ligne et à la recréer — ce qui perd son
  // descriptif et son statut, donc personne ne le fait et le faux numéro reste.
  const setNumero = async (id, numero) => {
    const v = (numero || '').trim()
    if (!v) return
    setProds(ps => ps.map(p => p.id === id ? { ...p, numero_producteur: v } : p))
    await supabase.from('producteurs').update({ numero_producteur: v, updated_at: new Date().toISOString() }).eq('id', id)
  }

  // ⚠️ UN NUMÉRO N'EST PAS UNIQUE : 0197216 existe chez AXA ET chez L'Ardenne
  // Prévoyante, 2042197 chez AXA et LAR, 41460 chez Athora et Baloise. C'est
  // le COUPLE (compagnie, numéro) qui identifie un compte. On refuse donc le
  // doublon sur ce couple, jamais sur le numéro seul.
  const ajouter = async () => {
    const num = (nouveau.numero || '').trim()
    if (!num) { setMsg('Il faut un numéro.'); return }
    if (!nouveau.compagnie_id) { setMsg('Il faut choisir une compagnie : un numéro seul n\'identifie pas un compte.'); return }
    if (prods.some(p => p.numero_producteur === num && p.compagnie_id === nouveau.compagnie_id)) {
      setMsg('Ce numéro existe déjà pour cette compagnie.'); return
    }
    setMsg(null)
    const { error } = await supabase.from('producteurs').insert({
      numero_producteur: num,
      fsma: cieFsma[nouveau.compagnie_id] || null,
      compagnie_id: nouveau.compagnie_id,
      compagnie_nom: cieNom[nouveau.compagnie_id] || null,
      statut: 'actif',
    })
    if (error) { setMsg(error.message); return }
    setNouveau({ numero: '', compagnie_id: '' })
    await load()
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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: COUL.texteDoux }}>{rows.length} producteur(s)</span>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', background: COUL.surface }}>
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
                  <td style={td}>
                    <input defaultValue={p.numero_producteur} title="Corrigeable"
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.numero_producteur) setNumero(p.id, v) }}
                      style={{ fontFamily: 'monospace', fontWeight: 700, color: COUL.marine, width: 120,
                        border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 7px', fontSize: 13 }} />
                  </td>
                  <td style={{ ...td, color: COUL.texteFaible }}>{p.fsma || '—'}</td>
                  <td style={td}>
                    <select value={p.compagnie_id || ''} onChange={e => setCompagnie(p.id, e.target.value)}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 6px', fontSize: 12, maxWidth: 220 }}>
                      <option value="">— non rattaché —</option>
                      {cies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </td>
                  <td style={td}>
                    <select value={p.statut || 'actif'} onChange={e => setStatut(p.id, e.target.value)}
                      style={{ border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 12, fontWeight: 600, color: COUL.blanc, background: st.couleur, cursor: 'pointer' }}>
                      <option value="actif" style={{ color: '#000', background: COUL.surface }}>Actif</option>
                      <option value="runoff" style={{ color: '#000', background: COUL.surface }}>Run-off</option>
                      <option value="cloture" style={{ color: '#000', background: COUL.surface }}>Clôturé</option>
                    </select>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => del(p.id)} style={{ border: 'none', background: 'none', color: COUL.danger, cursor: 'pointer', fontSize: 14 }} title="Supprimer">🗑</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10, background: COUL.surface }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
          color: COUL.texteDoux, marginBottom: 8 }}>Ajouter un compte producteur</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={nouveau.numero} onChange={e => setNouveau(n => ({ ...n, numero: e.target.value }))}
            placeholder="N° producteur"
            style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
              width: 150, fontFamily: 'monospace', fontWeight: 700 }} />
          {/* LA FSMA NE SE TAPE PAS : elle appartient à la compagnie.
              Un numéro FSMA pour un nom de compagnie — la retaper par compte
              producteur permettrait deux valeurs pour la même compagnie. */}
          <span style={{ fontSize: 12.5, color: COUL.texteDoux, whiteSpace: 'nowrap' }}>
            FSMA <b style={{ color: COUL.texte }}>{cieFsma[nouveau.compagnie_id] || '—'}</b>
          </span>
          <select value={nouveau.compagnie_id} onChange={e => setNouveau(n => ({ ...n, compagnie_id: e.target.value }))}
            style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, minWidth: 200 }}>
            <option value="">— choisir la compagnie —</option>
            {cies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button onClick={ajouter} style={{ padding: '8px 16px', border: 'none', borderRadius: 8,
            background: COUL.succes, color: COUL.blanc, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Ajouter
          </button>
        </div>
        {msg && <div style={{ marginTop: 8, fontSize: 12.5, color: COUL.danger }}>{msg}</div>}
        <p style={{ margin: '10px 0 0', fontSize: 12, color: COUL.texteDoux, lineHeight: 1.45 }}>
          Un numéro n'est <b>pas unique</b> : <code>0197216</code> existe chez AXA et chez L'Ardenne Prévoyante.
          C'est le couple <b>compagnie + numéro</b> qui identifie un compte — d'où la compagnie obligatoire.
          Le numéro se corrige directement dans la colonne de gauche.
        </p>
      </div>
    </div>
  )
}
