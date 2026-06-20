import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

// ── Constantes ──
const BLUE = '#0080BD'
const NAVY = '#0D2F5E'

const TYPES_PROD = {
  'N.A.':                     { label:'Nouvelles Affaires',    col:'#16a34a', sign:+1 },
  'Mandat faveur':             { label:'Mandats faveur',        col:'#0080BD', sign:+1 },
  'Mandat défaveur':           { label:'Mandats défaveur',      col:'#f59e0b', sign:-1 },
  'Renon':                     { label:'Résiliations',          col:'#dc2626', sign:-1 },
  'Résiliation Non paiement':  { label:'Résil. non-paiement',   col:'#dc2626', sign:-1 },
  'Avenant':                   { label:'Avenants',              col:'#94a3b8', sign:0  },
  'Suspension':                { label:'Suspensions',           col:'#94a3b8', sign:0  },
  'Tarification':              { label:'Tarifications',         col:'#94a3b8', sign:0  },
}

const AGENT_NOMS = {
  GGO:'Gregory Godfroid',   TJA:'Thibault Japsenne',  PFQ:'Priscilla Fernandez',
  MTE:'Michelangelo Terrana',NGI:'Nadine Ginis',       LDE:'Ludovic Detilloux',
  JFS:'J-F. Simonis',       FMZ:'Fabrice Mammo',      ICE:'Ingrid Cezar',
  RCA:'Raphael Carrea',     MVM:'Michael Van Muylder', VPE:'Vincent Pesser',
  LGM:'Luisa Gaen Munoz',   OBA:'Olivier Baudelet',   RDE:'Renaud Desclez',
  DCO:'Didier Coco',        HML:'Homelinks',
}

