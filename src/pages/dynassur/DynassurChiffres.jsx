import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

const BLUE='#0080BD', NAVY='#0D2F5E', GREEN='#16a34a'
const MOIS=['','Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const eur = v => v==null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const num = v => new Intl.NumberFormat('fr-BE').format(v)

function Kpi({ label, value, col, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', borderTop:`3px solid ${col}`, padding:'14px 18px' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:23, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

function Bloc({ titre, children, right }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:18, overflow:'hidden' }}>
      <div style={{ background:NAVY, padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ color:'#fff', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em' }}>{titre}</span>
        {right}
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  )
}

function TableAgg({ rows, label }) {
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
          <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
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

export default function DynassurChiffres() {
  const E = ENTITES.dynassur
  const [rows, setRows] = useState(null)
  const [annee, setAnnee] = useState(2026)

  useEffect(()=>{
    (async()=>{
      const all=[]; let from=0
      while(true){
        const { data, error } = await supabase.from('quittances')
          .select('date_comptable,prime_totale,commission,compagnie,gestionnaire,sous_agent,domaine')
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
      return { mois:MOIS[i+1], primes:sum(m,'prime_totale'), commissions:sum(m,'commission') }
    })
    const agg = (key) => {
      const map={}
      f.forEach(r=>{ const k=r[key]||'—'; (map[k]=map[k]||{key:k,primes:0,commissions:0,n:0}); map[k].primes+=Number(r.prime_totale)||0; map[k].commissions+=Number(r.commission)||0; map[k].n++ })
      return Object.values(map).sort((a,b)=>b.primes-a.primes)
    }
    return { n:f.length, primes, comm, taux:primes?comm/primes*100:0,
             parMois, cies:agg('compagnie'), gest:agg('gestionnaire'), sa:agg('sous_agent'), dom:agg('domaine') }
  },[rows,annee])

  const maxMois = stats ? Math.max(...stats.parMois.map(m=>m.primes),1) : 1

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

        <div style={{ display:'flex', gap:8, margin:'4px 0 18px' }}>
          {(annees.length?annees:[2026,2025]).map(y=>(
            <button key={y} onClick={()=>setAnnee(y)} style={{
              padding:'6px 16px', borderRadius:20, cursor:'pointer', fontSize:13, fontWeight:700,
              border:`1.5px solid ${annee===y?BLUE:'#e2e8f0'}`, background:annee===y?BLUE:'#fff', color:annee===y?'#fff':'#64748b' }}>{y}</button>
          ))}
        </div>

        {!rows && <p style={{ color:'#94a3b8' }}>Chargement des quittances…</p>}

        {stats && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:20 }}>
              <Kpi label="Primes encaissées" value={eur(stats.primes)} col={BLUE} sub={`${num(stats.n)} quittances`} />
              <Kpi label="Commissions" value={eur(stats.comm)} col={GREEN} />
              <Kpi label="Taux de commission" value={stats.taux.toFixed(1)+'%'} col="#7c3aed" />
              <Kpi label="Prime moyenne" value={eur(stats.n?stats.primes/stats.n:0)} col="#f59e0b" />
            </div>

            <Bloc titre={`Évolution mensuelle ${annee}`}>
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:180, padding:'0 4px' }}>
                {stats.parMois.map((m,i)=>(
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
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
              <Bloc titre="Par compagnie"><TableAgg rows={stats.cies.slice(0,12)} label="Compagnie" /></Bloc>
              <Bloc titre="Par domaine"><TableAgg rows={stats.dom.slice(0,12)} label="Domaine" /></Bloc>
              <Bloc titre="Par gestionnaire"><TableAgg rows={stats.gest.slice(0,12)} label="Gestionnaire" /></Bloc>
              <Bloc titre="Par sous-agent"><TableAgg rows={stats.sa.slice(0,12)} label="Sous-agent" /></Bloc>
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
