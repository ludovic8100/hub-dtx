import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const E = ENTITES.dynassur
const NAVY = '#0D2F5E'
const MOIS = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

// Formatage date/heure FR à partir d'un dateTime Graph (sans offset)
function fmtDateHeure(iso, journee) {
  if (!iso) return '—'
  const d = new Date(iso.length <= 19 ? iso + 'Z' : iso)
  if (isNaN(d)) return iso.slice(0, 16)
  const jour = `${d.getUTCDate()} ${MOIS[d.getUTCMonth() + 1]}`
  if (journee) return `${jour} · journée`
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${jour} · ${hh}:${mm}`
}
function tsOf(iso) { const d = new Date((iso || '').length <= 19 ? iso + 'Z' : iso); return isNaN(d) ? 0 : d.getTime() }

function KpiCard({ label, value, col, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', borderTop: `3px solid ${col}`, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function CatBadge({ code, cats }) {
  const c = cats[code]
  const col = (c && c.couleur) || '#64748b'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: col + '20', color: col, whiteSpace: 'nowrap' }}>
      {code}{c && c.libelle ? ` · ${c.libelle}` : ''}
    </span>
  )
}

export default function DynassurRdv() {
  const [rdv, setRdv] = useState([])
  const [cats, setCats] = useState({})        // { code: {libelle, couleur, entite} }
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('avenir')   // avenir | passes | tous
  const [filtreCat, setFiltreCat] = useState('')
  const [recherche, setRecherche] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [flash, setFlash] = useState(null)

  async function charger() {
    setLoading(true)
    const [{ data: cdata }, { data: rData }] = await Promise.all([
      supabase.from('rdv_categories').select('code,libelle,couleur,entite,ordre').order('ordre'),
      supabase.from('rdv').select('*').order('debut', { ascending: false }).range(0, 1999),
    ])
    const map = {}
    ;(cdata || []).forEach(c => { map[c.code] = c })
    setCats(map)
    setRdv(rData || [])
    setLoading(false)
  }
  useEffect(() => { charger() }, [])

  // Catégories Dynassur uniquement (DP / MANAGEMENT / FORMATION …)
  const codesDyn = useMemo(
    () => Object.values(cats).filter(c => (c.entite || '').toUpperCase() === 'DYNASSUR').map(c => c.code),
    [cats]
  )

  const now = Date.now()
  const liste = useMemo(() => {
    let l = rdv.filter(r => codesDyn.length === 0 || codesDyn.includes(r.categorie))
    if (filtreCat) l = l.filter(r => r.categorie === filtreCat)
    if (periode === 'avenir') l = l.filter(r => tsOf(r.debut) >= now - 86400000)
    if (periode === 'passes') l = l.filter(r => tsOf(r.debut) < now - 86400000)
    if (recherche.trim()) {
      const q = recherche.toLowerCase()
      l = l.filter(r => (r.objet || '').toLowerCase().includes(q)
        || (r.dossier_client || '').toLowerCase().includes(q)
        || (r.user_email || '').toLowerCase().includes(q))
    }
    return l.sort((a, b) => periode === 'passes' ? tsOf(b.debut) - tsOf(a.debut) : tsOf(a.debut) - tsOf(b.debut))
  }, [rdv, codesDyn, filtreCat, periode, recherche, now])

  // KPIs
  const totalDyn = useMemo(() => rdv.filter(r => codesDyn.includes(r.categorie)), [rdv, codesDyn])
  const avenir = totalDyn.filter(r => tsOf(r.debut) >= now - 86400000).length
  const parCat = useMemo(() => {
    const c = {}
    totalDyn.forEach(r => { c[r.categorie] = (c[r.categorie] || 0) + 1 })
    return c
  }, [totalDyn])

  async function creerTacheSuivi(r) {
    setBusyId(r.id)
    try {
      const dateTxt = fmtDateHeure(r.debut, r.journee_entiere)
      const echeance = r.debut ? new Date((r.debut.length <= 19 ? r.debut + 'Z' : r.debut)).toISOString().slice(0, 10) : null
      const { error } = await supabase.from('taches').insert({
        titre: `Suivi RDV : ${r.objet || 'sans objet'}`,
        description: `RDV du ${dateTxt} — catégorie ${r.categorie}${r.lieu ? ` — ${r.lieu}` : ''}${r.user_email ? ` (agenda ${r.user_email})` : ''}`,
        statut: 'todo',
        priorite: 'moyenne',
        categorie: 'RDV',
        source: 'rdv',
        dossier_client: r.dossier_client || null,
        echeance,
        lien_url: r.web_link || null,
      })
      if (error) throw error
      setFlash({ ok: true, msg: 'Tâche de suivi créée.' })
    } catch (e) {
      setFlash({ ok: false, msg: 'Échec création tâche : ' + (e.message || e) })
    } finally {
      setBusyId(null)
      setTimeout(() => setFlash(null), 4000)
    }
  }

  const selStyle = { padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: NAVY, background: '#fff', fontFamily: "'Source Sans Pro', sans-serif" }

  return (
    <Layout>
      <StatBanner
        color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
        title="RDV / Agenda" subtitle="Rendez-vous synchronisés depuis Outlook — suivi commercial ↔ gestionnaire"
        action={
          <button onClick={charger} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} />Actualiser
          </button>
        }
      />

      {flash && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: flash.ok ? '#16a34a15' : '#dc262615', color: flash.ok ? '#16a34a' : '#dc2626',
          border: `1px solid ${flash.ok ? '#16a34a40' : '#dc262640'}` }}>
          <i className={`ti ${flash.ok ? 'ti-check' : 'ti-alert-circle'}`} style={{ marginRight: 6 }} />{flash.msg}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="RDV 2026" value={totalDyn.length} col={E.color} />
        <KpiCard label="À venir" value={avenir} col="#16a34a" />
        {Object.keys(parCat).sort().map(code => (
          <KpiCard key={code} label={(cats[code] && cats[code].libelle) || code} value={parCat[code]} col={(cats[code] && cats[code].couleur) || '#64748b'} />
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['avenir', 'À venir'], ['passes', 'Passés'], ['tous', 'Tous']].map(([k, lbl]) => (
            <button key={k} onClick={() => setPeriode(k)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: `2px solid ${periode === k ? E.color : '#e2e8f0'}`, background: periode === k ? E.color : '#fff', color: periode === k ? '#fff' : '#64748b'
            }}>{lbl}</button>
          ))}
        </div>
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)} style={selStyle}>
          <option value="">Toutes catégories</option>
          {codesDyn.map(code => <option key={code} value={code}>{code} — {cats[code] && cats[code].libelle}</option>)}
        </select>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher objet / dossier / agenda…"
          style={{ ...selStyle, flex: 1, minWidth: 200 }} />
      </div>

      {/* Tableau */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          <i className="ti ti-loader-2" style={{ fontSize: 32, display: 'block', marginBottom: 12, animation: 'spin 1s linear infinite' }} />
          Chargement des RDV…
          <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
        </div>
      ) : liste.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8' }}>
          <i className="ti ti-calendar-off" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
          Aucun RDV pour ces filtres.<br />
          <span style={{ fontSize: 12 }}>Les RDV remontent automatiquement d'Outlook (catégories : {codesDyn.join(', ') || '—'}).</span>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '10px 14px' }}>Quand</th>
                  <th style={{ padding: '10px 14px' }}>Objet</th>
                  <th style={{ padding: '10px 14px' }}>Catégorie</th>
                  <th style={{ padding: '10px 14px' }}>Dossier</th>
                  <th style={{ padding: '10px 14px' }}>Agenda</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Suivi</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: NAVY, fontWeight: 600 }}>{fmtDateHeure(r.debut, r.journee_entiere)}</td>
                    <td style={{ padding: '10px 14px', maxWidth: 320 }}>
                      {r.web_link
                        ? <a href={r.web_link} target="_blank" rel="noreferrer" style={{ color: NAVY, textDecoration: 'none', fontWeight: 600 }}>{r.objet || '—'}</a>
                        : (r.objet || '—')}
                      {r.lieu && <div style={{ fontSize: 11, color: '#94a3b8' }}><i className="ti ti-map-pin" style={{ marginRight: 3 }} />{r.lieu}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}><CatBadge code={r.categorie} cats={cats} /></td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.dossier_client || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{(r.user_email || '').replace('@dynassur.be', '')}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button onClick={() => creerTacheSuivi(r)} disabled={busyId === r.id} style={{
                        padding: '5px 10px', borderRadius: 6, border: `1px solid ${E.color}40`, background: E.color + '12',
                        color: E.color, fontSize: 12, fontWeight: 700, cursor: busyId === r.id ? 'wait' : 'pointer', whiteSpace: 'nowrap'
                      }}>
                        <i className="ti ti-checkbox" style={{ marginRight: 4 }} />Tâche
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  )
}
