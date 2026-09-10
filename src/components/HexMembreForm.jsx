import { useState } from 'react'
import { supabase } from '../lib/supabase'
import BceSearch from './BceSearch'

// Formulaire modal de création / édition d'un membre Hexagroup.
// props: initial (membre | null), onSaved(membre), onClose()
export default function HexMembreForm({ initial, onSaved, onClose }) {
  const isNew = !initial?.id
  const [f, setF] = useState({
    contact: initial?.contact || '', societe: initial?.societe || '', numero_bce: initial?.numero_bce || '',
    adresse: initial?.adresse || '', cp: initial?.cp || '', ville: initial?.ville || '',
    email: initial?.email || '', actif: initial?.actif !== false,
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!(f.societe || f.contact)) { alert('Renseigne au moins le nom ou la société.'); return }
    setBusy(true)
    const payload = {
      contact: f.contact || null, societe: f.societe || null, numero_bce: f.numero_bce || null,
      adresse: f.adresse || null, cp: f.cp || null, ville: f.ville || null, email: f.email || null, actif: !!f.actif,
    }
    let data
    if (isNew) { const r = await supabase.from('hex_membres').insert(payload).select().single(); data = r.data }
    else { const r = await supabase.from('hex_membres').update(payload).eq('id', initial.id).select().single(); data = r.data }
    setBusy(false)
    if (onSaved) onSaved(data)
    if (onClose) onClose()
  }

  return (
    <div style={bg}>
      <div style={{ ...card, width: 'min(620px,100%)' }}>
        <div style={head}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{isNew ? 'Nouveau membre' : 'Membre — ' + (initial.societe || initial.contact)}</div>
          <button onClick={onClose} style={close}><i className="ti ti-x" /></button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Rechercher via la BCE (entreprise belge)</label>
          <BceSearch onSelect={c => { const a = c.address || {}; setF(p => ({
            ...p,
            societe: c.denomination_with_legal_form || c.denomination || p.societe,
            numero_bce: c.cbe_number_formatted || c.cbe_number || p.numero_bce,
            adresse: a.street ? (a.street + ' ' + (a.street_number || '')).trim() : p.adresse,
            cp: a.post_code || p.cp, ville: a.city || p.ville,
          })) }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <div><label style={lbl}>Contact</label><input value={f.contact} onChange={e => set('contact', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Société</label><input value={f.societe} onChange={e => set('societe', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>N° BCE / TVA</label><input value={f.numero_bce} onChange={e => set('numero_bce', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>E-mail</label><input value={f.email} onChange={e => set('email', e.target.value)} placeholder="nom@societe.be" style={inp} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Adresse</label><input value={f.adresse} onChange={e => set('adresse', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Code postal</label><input value={f.cp} onChange={e => set('cp', e.target.value)} style={inp} /></div>
          <div><label style={lbl}>Ville</label><input value={f.ville} onChange={e => set('ville', e.target.value)} style={inp} /></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!f.actif} onChange={e => set('actif', e.target.checked)} />Membre actif
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, borderTop: '0.5px solid #eef2f7', paddingTop: 14 }}>
          <button onClick={onClose} style={ghost}>Annuler</button>
          <button onClick={save} disabled={busy} style={prim}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

const bg = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 60, overflowY: 'auto', padding: '40px 16px' }
const card = { background: '#fff', borderRadius: 14, padding: 24 }
const head = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const close = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }
const ghost = { padding: '9px 16px', borderRadius: 8, border: '0.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }
const prim = { padding: '9px 18px', borderRadius: 8, border: 'none', background: '#6E2C91', color: '#fff', cursor: 'pointer', fontWeight: 700 }
const lbl = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600 }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '0.5px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }
