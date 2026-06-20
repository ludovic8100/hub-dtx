import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { LODE } from '../../lib/lodeConfig'

const ORANGE = LODE.couleur
const NAVY = '#1e293b'

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-BE') : '—'

// ════════════════════════════════════════════════════════════════
//  ÉDITEUR CLIENT (avec recherche BCE)
// ════════════════════════════════════════════════════════════════
function EditeurClient({ client, onClose, onSaved }) {
  const [f, setF] = useState({
    type: 'entreprise', numero_bce: '', denomination: '', forme_juridique: '',
    nom: '', prenom: '', adresse: '', cp: '', ville: '', pays: 'Belgique',
    tva: '', email: '', telephone: '', gsm: '', notes: '', peppol_id: '', actif: true,
    ...(client || {}),
  })
  const [saving, setSaving] = useState(false)
  const [bceQuery, setBceQuery] = useState('')
  const [bceResults, setBceResults] = useState(null)
  const [bceLoading, setBceLoading] = useState(false)
  const [bceError, setBceError] = useState(null)
  // Autocomplétion adresse (Photon / OpenStreetMap)
  const [addrResults, setAddrResults] = useState(null)
  const [addrLoading, setAddrLoading] = useState(false)

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Autocomplétion adresse en temps réel (Photon, debounce 400ms)
  useEffect(() => {
    const q = (f.adresse || '').trim()
    if (q.length < 4) { setAddrResults(null); setAddrLoading(false); return }
    setAddrLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=8&lang=fr`, { signal: ctrl.signal })
        const json = await res.json()
        const list = (json.features || [])
          .map(ft => ft.properties)
          .filter(p => (p.countrycode === 'BE' || p.country === 'Belgique') && (p.street || p.name))
          .map(p => ({
            street: p.street || p.name || '',
            housenumber: p.housenumber || '',
            postcode: p.postcode || '',
            city: p.city || p.county || '',
          }))
          // dédup
          .filter((p, i, arr) => arr.findIndex(x => x.street === p.street && x.housenumber === p.housenumber && x.postcode === p.postcode) === i)
        setAddrResults(list.slice(0, 6))
      } catch (e) {
        if (e.name !== 'AbortError') setAddrResults(null)
      } finally {
        if (!ctrl.signal.aborted) setAddrLoading(false)
      }
    }, 400)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [f.adresse])

  const appliquerAdresse = (a) => {
    setF(p => ({
      ...p,
      adresse: [a.street, a.housenumber].filter(Boolean).join(' '),
      cp: a.postcode || p.cp,
      ville: a.city || p.ville,
    }))
    setAddrResults(null)
  }

  // Recherche BCE en temps réel (debounce 350ms)
  useEffect(() => {
    const q = bceQuery.trim()
    if (q.length < 3) { setBceResults(null); setBceError(null); setBceLoading(false); return }
    setBceLoading(true); setBceError(null)
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      const KEY = 'WecYIpno6XvAgZY9jIbyakcL9XfPc1wg'
      const digits = q.replace(/\D/g, '')
      const isNum = digits.length === 10
      const url = isNum
        ? `https://cbeapi.be/api/v1/company/${digits}`
        : `https://cbeapi.be/api/v1/company/search?name=${encodeURIComponent(q)}`
      try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' }, signal: ctrl.signal })
        if (!res.ok) {
          if (res.status === 404) { setBceResults([]); setBceError('Aucune entreprise trouvée.'); return }
          throw new Error(`HTTP ${res.status}`)
        }
        const json = await res.json()
        const data = json.data
        const list = Array.isArray(data) ? data : (data ? [data] : [])
        setBceResults(list.slice(0, 8))
        if (!list.length) setBceError('Aucune entreprise trouvée.')
      } catch (e) {
        if (e.name !== 'AbortError') setBceError('Recherche BCE indisponible : ' + e.message)
      } finally {
        if (!ctrl.signal.aborted) setBceLoading(false)
      }
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [bceQuery])

  // Remplit le formulaire depuis un résultat CBEAPI
  const appliquerBCE = (e) => {
    const bce = e.cbe_number_formatted || e.cbe_number || ''
    const digits = (e.cbe_number || bce).replace(/\D/g, '')
    const a = e.address || {}
    setF(p => ({
      ...p,
      type: 'entreprise',
      numero_bce: bce,
      denomination: e.denomination_with_legal_form || e.denomination || p.denomination,
      forme_juridique: e.juridical_form_short || e.juridical_form || p.forme_juridique,
      tva: digits ? 'BE' + digits : p.tva,
      peppol_id: digits ? '0208:' + digits : p.peppol_id,
      adresse: a.street ? `${a.street} ${a.street_number || ''}`.trim() : p.adresse,
      cp: a.post_code || p.cp,
      ville: a.city || p.ville,
    }))
    setBceResults(null); setBceQuery('')
  }

  const save = async () => {
    if (f.type === 'entreprise' && !f.denomination?.trim()) { alert('La dénomination est obligatoire'); return }
    if (f.type === 'particulier' && !f.nom?.trim()) { alert('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      const payload = { ...f }
      delete payload.id; delete payload.created_at; delete payload.updated_at
      if (client?.id) await supabase.from('lode_clients').update(payload).eq('id', client.id)
      else await supabase.from('lode_clients').insert(payload)
      onSaved()
    } catch (e) { alert('Erreur : ' + e.message) }
    finally { setSaving(false) }
  }

  const inp = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 3, display: 'block' }
  const isEnt = f.type === 'entreprise'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: 14, maxWidth: 720, width: '100%', padding: 24, fontFamily: "'Source Sans Pro', sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>{client?.id ? 'Modifier le client' : 'Nouveau client'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['entreprise', '🏢 Entreprise'], ['particulier', '👤 Particulier']].map(([v, l]) => (
            <button key={v} onClick={() => set('type', v)} style={{
              flex: 1, padding: '10px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700,
              border: f.type === v ? `2px solid ${ORANGE}` : '1px solid #e2e8f0',
              background: f.type === v ? '#fff7ed' : '#fff', color: f.type === v ? ORANGE : '#64748b',
            }}>{l}</button>
          ))}
        </div>

        {/* Recherche BCE (entreprise uniquement) — autocomplétion temps réel */}
        {isEnt && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 16, position: 'relative' }}>
            <label style={{ ...lbl, color: ORANGE }}>🔍 Rechercher dans la Banque-Carrefour des Entreprises</label>
            <div style={{ position: 'relative' }}>
              <input style={inp} value={bceQuery} onChange={e => setBceQuery(e.target.value)}
                placeholder="Commencez à taper un nom d'entreprise ou un n° BCE…" autoComplete="off" />
              {bceLoading && <span style={{ position: 'absolute', right: 12, top: 9, fontSize: 12, color: ORANGE }}>⏳</span>}
            </div>
            {bceError && !bceLoading && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{bceError}</div>}
            {bceResults && bceResults.length > 0 && (
              <div style={{ position: 'absolute', left: 14, right: 14, top: 70, zIndex: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto' }}>
                {bceResults.map((e, i) => (
                  <div key={i} onClick={() => appliquerBCE(e)} style={{
                    padding: '9px 12px', cursor: 'pointer', fontSize: 12,
                    borderBottom: i < bceResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#fff7ed'}
                    onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                    <div style={{ fontWeight: 700, color: NAVY }}>{e.denomination_with_legal_form || e.denomination}</div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>{e.cbe_number_formatted || e.cbe_number}{e.address?.city ? ' · ' + e.address.city : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Champs entreprise */}
        {isEnt && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 8 }}>
            <div><label style={lbl}>Dénomination *</label><input style={inp} value={f.denomination} onChange={e => set('denomination', e.target.value)} /></div>
            <div><label style={lbl}>N° BCE</label><input style={inp} value={f.numero_bce} onChange={e => set('numero_bce', e.target.value)} /></div>
          </div>
        )}
        {isEnt && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div><label style={lbl}>Forme juridique</label><input style={inp} value={f.forme_juridique} onChange={e => set('forme_juridique', e.target.value)} /></div>
            <div><label style={lbl}>N° TVA</label><input style={inp} value={f.tva} onChange={e => set('tva', e.target.value)} /></div>
          </div>
        )}

        {/* Contact / particulier */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          <div><label style={lbl}>{isEnt ? 'Nom du contact' : 'Nom *'}</label><input style={inp} value={f.nom} onChange={e => set('nom', e.target.value)} /></div>
          <div><label style={lbl}>Prénom</label><input style={inp} value={f.prenom} onChange={e => set('prenom', e.target.value)} /></div>
        </div>

        {/* Adresse */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
          <div style={{ position: 'relative' }}>
            <label style={lbl}>Adresse {addrLoading && <span style={{ color: ORANGE }}>⏳</span>}</label>
            <input style={inp} value={f.adresse} onChange={e => set('adresse', e.target.value)} autoComplete="off" placeholder="Commencez à taper la rue…" />
            {addrResults && addrResults.length > 0 && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: 60, zIndex: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto' }}>
                {addrResults.map((a, i) => (
                  <div key={i} onClick={() => appliquerAdresse(a)} style={{
                    padding: '8px 11px', cursor: 'pointer', fontSize: 12,
                    borderBottom: i < addrResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                    onMouseEnter={ev => ev.currentTarget.style.background = '#fff7ed'}
                    onMouseLeave={ev => ev.currentTarget.style.background = '#fff'}>
                    <span style={{ fontWeight: 600, color: NAVY }}>{[a.street, a.housenumber].filter(Boolean).join(' ')}</span>
                    <span style={{ color: '#94a3b8' }}> — {a.postcode} {a.city}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div><label style={lbl}>Code postal</label><input style={inp} value={f.cp} onChange={e => set('cp', e.target.value)} /></div>
          <div><label style={lbl}>Ville</label><input style={inp} value={f.ville} onChange={e => set('ville', e.target.value)} /></div>
        </div>

        {/* Coordonnées */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div><label style={lbl}>Email</label><input style={inp} value={f.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label style={lbl}>Téléphone</label><input style={inp} value={f.telephone} onChange={e => set('telephone', e.target.value)} /></div>
          <div><label style={lbl}>GSM</label><input style={inp} value={f.gsm} onChange={e => set('gsm', e.target.value)} /></div>
        </div>

        <div style={{ marginBottom: 18 }}><label style={lbl}>Notes</label><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ background: ORANGE, border: 'none', borderRadius: 9, padding: '10px 24px', cursor: saving ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════
export default function LodeClientsModule() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('lode_clients').select('*').order('created_at', { ascending: false })
    setClients(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const supprimer = async (id) => {
    if (!confirm('Supprimer ce client ?')) return
    await supabase.from('lode_clients').delete().eq('id', id)
    load()
  }

  const q = search.toLowerCase()
  const filtered = clients.filter(c =>
    !q || (c.denomination || '').toLowerCase().includes(q) || (c.nom || '').toLowerCase().includes(q) ||
    (c.prenom || '').toLowerCase().includes(q) || (c.numero_bce || '').includes(q) || (c.ville || '').toLowerCase().includes(q)
  )

  const nomAffiche = c => c.type === 'entreprise' ? c.denomination : `${c.prenom || ''} ${c.nom || ''}`.trim()

  return (
    <Layout currentPage="Clients">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: '0 0 2px' }}>Clients LODE</h1>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{clients.length} client{clients.length > 1 ? 's' : ''} encodé{clients.length > 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setEditing({})} style={{ background: ORANGE, border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="ti ti-plus" /> Nouveau client
          </button>
        </div>

        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (nom, dénomination, BCE, ville)…"
          style={{ width: '100%', maxWidth: 420, padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, marginBottom: 16, boxSizing: 'border-box', fontFamily: 'inherit' }} />

        {loading ? <p style={{ color: '#94a3b8' }}>Chargement…</p> :
          filtered.length === 0 ? <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Aucun client. Clique sur « Nouveau client » pour commencer.</p> :
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr>{['', 'Nom / Dénomination', 'BCE / TVA', 'Ville', 'Contact', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 ? '#fafafe' : '#fff', borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 12px', fontSize: 18 }}>{c.type === 'entreprise' ? '🏢' : '👤'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{nomAffiche(c) || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{c.numero_bce || c.tva || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b' }}>{c.ville || '—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b' }}>{c.email || c.gsm || c.telephone || '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setEditing(c)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#64748b' }}>Modifier</button>
                          <button onClick={() => supprimer(c.id)} style={{ background: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>×</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>

      {editing && <EditeurClient client={editing.id ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </Layout>
  )
}
