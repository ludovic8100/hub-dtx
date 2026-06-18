import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

// ── Palette & styles cohérents avec le reste du Hub ──
const C = {
  navy:'#1A3A6B', navyMid:'#1E5799', cyan:'#29ABE2', cyanB:'#00AEEF',
  bg:'#F4F6F9', white:'#FFFFFF', border:'#DDE3ED',
  textD:'#1A3A6B', textM:'#4A5568', textL:'#8A9BBE',
  ok:'#16a34a', warn:'#f59e0b', danger:'#dc2626',
  AG:'#005F9E', AXA:'#E63329', VIVIUM:'#00A650', ALLIANZ:'#003781'
}
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:'0 1px 4px rgba(26,58,107,0.06)' },
  th:{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:700, color:C.textL, borderBottom:`1px solid ${C.border}`, textTransform:'uppercase', letterSpacing:.5 },
  td:{ padding:'10px 12px', borderBottom:`1px solid ${C.border}`, color:C.textM, fontSize:13 },
  kpi:(col)=>({ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:'18px 20px', boxShadow:'0 1px 4px rgba(26,58,107,0.06)', borderTop:`3px solid ${col||C.cyan}` }),
  tab:(active, col)=>({ padding:'9px 18px', border:'none', borderBottom: active?`2px solid ${col||C.cyan}`:'2px solid transparent', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: active?700:400, color: active?(col||C.navy):C.textL, transition:'all 0.15s' }),
  badge:(col)=>({ display:'inline-block', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:col+'22', color:col, letterSpacing:.3 }),
  progress:(pct, col)=>({
    outer:{ background:'#e2e8f0', borderRadius:6, height:8, width:'100%', overflow:'hidden' },
    inner:{ width:`${Math.min(pct||0,100)}%`, height:'100%', borderRadius:6, background: (pct||0)>=100?C.ok:(pct||0)>=70?col||C.cyan:C.warn, transition:'width 0.4s' }
  })
}
const fmt = v => v==null?'—':new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtN = v => v==null?'—':new Intl.NumberFormat('fr-BE').format(v)
const fmtPct = v => v==null?'—':`${Number(v).toFixed(1)} %`

// ── Barre de progression ──
function ProgressBar({ pct, col }) {
  const s = D.progress(pct, col)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={s.outer}><div style={s.inner} /></div>
      <span style={{ fontSize:12, fontWeight:700, color: (pct||0)>=100?C.ok:(pct||0)>=70?col||C.cyan:C.warn, minWidth:38 }}>{fmtPct(pct)}</span>
    </div>
  )
}

// ── KPI Card ──
function KpiCard({ label, value, sub, col, pct }) {
  return (
    <div style={D.kpi(col)}>
      <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.05, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:800, color:'#0f172a', marginBottom:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:C.textM, marginBottom:pct!=null?6:0 }}>{sub}</div>}
      {pct!=null && <ProgressBar pct={pct} col={col} />}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET 1 — DYNASSUR GLOBAL
