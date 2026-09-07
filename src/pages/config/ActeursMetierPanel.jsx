import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Types de travail pour les taux de commission/rétrocession
const TYPES_TRAVAIL = ['Non-Vie', 'Vie', 'Santé', 'Crédit', 'PJ']

const CATS = [
  { key: 'employe',   label: 'Employés',    color: '#0080BD', test: c => c.est_commercial || c.est_gestionnaire },
  { key: 'sousagent', label: 'Sous-agents', color: '#7c3aed', test: c => c.est_sous_agent },
  { key: 'apporteur', label: 'Apporteurs',  color: '#ea580c', test: c => c.est_apporteur },
]

const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box' }

function catOf(c) {
  return CATS.find(x => x.test(c)) || { key: 'autre', label: 'Autre', color: '#94a3b8' }
}

export default function ActeursMetierPanel() {
  const [rows, setRows] = useState([])
  const [taux, setTaux] = useState({})        // collaborateur_id -> { type_travail: valeur }
  const [sel, setSel] = useState(null)
  const [selTaux, setSelTaux] = useState({})  // { type_travail: valeur } de l'acteur sélectionné
  const [filter, setFilter] = useState('tous')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: cs } = await supabase.from('collaborateurs').select('*').order('nom_complet')
    const { data: ts } = await supabase.from('collaborateur_taux').select('*')
    const mt = {}
    ;(ts || []).forEach(t => { (mt[t.collaborateur_id] || (mt[t.collaborateur_id] = {}))[t.type_travail] = t.taux })
    setRows(cs || []); setTaux(mt); setLoading(false)
  }

  function notify(m) { setFlash(m); setTimeout(() => setFlash(null), 2500) }

  function pick(c) {
    setSel({ ...c, noms_repris_str: (c.noms_repris || []).join(', ') })
    setSelTaux({ ...(taux[c.id] || {}) })
  }
  function nouveau() {
    setSel({
      id: null, code: '', nom_complet: '', type: 'physique', actif: true,
      est_commercial: false, est_gestionnaire: false, est_sous_agent: false, est_apporteur: false, est_admin: false,
      noms_repris_str: '',
    })
    setSelTaux({})
  }

  async function save() {
    if (!sel) return
    if (!sel.nom_complet) { notify('❌ Le nom est obligatoire'); return }
    setSaving(true)
    const { id, noms_repris_str, taux_commission, created_at, updated_at, ...rest } = sel
    const payload = {
      ...rest,
      numero: (rest.numero === '' || rest.numero == null) ? null : Number(rest.numero),
      noms_repris: noms_repris_str ? noms_repris_str.split(',').map(s => s.trim()).filter(Boolean) : null,
    }
    let cid = id
    if (id) {
      const { error } = await supabase.from('collaborateurs').update(payload).eq('id', id)
      if (error) { setSaving(false); notify('❌ ' + error.message); return }
    } else {
      const { data, error } = await supabase.from('collaborateurs').insert(payload).select('id').single()
      if (error) { setSaving(false); notify('❌ ' + error.message); return }
      cid = data.id
    }
    // Taux par type de travail (upsert sur la contrainte unique)
    const trows = TYPES_TRAVAIL.map(t => ({
      collaborateur_id: cid, type_travail: t,
      taux: (selTaux[t] === '' || selTaux[t] == null) ? null : Number(selTaux[t]),
      actif: true,
    }))
    const { error: te } = await supabase.from('collaborateur_taux').upsert(trows, { onConflict: 'collaborateur_id,type_travail' })
    setSaving(false)
    if (te) { notify('❌ Taux : ' + te.message); return }
    notify('✓ Enregistré')
    await load()
    const { data: fresh } = await supabase.from('collaborateurs').select('*').eq('id', cid).single()
    if (fresh) pick(fresh)
  }

  async function remove() {
    if (!sel?.id) { setSel(null); return }
    if (!window.confirm('Supprimer « ' + (sel.nom_complet || 'cet acteur') + ' » ?')) return
    setSaving(true)
    const { error } = await supabase.from('collaborateurs').delete().eq('id', sel.id)
    setSaving(false)
    if (error) { notify('❌ ' + error.message); return }
    setSel(null); notify('✓ Supprimé'); load()
  }

  const list = rows
    .filter(c => filter === 'tous' || catOf(c).key === filter)
    .filter(c => !search || (c.nom_complet || '').toLowerCase().includes(search.toLowerCase()) || (c.code || '').toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Chargement…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,300px) 1fr', gap: 18, alignItems: 'start' }}>
      {flash && <div style={{ position: 'fixed', top: 16, right: 16, background: '#1e293b', color: '#fff', padding: '10px 16px', borderRadius: 10, zIndex: 50, fontWeight: 600 }}>{flash}</div>}

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={nouveau} style={{ padding: '9px 14px', border: 'none', borderRadius: 10, background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>➕ Nouvel acteur</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={inp} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[['tous', 'Tous'], ...CATS.map(c => [c.key, c.label])].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 10px', borderRadius: 999, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === k ? '#1e293b' : '#fff', color: filter === k ? '#fff' : '#475569' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 560, overflowY: 'auto' }}>
          {list.map(c => {
            const cat = catOf(c); const active = sel?.id === c.id
            return (
              <button key={c.id} onClick={() => pick(c)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + (active ? '#1e293b' : '#e2e8f0'), background: active ? '#f8fafc' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom_complet || '(sans nom)'}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{c.code} · {cat.label}{c.actif === false ? ' · inactif' : ''}</span>
                </span>
              </button>
            )
          })}
          {!list.length && <div style={{ color: '#94a3b8', fontSize: 13, padding: 10 }}>Aucun acteur.</div>}
        </div>
      </div>

      {/* Fiche */}
      {sel ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Section titre="Coordonnées">
            <Grid>
              <F label="Nom complet" value={sel.nom_complet} onChange={v => setSel(s => ({ ...s, nom_complet: v }))} />
              <F label="Code" value={sel.code} onChange={v => setSel(s => ({ ...s, code: (v || '').toUpperCase() }))} />
              <F label="N° producteur" type="number" value={sel.numero} onChange={v => setSel(s => ({ ...s, numero: v }))} />
              <div><Lbl>Type</Lbl>
                <select value={sel.type || 'physique'} onChange={e => setSel(s => ({ ...s, type: e.target.value }))} style={inp}>
                  <option value="physique">Personne physique</option>
                  <option value="morale">Personne morale</option>
                </select>
              </div>
              <F label="Email" value={sel.email} onChange={v => setSel(s => ({ ...s, email: v }))} />
              <F label="Téléphone" value={sel.telephone} onChange={v => setSel(s => ({ ...s, telephone: v }))} />
              <F label="Adresse" value={sel.adresse} onChange={v => setSel(s => ({ ...s, adresse: v }))} />
              <F label="Code postal" value={sel.code_postal} onChange={v => setSel(s => ({ ...s, code_postal: v }))} />
              <F label="Ville" value={sel.ville} onChange={v => setSel(s => ({ ...s, ville: v }))} />
              <F label="N° BCE" value={sel.bce} onChange={v => setSel(s => ({ ...s, bce: v }))} />
            </Grid>
          </Section>

          <Section titre="Rôle">
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
              <Chk label="Commercial" on={!!sel.est_commercial} onClick={() => setSel(s => ({ ...s, est_commercial: !s.est_commercial }))} />
              <Chk label="Gestionnaire" on={!!sel.est_gestionnaire} onClick={() => setSel(s => ({ ...s, est_gestionnaire: !s.est_gestionnaire }))} />
              <Chk label="Sous-agent" on={!!sel.est_sous_agent} onClick={() => setSel(s => ({ ...s, est_sous_agent: !s.est_sous_agent }))} />
              <Chk label="Apporteur" on={!!sel.est_apporteur} onClick={() => setSel(s => ({ ...s, est_apporteur: !s.est_apporteur }))} />
              <Chk label="Admin" on={!!sel.est_admin} onClick={() => setSel(s => ({ ...s, est_admin: !s.est_admin }))} />
              <Chk label="Actif" on={sel.actif !== false} onClick={() => setSel(s => ({ ...s, actif: !(s.actif !== false) }))} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Grid>
                <F label="Nom en donnée SOUS-AGENT (quittances)" value={sel.nom_sa_data} onChange={v => setSel(s => ({ ...s, nom_sa_data: v }))} />
                <F label="Nom en donnée GESTIONNAIRE (quittances)" value={sel.nom_gestionnaire_data} onChange={v => setSel(s => ({ ...s, nom_gestionnaire_data: v }))} />
                <F label="Alias / noms repris (séparés par ,)" value={sel.noms_repris_str} onChange={v => setSel(s => ({ ...s, noms_repris_str: v }))} />
              </Grid>
            </div>
          </Section>

          <Section titre="Banque">
            <Grid>
              <F label="IBAN" value={sel.iban} onChange={v => setSel(s => ({ ...s, iban: v }))} />
              <F label="BIC" value={sel.bic} onChange={v => setSel(s => ({ ...s, bic: v }))} />
            </Grid>
          </Section>

          <Section titre="Taux de commission / rétrocession par type de travail (%)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
              {TYPES_TRAVAIL.map(t => (
                <div key={t}><Lbl>{t}</Lbl>
                  <div style={{ position: 'relative' }}>
                    <input type="number" step="0.01" value={selTaux[t] ?? ''} onChange={e => setSelTaux(m => ({ ...m, [t]: e.target.value }))} style={{ ...inp, paddingRight: 26 }} />
                    <span style={{ position: 'absolute', right: 10, top: 9, color: '#94a3b8', fontSize: 13 }}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <button onClick={save} disabled={saving} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? .6 : 1 }}>{saving ? '…' : (sel.id ? '💾 Enregistrer' : '➕ Créer')}</button>
            <button onClick={remove} disabled={saving} style={{ marginLeft: 'auto', padding: '10px 16px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{sel.id ? '🗑 Supprimer' : '✕ Annuler'}</button>
          </div>
        </div>
      ) : <div style={{ color: '#94a3b8', padding: 20 }}>Sélectionne un acteur ou crée-en un.</div>}
    </div>
  )
}

function Section({ titre, children }) {
  return <div>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#1e293b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.03em' }}>{titre}</div>
    {children}
  </div>
}
function Grid({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>{children}</div> }
function Lbl({ children }) { return <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>{children}</div> }
function F({ label, value, onChange, type = 'text' }) { return <div><Lbl>{label}</Lbl><input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} style={inp} /></div> }
function Chk({ label, on, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? '#16a34a' : '#cbd5e1', position: 'relative', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#475569' }}>{label}</span>
    </button>
  )
}
