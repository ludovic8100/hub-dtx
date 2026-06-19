import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

const BLUE  = '#0080BD'
const NAVY  = '#0D2F5E'
const PER   = 40

const fmt     = v => v == null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const fmtMois = v => { if(!v) return '—'; const d=new Date(v); return d.toLocaleDateString('fr-BE',{month:'short',year:'numeric'}) }

// ── Domaines → icônes ──
const DOM = [
  { k:['AUTO','MOTO','CAMION','VÉHICULE'],       icon:'🚗', label:'Auto' },
  { k:['HABITATION','INCENDIE','MAISON'],         icon:'🏠', label:'Habitation' },
  { k:['VIE','DÉCÈS','PENSION','ÉPARGNE'],        icon:'💙', label:'Vie' },
  { k:['CRÉDIT','CREDIT','SOLDE RESTANT','SRDU'], icon:'💳', label:'Crédit' },
  { k:['RC','RESPONSABILIT'],                     icon:'⚖️', label:'RC' },
  { k:['ACCIDENT','CORPO'],                       icon:'🩹', label:'Accidents' },
  { k:['VOYAGE','ASSIST'],                        icon:'✈️', label:'Voyage' },
  { k:['JURIDIQUE','PROTECTION'],                 icon:'🛡️', label:'Protection juri.' },
]
const getIcon = d => { const u=(d||'').toUpperCase(); return DOM.find(m=>m.k.some(k=>u.includes(k)))||{icon:'📋',label:d||'Autre'} }

// ── Relation → badge ──
const REL_MAP = {
  conjoint:   { icon:'💍', col:'#ec4899', bg:'#fdf2f8', label:'Conjoint·e' },
  enfant:     { icon:'👶', col:'#7c3aed', bg:'#f5f3ff', label:'Enfant' },
  parent:     { icon:'👨‍👩‍👧', col:'#0d9488', bg:'#f0fdfa', label:'Parent' },
  fratrie:    { icon:'👫', col:'#2563eb', bg:'#eff6ff', label:'Fratrie' },
  entreprise: { icon:'🏢', col:'#94a3b8', bg:'#f8fafc', label:'Entreprise' },
  apporteur:  { icon:'🤝', col:'#16a34a', bg:'#f0fdf4', label:'Apporteur' },
  autre:      { icon:'🔗', col:'#64748b', bg:'#f1f5f9', label:'Autre' },
}

// ── Section pliable ──
function Sec({ icon, title, count, children, open: defOpen=true, col=BLUE }) {
  const [open, setOpen] = useState(defOpen)
  return (
    <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:'#f8fafc', userSelect:'none' }}
        onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'}
        onMouseLeave={e=>e.currentTarget.style.background='#f8fafc'}>
        <i className={`ti ${icon}`} style={{ fontSize:14, color:col }} />
        <span style={{ fontSize:13, fontWeight:700, color:NAVY, flex:1 }}>{title}</span>
        {count>0 && <span style={{ fontSize:10, background:col+'20', color:col, padding:'1px 7px', borderRadius:10, fontWeight:700 }}>{count}</span>}
        <i className={`ti ${open?'ti-chevron-up':'ti-chevron-down'}`} style={{ fontSize:11, color:'#94a3b8' }} />
      </div>
      {open && <div style={{ padding:'14px 16px' }}>{children}</div>}
    </div>
  )
}

