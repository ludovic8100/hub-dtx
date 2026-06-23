import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const G = ENTITES.groupe
const NAVY = '#0D2F5E'
const ENTITE_OPTS = ['DYNASSUR', 'LODE', 'DTX', 'HEXAGROUP', 'PRIVE']
const TYPE_OPTS = ['client', 'fiscalite', 'interne', 'formation', 'compagnie', 'autre']

const blank = () => ({ id: null, code: '', libelle: '', entite: 'DYNASSUR', type: 'client', couleur: '#0080BD', sync_enabled: true, actif: true, ordre: 0, _new: true })

export default function RdvCategories() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [flash, setFlash] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('rdv_categories').select('*').order('ordre').order('code')
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function notify(ok, msg) { setFlash({ ok, msg }); setTimeout(() => setFlash(null), 4000) }
  function patch(i, field, val) { setRows(r => r.map((row, k) => k === i ? { ...row, [field]: val, _dirty: true } : row)) }
  function addRow() { setRows(r => [...r, blank()]) }

  async function save(row, i) {
    if (!row.code.trim() || !row.libelle.trim()) { notify(false, 'Code et libellé obligatoires.'); return }
    setBusy(i)
    const payload = {
      code: row.code.trim(), libelle: row.libelle.trim(), entite: row.entite, type: row.type,
      couleur: row.couleur, sync_enabled: row.sync_enabled, actif: row.actif, ordre: Number(row.ordre) || 0,
      updated_at: new Date().toISOString(),
    }
    try {
      let error
      if (row.id) ({ error } = await supabase.from('rdv_categories').update(payload).eq('id', row.id))
      else ({ error } = await supabase.from('rdv_categories').insert(payload))
      if (error) throw error
      notify(true, `Catégorie « ${row.code} » enregistrée.`)
      await load()
    } catch (e) { notify(false, 'Erreur : ' + (e.message || e)) }
    finally { setBusy(null) }
  }

  async function del(row, i) {
    if (row._new) { setRows(r => r.filter((_, k) => k !== i)); return }
    if (!window.confirm(`Supprimer la catégorie « ${row.code} » ? Les RDV déjà synchronisés ne seront pas supprimés.`)) return
    setBusy(i)
    try {
      const { error } = await supabase.from('rdv_categories').delete().eq('id', row.id)
      if (error) throw error
      notify(true, `Catégorie « ${row.code} » supprimée.`)
      await load()
    } catch (e) { notify(false, 'Erreur : ' + (e.message || e)) }
    finally { setBusy(null) }
  }

  const inp = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: NAVY, fontFamily: "'Source Sans Pro', sans-serif", width: '100%', boxSizing: 'border-box' }
  const th = { padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#64748b', whiteSpace: 'nowrap' }
  const td = { padding: '8px 12px', verticalAlign: 'middle' }

  return (
    <Layout>
      <StatBanner
        color={G.color} colorDark={G.colorDark}
        title="Catégories RDV" subtitle="Pilote la synchro agenda : seules les catégories actives + synchro sont remontées d'Outlook"
        action={
          <button onClick={addRow} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-plus" style={{ marginRight: 6 }} />Ajouter
          </button>
        }
      />

      {flash && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: flash.ok ? '#16a34a15' : '#dc262615', color: flash.ok ? '#16a34a' : '#dc2626', border: `1px solid ${flash.ok ? '#16a34a40' : '#dc262640'}` }}>
          <i className={`ti ${flash.ok ? 'ti-check' : 'ti-alert-circle'}`} style={{ marginRight: 6 }} />{flash.msg}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b' }}>
          <i className="ti ti-info-circle" style={{ marginRight: 6 }} />
          Le <b>code</b> doit correspondre exactement au nom de la catégorie Outlook (sensible à la casse pour l'affichage, insensible pour le matching).
        </div>
        {loading ? (
          <div style={{ padding: 50, textAlign: 'center', color: '#94a3b8' }}>
            <i className="ti ti-loader-2" style={{ fontSize: 28, animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#f8fafc' }}>
                <th style={{ ...th, width: 110 }}>Code</th>
                <th style={th}>Libellé</th>
                <th style={{ ...th, width: 130 }}>Entité</th>
                <th style={{ ...th, width: 120 }}>Type</th>
                <th style={{ ...th, width: 70 }}>Couleur</th>
                <th style={{ ...th, width: 60 }}>Ordre</th>
                <th style={{ ...th, width: 70, textAlign: 'center' }}>Synchro</th>
                <th style={{ ...th, width: 60, textAlign: 'center' }}>Actif</th>
                <th style={{ ...th, width: 130, textAlign: 'right' }}>Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id || `new-${i}`} style={{ borderTop: '1px solid #f1f5f9', background: row._new ? '#f0f9ff' : '#fff' }}>
                    <td style={td}><input style={inp} value={row.code} onChange={e => patch(i, 'code', e.target.value)} placeholder="DP" /></td>
                    <td style={td}><input style={inp} value={row.libelle} onChange={e => patch(i, 'libelle', e.target.value)} placeholder="RDV client" /></td>
                    <td style={td}>
                      <select style={inp} value={row.entite || ''} onChange={e => patch(i, 'entite', e.target.value)}>
                        {ENTITE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={td}>
                      <select style={inp} value={row.type || ''} onChange={e => patch(i, 'type', e.target.value)}>
                        {TYPE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <input type="color" value={row.couleur || '#0080BD'} onChange={e => patch(i, 'couleur', e.target.value)}
                        style={{ width: 36, height: 28, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 0, background: '#fff' }} />
                    </td>
                    <td style={td}><input type="number" style={{ ...inp, width: 56 }} value={row.ordre ?? 0} onChange={e => patch(i, 'ordre', e.target.value)} /></td>
                    <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={!!row.sync_enabled} onChange={e => patch(i, 'sync_enabled', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                    <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={!!row.actif} onChange={e => patch(i, 'actif', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => save(row, i)} disabled={busy === i} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: G.color, color: '#fff', fontSize: 12, fontWeight: 700, cursor: busy === i ? 'wait' : 'pointer', marginRight: 6 }}>
                        <i className="ti ti-device-floppy" style={{ marginRight: 4 }} />{row._new ? 'Créer' : 'OK'}
                      </button>
                      <button onClick={() => del(row, i)} disabled={busy === i} title="Supprimer" style={{ padding: '5px 9px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                        <i className="ti ti-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Aucune catégorie. Cliquez sur « Ajouter ».</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
