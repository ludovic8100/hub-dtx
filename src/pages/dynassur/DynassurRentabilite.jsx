import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const BLUE = '#0080BD'
const NAVY = '#0D2F5E'

const AGENT_NOMS = {
  GGO: 'Gregory Godfroid', TJA: 'Thibault Japsenne', PFQ: 'Priscilla Fernandez',
  MTE: 'Michelangelo Terrana', NGI: 'Nadine Ginis', LDE: 'Ludovic Detilloux',
  JFS: 'J-F. Simonis', FMZ: 'Fabrice Mammo', ICE: 'Ingrid Cezar',
  RCA: 'Raphael Carrea', MVM: 'Michael Van Muylder', VPE: 'Vincent Pesser',
  LGM: 'Luisa Gaen Munoz', OBA: 'Olivier Baudelet', RDE: 'Renaud Desclez',
  DCO: 'Didier Coco', HML: 'Homelinks', FBL: 'F. Bleret', BHU: 'B. Hurard',
}

const fmtE = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtP = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v)} %`

const th = { padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' }
const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ flex: '1 1 180px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: col }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Section({ titre, children, note }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{titre}</div>
      {note && <div style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 10px' }}>{note}</div>}
      {children}
    </div>
  )
}

export default function DynassurRentabilite() {
  const E = ENTITES.dynassur
  const [annee, setAnnee] = useState(2025)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase.from('v_pnl_producteur_annee').select('*').eq('annee', annee)
      if (alive) { setRows(Array.isArray(data) ? data : []); setLoading(false) }
    })()
    return () => { alive = false }
  }, [annee])

  const nom = r => AGENT_NOMS[r.code] || r.nom || r.code
  const sa = rows.filter(r => r.est_sous_agent).sort((a, b) => (b.commission || 0) - (a.commission || 0))
  const interne = rows.filter(r => !r.est_sous_agent && (r.commission || 0) > 0).sort((a, b) => (b.commission || 0) - (a.commission || 0))

  const commTot = rows.reduce((s, r) => s + (r.commission || 0), 0)
  const retroTheo = sa.reduce((s, r) => s + (r.retro_theorique || 0), 0)
  const payeReel = sa.reduce((s, r) => s + (r.paye_reel || 0), 0)
  const margeTheo = rows.reduce((s, r) => s + (r.marge_theorique || 0), 0)

  return (
    <Layout currentPage="Rentabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title="Rentabilité / P&L par producteur" subtitle="Dynassur SRL — base quittances, théorique vs réel payé" />

        <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
          {[2025, 2026].map(y => (
            <button key={y} onClick={() => setAnnee(y)}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid ' + (annee === y ? BLUE : '#e2e8f0'), background: annee === y ? BLUE : '#fff', color: annee === y ? '#fff' : '#475569', fontWeight: 700, cursor: 'pointer' }}>
              {y}{y === 2026 ? ' (partiel)' : ''}
            </button>
          ))}
        </div>

        {loading ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Calcul…</div> : <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Kpi label="Commissions (quittances)" value={fmtE(commTot)} col={BLUE} sub={`année ${annee}`} />
            <Kpi label="Rétrocession théorique" value={fmtE(retroTheo)} col="#9333ea" sub="quittances × taux (sous-agents)" />
            <Kpi label="Payé réel aux sous-agents" value={fmtE(payeReel)} col="#ea580c" sub="virements réels (inclut bonus)" />
            <Kpi label="Marge Dynassur (théorique)" value={fmtE(margeTheo)} col="#16a34a" sub="avant structure & employés" />
          </div>

          <Section titre="Sous-agents — théorique vs réel payé"
            note="Écart = payé réel − rétrocession théorique. Un écart fortement positif = bonus vie / boosters / avances non captés par les quittances (ex. OBA, FMZ). « — » en réel = libellé de paiement à renseigner dans Acteurs métier (Alias / noms repris).">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Sous-agent</th>
                  <th style={thR}>Commission</th>
                  <th style={thR}>Rétro. théorique</th>
                  <th style={thR}>Payé réel</th>
                  <th style={thR}>Écart</th>
                </tr></thead>
                <tbody>
                  {sa.map(r => {
                    const ecart = r.paye_reel != null ? r.paye_reel - (r.retro_theorique || 0) : null
                    const ecartPct = (ecart != null && r.retro_theorique) ? ecart / r.retro_theorique * 100 : null
                    const alerte = ecartPct != null && Math.abs(ecartPct) >= 20
                    return (
                      <tr key={r.code}>
                        <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{nom(r)}</span> <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.code}</span></td>
                        <td style={tdR}>{fmtE(r.commission)}</td>
                        <td style={tdR}>{fmtE(r.retro_theorique)}</td>
                        <td style={tdR}>{r.paye_reel == null ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>—</span> : fmtE(r.paye_reel)}</td>
                        <td style={{ ...tdR, fontWeight: 700, color: ecart == null ? '#cbd5e1' : alerte ? '#dc2626' : '#16a34a' }}>
                          {ecart == null ? '—' : `${fmtE(ecart)}${ecartPct != null ? ` (${fmtP(ecartPct)})` : ''}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Section>

          <Section titre="Production interne (employés)"
            note="Commission acquise 100 % à Dynassur (le coût = les salaires, dans la structure — pas une rétrocession).">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>Producteur</th>
                  <th style={thR}>Commission (= marge)</th>
                </tr></thead>
                <tbody>
                  {interne.map(r => (
                    <tr key={r.code}>
                      <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{nom(r)}</span> <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.code}</span></td>
                      <td style={tdR}>{fmtE(r.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
            Base : quittances {annee} (hors lignes non ventilées). Le CA cash complet (avec bonus répartis par producteur) viendra de la réconciliation des bordereaux RCP.
          </div>
        </>}
      </div>
    </Layout>
  )
}
