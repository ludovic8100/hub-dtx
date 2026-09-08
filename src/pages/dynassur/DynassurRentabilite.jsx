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

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const on = () => setM(window.innerWidth < 640)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return m
}

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ flex: '1 1 150px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{value}</div>
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

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 800 : 600, color: color || '#334155', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

export default function DynassurRentabilite() {
  const E = ENTITES.dynassur
  const mobile = useIsMobile()
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

  const ecartDe = r => r.paye_reel != null ? r.paye_reel - (r.retro_theorique || 0) : null
  const pctDe = r => { const e = ecartDe(r); return (e != null && r.retro_theorique) ? e / r.retro_theorique * 100 : null }
  const ecartCol = r => { const p = pctDe(r); return ecartDe(r) == null ? '#cbd5e1' : (p != null && Math.abs(p) >= 20) ? '#dc2626' : '#16a34a' }

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
            <Kpi label="Commissions" value={fmtE(commTot)} col={BLUE} sub={`année ${annee}`} />
            <Kpi label="Rétro. théorique" value={fmtE(retroTheo)} col="#9333ea" sub="quittances × taux" />
            <Kpi label="Payé réel (SA)" value={fmtE(payeReel)} col="#ea580c" sub="virements réels" />
            <Kpi label="Marge théorique" value={fmtE(margeTheo)} col="#16a34a" sub="avant structure" />
          </div>

          <Section titre="Sous-agents — théorique vs réel payé"
            note="Écart = payé réel − rétrocession théorique. Écart fortement positif = bonus vie / avances non captés par les quittances. « — » en réel = libellé de paiement à renseigner dans Acteurs métier.">
            {mobile ? (
              <div>
                {sa.map(r => {
                  const e = ecartDe(r), p = pctDe(r)
                  return (
                    <div key={r.code} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, color: NAVY, marginBottom: 4 }}>{nom(r)} <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.code}</span></div>
                      <Row label="Commission" value={fmtE(r.commission)} />
                      <Row label="Rétro. théorique" value={fmtE(r.retro_theorique)} />
                      <Row label="Payé réel" value={r.paye_reel == null ? '—' : fmtE(r.paye_reel)} color={r.paye_reel == null ? '#f59e0b' : '#334155'} />
                      <Row label="Écart" value={e == null ? '—' : `${fmtE(e)}${p != null ? ` (${fmtP(p)})` : ''}`} color={ecartCol(r)} bold />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={th}>Sous-agent</th><th style={thR}>Commission</th><th style={thR}>Rétro. théorique</th><th style={thR}>Payé réel</th><th style={thR}>Écart</th>
                  </tr></thead>
                  <tbody>
                    {sa.map(r => {
                      const e = ecartDe(r), p = pctDe(r)
                      return (
                        <tr key={r.code}>
                          <td style={td}><span style={{ fontWeight: 600, color: NAVY }}>{nom(r)}</span> <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.code}</span></td>
                          <td style={tdR}>{fmtE(r.commission)}</td>
                          <td style={tdR}>{fmtE(r.retro_theorique)}</td>
                          <td style={tdR}>{r.paye_reel == null ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>—</span> : fmtE(r.paye_reel)}</td>
                          <td style={{ ...tdR, fontWeight: 700, color: ecartCol(r) }}>{e == null ? '—' : `${fmtE(e)}${p != null ? ` (${fmtP(p)})` : ''}`}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section titre="Production interne (employés)"
            note="Commission acquise 100 % à Dynassur (coût = salaires, dans la structure).">
            {mobile ? (
              <div>
                {interne.map(r => (
                  <div key={r.code} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 2px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: NAVY }}>{nom(r)} <span style={{ fontSize: 10, color: '#94a3b8' }}>{r.code}</span></span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtE(r.commission)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Producteur</th><th style={thR}>Commission (= marge)</th></tr></thead>
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
            )}
          </Section>

          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
            Base : quittances {annee}. Le CA cash complet (bonus répartis par producteur) viendra de la réconciliation des bordereaux RCP.
          </div>
        </>}
      </div>
    </Layout>
  )
}