// ══ Primes + commissions ══
function Primes({ dossier }) {
  const [rows,setRows]=useState([]); const [load,setLoad]=useState(true); const [showC,setShowC]=useState(false)
  useEffect(()=>{
    supabase.from('quittances').select('compagnie,date_comptable,prime_totale,commission,commission_sa,sous_agent').eq('dossier',dossier).order('date_comptable',{ascending:false}).limit(50)
      .then(({data})=>{ setRows(data||[]); setLoad(false) })
  },[dossier])
  if(load) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  if(!rows.length) return <p style={{color:'#94a3b8',fontSize:12}}>Aucune quittance trouvée</p>
  const tP=rows.reduce((s,r)=>s+parseFloat(r.prime_totale||0),0)
  const tC=rows.reduce((s,r)=>s+parseFloat(r.commission||0),0)
  const tS=rows.reduce((s,r)=>s+parseFloat(r.commission_sa||0),0)
  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'flex-start'}}>
        <div style={{background:'#eff6ff',borderRadius:8,padding:'8px 14px',border:'1px solid #bfdbfe'}}>
          <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Primes TTC</div>
          <div style={{fontSize:18,fontWeight:800,color:NAVY}}>{fmt(tP)}</div>
        </div>
        {showC&&<>
          <div style={{background:'#f0fdf4',borderRadius:8,padding:'8px 14px',border:'1px solid #bbf7d0'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Comm. DYN</div>
            <div style={{fontSize:18,fontWeight:800,color:'#16a34a'}}>{fmt(tC)}</div>
          </div>
          <div style={{background:'#fdf4ff',borderRadius:8,padding:'8px 14px',border:'1px solid #e9d5ff'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Comm. SA</div>
            <div style={{fontSize:18,fontWeight:800,color:'#7c3aed'}}>{fmt(tS)}</div>
          </div>
        </>}
        <button onClick={()=>setShowC(s=>!s)} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:12,color:showC?'#16a34a':'#64748b',background:showC?'#f0fdf4':'#f8fafc',border:`1px solid ${showC?'#bbf7d0':'#e2e8f0'}`,borderRadius:7,padding:'5px 12px',cursor:'pointer',fontWeight:600}}>
          <i className={`ti ${showC?'ti-eye-off':'ti-eye'}`}/>{showC?'Masquer commissions':'Voir commissions'}
        </button>
      </div>
      <div style={{overflowX:'auto',maxHeight:200,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
            <tr>{['Période','Compagnie','Prime TTC',...(showC?['Comm. DYN','Comm. SA']:[])].map(h=>(
              <th key={h} style={{padding:'6px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b',whiteSpace:'nowrap'}}>{fmtMois(r.date_comptable)}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#374151'}}>{r.compagnie||'—'}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:NAVY}}>{fmt(r.prime_totale)}</td>
                {showC&&<><td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:'#16a34a'}}>{fmt(r.commission)}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:'#7c3aed'}}>{fmt(r.commission_sa)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══ Relations familiales ══
function Relations({ dossier, onSelectMembre }) {
  const [rels,setRels]=useState([]); const [load,setLoad]=useState(true)
  useEffect(()=>{
    supabase.from('client_relations')
      .select('*')
      .or(`dossier_a.eq.${dossier},dossier_b.eq.${dossier}`)
      .then(async({data})=>{
        if(!data?.length){ setLoad(false); return }
        const dossiersLies=[...new Set(data.map(r=>r.dossier_a===dossier?r.dossier_b:r.dossier_a))]
        const{data:clients}=await supabase.from('clients').select('dossier,nom,prenom,gsm,email,gestionnaire_nom,sa_nom').in('dossier',dossiersLies)
        const clientMap=Object.fromEntries((clients||[]).map(c=>[c.dossier,c]))
        const enriched=data.map(r=>{
          const autreD=r.dossier_a===dossier?r.dossier_b:r.dossier_a
          const typeAffiche=r.dossier_a===dossier?r.type_relation:(r.type_relation==='enfant'?'parent':r.type_relation==='parent'?'enfant':r.type_relation)
          return{...r,autreD,typeAffiche,client:clientMap[autreD]}
        })
        setRels(enriched); setLoad(false)
      })
  },[dossier])
  if(load) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  if(!rels.length) return (
    <div style={{color:'#94a3b8',fontSize:12,fontStyle:'italic'}}>
      Aucune relation enregistrée.&nbsp;
      <span style={{color:BLUE,textDecoration:'underline',cursor:'pointer'}}>Ajouter une relation →</span>
    </div>
  )
  return(
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
      {rels.map((r,i)=>{
        const cfg=REL_MAP[r.typeAffiche]||REL_MAP.autre
        const c=r.client
        return(
          <div key={i} onClick={()=>c&&onSelectMembre(c)}
            style={{background:cfg.bg,border:`1px solid ${cfg.col}30`,borderRadius:10,padding:'10px 14px',cursor:c?'pointer':'default',minWidth:160,transition:'box-shadow 0.15s'}}
            onMouseEnter={e=>c&&(e.currentTarget.style.boxShadow=`0 3px 10px ${cfg.col}30`)}
            onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
              <span style={{fontSize:18}}>{cfg.icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:cfg.col,textTransform:'uppercase',letterSpacing:'.05em'}}>{cfg.label}</span>
            </div>
            {c?<>
              <div style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>{c.prenom} {c.nom}</div>
              <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{c.gsm||c.email||'—'}</div>
              <div style={{fontSize:10,color:cfg.col,marginTop:4,fontWeight:600}}>Voir fiche →</div>
            </>:<div style={{fontSize:12,color:'#94a3b8'}}>{r.label||r.autreD}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════
// FICHE CLIENT complète
// ══════════════════════
function Fiche({ client, onClose, onSelectMembre }) {
  const [contrats,setContrats]=useState([]); const [taches,setTaches]=useState([]); const [loadF,setLoadF]=useState(true)
  const ref=useRef(null)

  useEffect(()=>{
    ref.current?.scrollIntoView({behavior:'smooth',block:'start'})
    setLoadF(true)
    Promise.all([
      supabase.from('contrats').select('police,nom,situation___libelle,date_de_creation,domaine,type_production,garantie___valeur').eq('dossier',client.dossier).order('date_de_creation',{ascending:false}),
      supabase.from('taches').select('*').eq('dossier_client',client.dossier).order('echeance',{ascending:true}).limit(20),
    ]).then(([{data:c},{data:t}])=>{ setContrats(c||[]); setTaches(t||[]); setLoadF(false) })
  },[client.dossier])

  const initiales=`${(client.prenom||'?')[0]}${(client.nom||'?')[0]}`.toUpperCase()
  const actifs=contrats.filter(c=>c.situation___libelle==='En cours').length
  const adresse=[client.rue,client.num_maison,client.boite].filter(Boolean).join(' ')

  // Risques
  const risques={}
  contrats.filter(c=>c.situation___libelle==='En cours').forEach(c=>{
    const cfg=getIcon(c.domaine); const k=cfg.label
    if(!risques[k]) risques[k]={...cfg,n:0}
    risques[k].n++
  })
  const SIT={  'En cours':{bg:'#dcfce7',col:'#16a34a'},'Résilié':{bg:'#fee2e2',col:'#dc2626'},'Suspendu':{bg:'#fef3c7',col:'#92400e'} }

  return(
    <div ref={ref} style={{marginTop:20,background:'#fff',borderRadius:14,border:`2px solid ${BLUE}25`,overflow:'hidden',boxShadow:'0 4px 24px rgba(0,128,189,0.1)'}}>

      {/* ── Header gradient ── */}
      <div style={{background:`linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,padding:'18px 22px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{width:54,height:54,borderRadius:13,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:19,fontWeight:800,color:'#fff'}}>{initiales}</div>
        <div style={{flex:1,minWidth:160}}>
          <h2 style={{fontSize:19,fontWeight:800,color:'#fff',margin:'0 0 3px'}}>{client.prenom} {client.nom}</h2>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',display:'flex',gap:14,flexWrap:'wrap'}}>
            <span>#{client.dossier}</span>
            {client.bureau&&<span>{client.bureau}</span>}
            {client.classe&&<span>{client.classe}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {[{v:actifs,l:'Actifs'},{v:contrats.length,l:'Contrats'}].map(k=>(
            <div key={k.l} style={{textAlign:'center',background:'rgba(255,255,255,0.15)',borderRadius:9,padding:'8px 14px'}}>
              <div style={{fontSize:21,fontWeight:800,color:'#fff'}}>{k.v}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.65)',fontWeight:600}}>{k.l}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 12px',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
          <i className="ti ti-x"/>Fermer
        </button>
      </div>

      <div style={{padding:'18px 22px'}}>
        {client.alerte&&(
          <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'8px 14px',marginBottom:12,display:'flex',gap:8,fontSize:13,color:'#c2410c',alignItems:'center'}}>
            <i className="ti ti-alert-triangle" style={{fontSize:16}}/><strong>Alerte :</strong>{client.alerte}
          </div>
        )}

        {/* Coordonnées inline compact */}
        <Sec icon="ti-user" title="Coordonnées" col="#64748b" open={true} count={0}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:10}}>
            {[
              {icon:'ti-map-pin',  l:'Adresse',      v:adresse?`${adresse}, ${client.cp||''} ${client.localite||''}`:`${client.cp||''} ${client.localite||''}`},
              {icon:'ti-device-mobile',l:'GSM',       v:client.gsm||'—'},
              {icon:'ti-phone',    l:'Fixe',          v:client.tel_fixe||'—'},
              {icon:'ti-mail',     l:'Email',         v:client.email||'—'},
              {icon:'ti-calendar', l:'Naissance',     v:fmtDate(client.date_naissance)},
              {icon:'ti-user',     l:'Gestionnaire',  v:client.gestionnaire_nom||'—'},
              {icon:'ti-user',     l:'Sous-agent',    v:client.sa_nom||'—'},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',alignItems:'flex-start',gap:8}}>
                <i className={`ti ${r.icon}`} style={{fontSize:13,color:'#94a3b8',marginTop:2,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em'}}>{r.l}</div>
                  <div style={{fontSize:13,color:'#1e293b'}}>{r.v}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        {/* Relations familiales */}
        <Sec icon="ti-users-group" title="Relations & famille" col="#ec4899" open={true} count={0}>
          <Relations dossier={client.dossier} onSelectMembre={onSelectMembre}/>
        </Sec>

        {/* Objets assurés */}
        <Sec icon="ti-shield" title="Objets assurés" count={actifs} col="#7c3aed" open={true}>
          {loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:
            Object.values(risques).length===0?<p style={{color:'#94a3b8',fontSize:12}}>Aucun contrat actif</p>:
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {Object.values(risques).map((r,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:'#f8fafc',borderRadius:9,padding:'9px 14px',border:'1px solid #e2e8f0'}}>
                  <span style={{fontSize:22}}>{r.icon}</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{r.label}</div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{r.n} contrat{r.n>1?'s':''}</div>
                  </div>
                </div>
              ))}
            </div>
          }
        </Sec>

        {/* Contrats */}
        <Sec icon="ti-file-text" title="Contrats" count={contrats.length} col={BLUE} open={true}>
          {loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!contrats.length?<p style={{color:'#94a3b8',fontSize:12}}>Aucun contrat</p>:
            <div style={{overflowX:'auto',maxHeight:240,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
                  <tr>{['Police','Compagnie','Domaine','Situation','Type','Garantie'].map(h=>(
                    <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {contrats.map((c,i)=>{
                    const s=SIT[c.situation___libelle]||{bg:'#f1f5f9',col:'#64748b'}
                    return(
                      <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,fontWeight:600,color:NAVY}}>{c.police||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#1e293b'}}>{c.nom||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.domaine||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:s.bg,color:s.col}}>{c.situation___libelle||'—'}</span></td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.type_production||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.garantie___valeur||'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          }
        </Sec>

        {/* Primes & commissions */}
        <Sec icon="ti-cash" title="Primes & commissions" count={0} col="#16a34a" open={true}>
          <Primes dossier={client.dossier}/>
        </Sec>

        {/* Tâches */}
        <Sec icon="ti-checkbox" title="Tâches" count={taches.length} col="#f59e0b" open={false}>
          {loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!taches.length?
            <p style={{color:'#16a34a',fontSize:12}}>✓ Aucune tâche en cours</p>:
            taches.map((t,i)=>{
              const ret=t.echeance&&new Date(t.echeance)<new Date()
              return(
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<taches.length-1?'1px solid #f8fafc':'none',background:ret?'#fff5f510':''}} >
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,color:'#1e293b'}}>{t.titre||'—'}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{t.gestionnaire}{t.code_type?` · ${t.code_type}`:''}</div>
                  </div>
                  <span style={{fontSize:11,color:ret?'#dc2626':'#64748b',fontWeight:ret?700:400}}>{fmtDate(t.echeance)}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:ret?'#fee2e2':'#dbeafe',color:ret?'#dc2626':'#1d4ed8'}}>{t.statut}</span>
                </div>
              )
            })
          }
        </Sec>
      </div>
    </div>
  )
}

// ══════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════
export default function DynassurClients() {
  const [myCode,setMyCode]   = useState(null)
  const [myBureau,setMyBureau] = useState(null)
  const [kpis,setKpis]       = useState(null)
  const [counts,setCounts]   = useState({mine:0,bureau:0,total:0})
  const [scope,setScope]     = useState('all')
  const [q,setQ]             = useState('')
  const [clients,setClients] = useState([])
  const [total,setTotal]     = useState(0)
  const [page,setPage]       = useState(0)
  const [loading,setLoading] = useState(false)
  const [selected,setSelected] = useState(null)
  const searchRef = useRef(null)

  // Init user + counts
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user) return
      const code=user.email?.split('@')[0]?.toUpperCase()
      setMyCode(code)
      supabase.from('clients').select('bureau').eq('gestionnaire_code',code).limit(1)
        .then(({data})=>{ if(data?.[0]?.bureau) setMyBureau(data[0].bureau) })
    })
    supabase.rpc('get_clients_kpis').then(({data,error})=>{ if(!error&&data) setKpis(data) })
    supabase.from('clients').select('*',{count:'exact',head:true}).then(({count})=>setCounts(c=>({...c,total:count||0})))
  },[])

  useEffect(()=>{
    if(!myCode) return
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('gestionnaire_code',myCode).then(({count})=>setCounts(c=>({...c,mine:count||0})))
  },[myCode])

  useEffect(()=>{
    if(!myBureau) return
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('bureau',myBureau).then(({count})=>setCounts(c=>({...c,bureau:count||0})))
  },[myBureau])

  const load = useCallback(async(search,sc,p)=>{
    setLoading(true)
    let qb=supabase.from('clients').select('dossier,nom,prenom,cp,localite,gsm,tel_fixe,email,rue,num_maison,boite,date_naissance,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte',{count:'exact'})
    if(search.length>=2) qb=qb.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,dossier.ilike.%${search}%,email.ilike.%${search}%,gsm.ilike.%${search}%`)
    if(sc==='mine'&&myCode) qb=qb.eq('gestionnaire_code',myCode)
    else if(sc==='bureau'&&myBureau) qb=qb.eq('bureau',myBureau)
    const{data,count}=await qb.order('nom').range(p*PER,(p+1)*PER-1)
    const seen=new Set(); const uniq=(data||[]).filter(c=>{ if(!c.dossier||seen.has(c.dossier))return false; seen.add(c.dossier); return true })
    setClients(uniq); setTotal(count||0); setLoading(false)
  },[myCode,myBureau])

  useEffect(()=>{
    const t=setTimeout(()=>{ setPage(0); setSelected(null); load(q,scope,0) },300)
    return ()=>clearTimeout(t)
  },[q,scope,myCode,myBureau])

  useEffect(()=>{ load(q,scope,page) },[page])

  const nb=Math.ceil(total/PER)
  const tot=counts.total||1
  const pctMine=counts.mine?((counts.mine/tot)*100).toFixed(1):'—'
  const pctBureau=counts.bureau?((counts.bureau/tot)*100).toFixed(1):'—'

  const SCOPES=[
    { val:'mine',   icon:'ti-user',   label:'Mes clients',  nb:counts.mine,  pct:pctMine,   col:'#0080BD', note:myCode },
    { val:'bureau', icon:'ti-building',label:'Mon bureau',  nb:counts.bureau,pct:pctBureau, col:'#7c3aed', note:myBureau },
    { val:'all',    icon:'ti-users',  label:'Tous Dynassur',nb:counts.total, pct:'100',     col:'#16a34a', note:'Dynassur' },
  ]

  return(
    <Layout currentPage="Clients">
      <div style={{fontFamily:"'Source Sans Pro',sans-serif",maxWidth:1300}}>

        {/* Titre */}
        <div style={{marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
              <i className="ti ti-users" style={{fontSize:20,color:BLUE}}/>
              <h1 style={{fontSize:20,fontWeight:800,color:NAVY,margin:0}}>Clients Dynassur</h1>
            </div>
            <p style={{fontSize:13,color:'#64748b',margin:0}}>Base clients — {new Date().getFullYear()}</p>
          </div>
          {/* Mini KPIs */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {[{l:'Avec alerte',v:kpis?.avec_alerte,col:'#f59e0b'},{l:'Sans contrat',v:kpis?.sans_contrat,col:'#dc2626'},{l:'Sans comm. 2026',v:kpis?.sans_commissions,col:'#7c3aed'}].map(k=>(
              <div key={k.l} style={{background:'#fff',borderRadius:8,border:`1px solid ${k.col}30`,borderTop:`2px solid ${k.col}`,padding:'8px 14px',minWidth:110}}>
                <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:2}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:800,color:k.col}}>{k.v!=null?k.v.toLocaleString('fr-BE'):'…'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Barre de recherche en HAUT ── */}
        {!selected&&(
          <div style={{position:'relative',marginBottom:18}}>
            <i className="ti ti-search" style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:18}}/>
            <input ref={searchRef} value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Rechercher par nom, prénom, n° dossier, email, téléphone…"
              style={{width:'100%',padding:'12px 14px 12px 42px',borderRadius:10,border:`1.5px solid ${q?BLUE:'#e2e8f0'}`,fontSize:14,fontFamily:"'Source Sans Pro',sans-serif",outline:'none',boxSizing:'border-box',transition:'border-color 0.15s',background:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.04)'}}
            />
            {q&&<button onClick={()=>setQ('')} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:18}}>✕</button>}
          </div>
        )}

        {/* ── 3 cartes de scope ── */}
        {!selected&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
            {SCOPES.map(s=>{
              const isSel=scope===s.val
              const barW=s.pct==='100'?100:parseFloat(s.pct)||0
              return(
                <div key={s.val} onClick={()=>setScope(s.val)} style={{
                  background:'#fff',borderRadius:12,padding:'16px 18px',cursor:'pointer',
                  border:isSel?`2px solid ${s.col}`:'2px solid #e2e8f0',
                  boxShadow:isSel?`0 4px 16px ${s.col}25`:'0 1px 4px rgba(0,0,0,0.04)',
                  transition:'all 0.15s',
                }}
                  onMouseEnter={e=>{ if(!isSel){e.currentTarget.style.borderColor=s.col+'80';e.currentTarget.style.boxShadow=`0 3px 12px ${s.col}15`} }}
                  onMouseLeave={e=>{ if(!isSel){e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.04)'} }}
                >
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                    <i className={`ti ${s.icon}`} style={{fontSize:18,color:s.col}}/>
                    <span style={{fontSize:13,fontWeight:700,color:isSel?s.col:NAVY}}>{s.label}</span>
                    {s.note&&<span style={{fontSize:10,color:'#94a3b8',marginLeft:'auto'}}>{s.note}</span>}
                  </div>
                  <div style={{fontSize:30,fontWeight:900,color:isSel?s.col:'#0f172a',lineHeight:1,marginBottom:4}}>{s.nb.toLocaleString('fr-BE')}</div>
                  <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>{s.pct}% du total Dynassur</div>
                  <div style={{background:'#f1f5f9',borderRadius:4,height:5,overflow:'hidden'}}>
                    <div style={{width:`${barW}%`,height:'100%',background:s.col,borderRadius:4,transition:'width 0.4s'}}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Si client sélectionné : mini barre compacte ── */}
        {selected&&(
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,background:'#f0f9ff',borderRadius:10,padding:'10px 16px',border:`1px solid ${BLUE}30`}}>
            <button onClick={()=>{ setSelected(null); setTimeout(()=>searchRef.current?.focus(),100) }}
              style={{display:'flex',alignItems:'center',gap:5,background:'transparent',border:'none',cursor:'pointer',color:BLUE,fontSize:13,fontWeight:600,padding:0}}>
              <i className="ti ti-search" style={{fontSize:15}}/>Nouvelle recherche
            </button>
            <span style={{color:'#94a3b8'}}>·</span>
            <span style={{fontSize:13,color:'#64748b'}}>Fiche : <strong style={{color:NAVY}}>{selected.prenom} {selected.nom}</strong></span>
            <button onClick={()=>setSelected(null)} style={{marginLeft:'auto',background:'transparent',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:18}}>✕</button>
          </div>
        )}

        {/* ── Tableau ── */}
        {!selected&&(
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:4}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    {['N° Dossier','Nom & Prénom','Localité','GSM / Tél','Gestionnaire','SA',''].map(h=>(
                      <th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading&&!clients.length?(<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Chargement…</td></tr>)
                  :!clients.length?(<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Aucun client trouvé</td></tr>)
                  :clients.map((c,i)=>(
                    <tr key={c.dossier||i} onClick={()=>setSelected(c)} style={{cursor:'pointer',background:i%2===0?'#fff':'#fafafe',transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,color:NAVY,fontWeight:600}}>{c.dossier}</td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9'}}>
                        <div style={{fontWeight:600,color:'#1e293b'}}>{c.nom} {c.prenom}</div>
                        {c.email&&<div style={{fontSize:11,color:'#94a3b8'}}>{c.email}</div>}
                      </td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.cp} {c.localite||'—'}</td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#374151',fontSize:12}}>
                        {c.gsm||c.tel_fixe||'—'}
                      </td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#64748b',fontSize:12}}>{c.gestionnaire_nom||'—'}</td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#64748b',fontSize:12}}>{c.sa_nom||'—'}</td>
                      <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',textAlign:'right'}}>
                        <div style={{display:'flex',gap:4,alignItems:'center',justifyContent:'flex-end'}}>
                          {c.alerte&&<i className="ti ti-alert-triangle" style={{fontSize:13,color:'#f59e0b'}} title={c.alerte}/>}
                          <span style={{fontSize:11,color:BLUE,fontWeight:600}}>Fiche ▼</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {nb>1&&(
              <div style={{padding:'10px 18px',borderTop:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fafafe'}}>
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{padding:'5px 14px',borderRadius:6,border:'1px solid #e2e8f0',background:page===0?'#f8fafc':'#fff',cursor:page===0?'not-allowed':'pointer',fontSize:12,color:page===0?'#94a3b8':'#374151'}}>← Précédent</button>
                <span style={{fontSize:12,color:'#64748b'}}>Page {page+1} / {nb} — ≈ {total.toLocaleString('fr-BE')} clients</span>
                <button onClick={()=>setPage(p=>Math.min(nb-1,p+1))} disabled={page===nb-1} style={{padding:'5px 14px',borderRadius:6,border:'1px solid #e2e8f0',background:page===nb-1?'#f8fafc':'#fff',cursor:page===nb-1?'not-allowed':'pointer',fontSize:12,color:page===nb-1?'#94a3b8':'#374151'}}>Suivant →</button>
              </div>
            )}
          </div>
        )}

        {/* ── Fiche ── */}
        {selected&&<Fiche client={selected} onClose={()=>setSelected(null)} onSelectMembre={c=>setSelected(c)}/>}

      </div>
    </Layout>
  )
}
