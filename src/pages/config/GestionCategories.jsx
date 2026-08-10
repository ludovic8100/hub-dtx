import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const TYPES = [['depense', 'Dépense'], ['recette', 'Recette']]
const PALETTE = ['#0080BD', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#ea580c', '#10b981', '#ef4444', '#64748b', '#94a3b8', '#7c3aed']

export default function GestionCategories() {
  const [societes, setSocietes] = useState([])
  const [cats, setCats] = useState([])
  const [filtre, setFiltre] = useState('') // '' = toutes ; sinon code entité
  const [nouv, setNouv] = useState({ nom: '', type: 'depense', couleur: '#0080BD', entites: [] })
  const [edits, setEdits] = useState({})
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)

  function notify(m) { setFlash(m); setTimeout(() => setFlash(null), 2800) }

  async function charger() {
    const { data: socs } = await supabase.from('societes').select('code,nom,couleur,actif').order('nom')
    setSocietes((socs || []).filter(s => s.actif !== false && s.code !== 'HOL'))
    const { data } = await supabase.from('categories').select('*').order('type').order('nom')
    setCats(data || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  function catEntites(cat) { const e = edits[cat.id]; return (e && e.entites) ? e.entites : (cat.entites || []) }
  function champ(cat, key) { return (edits[cat.id] && key in edits[cat.id]) ? edits[cat.id][key] : cat[key] }
  function modifie(cat, key, val) { setEdits(p => ({ ...p, [cat.id]: { ...p[cat.id], [key]: val } })) }
  function toggleEntite(cat, code) {
    const cur = catEntites(cat)
    modifie(cat, 'entites', cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code])
  }
  function estModifie(cat) {
    const e = edits[cat.id]; if (!e) return false
    const b = [cat.nom, cat.type, cat.couleur, (cat.entites || []).slice().sort().join(',')].join('|')
    const c = [champ(cat, 'nom'), champ(cat, 'type'), champ(cat, 'couleur'), catEntites(cat).slice().sort().join(',')].join('|')
    return b !== c
  }

  const liste = filtre ? cats.filter(c => (c.entites || []).includes(filtre)) : cats
  const recettes = liste.filter(c => c.type === 'recette')
  const depenses = liste.filter(c => c.type === 'depense')

  async function ajouter() {
    const nom = nouv.nom.trim()
    if (!nom) { notify('Donne un nom à la catégorie.'); return }
    if (!nouv.entites.length) { notify('Coche au moins une entité.'); return }
    const { error } = await supabase.from('categories').insert({ nom, type: nouv.type, couleur: nouv.couleur, entites: nouv.entites })
    if (error) { notify('Erreur : ' + error.message); return }
    setNouv({ nom: '', type: 'depense', couleur: '#0080BD', entites: [] })
    await charger(); notify('Catégorie ajoutée.')
  }

  async function enregistrer(cat) {
    const nom = (champ(cat, 'nom') || '').trim()
    const entites = catEntites(cat)
    if (!nom) { notify('Le nom ne peut pas être vide.'); return }
    if (!entites.length) { notify('Coche au moins une entité.'); return }
    const { error } = await supabase.from('categories').update({ nom, type: champ(cat, 'type'), couleur: champ(cat, 'couleur'), entites }).eq('id', cat.id)
    if (error) { notify('Erreur : ' + error.message); return }
    setEdits(p => { const n = { ...p }; delete n[cat.id]; return n })
    await charger(); notify('Catégorie modifiée.')
  }

  async function supprimer(cat) {
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('categorie_id', cat.id)
    if (count && count > 0) { notify(`Impossible : ${count} transaction(s) utilisent « ${cat.nom} ». Réaffecte-les d'abord.`); return }
    if (!window.confirm(`Supprimer la catégorie « ${cat.nom} » ?`)) return
    await supabase.from('categories_regles').delete().eq('categorie_id', cat.id)
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { notify('Erreur : ' + error.message); return }
    await charger(); notify('Catégorie supprimée.')
  }

  const inp = { padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: FONT, boxSizing: 'border-box' }

  function CasesEntites({ selected, onToggle }) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {societes.map(s => {
          const on = selected.includes(s.code)
          return (
            <label key={s.code} title={s.nom} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
              border: on ? `1.5px solid ${s.couleur || '#1e293b'}` : '1px solid #e2e8f0',
              background: on ? (s.couleur || '#1e293b') + '14' : '#fff', fontSize: 12, fontWeight: 700,
              color: on ? '#1e293b' : '#94a3b8', userSelect: 'none',
            }}>
              <input type="checkbox" checked={on} onChange={() => onToggle(s.code)} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: s.couleur || '#1e293b' }} />
              {s.code}
            </label>
          )
        })}
      </div>
    )
  }

  function Ligne({ cat }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', border: '1px solid #f1f5f9', borderRadius: 9, background: '#fff', flexWrap: 'wrap' }}>
        <input type="color" value={champ(cat, 'couleur') || '#94a3b8'} onChange={e => modifie(cat, 'couleur', e.target.value)} title="Couleur" style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
        <input value={champ(cat, 'nom')} onChange={e => modifie(cat, 'nom', e.target.value)} style={{ ...inp, width: 210, fontWeight: 600 }} />
        <select value={champ(cat, 'type')} onChange={e => modifie(cat, 'type', e.target.value)} style={{ ...inp, width: 105 }}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div style={{ flex: 1, minWidth: 240 }}><CasesEntites selected={catEntites(cat)} onToggle={code => toggleEntite(cat, code)} /></div>
        {estModifie(cat)
          ? <button onClick={() => enregistrer(cat)} style={{ padding: '7px 12px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT }}>Enregistrer</button>
          : <span style={{ width: 84 }} />}
        <button onClick={() => supprimer(cat)} title="Supprimer" style={{ width: 32, height: 32, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="ti ti-trash" style={{ fontSize: 15 }} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {flash && <div style={{ position: 'fixed', top: 16, right: 16, background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 10, zIndex: 50, fontWeight: 600 }}>{flash}</div>}

      <div style={{ marginBottom: 6, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Catégories comptables</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 740 }}>
        Coche les entités auxquelles chaque catégorie s'applique. Une catégorie peut être partagée par plusieurs sociétés ; en comptabilité, chaque société ne voit que les catégories qui lui sont attribuées.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>Afficher :</span>
        <button onClick={() => setFiltre('')} style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: FONT, border: filtre === '' ? '2px solid #1e293b' : '1px solid #e2e8f0', background: filtre === '' ? '#f8fafc' : '#fff', color: '#1e293b' }}>Toutes</button>
        {societes.map(s => (
          <button key={s.code} onClick={() => setFiltre(s.code)} style={{ padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12.5, fontFamily: FONT, border: filtre === s.code ? `2px solid ${s.couleur || '#1e293b'}` : '1px solid #e2e8f0', background: filtre === s.code ? '#f8fafc' : '#fff', color: '#1e293b' }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: s.couleur || '#94a3b8', marginRight: 6 }} />{s.code}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#94a3b8', padding: 20 }}>Chargement…</div> : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          {liste.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>Aucune catégorie{filtre ? ` pour ${filtre}` : ''}. Ajoute-en une ci-dessous.</div>}

          {depenses.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '4px 0 8px' }}>Dépenses</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>{depenses.map(c => <Ligne key={c.id} cat={c} />)}</div>
          </>}
          {recettes.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '4px 0 8px' }}>Recettes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>{recettes.map(c => <Ligne key={c.id} cat={c} />)}</div>
          </>}

          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 10 }}>Nouvelle catégorie</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <input type="color" value={nouv.couleur} onChange={e => setNouv(n => ({ ...n, couleur: e.target.value }))} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <input value={nouv.nom} onChange={e => setNouv(n => ({ ...n, nom: e.target.value }))} placeholder="Nom de la catégorie" style={{ ...inp, width: 220 }} />
              <select value={nouv.type} onChange={e => setNouv(n => ({ ...n, type: e.target.value }))} style={{ ...inp, width: 120 }}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                {PALETTE.map(c => <button key={c} onClick={() => setNouv(n => ({ ...n, couleur: c }))} title={c} style={{ width: 20, height: 20, borderRadius: 5, border: nouv.couleur === c ? '2px solid #1e293b' : '1px solid #e2e8f0', background: c, cursor: 'pointer', padding: 0 }} />)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Entités :</span>
              <CasesEntites selected={nouv.entites} onToggle={code => setNouv(n => ({ ...n, entites: n.entites.includes(code) ? n.entites.filter(x => x !== code) : [...n.entites, code] }))} />
              <button onClick={ajouter} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: FONT }}>
                <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 6 }} />Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