// ══════════════════════════════════════════════
function OngletGlobal({ objectifs, loading }) {
  const AGENTS = ['GGO','TJA','PFQ','MTE','NGI','LDE']
  const AGENT_NOMS = { GGO:'Gregory Godfroid', TJA:'Thibault Japsenne', PFQ:'Priscilla Fernandez', MTE:'Michelangelo Terrana', NGI:'Nadine Ginis', LDE:'Ludovic Detilloux' }

  const global = objectifs.find(o => o.scope==='global' && o.period_type==='year')
  const parAgent = AGENTS.map(code => objectifs.find(o => o.scope==='agent' && o.agent_code===code && o.period_type==='year')).filter(Boolean)

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.textL }}>Chargement…</div>

  return (
    <div>
      {/* KPIs globaux */}
      {global && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ fontSize:13, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.5, marginBottom:14 }}>Objectifs annuels Dynassur</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14 }}>
            <KpiCard label="Nouvelles Affaires" value={`${fmtN(global.actual_na)} / ${fmtN(global.target_na)}`} col={C.cyan} pct={global.pct_na} sub={`Objectif : ${fmtN(global.target_na)} NA/an`} />
            <KpiCard label="Primes" value={fmt(global.actual_primes)} col='#7c3aed' pct={global.pct_primes} sub={`Objectif : ${fmt(global.target_primes)}`} />
            <KpiCard label="Commissions" value={fmt(global.actual_commissions)} col={C.ok} pct={global.pct_commissions} sub={`Objectif : ${fmt(global.target_commissions)}`} />
            <KpiCard label="Mandats faveur" value={`${fmtN(global.actual_mandat_fav)} / ${fmtN(global.target_mandat_fav)}`} col={C.warn} pct={global.target_mandat_fav>0?global.actual_mandat_fav/global.target_mandat_fav*100:null} />
          </div>
        </div>
      )}

      {/* Par agent */}
      {parAgent.length > 0 && (
        <div style={D.card}>
          <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.5, marginBottom:16 }}>Objectifs par commercial</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>
                  {['Agent','Obj. NA','Réalisé NA','Avancement','Obj. Primes','Réalisé Primes'].map(h => (
                    <th key={h} style={D.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parAgent.map(a => (
                  <tr key={a.agent_code} style={{ transition:'background 0.1s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={D.td}>
                      <div style={{ fontWeight:600, color:C.textD }}>{AGENT_NOMS[a.agent_code]||a.agent_code}</div>
                      <div style={{ fontSize:11, color:C.textL }}>{a.agent_code}</div>
                    </td>
                    <td style={D.td}>{fmtN(a.target_na)}</td>
                    <td style={D.td}><span style={{ fontWeight:700, color:C.textD }}>{fmtN(a.actual_na)}</span></td>
                    <td style={{ ...D.td, minWidth:160 }}><ProgressBar pct={a.pct_na} col={C.cyan} /></td>
                    <td style={D.td}>{fmt(a.target_primes)}</td>
                    <td style={D.td}>{fmt(a.actual_primes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!global && !loading && (
        <div style={{ padding:40, textAlign:'center', background:'#fff', borderRadius:10, border:`1px solid ${C.border}`, color:C.textL }}>
          <i className="ti ti-target" style={{ fontSize:40, display:'block', marginBottom:12 }} />
          Aucun objectif configuré pour 2026.<br/>
          <span style={{ fontSize:12 }}>Les objectifs sont définis dans la table <code>objectives_global</code> de Supabase.</span>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET 2 — COMPAGNIES
// ══════════════════════════════════════════════
function OngletCompagnies({ stargetResults, technicalResults, loadingStar }) {
  const [compagnie, setCompagnie] = useState('AG')
  const COMPAGNIES = ['AG','AXA','VIVIUM','ALLIANZ']
  const LABELS = { AG:'AG Insurance — Starget', AXA:'AXA Belgium — S\'miles', VIVIUM:'Vivium — Partnership', ALLIANZ:'Allianz — Barème fixe' }

  // Dernier résultat Starget AG
  const lastStar = stargetResults.length > 0
    ? [...stargetResults].sort((a,b) => b.week_number - a.week_number)[0]
    : null

  // Résultats techniques AG par famille
  const techByFamily = useMemo(() => {
    const latest = technicalResults.filter(r => r.period_year===2026)
    const map = {}
    latest.forEach(r => {
      if (!map[r.product_family]) map[r.product_family] = r
    })
    return map
  }, [technicalResults])

  const totalPrimesAG = Object.values(techByFamily).reduce((s,r)=>s+(r.primes_acquises_period||0),0)
  const totalSinistresAG = Object.values(techByFamily).reduce((s,r)=>s+(r.sinistres_period||0),0)
  const totalComAG = Object.values(techByFamily).reduce((s,r)=>s+(r.commissions_acquises||0),0)
  const spGlobalAG = totalPrimesAG>0 ? totalSinistresAG/totalPrimesAG*100 : null

  return (
    <div>
      {/* Sélecteur compagnie */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {COMPAGNIES.map(c => (
          <button key={c} onClick={()=>setCompagnie(c)} style={{
            padding:'7px 16px', borderRadius:20, border:`2px solid ${C[c]||C.border}`,
            background: compagnie===c ? (C[c]||C.navy) : C.white,
            color: compagnie===c ? '#fff' : (C[c]||C.textM),
            fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.15s'
          }}>{c}</button>
        ))}
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.5, marginBottom:16 }}>{LABELS[compagnie]}</div>

      {/* ── AG ── */}
      {compagnie==='AG' && (
        <div>
          {/* Starget dernière semaine */}
          {lastStar ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:20 }}>
              <KpiCard label={`Starget S${lastStar.week_number} / Mois ${lastStar.month_number}`} value={fmt(lastStar.bonus_total)} col={C.AG} sub={`Niveau : ${lastStar.star_level||'—'}`} />
              <KpiCard label="Bonus Croissance PPE" value={fmt(lastStar.bonus_croissance_ppe)} col={C.AG} />
              <KpiCard label="Bonus Croissance Entr." value={fmt(lastStar.bonus_croissance_enterprise)} col={C.AG} />
              <KpiCard label="Bonus Qualité S/P" value={fmt(lastStar.bonus_sp)} col={C.AG} />
            </div>
          ) : (
            <div style={{ ...D.card, color:C.textL, textAlign:'center', padding:30 }}>
              {loadingStar ? 'Chargement…' : 'Aucun résultat Starget importé. Importer les PDFs 2026.XX depuis SharePoint.'}
            </div>
          )}

          {/* Résultats techniques par famille */}
          {Object.keys(techByFamily).length > 0 && (
            <div style={D.card}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>
                Résultats techniques 2026 — S/P Global : <span style={{ color: (spGlobalAG||0)<40?C.ok:C.warn }}>{fmtPct(spGlobalAG)}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
                <div style={{ fontSize:12, color:C.textM }}>Primes acquises : <strong>{fmt(totalPrimesAG)}</strong></div>
                <div style={{ fontSize:12, color:C.textM }}>Sinistres : <strong style={{ color:(spGlobalAG||0)>45?C.danger:C.textD }}>{fmt(totalSinistresAG)}</strong></div>
                <div style={{ fontSize:12, color:C.textM }}>Commissions : <strong style={{ color:C.ok }}>{fmt(totalComAG)}</strong></div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr>{['Famille','Primes acquises','Sinistres','Commissions','S/P'].map(h=><th key={h} style={D.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {Object.entries(techByFamily).map(([fam, r]) => {
                      const sp = r.sp_historique_total
                      return (
                        <tr key={fam} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <td style={{ ...D.td, fontWeight:600, color:C.textD }}>{fam}</td>
                          <td style={D.td}>{fmt(r.primes_acquises_period)}</td>
                          <td style={D.td}>{fmt(r.sinistres_period)}</td>
                          <td style={{ ...D.td, color:C.ok, fontWeight:600 }}>{fmt(r.commissions_acquises)}</td>
                          <td style={D.td}>
                            <span style={{ fontWeight:700, color: sp==null?C.textL:sp<40?C.ok:sp<55?C.warn:C.danger }}>
                              {fmtPct(sp)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AXA ── */}
      {compagnie==='AXA' && (
        <div style={D.card}>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.textD, marginBottom:12 }}>Programme S'miles 2026 — Niveaux de partnership</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
              {[
                { level:'Bronze',   miles:900,  booster:0,   col:'#cd7f32' },
                { level:'Silver',   miles:1900, booster:10,  col:'#94a3b8' },
                { level:'Gold',     miles:3500, booster:30,  col:'#f59e0b' },
                { level:'Platinum', miles:7700, booster:50,  col:'#64748b' },
              ].map(l => (
                <div key={l.level} style={{ background:C.bg, borderRadius:8, padding:'14px 16px', borderLeft:`3px solid ${l.col}` }}>
                  <div style={{ fontWeight:800, color:l.col, fontSize:15, marginBottom:4 }}>{l.level}</div>
                  <div style={{ fontSize:12, color:C.textM }}>À partir de <strong>{fmtN(l.miles)} miles</strong></div>
                  <div style={{ fontSize:12, color:C.textM }}>Booster : <strong style={{ color:l.booster>0?C.ok:C.textM }}>{l.booster > 0 ? `+${l.booster}%` : 'Aucun'}</strong></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize:13, fontWeight:600, color:C.textD, marginBottom:10 }}>Taux de base sur nouvelle production</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr>{['Branche','Taux de base'].map(h=><th key={h} style={D.th}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ['Mobilité particuliers — formules de base','7 %'],
                ['Mobilité particuliers — garanties optionnelles','8 %'],
                ['Incendie particuliers & autres garanties','15 %'],
                ['Protection juridique','8 %'],
                ['Protection','7 %'],
                ['Voyage','7 %'],
                ['PME (petites & moyennes entreprises)','4,5 %'],
                ['Vie particuliers, indépendants, entreprises','0,5 %'],
              ].map(([b,t]) => (
                <tr key={b} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={D.td}>{b}</td>
                  <td style={{ ...D.td, fontWeight:700, color:C.AXA }}>{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIVIUM ── */}
      {compagnie==='VIVIUM' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
            {[
              { level:'Niveau 1', points:600,  rate:3, na:75,   prime:100000,  col:'#6b7280' },
              { level:'Niveau 2', points:1300, rate:4, na:150,  prime:250000,  col:'#0080BD' },
              { level:'Niveau 3', points:3000, rate:5, na:200,  prime:400000,  col:'#00A650' },
            ].map(l => (
              <div key={l.level} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:18, borderTop:`3px solid ${l.col}` }}>
                <div style={{ fontWeight:800, color:l.col, fontSize:16, marginBottom:10 }}>{l.level}</div>
                <div style={{ fontSize:12, color:C.textM, marginBottom:4 }}>≥ <strong>{fmtN(l.points)} points</strong></div>
                <div style={{ fontSize:12, color:C.textM, marginBottom:4 }}>≥ <strong>{l.na} NA</strong> (Life + Non-Life)</div>
                <div style={{ fontSize:12, color:C.textM, marginBottom:10 }}>≥ <strong>{fmt(l.prime)}</strong> prime acquise Non-Life</div>
                <div style={{ background:l.col, color:'#fff', borderRadius:6, padding:'6px 10px', fontSize:14, fontWeight:800, textAlign:'center' }}>
                  {l.rate} % sur prime production
                </div>
              </div>
            ))}
          </div>
          <div style={D.card}>
            <div style={{ fontSize:13, fontWeight:600, color:C.textD, marginBottom:10 }}>Bonus rentabilité S/P global (% prime acquise Non-Life)</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr>{['S/P Global','Niveau 1','Niveau 2','Niveau 3'].map(h=><th key={h} style={D.th}>{h}</th>)}</tr></thead>
              <tbody>
                {[
                  ['< 30 %','0,60 %','0,80 %','1,00 %'],
                  ['30 % – 35 %','0,40 %','0,60 %','0,80 %'],
                  ['35 % – 40 %','0,20 %','0,40 %','0,60 %'],
                  ['40 % – 45 %','0,00 %','0,20 %','0,40 %'],
                  ['45 % – 50 %','0,00 %','0,00 %','0,20 %'],
                ].map(([sp,...vals]) => (
                  <tr key={sp} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{ ...D.td, fontWeight:600 }}>{sp}</td>
                    {vals.map((v,i)=><td key={i} style={{ ...D.td, fontWeight:700, color:C.VIVIUM }}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ALLIANZ ── */}
      {compagnie==='ALLIANZ' && (
        <div style={D.card}>
          <div style={{ fontSize:13, color:C.textM, marginBottom:16, background:'#eff6ff', borderRadius:8, padding:'10px 14px', border:'1px solid #bfdbfe' }}>
            <strong>Allianz</strong> fonctionne sur un barème de base fixe — pas de programme de fidélité ou bonus annuel.
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr>{['Branche','Produit','Taux de base'].map(h=><th key={h} style={D.th}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ['Auto','RC Auto Tourisme','17 %'],
                ['Auto','Omnium Auto Tourisme','19 %'],
                ['Auto','Conducteur','25 %'],
                ['Auto','RC Transport ≤ 3,5T','13,5 %'],
                ['Auto','RC Transport > 3,5T','10 %'],
                ['Incendie','Home Plan / Biz Commerce','27 %'],
                ['Incendie','Biz Agriculture / Buildings','25 %'],
                ['Incendie','Biz Horeca','20 %'],
                ['Incendie','Risques spéciaux','15 %'],
                ['RC','Family Plan','22,5 %'],
                ['RC','RC Exploitation','20 %'],
                ['RC','RC Professionnelle / D&O / Cyber','15 %'],
                ['Accidents corporels','Individuelle / Circulation','25 %'],
                ['Accidents du travail','AT / Gens de maison','7,5 – 15 %'],
                ['Engineering','TRC / Bris de Machine','15 %'],
                ['Engineering','Décennale Loi Peeters','10 %'],
                ['Vie','Solde restant dû / Temporaire','15 %'],
                ['Vie','Plan for Life+','max 5 %'],
                ['Vie Entreprise','Vie et décès','max 4 %'],
                ['Vie Entreprise','Allianz Medical Plan','10 %'],
              ].map(([b,p,t]) => (
                <tr key={b+p} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{ ...D.td, fontWeight:600, color:C.textD }}>{b}</td>
                  <td style={D.td}>{p}</td>
                  <td style={{ ...D.td, fontWeight:700, color:C.ALLIANZ }}>{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// ONGLET 3 — RENTABILITÉ
// ══════════════════════════════════════════════
function OngletRentabilite({ rentabilite, loading }) {
  const INSURERS = ['AG','AXA','VIVIUM','ALLIANZ']

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.textL }}>Chargement…</div>

  if (!rentabilite.length) return (
    <div style={{ ...D.card, textAlign:'center', color:C.textL, padding:40 }}>
      <i className="ti ti-chart-bar" style={{ fontSize:40, display:'block', marginBottom:12 }} />
      Aucune donnée de rentabilité disponible.<br/>
      <span style={{ fontSize:12 }}>Les chiffres s'afficheront ici une fois les résultats importés depuis les compagnies.</span>
    </div>
  )

  // Totaux par compagnie
  const byInsurer = {}
  rentabilite.forEach(r => {
    if (!byInsurer[r.insurer]) byInsurer[r.insurer] = { primes:0, sinistres:0, commissions:0, bonus:0 }
    byInsurer[r.insurer].primes      += parseFloat(r.total_primes_acquises||0)
    byInsurer[r.insurer].sinistres   += parseFloat(r.total_sinistres||0)
    byInsurer[r.insurer].commissions += parseFloat(r.total_commissions||0)
    byInsurer[r.insurer].bonus       += parseFloat(r.total_bonus||0)
  })

  const totalRevenu = Object.values(byInsurer).reduce((s,r)=>s+r.commissions+r.bonus,0)

  return (
    <div>
      {/* KPIs globaux */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:24 }}>
        <KpiCard label="Revenu total toutes compagnies" value={fmt(totalRevenu)} col='#7c3aed' />
        <KpiCard label="Compagnies actives" value={Object.keys(byInsurer).length} col={C.cyan} />
        <KpiCard label="Commissions acquises" value={fmt(Object.values(byInsurer).reduce((s,r)=>s+r.commissions,0))} col={C.ok} />
        <KpiCard label="Bonus programmes" value={fmt(Object.values(byInsurer).reduce((s,r)=>s+r.bonus,0))} col={C.warn} />
      </div>

      {/* Par compagnie */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:16 }}>
        {INSURERS.map(ins => {
          const d = byInsurer[ins]
          if (!d) return null
          const sp = d.primes>0 ? d.sinistres/d.primes*100 : null
          const col = C[ins]||C.navy
          return (
            <div key={ins} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
              <div style={{ background:col, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ color:'#fff', fontWeight:800, fontSize:15 }}>{ins}</span>
                <span style={{ color:'#fff', fontWeight:700, fontSize:18 }}>{fmt(d.commissions+d.bonus)}</span>
              </div>
              <div style={{ padding:16 }}>
                {[
                  { label:'Primes acquises', value:fmt(d.primes) },
                  { label:'Sinistres', value:fmt(d.sinistres) },
                  { label:'S/P', value:fmtPct(sp), color: sp==null?C.textM:sp<40?C.ok:sp<55?C.warn:C.danger },
                  { label:'Commissions', value:fmt(d.commissions), color:C.ok },
                  { label:'Bonus programme', value:fmt(d.bonus), color:C.warn },
                ].map(row => (
                  <div key={row.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.textL }}>{row.label}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:row.color||C.textD }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Détail par branche */}
      {rentabilite.length > 0 && (
        <div style={{ ...D.card, marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:'uppercase', letterSpacing:.5, marginBottom:12 }}>Détail par compagnie et branche</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr>{['Compagnie','Branche','Primes','Sinistres','S/P','Commissions','Bonus','Revenu total'].map(h=><th key={h} style={D.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rentabilite.map((r,i) => {
                  const sp = r.sp_global
                  return (
                    <tr key={i} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <td style={D.td}><span style={{ ...D.badge(C[r.insurer]||C.navy) }}>{r.insurer}</span></td>
                      <td style={{ ...D.td, color:C.textD, fontWeight:500 }}>{r.branch||'—'}</td>
                      <td style={D.td}>{fmt(r.total_primes_acquises)}</td>
                      <td style={D.td}>{fmt(r.total_sinistres)}</td>
                      <td style={D.td}><span style={{ fontWeight:700, color: sp==null?C.textL:sp<40?C.ok:sp<55?C.warn:C.danger }}>{fmtPct(sp)}</span></td>
                      <td style={{ ...D.td, color:C.ok, fontWeight:600 }}>{fmt(r.total_commissions)}</td>
                      <td style={{ ...D.td, color:C.warn, fontWeight:600 }}>{fmt(r.total_bonus)}</td>
                      <td style={{ ...D.td, color:'#7c3aed', fontWeight:700 }}>{fmt(r.revenu_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════
export default function ObjectifsView() {
  const [onglet, setOnglet] = useState('global')
  const [objectifs, setObjectifs]         = useState([])
  const [stargetResults, setStarget]      = useState([])
  const [technicalResults, setTechnical]  = useState([])
  const [rentabilite, setRentabilite]     = useState([])
  const [loading, setLoading]             = useState(true)
  const [loadingStar, setLoadingStar]     = useState(true)

  const DYNASSUR_BLUE = '#0080BD'
  const ONGLETS = [
    { key:'global',      label:'Dynassur Global',  icon:'ti-target' },
    { key:'compagnies',  label:'Compagnies',        icon:'ti-building' },
    { key:'rentabilite', label:'Rentabilité',       icon:'ti-chart-bar' },
  ]

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLoadingStar(true)
      try {
        const [
          { data: obj },
          { data: star },
          { data: tech },
          { data: rent },
        ] = await Promise.all([
          supabase.from('objectives_global').select('*').eq('year', 2026),
          supabase.from('ag_starget_results').select('*').eq('year', 2026).order('week_number', { ascending:false }),
          supabase.from('ag_technical_results').select('*').eq('period_year', 2026),
          supabase.from('view_rentabilite_compagnies').select('*').eq('year', 2026),
        ])
        setObjectifs(obj || [])
        setStarget(star || [])
        setTechnical(tech || [])
        setRentabilite(rent || [])
      } catch(e) { console.error('ObjectifsView load error:', e) }
      setLoading(false)
      setLoadingStar(false)
    }
    load()
  }, [])

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif", background:C.bg, minHeight:'100vh', padding:'24px' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
          <i className="ti ti-target" style={{ fontSize:22, color:DYNASSUR_BLUE }} />
          <h1 style={{ fontSize:20, fontWeight:800, color:C.navy, margin:0 }}>Objectifs 2026</h1>
          <span style={{ fontSize:12, background:DYNASSUR_BLUE+'18', color:DYNASSUR_BLUE, fontWeight:700, padding:'2px 10px', borderRadius:20 }}>DYNASSUR</span>
        </div>
        <p style={{ fontSize:13, color:C.textL, margin:0 }}>Suivi des objectifs commerciaux, programmes compagnies et rentabilité</p>
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', borderBottom:`1px solid ${C.border}`, marginBottom:24, background:C.white, borderRadius:'10px 10px 0 0', padding:'0 16px' }}>
        {ONGLETS.map(o => (
          <button key={o.key} onClick={()=>setOnglet(o.key)} style={D.tab(onglet===o.key, DYNASSUR_BLUE)}>
            <i className={`ti ${o.icon}`} style={{ marginRight:6, fontSize:14 }} />
            {o.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div>
        {onglet==='global'      && <OngletGlobal objectifs={objectifs} loading={loading} />}
        {onglet==='compagnies'  && <OngletCompagnies stargetResults={stargetResults} technicalResults={technicalResults} loadingStar={loadingStar} />}
        {onglet==='rentabilite' && <OngletRentabilite rentabilite={rentabilite} loading={loading} />}
      </div>
    </div>
  )
}
