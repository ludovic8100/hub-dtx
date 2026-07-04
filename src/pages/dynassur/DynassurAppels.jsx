import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const E = ENTITES.dynassur
const NAVY = '#0D2F5E'

const fmtDT = iso => { if (!iso) return '—'; const d = new Date(String(iso).replace(' ', 'T')); return isNaN(d) ? '—' : d.toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
const isIn = dir => String(dir || '').toLowerCase().startsWith('in')

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function DynassurAppels() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sens, setSens] = useState('tous')   // tous | in | out
  const [q, setQ] = useState('')

  const charger = () => {
    setLoading(true)
    supabase.from('appels')
      .select('id,direction,numero_externe,numero_e164,agent,duree,debut,nom_3cx,client_id,clients(dossier)')
      .order('debut', { ascending: false })
      .range(0, 999)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }
  useEffect(() => { charger() }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(r => {
      if (sens === 'in' && !isIn(r.direction)) return false
      if (sens === 'out' && isIn(r.direction)) return false
      if (s) {
        const hay = `${r.numero_e164 || ''} ${r.numero_externe || ''} ${r.nom_3cx || ''} ${r.agent || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [rows, sens, q])

  const nEntrants = rows.filter(r => isIn(r.direction)).length
  const nSortants = rows.length - nEntrants
  const today = new Date().toISOString().slice(0, 10)
  const nToday = rows.filter(r => String(r.debut || '').slice(0, 10) === today).length

  const openFiche = r => {
    const dossier = r.clients?.dossier
    if (dossier) navigate('/dynassur/clients?dossier=' + encodeURIComponent(dossier))
  }

  return (
    <Layout currentPage="Appels">
      <StatBanner
        color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
        title="Appels" subtitle="Journal des appels — téléphonie 3CX, synchronisé en temps réel"
        action={
          <button onClick={charger} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />Actualiser
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Total (récents)" value={rows.length} col={E.color} />
        <Kpi label="Entrants" value={nEntrants} col="#16a34a" />
        <Kpi label="Sortants" value={nSortants} col="#1d4ed8" />
        <Kpi label="Aujourd'hui" value={nToday} col="#7c3aed" />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ v: 'tous', l: 'Tous' }, { v: 'in', l: 'Entrants' }, { v: 'out', l: 'Sortants' }].map(o => (
            <button key={o.v} onClick={() => setSens(o.v)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid ' + (sens === o.v ? E.color : '#e2e8f0'), background: sens === o.v ? E.color : '#fff', color: sens === o.v ? '#fff' : '#64748b', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>{o.l}</button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (numéro, nom, poste)…" style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
      </div>

      {/* Tableau */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              {['Sens', 'Numéro', 'Contact', 'Poste', 'Durée', 'Date / heure', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Chargement…</td></tr>
            ) : !filtered.length ? (
              <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Aucun appel.</td></tr>
            ) : filtered.map((r, i) => {
              const entrant = isIn(r.direction)
              const dossier = r.clients?.dossier
              return (
                <tr key={r.id} onClick={() => openFiche(r)} style={{ borderTop: '1px solid #f1f5f9', cursor: dossier ? 'pointer' : 'default', background: i % 2 ? '#fafafe' : '#fff' }}
                  onMouseEnter={e => { if (dossier) e.currentTarget.style.background = '#eff6ff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 ? '#fafafe' : '#fff' }}>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: entrant ? '#dcfce7' : '#dbeafe', color: entrant ? '#16a34a' : '#1d4ed8', whiteSpace: 'nowrap' }}>
                      <i className={`ti ${entrant ? 'ti-phone-incoming' : 'ti-phone-outgoing'}`} style={{ marginRight: 4 }} />{entrant ? 'Entrant' : 'Sortant'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: '#1e293b' }}>{r.numero_e164 || r.numero_externe || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#1e293b' }}>{r.nom_3cx || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b' }}>{r.agent || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b' }}>{r.duree || '—'}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDT(r.debut)}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>{dossier && <i className="ti ti-external-link" style={{ color: E.color }} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>{filtered.length} appel(s) affiché(s){rows.length >= 1000 ? ' — 1000 plus récents' : ''}. Clic sur une ligne = ouvrir la fiche client liée (quand un dossier est rattaché).</p>
    </Layout>
  )
}
