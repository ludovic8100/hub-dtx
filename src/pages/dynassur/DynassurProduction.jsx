import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { useAuth } from '../../lib/auth'

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

function KpiCard({ label, value, col, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0',
      borderTop:`3px solid ${col}`, padding:'14px 18px', cursor:onClick?'pointer':'default', transition:'box-shadow .15s' }}
      onMouseEnter={e=>{ if(onClick) e.currentTarget.style.boxShadow=`0 4px 14px ${col}25` }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='none' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6, display:'flex', justifyContent:'space-between' }}>
        <span>{label}</span>{onClick && <i className="ti ti-zoom-in" style={{ color:'#cbd5e1' }}/>}
      </div>
      <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ── Fenêtre de détail : les mouvements (actes) derrière un chiffre ──
function ActsModal({ titre, rows, onClose }) {
  const tri = [...rows].sort((a,b)=>(b.mois||'').localeCompare(a.mois||''))
  const show = tri.slice(0,1000)
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.55)', zIndex:1000, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'min(880px,96vw)', height:'100%', background:'#fff', display:'flex', flexDirection:'column', boxShadow:'-8px 0 30px rgba(0,0,0,.2)' }}>
        <div style={{ background:NAVY, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#fff', fontSize:15, fontWeight:800 }}>{titre}</div>
            <div style={{ color:'#cbd5e1', fontSize:12, marginTop:2 }}>{fmtN(rows.length)} mouvement(s)</div>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
              {['Mois','Type','Agent','Client','Branche','Compagnie','N° contrat'].map(h=>(
                <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {show.map((d,i)=>{
                const cfg = TYPES_PROD[d.type_prod] || { col:'#94a3b8' }
                return (
                  <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'7px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{MOIS_LABELS[parseInt(d.mois)]||d.mois} {d.annee}</td>
                    <td style={{ padding:'7px 12px' }}><Badge label={d.type_prod} col={cfg.col} /></td>
                    <td style={{ padding:'7px 12px', color:'#475569' }}>{AGENT_NOMS[d.agent_code]||d.agent_code||'—'}</td>
                    <td style={{ padding:'7px 12px', fontWeight:600, color:NAVY }}>{d.client_nom||'—'}</td>
                    <td style={{ padding:'7px 12px', color:'#475569' }}>{d.branche||'—'}</td>
                    <td style={{ padding:'7px 12px', color:'#475569' }}>{d.compagnie||'—'}</td>
                    <td style={{ padding:'7px 12px', color:'#64748b', whiteSpace:'nowrap' }}>{d.num_contrat||'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tri.length>1000 && <p style={{ padding:'12px 16px', color:'#94a3b8', fontSize:12 }}>… et {fmtN(tri.length-1000)} autres lignes.</p>}
        </div>
      </div>
    </div>
  )
}

// ── ONGLET 1 : Vue globale ──
// dégradés « classe » (clair en haut → foncé en bas)
const CAT_DEF = {
  HQ:        { label:'HQ',         grad:'linear-gradient(180deg,#5b9bff,#14306b)', solid:'#2f6fed' },
  SA:        { label:'Sous-agent', grad:'linear-gradient(180deg,#5eead4,#0b6b63)', solid:'#0f9b8e' },
  Apporteur: { label:'Apporteur',  grad:'linear-gradient(180deg,#c4b5fd,#5b21b6)', solid:'#7c4dd6' },
}
const mineDef = code => ({ key:code, label:code, grad:'linear-gradient(180deg,#fcd34d,#b45309)', solid:'#d97706' })
const POSITIFS = ['N.A.', 'Mandat faveur']
const NEGATIFS = ['Renon', 'Résiliation Non paiement', 'Mandat défaveur']
const MODES = [
  { key:'entrees', label:'Entrées',          types:POSITIFS },
  { key:'sorties', label:'Sorties',          types:NEGATIFS },
  { key:'nette',   label:'Production nette',  types:[...POSITIFS, ...NEGATIFS] },
]
const cnt = (rows, types) => rows.filter(d => types.includes(d.type_prod)).length
const netCnt = rows => cnt(rows, POSITIFS) - cnt(rows, NEGATIFS)

function Legende({ cats }) {
  return (
    <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
      {cats.map(c => (
        <span key={c.key} style={{ fontSize:11, color:'#475569', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}>
          <i style={{ display:'inline-block', width:12, height:12, borderRadius:3, background:c.grad }} />{c.label}
        </span>
      ))}
    </div>
  )
}

function ChartAnnee({ annee, rows, cats, mode, onDetail, myCode, myBase }) {
  const isNet = mode.key === 'nette'
  const val = rc => isNet ? netCnt(rc) : cnt(rc, mode.types)
  const mois = Array.from({ length:12 }, (_, i) => {
    const mm = String(i+1).padStart(2,'0')
    const rM = rows.filter(d => d.mois === mm)
    const seg = {}
    cats.forEach(c => { seg[c.key] = val(rM.filter(d => d._dcat === c.key)) })
    const total = cats.reduce((s,c) => s + seg[c.key], 0)
    const stack = cats.reduce((s,c) => s + Math.max(0, seg[c.key]), 0)
    return { i:i+1, mm, label:MOIS_LABELS[i+1], seg, total, stack, rM }
  })
  const maxStack = Math.max(...mois.map(m => m.stack), 1)
  const totalAn  = mois.reduce((s,m) => s + m.total, 0)
  const H = 150

  let compo = null
  if (myCode) {
    compo = {
      me:  val(rows.filter(d => d._code === myCode)),
      cat: val(rows.filter(d => d._cat === myBase)),
      all: val(rows),
    }
  }

  return (
    <div style={{ background:'#fff', borderRadius:14, border:'1px solid #e8edf3', padding:'16px 18px', marginBottom:16, boxShadow:'0 1px 3px rgba(15,23,42,.04)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, gap:12, flexWrap:'wrap' }}>
        <button onClick={() => onDetail(`Production ${annee} — toute la production`, rows)}
          style={{ fontSize:17, fontWeight:800, color:NAVY, background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
          {annee} <i className="ti ti-zoom-in" style={{ fontSize:14, color:'#cbd5e1' }} />
        </button>
        <Legende cats={cats} />
      </div>
      {compo ? (
        <div style={{ fontSize:11.5, color:'#64748b', marginBottom:12, background:'#f8fafc', borderRadius:8, padding:'6px 12px' }}>
          Toi (<strong style={{ color:'#d97706' }}>{myCode}</strong>) : <strong style={{ color:NAVY }}>{compo.me}</strong>
          <span style={{ margin:'0 8px', color:'#cbd5e1' }}>|</span>
          Ta catégorie ({CAT_DEF[myBase]?.label || myBase}) : <strong style={{ color:NAVY }}>{compo.cat}</strong>
          <span style={{ margin:'0 8px', color:'#cbd5e1' }}>|</span>
          Tout Dynassur : <strong style={{ color:NAVY }}>{compo.all}</strong>
          {compo.all > 0 && <span style={{ marginLeft:8, color:'#94a3b8' }}>· soit {Math.round(compo.me / compo.all * 100)}% du total</span>}
        </div>
      ) : (
        <div style={{ fontSize:11.5, color:'#94a3b8', marginBottom:12 }}>{mode.label} {annee} : <strong style={{ color:NAVY }}>{totalAn > 0 && isNet ? '+' : ''}{totalAn}</strong> actes</div>
      )}
      <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:H+22 }}>
        {mois.map(m => (
          <div key={m.i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{ fontSize:10, fontWeight:700, color:m.total>=0?NAVY:'#dc2626', marginBottom:3, height:13 }}>{m.total?`${m.total>0&&isNet?'+':''}${m.total}`:''}</div>
            <div style={{ width:'100%', height:H, display:'flex', flexDirection:'column', justifyContent:'flex-end', borderRadius:'5px 5px 0 0', overflow:'hidden', background:'#f1f5f9' }}>
              {cats.map(c => {
                const v = Math.max(0, m.seg[c.key])
                const h = v / maxStack * H
                if (h <= 0) return null
                const pct = m.stack ? Math.round(v / m.stack * 100) : 0
                return (
                  <div key={c.key} title={`${c.label} — ${m.label} ${annee} : ${m.seg[c.key]} (${pct}%)`}
                    onClick={() => onDetail(`${c.label} — ${mode.label} ${m.label} ${annee}`,
                      m.rM.filter(d => d._dcat === c.key && mode.types.includes(d.type_prod)))}
                    style={{ height:h, background:c.grad, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {h >= 15 && <span style={{ fontSize:9, fontWeight:700, color:'#fff' }}>{pct}%</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize:10, color:'#94a3b8', marginTop:5 }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OngletGlobal({ onDetail }) {
  const { perms, isAdmin } = useAuth()
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState({ commercial:new Set(), base:{} })
  const [mode, setMode] = useState(MODES[0])

  useEffect(() => {
    (async () => {
      const { data: collabs } = await supabase.from('collaborateurs')
        .select('code,nom_sa_data,noms_repris,est_commercial,est_apporteur,est_sous_agent')
      const baseOf = c => c.est_apporteur ? 'Apporteur' : c.est_sous_agent ? 'SA' : 'HQ'
      const nameToCode = {}, commercial = new Set(), base = {}
      ;(collabs || []).forEach(c => {
        base[c.code] = baseOf(c)
        if (c.est_commercial) commercial.add(c.code)
        if (c.nom_sa_data) nameToCode[c.nom_sa_data.trim()] = c.code
        ;(c.noms_repris || []).forEach(n => n && (nameToCode[n.trim()] = c.code))
      })
      const all = []; let from = 0
      while (true) {
        const { data, error } = await supabase.from('mouvements_production')
          .select('type_prod, annee, mois, agent_code:sa_contrat, num_contrat:police, client_nom:nom_client, branche:type_police, compagnie:cie')
          .range(from, from + 999)
        if (error || !data || !data.length) break
        all.push(...data); if (data.length < 1000) break; from += 1000
      }
      const Y = new Date().getFullYear()
      const mapped = all
        .filter(d => d.annee >= 2020 && d.annee <= Y)
        .map(d => {
          const code = nameToCode[(d.agent_code || '').trim()] || null
          return { ...d, mois:String(d.mois).padStart(2,'0'), _code:code, _cat: code ? (base[code] || 'SA') : 'SA' }
        })
      setMeta({ commercial, base })
      setRows(mapped)
    })()
  }, [])

  const view = useMemo(() => {
    if (!rows) return null
    const myCode = perms?.collab_code ? String(perms.collab_code).toUpperCase() : null
    const patron = isAdmin || !myCode
    let cats, dcat, myBase = null
    if (patron) {
      cats = ['HQ','SA','Apporteur'].map(k => ({ key:k, ...CAT_DEF[k] }))
      dcat = d => d._cat
    } else {
      myBase = meta.base[myCode] || 'HQ'
      if (meta.commercial.has(myCode)) {
        cats = [mineDef(myCode), ...['HQ','SA','Apporteur'].map(k => ({ key:k, ...CAT_DEF[k] }))]
        dcat = d => d._code === myCode ? myCode : d._cat
      } else {
        const others = ['HQ','SA','Apporteur'].filter(k => k !== myBase)
        cats = [mineDef(myCode), ...others.map(k => ({ key:k, ...CAT_DEF[k] }))]
        dcat = d => d._code === myCode ? myCode : (d._cat === myBase ? null : d._cat)
      }
    }
    return { cats, rows: rows.map(d => ({ ...d, _dcat: dcat(d) })), myCode: patron ? null : myCode, myBase }
  }, [rows, perms, isAdmin, meta])

  const annees = useMemo(() => view ? [...new Set(view.rows.map(r => r.annee))].sort((a,b) => b - a) : [], [view])

  if (!view) return <div style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>Chargement de la production…</div>

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        {MODES.map(m => (
          <button key={m.key} onClick={()=>setMode(m)} style={{
            padding:'7px 18px', borderRadius:22, border:`1.5px solid ${mode.key===m.key?BLUE:'#e2e8f0'}`,
            background: mode.key===m.key?'linear-gradient(135deg,#0080BD,#0D2F5E)':'#fff',
            color: mode.key===m.key?'#fff':'#64748b', fontWeight:700, fontSize:13, cursor:'pointer',
            boxShadow: mode.key===m.key?'0 2px 8px rgba(0,128,189,.3)':'none'
          }}>{m.label}</button>
        ))}
        <span style={{ fontSize:11, color:'#94a3b8', marginLeft:'auto' }}>Volume brut · clique un segment (ou l'année) pour le détail</span>
      </div>
      {annees.map(an => (
        <ChartAnnee key={an} annee={an} rows={view.rows.filter(r => r.annee === an)}
          cats={view.cats} mode={mode} onDetail={onDetail} myCode={view.myCode} myBase={view.myBase} />
      ))}
    </div>
  )
}


// ── ONGLET 2 : Par collaborateur ──
function OngletCollaborateurs({ data, annee, onDetail }) {
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
                      <td key={t.key} onClick={e=>{ e.stopPropagation(); if(ag[t.key]>0) onDetail(`${ag.nom} — ${t.label} ${annee}`, filtered.filter(d=>d.agent_code===ag.code && d.type_prod===t.key)) }}
                        style={{ padding:'10px 8px', textAlign:'center', borderBottom:'1px solid #f1f5f9', cursor:(ag[t.key]||0)>0?'pointer':'default' }}>
                        <span style={{ fontWeight:700, color:(ag[t.key]||0)>0?t.col:'#e2e8f0', fontSize:14 }}>
                          {ag[t.key]||0}
                        </span>
                      </td>
                    ))}
                    <td onClick={e=>{ e.stopPropagation(); onDetail(`${ag.nom} — mouvements impactants ${annee}`, filtered.filter(d=>d.agent_code===ag.code && (TYPES_PROD[d.type_prod]?.sign||0)!==0)) }}
                      style={{ padding:'10px 14px', textAlign:'center', borderBottom:'1px solid #f1f5f9', cursor:'pointer' }}>
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
                      <td key={t.key} onClick={()=>tot>0&&onDetail(`Tous — ${t.label} ${annee}`, filtered.filter(d=>d.type_prod===t.key))}
                        style={{ padding:'10px 8px', textAlign:'center', fontWeight:800, color:tot>0?t.col+'cc':'rgba(255,255,255,0.2)', fontSize:14, cursor:tot>0?'pointer':'default' }}>
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
  const [detail, setDetail]   = useState(null)   // { titre, rows }
  const onDetail = (titre, rows) => setDetail({ titre, rows })

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
          .select('type_prod, annee, mois, agent_code:sa_contrat, num_contrat:police, client_nom:nom_client, branche:type_police, compagnie:cie')
          .eq('annee', annee)
          .order('mois', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) { console.error(error); break }
        const r = Array.isArray(rows) ? rows : []
        all = all.concat(r)
        if (r.length < PAGE) break
        from += PAGE
      }
      // mois est un entier en base -> normaliser en '01'..'12' pour le reste du code (comparaisons + tris)
      setData(all.map(d => ({ ...d, mois: String(d.mois).padStart(2,'0') }))); setLoading(false)
    })()
  }, [annee])

  return (
    <Layout currentPage="Production">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", width:'100%' }}>

        <StatBanner
          color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title={onglet === 'global' ? 'Production' : `Production ${annee}`}
          subtitle="Dynassur SRL — suivi par type et collaborateur"
          stats={[]}
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

        {onglet === 'global' ? (
          <OngletGlobal onDetail={onDetail} />
        ) : (
          <>
            {/* Sélecteur d'année (Collaborateurs / Détail) */}
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              {[2023,2024,2025,2026].map(a => (
                <button key={a} onClick={()=>setAnnee(a)} style={{
                  padding:'6px 16px', borderRadius:20, border:`2px solid ${annee===a?BLUE:'#e2e8f0'}`,
                  background: annee===a?BLUE:'#fff', color:annee===a?'#fff':'#64748b',
                  fontWeight:700, fontSize:13, cursor:'pointer'
                }}>{a}</button>
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
                {onglet==='collaborateurs' && <OngletCollaborateurs data={data} annee={annee} onDetail={onDetail} />}
                {onglet==='detail'         && <OngletDetail         data={data} />}
              </>
            )}
          </>
        )}
      </div>
      {detail && <ActsModal titre={detail.titre} rows={detail.rows} onClose={()=>setDetail(null)} />}
    </Layout>
  )
}
