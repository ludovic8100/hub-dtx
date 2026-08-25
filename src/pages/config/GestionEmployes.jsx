import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const FONT = "'Source Sans Pro', sans-serif"

export default function GestionEmployes() {
  const [societes, setSocietes] = useState([])
  const [emps, setEmps] = useState([])
  const [filtre, setFiltre] = useState('')            // '' = toutes ; sinon code société
  const [nouv, setNouv] = useState({ nom: '', code: '', entites: [], actif: true })
  const [edits, setEdits] = useState({})
  const [flash, setFlash] = useState(null)
  const [loading, setLoading] = useState(true)

  function notify(m) { setFlash(m); setTimeout(() => setFlash(null), 2800) }

  async function charger() {
    const { data: socs } = await supabase.from('societes').select('code,nom,couleur,actif').order('nom')
    setSocietes((socs || []).filter(s => s.actif !== false && s.code !== 'HOL'))
    const { data } = await supabase.from('employes').select('*').order('nom')
    setEmps(data || []); setLoading(false)
  }
  useEffect(() => { charger() }, [])

  function champ(e, k) { return (edits[e.id] && k in edits[e.id]) ? edits[e.id][k] : e[k] }
  function empEntites(e) { const x = edits[e.id]; return (x && x.entites) ? x.entites : (e.entites || []) }
  function modifie(e, k, v) { setEdits(p => ({ ...p, [e.id]: { ...p[e.id], [k]: v } })) }
  function toggleEnt(e, code) { const cur = empEntites(e); modifie(e, 'entites', cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code]) }
  function estModifie(e) {
    const x = edits[e.id]; if (!x) return false
    const b = [e.nom, e.code || '', !!e.actif, (e.entites || []).slice().sort().join(',')].join('|')
    const c = [champ(e, 'nom'), champ(e, 'code') || '', !!champ(e, 'actif'), empEntites(e).slice().sort().join(',')].join('|')
    return b !== c
  }

  const liste = filtre ? emps.filter(e => (e.entites || []).includes(filtre)) : emps

  async function ajouter() {
    const nom = (nouv.nom || '').trim()
    if (!nom) { notify('Nom obligatoire.'); return }
    if (!nouv.entites.length) { notify('Coche au moins une société.'); return }
    const { error } = await supabase.from('employes').insert({ nom, code: (nouv.code || '').trim() || null, entites: nouv.entites, actif: nouv.actif })
    if (error) { notify('❌ ' + error.message); return }
    setNouv({ nom: '', code: '', entites: [], actif: true }); notify('✓ Employé ajouté'); charger()
  }
  async function enregistrer(e) {
    const nom = (champ(e, 'nom') || '').trim()
    if (!nom) { notify('Nom obligatoire.'); return }
    const entites = empEntites(e)
    if (!entites.length) { notify('Coche au moins une société.'); return }
    const { error } = await supabase.from('employes').update({ nom, code: (champ(e, 'code') || '').trim() || null, actif: !!champ(e, 'actif'), entites }).eq('id', e.id)
    if (error) { notify('❌ ' + error.message); return }
    setEdits(p => { const n = { ...p }; delete n[e.id]; return n }); notify('✓ Enregistré'); charger()
  }
  async function supprimer(e) {
    const { count: ct } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('employe_id', e.id)
    const { count: cv } = await supabase.from('transaction_ventilation').select('id', { count: 'exact', head: true }).eq('employe_id', e.id)
    const liees = (ct || 0) + (cv || 0)
    const msg = liees > 0
      ? `« ${e.nom} » est lié à ${liees} imputation(s) de dépense.\nEn le supprimant, ces liens seront retirés. Continuer ?`
      : `Supprimer « ${e.nom} » ?`
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('employes').delete().eq('id', e.id)
    if (error) { notify('❌ ' + error.message); return }
    notify('✓ Supprimé'); charger()
  }

  const inp = { fontFamily: FONT, fontSize: 14, padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', boxSizing: 'border-box' }
  const chip = (on, couleur) => ({ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (on ? couleur : '#e2e8f0'), background: on ? couleur : '#fff', color: on ? '#fff' : '#94a3b8', userSelect: 'none' })
  const btn = (bg) => ({ fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: bg, color: '#fff' })

  if (loading) return <div style={{ padding: 30, color: '#94a3b8' }}>Chargement…</div>

  return (
    <div style={{ fontFamily: FONT }}>
      {flash && <div style={{ position: 'fixed', top: 20, right: 20, background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 8, zIndex: 50, fontSize: 14 }}>{flash}</div>}

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 800, color: '#1e293b', marginBottom: 10 }}>➕ Nouvel employé</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={nouv.nom} onChange={e => setNouv(n => ({ ...n, nom: e.target.value }))} placeholder="Nom complet" style={{ ...inp, width: 240 }} />
          <input value={nouv.code} onChange={e => setNouv(n => ({ ...n, code: e.target.value }))} placeholder="Code (opt.)" style={{ ...inp, width: 120 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {societes.map(s => { const on = nouv.entites.includes(s.code); return <span key={s.code} onClick={() => setNouv(n => ({ ...n, entites: on ? n.entites.filter(c => c !== s.code) : [...n.entites, s.code] }))} style={chip(on, s.couleur || '#0080BD')}>{s.nom}</span> })}
          </div>
          <button onClick={ajouter} style={btn('#16a34a')}>Ajouter</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>Société :</span>
        <span onClick={() => setFiltre('')} style={chip(filtre === '', '#1e293b')}>Toutes</span>
        {societes.map(s => <span key={s.code} onClick={() => setFiltre(s.code)} style={chip(filtre === s.code, s.couleur || '#0080BD')}>{s.nom}</span>)}
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{liste.length} employé(s)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {liste.map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid ' + (estModifie(e) ? '#f59e0b' : '#e2e8f0'), borderRadius: 10, padding: '10px 12px', opacity: champ(e, 'actif') ? 1 : 0.55 }}>
            <input value={champ(e, 'nom') || ''} onChange={ev => modifie(e, 'nom', ev.target.value)} style={{ ...inp, width: 230, fontWeight: 700 }} />
            <input value={champ(e, 'code') || ''} onChange={ev => modifie(e, 'code', ev.target.value)} placeholder="code" style={{ ...inp, width: 90 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {societes.map(s => { const on = empEntites(e).includes(s.code); return <span key={s.code} onClick={() => toggleEnt(e, s.code)} style={chip(on, s.couleur || '#0080BD')}>{s.code}</span> })}
            </div>
            <span onClick={() => modifie(e, 'actif', !champ(e, 'actif'))} style={{ ...chip(!!champ(e, 'actif'), '#16a34a'), minWidth: 64, textAlign: 'center' }}>{champ(e, 'actif') ? 'Actif' : 'Inactif'}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {estModifie(e) && <button onClick={() => enregistrer(e)} style={btn('#1e293b')}>💾 Enregistrer</button>}
              <button onClick={() => supprimer(e)} style={{ ...btn('#fff'), color: '#dc2626', border: '1px solid #fecaca' }}>🗑</button>
            </div>
          </div>
        ))}
        {liste.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Aucun employé{filtre ? ' pour cette société' : ''}.</div>}
      </div>
    </div>
  )
}