const MOIS_LABELS = ['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const fmtN = v => v==null?'—':new Intl.NumberFormat('fr-BE').format(v)

// ── Composants utilitaires ──
function Badge({ label, col, bg }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:4,
      background: bg||col+'20', color: col, whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

function KpiCard({ label, value, col, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0',
      borderTop:`3px solid ${col}`, padding:'14px 18px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── ONGLET 1 : Vue globale ──
function OngletGlobal({ data, annee, setAnnee }) {
  const ANNEES = [2024, 2025, 2026]

  const positifs = ['N.A.', 'Mandat faveur']
  const negatifs = ['Renon', 'Résiliation Non paiement', 'Mandat défaveur']

  const totalNA      = data.filter(d=>d.type_prod==='N.A.').length
  const totalMandFav = data.filter(d=>d.type_prod==='Mandat faveur').length
  const totalMandDef = data.filter(d=>d.type_prod==='Mandat défaveur').length
  const totalRenon   = data.filter(d=>['Renon','Résiliation Non paiement'].includes(d.type_prod)).length
  const soldeNet     = totalNA + totalMandFav - totalMandDef - totalRenon

  // Par mois
  const parMois = Array.from({length:12},(_,i) => {
    const m = String(i+1).padStart(2,'0')
    const rows = data.filter(d=>d.mois===m)
    const na    = rows.filter(d=>d.type_prod==='N.A.').length
    const plus  = rows.filter(d=>positifs.includes(d.type_prod)).length
    const moins = rows.filter(d=>negatifs.includes(d.type_prod)).length
    return { m, label:MOIS_LABELS[i+1], na, plus, moins, net: plus-moins }
  })

  const maxVal = Math.max(...parMois.map(m=>Math.max(m.plus,m.moins)), 1)

  return (
    <div>
      {/* Sélecteur année */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {ANNEES.map(a => (
          <button key={a} onClick={()=>setAnnee(a)} style={{
            padding:'6px 16px', borderRadius:20, border:`2px solid ${annee===a?BLUE:'#e2e8f0'}`,
            background: annee===a?BLUE:'#fff', color:annee===a?'#fff':'#64748b',
            fontWeight:700, fontSize:13, cursor:'pointer'
          }}>{a}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
        <KpiCard label="Nouvelles Affaires" value={fmtN(totalNA)}      col="#16a34a" />
        <KpiCard label="Mandats faveur"     value={fmtN(totalMandFav)} col="#0080BD" />
        <KpiCard label="Mandats défaveur"   value={fmtN(totalMandDef)} col="#f59e0b" />
        <KpiCard label="Résiliations"       value={fmtN(totalRenon)}   col="#dc2626" />
        <KpiCard label="Solde net"
          value={`${soldeNet>0?'+':''}${fmtN(soldeNet)}`}
          col={soldeNet>=0?'#16a34a':'#dc2626'}
          sub="entrées − sorties" />
      </div>

      {/* Graphe mensuel */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:16 }}>
          Évolution mensuelle {annee}
        </div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:120, marginBottom:8 }}>
          {parMois.map((m,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:100 }}>
                <div title={`Entrées: ${m.plus}`} style={{
                  flex:1, borderRadius:'3px 3px 0 0',
                  height:`${m.plus/maxVal*100}%`, minHeight:m.plus>0?3:0,
                  background:'#bbf7d0', transition:'height 0.3s'
                }} />
                <div title={`Sorties: ${m.moins}`} style={{
                  flex:1, borderRadius:'3px 3px 0 0',
                  height:`${m.moins/maxVal*100}%`, minHeight:m.moins>0?3:0,
                  background:'#fecaca', transition:'height 0.3s'
                }} />
              </div>
              {/* Solde net */}
              <div style={{ fontSize:9, fontWeight:700, color:m.net>=0?'#16a34a':'#dc2626' }}>
                {m.net>0?'+':''}{m.net||''}
              </div>
              <div style={{ fontSize:9, color:'#94a3b8' }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:16 }}>
          <span style={{ fontSize:11, color:'#64748b' }}><span style={{ display:'inline-block', width:10, height:10, background:'#bbf7d0', borderRadius:2, marginRight:4 }} />Entrées (NA + mandats fav.)</span>
          <span style={{ fontSize:11, color:'#64748b' }}><span style={{ display:'inline-block', width:10, height:10, background:'#fecaca', borderRadius:2, marginRight:4 }} />Sorties (renons + mandats déf.)</span>
        </div>
      </div>
    </div>
  )
}

// ── ONGLET 2 : Par collaborateur ──
function OngletCollaborateurs({ data, annee }) {
  const [selected, setSelected] = useState(null)
  const [moisFilter, setMoisFilter] = useState('all')

  const filtered = moisFilter==='all' ? data : data.filter(d=>d.mois===moisFilter)

  // Calcul par agent
  const parAgent = useMemo(() => {
    const map = {}
    filtered.forEach(d => {
      const code = d.agent_code || '?'
      if (!map[code]) map[code] = { code, nom:AGENT_NOMS[code]||code, total:0 }
      Object.keys(TYPES_PROD).forEach(t => { if (!map[code][t]) map[code][t] = 0 })
      if (map[code][d.type_prod] !== undefined) map[code][d.type_prod]++
      const cfg = TYPES_PROD[d.type_prod]
      if (cfg) map[code].total += cfg.sign
    })
    return Object.values(map).sort((a,b) => (b['N.A.']||0)-(a['N.A.']||0))
  }, [filtered])

  // Détail d'un agent
  const detailAgent = selected
    ? filtered.filter(d=>d.agent_code===selected).sort((a,b)=>b.mois.localeCompare(a.mois))
    : []

  const TYPES_DISPLAY = Object.entries(TYPES_PROD).filter(([,v])=>v.sign!==0).map(([k,v])=>({key:k,...v}))

  return (
    <div>
      {/* Filtre mois */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={()=>setMoisFilter('all')} style={{
          padding:'4px 12px', borderRadius:20, border:`1px solid ${moisFilter==='all'?BLUE:'#e2e8f0'}`,
          background:moisFilter==='all'?BLUE:'#fff', color:moisFilter==='all'?'#fff':'#64748b',
          fontSize:12, fontWeight:600, cursor:'pointer'
        }}>Toute l'année</button>
        {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(m=>(
          <button key={m} onClick={()=>setMoisFilter(m)} style={{
            padding:'4px 10px', borderRadius:20, border:`1px solid ${moisFilter===m?BLUE:'#e2e8f0'}`,
            background:moisFilter===m?BLUE:'#fff', color:moisFilter===m?'#fff':'#64748b',
            fontSize:12, cursor:'pointer'
          }}>{MOIS_LABELS[parseInt(m)]}</button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected?'1fr 1fr':'1fr', gap:16 }}>
        {/* Tableau agents */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#f8fafc' }}>
                  <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #e2e8f0' }}>Agent</th>
                  {TYPES_DISPLAY.map(t=>(
                    <th key={t.key} style={{ padding:'10px 8px', textAlign:'center', fontWeight:700, color:t.col, fontSize:10, textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid #e2e8f0' }}>
                      {t.label.split(' ')[0]}<br/>{t.label.split(' ').slice(1).join(' ')}
                    </th>
                  ))}
                  <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'#64748b', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid #e2e8f0' }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {parAgent.map((ag,i) => (
                  <tr key={ag.code}
                    onClick={() => setSelected(selected===ag.code ? null : ag.code)}
                    style={{ cursor:'pointer', background: selected===ag.code?BLUE+'12':i%2===0?'#fff':'#fafafe', transition:'background 0.1s' }}
                    onMouseEnter={e=>{ if(selected!==ag.code) e.currentTarget.style.background='#f0f9ff' }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=selected===ag.code?BLUE+'12':i%2===0?'#fff':'#fafafe' }}
                  >
                    <td style={{ padding:'10px 14px', borderBottom:'1px solid #f1f5f9' }}>
                      <div style={{ fontWeight:600, color:'#1e293b', fontSize:13 }}>{ag.nom}</div>
                      <div style={{ fontSize:10, color:'#94a3b8' }}>{ag.code}</div>
                    </td>
                    {TYPES_DISPLAY.map(t=>(
                      <td key={t.key} style={{ padding:'10px 8px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>
                        <span style={{ fontWeight:700, color:(ag[t.key]||0)>0?t.col:'#e2e8f0', fontSize:14 }}>
                          {ag[t.key]||0}
                        </span>
                      </td>
                    ))}
                    <td style={{ padding:'10px 14px', textAlign:'center', borderBottom:'1px solid #f1f5f9' }}>
                      <span style={{ fontWeight:800, fontSize:14, color:ag.total>0?'#16a34a':ag.total<0?'#dc2626':'#94a3b8' }}>
                        {ag.total>0?'+':''}{ag.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totaux */}
              <tfoot>
                <tr style={{ background:'#0f172a' }}>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'rgba(255,255,255,0.7)', fontSize:12 }}>TOTAL</td>
                  {TYPES_DISPLAY.map(t=>{
                    const tot = parAgent.reduce((s,a)=>s+(a[t.key]||0),0)
                    return (
                      <td key={t.key} style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:tot>0?t.col+'cc':'rgba(255,255,255,0.2)', fontSize:14 }}>
                        {tot||0}
                      </td>
                    )
                  })}
                  <td style={{ padding:'10px 14px', textAlign:'center', fontWeight:800, color:'#86efac', fontSize:14 }}>
                    {(()=>{const n=parAgent.reduce((s,a)=>s+a.total,0);return `${n>0?'+':''}${n}`})()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Détail agent sélectionné */}
        {selected && (
          <div style={{ background:'#fff', borderRadius:12, border:`2px solid ${BLUE}`, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between', background:BLUE+'08' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:NAVY }}>{AGENT_NOMS[selected]||selected}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{detailAgent.length} mouvements</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18 }}>✕</button>
            </div>
            <div style={{ maxHeight:400, overflowY:'auto' }}>
              {detailAgent.length === 0
                ? <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Aucun mouvement</div>
                : detailAgent.map((d,i) => {
                    const cfg = TYPES_PROD[d.type_prod] || { col:'#94a3b8', sign:0 }
                    return (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:10,
                        padding:'9px 16px', borderBottom:i<detailAgent.length-1?'1px solid #f8fafc':'none',
                        background:i%2===0?'#fff':'#fafafe' }}>
                        <div style={{ fontSize:11, color:'#94a3b8', fontWeight:600, minWidth:40 }}>
                          {MOIS_LABELS[parseInt(d.mois)]}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:500, color:'#1e293b' }}>
                            {d.num_contrat || d.client_nom || '—'}
                          </div>
                          {d.branche && <div style={{ fontSize:10, color:'#94a3b8' }}>{d.branche} {d.compagnie?`· ${d.compagnie}`:''}</div>}
                        </div>
                        <Badge label={d.type_prod} col={cfg.col} />
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ONGLET 3 : Détail contrats ──
function OngletDetail({ data }) {
  const [filters, setFilters] = useState({ agent:'all', type:'all', mois:'all' })
  const [page, setPage] = useState(0)
  const PER_PAGE = 50

  const agents  = [...new Set(data.map(d=>d.agent_code).filter(Boolean))].sort()
  const types   = [...new Set(data.map(d=>d.type_prod).filter(Boolean))].sort()

  const filtered = useMemo(() => {
    return data.filter(d =>
      (filters.agent==='all' || d.agent_code===filters.agent) &&
      (filters.type ==='all' || d.type_prod ===filters.type)  &&
      (filters.mois ==='all' || d.mois      ===filters.mois)
    ).sort((a,b)=>b.mois.localeCompare(a.mois)||b.annee-a.annee)
  }, [data, filters])

  const paginated = filtered.slice(page*PER_PAGE, (page+1)*PER_PAGE)
  const nbPages = Math.ceil(filtered.length/PER_PAGE)

  const selStyle = { padding:'6px 10px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, color:'#374151', background:'#fff', cursor:'pointer' }

  return (
    <div>
      {/* Filtres */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select value={filters.agent} onChange={e=>{setFilters(f=>({...f,agent:e.target.value}));setPage(0)}} style={selStyle}>
          <option value="all">Tous les agents</option>
          {agents.map(a=><option key={a} value={a}>{AGENT_NOMS[a]||a}</option>)}
        </select>
        <select value={filters.type} onChange={e=>{setFilters(f=>({...f,type:e.target.value}));setPage(0)}} style={selStyle}>
          <option value="all">Tous les types</option>
          {types.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.mois} onChange={e=>{setFilters(f=>({...f,mois:e.target.value}));setPage(0)}} style={selStyle}>
          <option value="all">Tous les mois</option>
          {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(m=>(
            <option key={m} value={m}>{MOIS_LABELS[parseInt(m)]}</option>
          ))}
        </select>
        <span style={{ fontSize:12, color:'#94a3b8', marginLeft:'auto' }}>
          {filtered.length} mouvement{filtered.length>1?'s':''}
        </span>
      </div>

      {/* Tableau */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Mois','Type','Agent','N° Contrat','Client','Branche','Compagnie'].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontWeight:700, color:'#94a3b8', fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #e2e8f0', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0
                ? <tr><td colSpan={7} style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Aucun résultat</td></tr>
                : paginated.map((d,i) => {
                    const cfg = TYPES_PROD[d.type_prod] || { col:'#94a3b8' }
                    return (
                      <tr key={i} style={{ background:i%2===0?'#fff':'#fafafe' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b', whiteSpace:'nowrap' }}>{MOIS_LABELS[parseInt(d.mois)]} {d.annee}</td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9' }}><Badge label={d.type_prod} col={cfg.col} /></td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{AGENT_NOMS[d.agent_code]||d.agent_code||'—'}</td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', fontFamily:'monospace', color:'#374151', fontSize:11 }}>{d.num_contrat||'—'}</td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#1e293b' }}>{d.client_nom||'—'}</td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{d.branche||'—'}</td>
                        <td style={{ padding:'8px 12px', borderBottom:'1px solid #f1f5f9', color:'#64748b' }}>{d.compagnie||'—'}</td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {nbPages > 1 && (
          <div style={{ padding:'10px 16px', borderTop:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}
              style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:page===0?'#f8fafc':'#fff', cursor:page===0?'not-allowed':'pointer', fontSize:12 }}>
              ← Précédent
            </button>
            <span style={{ fontSize:12, color:'#64748b' }}>Page {page+1} / {nbPages}</span>
            <button onClick={()=>setPage(p=>Math.min(nbPages-1,p+1))} disabled={page===nbPages-1}
              style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e2e8f0', background:page===nbPages-1?'#f8fafc':'#fff', cursor:page===nbPages-1?'not-allowed':'pointer', fontSize:12 }}>
              Suivant →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════
export default function DynassurProduction() {
  const [onglet, setOnglet]   = useState('global')
  const [annee, setAnnee]     = useState(new Date().getFullYear())
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)

  const ONGLETS = [
    { key:'global',         label:'Vue globale',         icon:'ti-chart-bar' },
    { key:'collaborateurs', label:'Par collaborateur',   icon:'ti-users' },
    { key:'detail',         label:'Détail contrats',     icon:'ti-list-details' },
  ]

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      const PAGE = 1000
      let from = 0, all = []
      while (true) {
        const { data: rows, error } = await supabase.from('mouvements_production')
          .select('type_prod, agent_code, annee, mois, num_contrat, client_nom, branche, compagnie')
          .eq('annee', annee)
          .order('mois', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) { console.error(error); break }
        const r = Array.isArray(rows) ? rows : []
        all = all.concat(r)
        if (r.length < PAGE) break
        from += PAGE
      }
      setData(all); setLoading(false)
    })()
  }, [annee])

  return (
    <Layout currentPage="Production">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", width:'100%' }}>

        <StatBanner
          color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title={`Production ${annee}`}
          subtitle="Dynassur SRL — suivi par type et collaborateur"
          stats={!loading ? [{ label: 'Mouvements', value: fmtN(data.length) }] : []}
        />

        {/* Onglets */}
        <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', marginBottom:24, background:'#fff', borderRadius:'10px 10px 0 0', padding:'0 16px' }}>
          {ONGLETS.map(o => (
            <button key={o.key} onClick={()=>setOnglet(o.key)} style={{
              padding:'10px 18px', border:'none', cursor:'pointer', fontSize:13,
              borderBottom: onglet===o.key?`2px solid ${BLUE}`:'2px solid transparent',
              fontWeight: onglet===o.key?700:400,
              color: onglet===o.key?NAVY:'#94a3b8',
              background:'transparent', transition:'all 0.15s'
            }}>
              <i className={`ti ${o.icon}`} style={{ marginRight:6, fontSize:14 }} />
              {o.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding:60, textAlign:'center', color:'#94a3b8', fontSize:14 }}>
            <i className="ti ti-loader-2" style={{ fontSize:32, display:'block', marginBottom:12, animation:'spin 1s linear infinite' }} />
            Chargement de la production…
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding:60, textAlign:'center', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', color:'#94a3b8' }}>
            <i className="ti ti-database-off" style={{ fontSize:40, display:'block', marginBottom:12 }} />
            Aucune donnée de production pour {annee}.<br/>
            <span style={{ fontSize:12 }}>Importez les données depuis Brio via n8n.</span>
          </div>
        ) : (
          <>
            {onglet==='global'         && <OngletGlobal         data={data} annee={annee} setAnnee={setAnnee} />}
            {onglet==='collaborateurs' && <OngletCollaborateurs data={data} annee={annee} />}
            {onglet==='detail'         && <OngletDetail         data={data} />}
          </>
        )}
      </div>
    </Layout>
  )
}
