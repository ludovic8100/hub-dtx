import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"
const TYPES = [['depense', 'Dépense'], ['recette', 'Recette']]
const PALETTE = ['#0080BD', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#ea580c', '#10b981', '#ef4444', '#64748b', '#94a3b8', '#7c3aed']
const COMMUN = '__COMMUN__'

export default function GestionCategories() {
  const [societes, setSocietes] = useState([])
  const [cats, setCats] = useState([])
  const [selSoc, setSelSoc] = useState('DYNASSUR') // code société, ou COMMUN
  const [nouv, setNouv] = useState({ nom: '', type: 'depense', couleur: '#0080BD' })
  const [edits, setEdits] = useState({}) // { [catId]: {nom,type,couleur} }
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)

  function notify(m) { setFlash(m); setTimeout(() => setFlash(null), 2800) }

  async function charger() {
    const { data: socs } = await supabase.from('societes').select('code,nom,couleur,actif').order('nom')
    const actives = (socs || []).filter(s => s.actif !== false && s.code !== 'HOL')
    setSocietes(actives)
    const { data } = await supabase.from('categories').select('*').order('type').order('nom')
    setCats(data || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  const commun = selSoc === COMMUN
  const socNom = commun ? 'communes (toutes sociétés)' : (societes.find(s => s.code === selSoc)?.nom || selSoc)
  const socCouleur = commun ? '#7c3aed' : (societes.find(s => s.code === selSoc)?.couleur || '#1e293b')
  const liste = cats.filter(c => commun ? (c.societe == null) : (c.societe === selSoc))
  const recettes = liste.filter(c => c.type === 'recette')
  const depenses = liste.filter(c => c.type === 'depense')

  function champ(cat, key) { return (edits[cat.id] && key in edits[cat.id]) ? edits[cat.id][key] : cat[key] }
  function modifie(cat, key, val) { setEdits(p => ({ ...p, [cat.id]: { ...p[cat.id], [key]: val } })) }
  function estModifie(cat) { const e = edits[cat.id]; return e && (e.nom !== undefined && e.nom !== cat.nom || e.type !== undefined && e.type !== cat.type || e.couleur !== undefined && e.couleur !== cat.couleur) }

  async function ajouter() {
    const nom = nouv.nom.trim()
    if (!nom) { notify('Donne un nom à la catégorie.'); return }
    const societe = commun ? null : selSoc
    const { error } = await supabase.from('categories').insert({ nom, type: nouv.type, couleur: nouv.couleur, societe })
    if (error) { notify('Erreur : ' + error.message); return }
    setNouv({ nom: '', type: 'depense', couleur: '#0080BD' })
    await charger(); notify('Catégorie ajoutée.')
  }

  async function enregistrer(cat) {
    const e = edits[cat.id]; if (!e) return
    const patch = { nom: (e.nom ?? cat.nom).trim(), type: e.type ?? cat.type, couleur: e.couleur ?? cat.couleur }
    if (!patch.nom) { notify('Le nom ne peut pas être vide.'); return }
    const { error } = await supabase.from('categories').update(patch).eq('id', cat.id)
    if (error) { notify('Erreur : ' + error.message); return }
    setEdits(p => { const n = { ...p }; delete n[cat.id]; return n })
    await charger(); notify('Catégorie modifiée.')
  }

  async function reaffecter(cat, societe) {
    const { error } = await supabase.from('categories').update({ societe: societe || null }).eq('id', cat.id)
    if (error) { notify('Erreur : ' + error.message); return }
    await charger()
    notify(societe ? `« ${cat.nom} » rattachée à ${societe}.` : `« ${cat.nom} » rendue commune.`)
  }

  async function supprimer(cat) {
    const { count } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('categorie_id', cat.id)
    if (count && count > 0) { notify(`Impossible de supprimer : ${count} transaction(s) utilisent « ${cat.nom} ». Réaffecte-les d'abord.`); return }
    if (!window.confirm(`Supprimer définitivement la catégorie « ${cat.nom} » ?`)) return
    await supabase.from('categories_regles').delete().eq('categorie_id', cat.id)
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) { notify('Erreur : ' + error.message); return }
    await charger(); notify('Catégorie supprimée.')
  }

  const inp = { padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: FONT, boxSizing: 'border-box' }

  function Ligne({ cat }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid #f1f5f9', borderRadius: 9, background: '#fff' }}>
        <input type="color" value={champ(cat, 'couleur') || '#94a3b8'} onChange={e => modifie(cat, 'couleur', e.target.value)}
          title="Couleur" style={{ width: 30, height: 30, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
        <input value={champ(cat, 'nom')} onChange={e => modifie(cat, 'nom', e.target.value)} style={{ ...inp, flex: 1, minWidth: 0, fontWeight: 600 }} />
        <select value={champ(cat, 'type')} onChange={e => modifie(cat, 'type', e.target.value)} style={{ ...inp, width: 110, flexShrink: 0 }}>
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={cat.societe || ''} onChange={e => reaffecter(cat, e.target.value)} title="Rattacher à une société" style={{ ...inp, width: 130, flexShrink: 0, color: '#64748b' }}>
          <option value="">Commune</option>
          {societes.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
        </select>
        {estModifie(cat)
          ? <button onClick={() => enregistrer(cat)} style={{ padding: '7px 12px', border: 'none', borderRadius: 7, background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}>Enregistrer</button>
          : <span style={{ width: 84, flexShrink: 0 }} />}
        <button onClick={() => supprimer(cat)} title="Supprimer" style={{ width: 32, height: 32, border: '1px solid #fecaca', borderRadius: 7, background: '#fff', color: '#dc2626', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-trash" style={{ fontSize: 15 }} />
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT }}>
      {flash && <div style={{ position: 'fixed', top: 16, right: 16, background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 10, zIndex: 50, fontWeight: 600 }}>{flash}</div>}

      <div style={{ marginBottom: 6, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Catégories comptables</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 720 }}>
        Chaque société a ses propres catégories. Les catégories <strong>communes</strong> sont visibles par toutes les entités (pratique pour Salaires, Taxes, Frais bancaires…). En comptabilité, une société voit ses catégories <em>plus</em> les communes.
      </div>

      {/* Sélecteur société */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {societes.map(s => {
          const on = selSoc === s.code
          return (
            <button key={s.code} onClick={() => setSelSoc(s.code)} style={{
              padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: FONT,
              border: on ? `2px solid ${s.couleur || '#1e293b'}` : '1px solid #e2e8f0',
              background: on ? '#f8fafc' : '#fff', color: '#1e293b',
            }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.couleur || '#94a3b8', marginRight: 8 }} />
              {s.nom}
            </button>
          )
        })}
        <button onClick={() => setSelSoc(COMMUN)} style={{
          padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13.5, fontFamily: FONT,
          border: commun ? '2px solid #7c3aed' : '1px dashed #cbd5e1', background: commun ? '#faf5ff' : '#fff', color: '#7c3aed',
        }}>
          <i className="ti ti-world" style={{ fontSize: 14, marginRight: 6 }} />Communes
        </button>
      </div>

      {loading ? <div style={{ color: '#94a3b8', padding: 20 }}>Chargement…</div> : (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: socCouleur, marginBottom: 14 }}>
            Catégories {socNom} <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>· {liste.length}</span>
          </div>

          {liste.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>Aucune catégorie pour l'instant. Ajoute-en une ci-dessous.</div>}

          {depenses.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '4px 0 8px' }}>Dépenses</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>{depenses.map(c => <Ligne key={c.id} cat={c} />)}</div>
          </>}
          {recettes.length > 0 && <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '4px 0 8px' }}>Recettes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>{recettes.map(c => <Ligne key={c.id} cat={c} />)}</div>
          </>}

          {/* Ajout */}
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Ajouter une catégorie {commun ? '(commune)' : `pour ${selSoc}`}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="color" value={nouv.couleur} onChange={e => setNouv(n => ({ ...n, couleur: e.target.value }))} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              <input value={nouv.nom} onChange={e => setNouv(n => ({ ...n, nom: e.target.value }))} onKeyDown={e => e.key === 'Enter' && ajouter()} placeholder="Nom de la catégorie" style={{ ...inp, flex: 1, minWidth: 160 }} />
              <select value={nouv.type} onChange={e => setNouv(n => ({ ...n, type: e.target.value }))} style={{ ...inp, width: 120 }}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                {PALETTE.map(c => <button key={c} onClick={() => setNouv(n => ({ ...n, couleur: c }))} title={c} style={{ width: 20, height: 20, borderRadius: 5, border: nouv.couleur === c ? '2px solid #1e293b' : '1px solid #e2e8f0', background: c, cursor: 'pointer', padding: 0 }} />)}
              </div>
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
