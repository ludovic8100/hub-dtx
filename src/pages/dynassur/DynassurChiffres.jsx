import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const BLUE='#0080BD', NAVY='#0D2F5E', GREEN='#16a34a'
const MOIS=['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const eur = v => v==null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const eur2 = v => v==null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(v)
const num = v => new Intl.NumberFormat('fr-BE').format(v)

function Kpi({ label, value, col, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', borderTop:`3px solid ${col}`, padding:'14px 18px',
      cursor:onClick?'pointer':'default', transition:'box-shadow .15s' }}
      onMouseEnter={e=>{ if(onClick) e.currentTarget.style.boxShadow=`0 4px 14px ${col}25` }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
        <span>{label}</span>{onClick && <i className="ti ti-zoom-in" style={{ color:'#cbd5e1' }}/>}
      </div>
      <div style={{ fontSize:23, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Bloc({ titre, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:18, overflow:'hidden' }}>
      <div style={{ background:NAVY, padding:'10px 16px' }}>
        <span style={{ color:'#fff', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{titre}</span>
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  )
}

function TableAgg({ rows, label, onRow }) {
  const max = Math.max(...rows.map(r=>r.primes), 1)
  return (
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead><tr style={{ background:'#f8fafc' }}>
        {[label,'Primes','Commissions','Taux','Quitt.'].map((h,i)=>(
          <th key={h} style={{ textAlign:i===0?'left':'right', padding:'8px 12px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {rows.map((r,i)=>(
          <tr key={i} onClick={()=>onRow&&onRow(r.key)} style={{ borderBottom:'1px solid #f1f5f9', cursor:onRow?'pointer':'default' }}
            onMouseEnter={e=>{ e.currentTarget.style.background='#f8fafc' }} onMouseLeave={e=>{ e.currentTarget.style.background='transparent' }}>
            <td style={{ padding:'8px 12px', position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${(r.primes/max)*100}%`, background:BLUE+'10' }}/>
              <span style={{ position:'relative', fontWeight:600, color:NAVY }}>{r.key||'—'}</span>
            </td>
            <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700 }}>{eur(r.primes)}</td>
            <td style={{ padding:'8px 12px', textAlign:'right', color:GREEN, fontWeight:700 }}>{eur(r.commissions)}</td>
            <td style={{ padding:'8px 12px', textAlign:'right', color:'#64748b' }}>{r.primes?((r.commissions/r.primes)*100).toFixed(1)+'%':'—'}</td>
            <td style={{ padding:'8px 12px', textAlign:'right', color:'#64748b' }}>{num(r.n)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Fenêtre de détail : les quittances derrière un chiffre ──
function DetailModal({ titre, rows, onClose }) {
  const totP = rows.reduce((s,r)=>s+(Number(r.prime_totale)||0),0)
  const totC = rows.reduce((s,r)=>s+(Number(r.commission)||0),0)
  const COLS = [
    { key:'date_comptable', label:'Date',       align:'left',  get:r=>r.date_comptable||'', render:r=><span style={{ color:'#64748b', whiteSpace:'nowrap' }}>{r.date_comptable||'—'}</span> },
    { key:'client',         label:'Client',     align:'left',  get:r=>[r.client_nom,r.client_prenom].filter(Boolean).join(' '), render:r=><span style={{ fontWeight:600, color:NAVY }}>{[r.client_nom,r.client_prenom].filter(Boolean).join(' ')||'—'}</span> },
    { key:'compagnie',      label:'Compagnie',  align:'left',  get:r=>r.compagnie||'', render:r=>r.compagnie||'—' },
    { key:'domaine',        label:'Domaine',    align:'left',  get:r=>r.domaine||'', render:r=>r.domaine||'—' },
    { key:'sous_agent',     label:'Sous-agent', align:'left',  get:r=>r.sous_agent||'', render:r=>r.sous_agent||'—' },
    { key:'prime_totale',   label:'Prime',      align:'right', get:r=>Number(r.prime_totale)||0, render:r=><span style={{ fontWeight:700 }}>{eur2(r.prime_totale)}</span> },
    { key:'commission',     label:'Commission', align:'right', get:r=>Number(r.commission)||0, render:r=><span style={{ color:GREEN, fontWeight:700 }}>{eur2(r.commission)}</span> },
  ]
  const [sort, setSort] = useState({ key:'date_comptable', dir:'desc' })
  const sorted = [...rows].sort((a,b)=>{
    const c = COLS.find(x=>x.key===sort.key); const av=c.get(a), bv=c.get(b)
    const r = typeof av==='string' ? av.localeCompare(bv) : av-bv
    return sort.dir==='asc' ? r : -r
  })
  const show = sorted.slice(0,1000)
  const click = k => setSort(s => s.key===k ? { key:k, dir:s.dir==='asc'?'desc':'asc' } : { key:k, dir:'asc' })
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'min(900px,96vw)', height:'100%', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-8px 0 30px rgba(0,0,0,.2)' }}>
        <div style={{ background:NAVY, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#fff', fontSize:15, fontWeight:800 }}>{titre}</div>
            <div style={{ color:'#cbd5e1', fontSize:12, marginTop:2 }}>{num(rows.length)} quittance(s) · Primes {eur(totP)} · Commissions {eur(totC)}</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
              {COLS.map(c=>(
                <th key={c.key} onClick={()=>click(c.key)} style={{ textAlign:c.align, padding:'8px 12px', fontSize:10, fontWeight:700, color: sort.key===c.key?NAVY:'#94a3b8', textTransform:'uppercase', whiteSpace:'nowrap', cursor:'pointer', userSelect:'none' }}>
                  {c.label}{sort.key===c.key && <span style={{ marginLeft:4 }}>{sort.dir==='asc'?'▲':'▼'}</span>}
                </th>
              ))}
            </tr></thead>
            <tbody>
              {show.map((r,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  {COLS.map(c=>(
                    <td key={c.key} style={{ padding:'7px 12px', textAlign:c.align, color:'#475569' }}>{c.render(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length>1000 && <p style={{ padding:'12px 16px', color:'#94a3b8', fontSize:12 }}>… et {num(sorted.length-1000)} autres lignes (totaux ci-dessus calculés sur l'ensemble).</p>}
        </div>
      </div>
    </div>
  )
}

export default function DynassurChiffres() {
  const E = ENTITES.dynassur
  const [rows, setRows] = useState(null)
  const [annee, setAnnee] = useState(2026)
  const [detail, setDetail] = useState(null)   // { titre, rows }

  useEffect(()=>{
    (async()=>{
      const all=[]; let from=0
      while(true){
        const { data, error } = await supabase.from('quittances')
          .select('date_comptable,prime_totale,commission,compagnie,gestionnaire,sous_agent,domaine,client_nom,client_prenom,police')
          .range(from, from+999)
        if(error||!data||!data.length) break
        all.push(...data); if(data.length<1000) break; from+=1000
      }
      setRows(all)
    })()
  },[])

  const annees = useMemo(()=>{
    const s=new Set((rows||[]).map(r=>r.date_comptable&&Number(r.date_comptable.slice(0,4))).filter(Boolean))
    return [...s].sort((a,b)=>b-a)
  },[rows])

  const stats = useMemo(()=>{
    if(!rows) return null
    const f = rows.filter(r=>r.date_comptable && Number(r.date_comptable.slice(0,4))===annee)
    const sum = (a,k)=>a.reduce((s,r)=>s+(Number(r[k])||0),0)
    const primes=sum(f,'prime_totale'), comm=sum(f,'commission')
    const parMois = Array.from({length:12},(_,i)=>{
      const m=f.filter(r=>Number(r.date_comptable.slice(5,7))===i+1)
      return { mois:MOIS[i+1], n:i+1, primes:sum(m,'prime_totale'), commissions:sum(m,'commission') }
    })
    const agg = (key) => {
      const map={}
      f.forEach(r=>{ const k=r[key]||'—'; (map[k]=map[k]||{key:k,primes:0,commissions:0,n:0}); map[k].primes+=Number(r.prime_totale)||0; map[k].commissions+=Number(r.commission)||0; map[k].n++ })
      return Object.values(map).sort((a,b)=>b.primes-a.primes)
    }
    return { f, n:f.length, primes, comm, taux:primes?comm/primes*100:0,
             parMois, cies:agg('compagnie'), gest:agg('gestionnaire'), sa:agg('sous_agent'), dom:agg('domaine') }
  },[rows,annee])

  const maxMois = stats ? Math.max(...stats.parMois.map(m=>m.primes),1) : 1
  const open = (titre, subset) => setDetail({ titre, rows:subset })
  const byDim = (dim, key) => stats.f.filter(r=>(r[dim]||'—')===key)

  return (
    <Layout currentPage="Chiffres">
      <div style={{ fontFamily:"'Source Sans Pro',sans-serif", width:'100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title="Chiffres" subtitle="Dynassur SRL — primes, commissions & rentabilité"
          stats={ stats ? [
            { label:`Primes ${annee}`, value:eur(stats.primes) },
            { label:`Commissions ${annee}`, value:eur(stats.comm) },
            { label:'Taux de commission', value:stats.taux.toFixed(1)+'%' },
          ] : [] }
        />

        <div style={{ display:'flex', gap:8, margin:'4px 0 18px', alignItems:'center' }}>
          {(annees.length?annees:[2026,2025]).map(y=>(
            <button key={y} onClick={()=>setAnnee(y)} style={{
              padding:'6px 16px', borderRadius:20, cursor:'pointer', fontSize:13, fontWeight:700,
              border:`1.5px solid ${annee===y?BLUE:'#e2e8f0'}`, background:annee===y?BLUE:'#fff', color:annee===y?'#fff':'#64748b' }}>{y}</button>
          ))}
          <span style={{ fontSize:12, color:'#94a3b8', marginLeft:8 }}><i className="ti ti-info-circle" style={{ marginRight:4 }}/>Clique un chiffre, une barre ou une ligne pour voir le détail.</span>
        </div>

        {!rows && <p style={{ color:'#94a3b8' }}>Chargement des quittances…</p>}

        {stats && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:20 }}>
              <Kpi label="Primes encaissées" value={eur(stats.primes)} col={BLUE} sub={`${num(stats.n)} quittances`} onClick={()=>open(`Toutes les quittances ${annee}`, stats.f)} />
              <Kpi label="Commissions" value={eur(stats.comm)} col={GREEN} onClick={()=>open(`Commissions ${annee} — détail`, stats.f)} />
              <Kpi label="Taux de commission" value={stats.taux.toFixed(1)+'%'} col="#7c3aed" />
              <Kpi label="Prime moyenne" value={eur(stats.n?stats.primes/stats.n:0)} col="#f59e0b" sub="par quittance" onClick={()=>open(`Toutes les quittances ${annee}`, stats.f)} />
            </div>

            <Bloc titre={`Évolution mensuelle ${annee} — clique une barre`}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:180, padding:'0 4px' }}>
                {stats.parMois.map((m,i)=>(
                  <div key={i} onClick={()=>m.primes&&open(`${m.mois} ${annee}`, stats.f.filter(r=>Number(r.date_comptable.slice(5,7))===m.n))}
                    style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:m.primes?'pointer':'default' }}>
                    <div style={{ fontSize:9, color:'#94a3b8' }}>{m.primes?Math.round(m.primes/1000)+'k':''}</div>
                    <div title={`Primes ${eur(m.primes)} · Comm ${eur(m.commissions)}`}
                      style={{ width:'100%', position:'relative', height:`${(m.primes/maxMois)*140}px`, background:BLUE, borderRadius:'4px 4px 0 0', minHeight:m.primes?2:0 }}>
                      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${m.primes?(m.commissions/m.primes)*100:0}%`, background:GREEN, borderRadius:'0 0 4px 4px' }}/>
                    </div>
                    <div style={{ fontSize:10, color:'#64748b' }}>{m.mois}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:16, marginTop:10, fontSize:11, color:'#64748b' }}>
                <span><i style={{ display:'inline-block', width:10, height:10, background:BLUE, borderRadius:2, marginRight:5 }}/>Primes</span>
                <span><i style={{ display:'inline-block', width:10, height:10, background:GREEN, borderRadius:2, marginRight:5 }}/>Commissions</span>
              </div>
            </Bloc>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
              <Bloc titre="Par compagnie"><TableAgg rows={stats.cies.slice(0,12)} label="Compagnie" onRow={k=>open(`Compagnie : ${k}`, byDim('compagnie',k))} /></Bloc>
              <Bloc titre="Par domaine"><TableAgg rows={stats.dom.slice(0,12)} label="Domaine" onRow={k=>open(`Domaine : ${k}`, byDim('domaine',k))} /></Bloc>
              <Bloc titre="Par gestionnaire"><TableAgg rows={stats.gest.slice(0,12)} label="Gestionnaire" onRow={k=>open(`Gestionnaire : ${k}`, byDim('gestionnaire',k))} /></Bloc>
              <Bloc titre="Par sous-agent"><TableAgg rows={stats.sa.slice(0,12)} label="Sous-agent" onRow={k=>open(`Sous-agent : ${k}`, byDim('sous_agent',k))} /></Bloc>
            </div>
          </>
        )}
      </div>
      {detail && <DetailModal titre={detail.titre} rows={detail.rows} onClose={()=>setDetail(null)} />}
    </Layout>
  )
}
