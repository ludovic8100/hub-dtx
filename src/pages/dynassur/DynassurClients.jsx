import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { getCompagnies, resolveCie } from '../../lib/cie'

const BLUE  = '#0080BD'
const NAVY  = '#0D2F5E'
const PER   = 40

const fmt     = v => v == null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)

// Parse une date qui peut être ISO (2026-05-06) OU belge (30/01/1978) → objet Date ou null
const parseDate = v => {
  if(!v) return null
  if(v instanceof Date) return isNaN(v)?null:v
  const s=String(v).trim()
  let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)              // JJ/MM/AAAA
  if(m) return new Date(+m[3],+m[2]-1,+m[1])
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)                      // AAAA-MM-JJ
  if(m) return new Date(+m[1],+m[2]-1,+m[3])
  const d=new Date(s); return isNaN(d)?null:d
}
const fmtDate = v => { const d=parseDate(v); return d?d.toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'}):'—' }
const fmtDateLong = v => { const d=parseDate(v); return d?d.toLocaleDateString('fr-BE',{day:'numeric',month:'long',year:'numeric'}):'—' }
const fmtMois = v => { const d=parseDate(v); return d?d.toLocaleDateString('fr-BE',{month:'short',year:'numeric'}):'—' }
// RDV : le debut Graph peut être sans offset → on force UTC
const tsRdv = iso => { if(!iso) return 0; const d=new Date(String(iso).length<=19?iso+'Z':iso); return isNaN(d)?0:d.getTime() }
const fmtRdv = iso => { const t=tsRdv(iso); return t?new Date(t).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'}):'—' }
const fmtAppel = iso => { if(!iso) return '—'; const d=new Date(String(iso).replace(' ','T')); return isNaN(d)?'—':d.toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) }
const ilYa = jours => {
  if(jours==null) return ''
  if(jours<31) return `il y a ${jours} j`
  const mois=Math.round(jours/30.44)
  if(mois<12) return `il y a ${mois} mois`
  const ans=Math.floor(jours/365); const r=Math.round((jours%365)/30.44)
  return r>=1 ? `il y a ${ans} an${ans>1?'s':''} ${r} m` : `il y a ${ans} an${ans>1?'s':''}`
}
// Tranches « dernier contact » pour la relance (bornes en jours)
const TRANCHES = [
  { val:'m1',  label:'Ce mois (< 1 mois)',  min:0,   max:31 },
  { val:'m3',  label:'1 à 3 mois',          min:31,  max:92 },
  { val:'m6',  label:'3 à 6 mois',          min:92,  max:183 },
  { val:'m12', label:'6 à 12 mois',         min:183, max:365 },
  { val:'a2',  label:'1 à 2 ans',           min:365, max:730 },
  { val:'a2p', label:'Plus de 2 ans',       min:730, max:Infinity },
  { val:'jamais', label:'Jamais contacté',  min:null, max:null },
]
const trancheDe = jours => TRANCHES.find(t=>t.min!=null&&jours>=t.min&&jours<t.max)?.val || null
const TRANCHE_COL = { m1:'#16a34a', m3:'#65a30d', m6:'#ca8a04', m12:'#ea580c', a2:'#dc2626', a2p:'#991b1b', jamais:'#6b7280' }
// Âge en années (+ mois) à partir d'une date de naissance
const calcAge = v => {
  const d=parseDate(v); if(!d) return null
  const now=new Date()
  let ans=now.getFullYear()-d.getFullYear()
  let mois=now.getMonth()-d.getMonth()
  if(now.getDate()<d.getDate()) mois--
  if(mois<0){ ans--; mois+=12 }
  return { ans, mois }
}
// Nettoie un numéro de téléphone (retire l'apostrophe parasite d'export Excel)
const cleanTel = v => { if(!v) return null; const s=String(v).replace(/^'+/,'').trim(); return (s && s.toUpperCase()!=='GSM' && s.toUpperCase()!=='TEL')?s:null }

// Mémorise les derniers clients consultés (localStorage) — lus par le tableau de bord Dynassur
const RECENT_KEY='dyn_recent_clients'
const pushRecentClient = c => {
  if(!c||!c.dossier) return
  try{
    const prev=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')
    const entry={dossier:c.dossier, nom:c.nom||'', prenom:c.prenom||'', localite:c.localite||'', ts:Date.now()}
    const next=[entry, ...prev.filter(x=>x.dossier!==c.dossier)].slice(0,8)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  }catch(e){}
}

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

// ── Badge « En cours de développement » ──
function EnDev({ label='En cours de développement', mini=false }) {
  return (
    <span title="Fonctionnalité en cours de développement" style={{
      display:'inline-flex',alignItems:'center',gap:4,
      background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa',
      borderRadius:20,padding:mini?'1px 7px':'2px 9px',fontSize:mini?9:10,fontWeight:700,
      textTransform:'uppercase',letterSpacing:'.03em',whiteSpace:'nowrap',verticalAlign:'middle',
    }}>
      <i className="ti ti-tools" style={{fontSize:mini?10:11}}/>{label}
    </span>
  )
}

// ── Couvertures essentielles (analyse 360) ──
const ESSENTIELS=[
  {label:'Auto / Véhicule',       icon:'🚗', kw:['AUTO','VÉHIC','VEHIC','MOTO','CAMION']},
  {label:'Habitation / Incendie', icon:'🏠', kw:['HABITATION','INCENDIE','MAISON','BÂTIMENT','BATIMENT','IMMEUBLE']},
  {label:'RC Familiale',          icon:'⚖️', kw:['FAMILIALE','RC VIE PRIVÉE','VIE PRIVEE','RESPONSABILIT']},
  {label:'Protection juridique',  icon:'🛡️', kw:['JURIDIQUE','PROTECTION JUR','D.A.S','DAS']},
  {label:'Soins de santé / Hospi',icon:'🏥', kw:['SANTÉ','SANTE','HOSPI','MALADIE','SOINS','INDIVIDUELLE','DKV']},
  {label:'Vie / Décès',           icon:'💙', kw:['VIE ','DÉCÈS','DECES','PLACEMENT']},
  {label:'Pension / Épargne',     icon:'🐷', kw:['PENSION','ÉPARGNE','EPARGNE','EPL','EIP']},
  {label:'Accidents',             icon:'🩹', kw:['ACCIDENT','CORPO']},
]
// Texte de couverture à partir d'une liste de contrats (domaine + type + compagnie)
const coverBlob = contrats => (contrats||[]).filter(c=>c.situation==='En cours').map(c=>`${c.domaine||''} ${c.type_production||''} ${c.compagnie||''}`).join(' | ').toUpperCase()
// Quels types de relation propagent une couverture (foyer + sociétés liées)
const PROPAGE = lib => { const t=(lib||'').toLowerCase(); return ['conjoint','cohabitant','concubin','gérant','gerant','administrateur','coopérateur','cooperateur','firme','parent','enfant'].some(k=>t.includes(k)) }

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
function Sec({ icon, title, count, children, extra, open: defOpen=true, col=BLUE }) {
  const [open, setOpen] = useState(defOpen)
  return (
    <div style={{ border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden', marginBottom:10 }}>
      <div onClick={()=>setOpen(o=>!o)} style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:8, cursor:'pointer', background:'#f8fafc', userSelect:'none' }}
        onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'}
        onMouseLeave={e=>e.currentTarget.style.background='#f8fafc'}>
        <i className={`ti ${icon}`} style={{ fontSize:14, color:col }} />
        <span style={{ fontSize:13, fontWeight:700, color:NAVY }}>{title}</span>
        {count>0 && <span style={{ fontSize:10, background:col+'20', color:col, padding:'1px 7px', borderRadius:10, fontWeight:700 }}>{count}</span>}
        {extra}
        <span style={{ flex:1 }} />
        <i className={`ti ${open?'ti-chevron-up':'ti-chevron-down'}`} style={{ fontSize:11, color:'#94a3b8' }} />
      </div>
      {open && <div style={{ padding:'14px 16px' }}>{children}</div>}
    </div>
  )
}

// ══ Primes + commissions ══
function Primes({ dossier }) {
  const { perms }=useAuth()
  const canComm=!!perms?.voir_commissions
  const [rows,setRows]=useState([]); const [load,setLoad]=useState(true); const [showC,setShowC]=useState(false)
  const show=showC&&canComm
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
        {show&&<>
          <div style={{background:'#f0fdf4',borderRadius:8,padding:'8px 14px',border:'1px solid #bbf7d0'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Comm. DYN</div>
            <div style={{fontSize:18,fontWeight:800,color:'#16a34a'}}>{fmt(tC)}</div>
          </div>
          <div style={{background:'#fdf4ff',borderRadius:8,padding:'8px 14px',border:'1px solid #e9d5ff'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',marginBottom:2}}>Comm. SA</div>
            <div style={{fontSize:18,fontWeight:800,color:'#7c3aed'}}>{fmt(tS)}</div>
          </div>
        </>}
        {canComm&&<button onClick={()=>setShowC(s=>!s)} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:12,color:showC?'#16a34a':'#64748b',background:showC?'#f0fdf4':'#f8fafc',border:`1px solid ${showC?'#bbf7d0':'#e2e8f0'}`,borderRadius:7,padding:'5px 12px',cursor:'pointer',fontWeight:600}}>
          <i className={`ti ${showC?'ti-eye-off':'ti-eye'}`}/>{showC?'Masquer commissions':'Voir commissions'}
        </button>}
      </div>
      <div style={{overflowX:'auto',maxHeight:200,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
            <tr>{['Période','Compagnie','Prime TTC',...(show?['Comm. DYN','Comm. SA']:[])].map(h=>(
              <th key={h} style={{padding:'6px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b',whiteSpace:'nowrap'}}>{fmtMois(r.date_comptable)}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#374151'}}>{r.compagnie||'—'}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:NAVY}}>{fmt(r.prime_totale)}</td>
                {show&&<><td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:'#16a34a'}}>{fmt(r.commission)}</td>
                <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:'#7c3aed'}}>{fmt(r.commission_sa)}</td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ══ Analyse 360 — couvertures du client + accessibles via les relations ══
function Analyse360({ client, contrats }) {
  const [ext,setExt]=useState({})      // label couvert -> { via, type } (via une relation)
  const [loadExt,setLoadExt]=useState(true)

  // Couvertures directes (contrats du client)
  const blobDirect=coverBlob(contrats)
  const directs={}
  ESSENTIELS.forEach(e=>{ if(e.kw.some(k=>blobDirect.includes(k))) directs[e.label]=true })

  // Remontée du graphe de relations (profondeur 2) pour couvertures « accessibles via une relation »
  useEffect(()=>{
    let annule=false
    async function run(){
      setLoadExt(true)
      try{
        const startDossier=client.dossier
        const visited=new Set([startDossier])
        // frontier : personnes courantes { dossier, nom, prenom }
        let frontier=[{dossier:startDossier, nom:(client.nom||'').toUpperCase(), prenom:(client.prenom||'')}]
        const liens=[]   // { dossier, nom, prenom, via, type } des dossiers liés découverts
        for(let depth=0; depth<2 && frontier.length; depth++){
          const dossiers=frontier.map(f=>f.dossier).filter(Boolean)
          const noms=[...new Set(frontier.map(f=>f.nom).filter(Boolean))]
          const [dirRes, invRes]=await Promise.all([
            dossiers.length? supabase.from('famille').select('dossier,nom_principal,prenom_principal,type_relation_libelle,nom_lie,prenom_lie').in('dossier',dossiers) : Promise.resolve({data:[]}),
            noms.length?     supabase.from('famille').select('dossier,nom_principal,prenom_principal,type_relation_libelle,nom_lie,prenom_lie').in('nom_lie',noms) : Promise.resolve({data:[]}),
          ])
          const trouvailles=[]
          // inverses : le principal (avec dossier) est lié à une personne du frontier
          ;(invRes.data||[]).forEach(r=>{
            if(!PROPAGE(r.type_relation_libelle)) return
            const match=frontier.some(f=>f.nom===(r.nom_lie||'').toUpperCase() && (f.prenom||'').toUpperCase()===(r.prenom_lie||'').toUpperCase())
            if(match && r.dossier && !visited.has(r.dossier))
              trouvailles.push({dossier:r.dossier, nom:(r.nom_principal||'').toUpperCase(), prenom:r.prenom_principal||'', via:`${r.nom_principal||''} ${r.prenom_principal||''}`.trim(), type:r.type_relation_libelle})
          })
          // directes : la personne liée n'a pas de dossier en base → résolue via clients ensuite
          const aResoudre=[]
          ;(dirRes.data||[]).forEach(r=>{
            if(!PROPAGE(r.type_relation_libelle)) return
            aResoudre.push({nom:(r.nom_lie||'').toUpperCase(), prenom:r.prenom_lie||'', via:`${r.nom_lie||''} ${r.prenom_lie||''}`.trim(), type:r.type_relation_libelle})
          })
          if(aResoudre.length){
            const nomsR=[...new Set(aResoudre.map(x=>x.nom).filter(Boolean))]
            const{data:cl}=await supabase.from('clients').select('dossier,nom,prenom').in('nom',nomsR).not('dossier','is',null)
            const idx={}
            ;(cl||[]).forEach(c=>{ idx[`${(c.nom||'').toUpperCase()}|${(c.prenom||'').toUpperCase()}`]=c.dossier })
            aResoudre.forEach(x=>{ const dd=idx[`${x.nom}|${x.prenom.toUpperCase()}`]; if(dd&&!visited.has(dd)) trouvailles.push({...x,dossier:dd}) })
          }
          // Avancer
          frontier=[]
          trouvailles.forEach(t=>{ if(!visited.has(t.dossier)){ visited.add(t.dossier); liens.push(t); frontier.push(t) } })
        }
        // Contrats EN COURS de tous les dossiers liés découverts
        const autresDossiers=liens.map(l=>l.dossier)
        const couvExt={}
        if(autresDossiers.length){
          const{data:ctr}=await supabase.from('contrats').select('dossier,domaine,type_production,compagnie,situation').in('dossier',autresDossiers).eq('situation','En cours')
          // associer chaque contrat à sa source (lien)
          const parDossier={}
          ;(ctr||[]).forEach(c=>{ (parDossier[c.dossier]=parDossier[c.dossier]||[]).push(c) })
          liens.forEach(l=>{
            const blob=coverBlob(parDossier[l.dossier]||[])
            ESSENTIELS.forEach(e=>{
              if(directs[e.label]) return
              if(e.kw.some(k=>blob.includes(k)) && !couvExt[e.label]) couvExt[e.label]={via:l.via, type:l.type}
            })
          })
        }
        if(!annule) setExt(couvExt)
      }catch(e){ if(!annule) setExt({}) }
      if(!annule) setLoadExt(false)
    }
    run()
    return ()=>{ annule=true }
  },[client.dossier, blobDirect])

  const couv=ESSENTIELS.map(e=>{
    if(directs[e.label]) return {...e, etat:'direct'}
    if(ext[e.label])     return {...e, etat:'relation', src:ext[e.label]}
    return {...e, etat:'absent'}
  })
  const manquants=couv.filter(e=>e.etat==='absent')
  const STY={ direct:{bg:'#f0fdf4',col:'#16a34a',bd:'#bbf7d0',ic:'ti-check'}, relation:{bg:'#eff6ff',col:'#2563eb',bd:'#bfdbfe',ic:'ti-users'}, absent:{bg:'#fef2f2',col:'#dc2626',bd:'#fecaca',ic:'ti-x'} }

  return (
    <div style={{background:'#fafafe',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px',marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:700,color:NAVY,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:9,display:'flex',alignItems:'center',gap:6}}>
        <i className="ti ti-radar" style={{color:'#7c3aed'}}/>Analyse 360 — couverture
        {loadExt&&<span style={{fontSize:10,color:'#94a3b8',fontWeight:500,textTransform:'none'}}>· analyse des relations…</span>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:7}}>
        {couv.map((e,i)=>{
          const s=STY[e.etat]
          return(
            <div key={i} title={e.etat==='relation'?`Couvert via ${e.src.via} (${e.src.type})`:e.etat==='direct'?'Couvert par un contrat du client':'Non couvert — opportunité'}
              style={{display:'flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:10,fontSize:12,fontWeight:600,background:s.bg,color:s.col,border:`1px solid ${s.bd}`}}>
              <span style={{fontSize:14,filter:e.etat==='absent'?'grayscale(1)':'none',opacity:e.etat==='absent'?0.6:1}}>{e.icon}</span>
              {e.label}
              {e.etat==='relation'&&<span style={{fontSize:9,background:'#dbeafe',padding:'1px 5px',borderRadius:8}}>via relation</span>}
              <i className={`ti ${s.ic}`} style={{fontSize:13}}/>
            </div>
          )
        })}
      </div>
      {manquants.length>0&&(
        <div style={{fontSize:11,color:'#92400e',marginTop:9,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:7,padding:'7px 11px'}}>
          <strong>{manquants.length} couverture{manquants.length>1?'s':''} à proposer :</strong> {manquants.map(m=>m.label).join(', ')}
        </div>
      )}
    </div>
  )
}

// ══ Objets de risque (table risques liée par police de contrat) ══
function Risques({ contrats, loadContrats }) {
  const [risques,setRisques]=useState([]); const [load,setLoad]=useState(true); const [showInactifs,setShowInactifs]=useState(false)
  // Icône par type de risque Brio
  const RICON = u => {
    const t=(u||'').toUpperCase()
    if(t.includes('VÉHIC')||t.includes('VEHIC')||t.includes('AUTO')) return '🚗'
    if(t.includes('BÂTIMENT')||t.includes('BATIMENT')||t.includes('HABITATION')||t.includes('IMMEUBLE')) return '🏠'
    if(t.includes('PERSONNE')||t.includes('VIE')) return '💙'
    if(t.includes('RESPONSAB')) return '⚖️'
    if(t.includes('NAVIGATION')||t.includes('BATEAU')) return '⛵'
    return '🛡️'
  }
  useEffect(()=>{
    if(loadContrats) return
    const polices=[...new Set(contrats.map(c=>c.police).filter(Boolean))]
    if(!polices.length){ setRisques([]); setLoad(false); return }
    setLoad(true)
    // batch par 100 polices pour éviter URL trop longue
    const fetchAll=async()=>{
      const out=[]
      for(let i=0;i<polices.length;i+=100){
        const chunk=polices.slice(i,i+100)
        const{data}=await supabase.from('risques')
          .select('police,type_risque_libelle,description,actif,total_contrats_en_cours,gestionnaire')
          .in('police',chunk)
        if(data) out.push(...data)
      }
      setRisques(out); setLoad(false)
    }
    fetchAll()
  },[contrats,loadContrats])

  if(loadContrats||load) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  const aContratsActifs=contrats.some(c=>c.situation==='En cours')
  if(!risques.length&&!aContratsActifs) return <p style={{color:'#94a3b8',fontSize:12}}>Aucun objet de risque trouvé pour ce client</p>

  // Séparer actifs / inactifs
  const actifs=risques.filter(r=>r.actif)
  const inactifs=risques.filter(r=>!r.actif)
  const visibles=showInactifs?risques:actifs

  // Grouper par type (actifs uniquement pour les badges résumé)
  const parType={}
  actifs.forEach(r=>{ const k=r.type_risque_libelle||'Autre'; if(!parType[k])parType[k]=[]; parType[k].push(r) })

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* Badges résumé par type (actifs) */}
      {Object.keys(parType).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        {Object.entries(parType).map(([type,arr],i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:'#faf5ff',borderRadius:9,padding:'9px 14px',border:'1px solid #e9d5ff'}}>
            <span style={{fontSize:22}}>{RICON(type)}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{type}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{arr.length} objet{arr.length>1?'s':''}</div>
            </div>
          </div>
        ))}
      </div>}

      {/* Bouton aperçu des inactifs */}
      {inactifs.length>0&&(
        <button onClick={()=>setShowInactifs(s=>!s)} style={{alignSelf:'flex-start',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,
          color:showInactifs?'#dc2626':'#64748b',background:showInactifs?'#fef2f2':'#f8fafc',border:`1px solid ${showInactifs?'#fecaca':'#e2e8f0'}`,borderRadius:7,padding:'5px 12px',cursor:'pointer'}}>
          <i className={`ti ${showInactifs?'ti-eye-off':'ti-eye'}`}/>{showInactifs?`Masquer les ${inactifs.length} inactif${inactifs.length>1?'s':''}`:`Aperçu des ${inactifs.length} risque${inactifs.length>1?'s':''} inactif${inactifs.length>1?'s':''}`}
        </button>
      )}

      {/* Détail */}
      {visibles.length>0&&<div style={{overflowX:'auto',maxHeight:240,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
            <tr>{['Police','Type','Description','Contrats','Statut'].map(h=>(
              <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {visibles.map((r,i)=>(
              <tr key={i} style={{background:r.actif?(i%2===0?'#fff':'#fafafe'):'#fef2f2'}}>
                <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,fontWeight:600,color:NAVY}}>{r.police}</td>
                <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#1e293b'}}>{RICON(r.type_risque_libelle)} {r.type_risque_libelle||'—'}</td>
                <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{r.description||'—'}</td>
                <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',textAlign:'center',color:'#64748b'}}>{r.total_contrats_en_cours||0}</td>
                <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9'}}>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:r.actif?'#dcfce7':'#fee2e2',color:r.actif?'#16a34a':'#dc2626'}}>{r.actif?'Actif':'Inactif'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}

// ══ Relations (familiales ET sociétés) — lecture BIDIRECTIONNELLE ══
function Relations({ client, onOpenDossier }) {
  const [rels,setRels]=useState([]); const [load,setLoad]=useState(true)
  // Icône/couleur par type de relation Brio
  const relCfg = lib => {
    const t=(lib||'').toLowerCase()
    if(t.includes('conjoint')||t.includes('époux')||t.includes('epoux')||t.includes('marié')) return {icon:'💍',col:'#ec4899',bg:'#fdf2f8'}
    if(t.includes('cohabitant')||t.includes('concubin')) return {icon:'🏡',col:'#0d9488',bg:'#f0fdfa'}
    if(t.includes('enfant')||t.includes('fils')||t.includes('fille')) return {icon:'👶',col:'#7c3aed',bg:'#f5f3ff'}
    if(t.includes('parent')||t.includes('père')||t.includes('mère')||t.includes('pere')||t.includes('mere')||t.includes('grand-parent')) return {icon:'👨‍👩‍👧',col:'#0d9488',bg:'#f0fdfa'}
    if(t.includes('frère')||t.includes('soeur')||t.includes('sœur')||t.includes('frere')) return {icon:'👫',col:'#2563eb',bg:'#eff6ff'}
    if(t.includes('cousin')||t.includes('oncle')||t.includes('tante')||t.includes('neveu')||t.includes('nièce')||t.includes('beau')||t.includes('belle')) return {icon:'🧑‍🤝‍🧑',col:'#2563eb',bg:'#eff6ff'}
    if(t.includes('gérant')||t.includes('gerant')||t.includes('administrateur')||t.includes('coopérateur')||t.includes('bénéficiaire effectif')) return {icon:'👔',col:'#b45309',bg:'#fffbeb'}
    if(t.includes('firme')||t.includes('société')||t.includes('societe')||t.includes('entreprise')||t.includes('morale')||t.includes('organisation')) return {icon:'🏢',col:'#475569',bg:'#f8fafc'}
    if(t.includes('employeur')||t.includes('salarié')||t.includes('salarie')||t.includes('membre')||t.includes('représentant')||t.includes('representant')) return {icon:'💼',col:'#475569',bg:'#f8fafc'}
    return {icon:'🔗',col:'#64748b',bg:'#f1f5f9'}
  }
  const SEL='dossier,nom_principal,prenom_principal,type_relation_libelle,relation_active,physique_morale_libelle,nom_lie,prenom_lie,cp_lie,localite_lie'

  // Rôle réel de l'AUTRE personne vis-à-vis du client (Brio : « le principal est le [type] du lié »)
  const roleAutre = (type, sens) => {
    const t=(type||'').toLowerCase()
    const estParent = t.includes('parent')||t.includes('père')||t.includes('pere')||t.includes('mère')||t.includes('mere')||t.includes('grand-parent')
    const estEnfant = t.includes('enfant')||t.includes('fils')||t.includes('fille')
    if(estParent||estEnfant){
      // directe = le client est [type] de l'autre → on inverse pour décrire l'autre
      if(sens==='directe') return estParent?'Enfant':'Parent'
      return type // inverse = l'autre est [type] du client
    }
    return type // symétrique (conjoint…) ou société (gérant…) : libellé tel quel
  }

  useEffect(()=>{
    if(!client?.dossier){ setLoad(false); return }
    setLoad(true)
    const NOM=(client.nom||'').toUpperCase().trim()
    const PRENOM=(client.prenom||'').trim()
    Promise.all([
      // (A) directes : le client est la personne PRINCIPALE
      supabase.from('famille').select(SEL).eq('dossier',client.dossier),
      // (B) inverses : le client est la personne LIÉE
      supabase.from('famille').select(SEL).ilike('nom_lie',NOM).ilike('prenom_lie',PRENOM),
    ]).then(async([{data:dir},{data:inv}])=>{
      const list=[]
      ;(dir||[]).forEach(r=>list.push({
        type:r.type_relation_libelle, active:r.relation_active, sens:'directe',
        autreNom:r.nom_lie, autrePrenom:r.prenom_lie, autreDossier:null,
        cp:r.cp_lie, localite:r.localite_lie, morale:(r.physique_morale_libelle||'').toLowerCase().includes('morale'),
      }))
      ;(inv||[]).forEach(r=>list.push({
        type:r.type_relation_libelle, active:r.relation_active, sens:'inverse',
        autreNom:r.nom_principal, autrePrenom:r.prenom_principal, autreDossier:r.dossier,
        cp:r.cp_lie, localite:r.localite_lie, morale:!r.prenom_principal,
      }))
      // Résoudre les dossiers manquants (relations directes) via la table clients
      const aResoudre=[...new Set(list.filter(x=>!x.autreDossier&&x.autreNom).map(x=>x.autreNom.toUpperCase()))]
      if(aResoudre.length){
        const{data:cl}=await supabase.from('clients').select('dossier,nom,prenom').in('nom',aResoudre).not('dossier','is',null)
        const idx={}
        ;(cl||[]).forEach(c=>{ const k=`${(c.nom||'').toUpperCase()}|${(c.prenom||'').toUpperCase()}`; if(!idx[k]) idx[k]=c.dossier })
        list.forEach(x=>{ if(!x.autreDossier){ const k=`${(x.autreNom||'').toUpperCase()}|${(x.autrePrenom||'').toUpperCase()}`; if(idx[k]) x.autreDossier=idx[k] } })
      }
      // Dédoublonner par (autre personne + type) ; garder la version cliquable
      const map={}
      list.forEach(x=>{
        const k=`${(x.autreNom||'').toUpperCase()}|${(x.autrePrenom||'').toUpperCase()}|${(x.type||'').toLowerCase()}`
        if(!map[k]||(!map[k].autreDossier&&x.autreDossier)) map[k]=x
      })
      // Ne pas s'auto-référencer
      const self=`${NOM}|${PRENOM.toUpperCase()}`
      const out=Object.values(map).filter(x=>`${(x.autreNom||'').toUpperCase()}|${(x.autrePrenom||'').toUpperCase()}`!==self)
      // Trier : actives d'abord, puis sociétés en bas
      out.sort((a,b)=>(b.active-a.active)||(a.morale-b.morale))
      setRels(out); setLoad(false)
    })
  },[client?.dossier])

  if(load) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  if(!rels.length) return <div style={{color:'#94a3b8',fontSize:12,fontStyle:'italic'}}>Aucune relation enregistrée pour ce dossier.</div>
  return(
    <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
      {rels.map((r,i)=>{
        const cfg=relCfg(r.type)
        const clickable=!!r.autreDossier
        const nomAffiche=r.morale?(r.autreNom||'Société'):`${r.autreNom||''} ${r.autrePrenom||''}`.trim()
        const role=roleAutre(r.type, r.sens)
        // Phrase directionnelle (lève l'ambiguïté Parent/Enfant)
        const prenomClient=(client.prenom||client.nom||'ce client').split(' ')[0]
        const tlow=(r.type||'').toLowerCase()
        const asym=tlow.includes('parent')||tlow.includes('enfant')||tlow.includes('père')||tlow.includes('mère')||tlow.includes('fils')||tlow.includes('fille')
        const direction = asym ? (`${role} de ${prenomClient}`) : null
        return(
          <div key={i} onClick={()=>clickable&&onOpenDossier(r.autreDossier)}
            title={clickable?'Ouvrir la fiche':''}
            style={{background:cfg.bg,border:`1px solid ${cfg.col}30`,borderRadius:10,padding:'10px 14px',cursor:clickable?'pointer':'default',minWidth:185,transition:'box-shadow 0.15s,transform 0.1s'}}
            onMouseEnter={e=>{if(clickable){e.currentTarget.style.boxShadow=`0 4px 12px ${cfg.col}30`;e.currentTarget.style.transform='translateY(-1px)'}}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform=''}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
              <span style={{fontSize:18}}>{cfg.icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:cfg.col,textTransform:'uppercase',letterSpacing:'.03em',lineHeight:1.2}}>{role||'Relation'}</span>
              {!r.active&&<span style={{fontSize:9,color:'#dc2626',marginLeft:'auto',fontWeight:600}}>inactive</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>{nomAffiche||'—'}</div>
            {direction&&<div style={{fontSize:10,color:cfg.col,marginTop:1,fontStyle:'italic'}}>{direction}</div>}
            <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{[r.cp,r.localite].filter(Boolean).join(' ')||'—'}</div>
            {clickable
              ? <div style={{fontSize:10,color:cfg.col,marginTop:4,fontWeight:600}}>Voir la fiche →</div>
              : <div style={{fontSize:10,color:'#cbd5e1',marginTop:4}}>Hors portefeuille</div>}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════
// FICHE CLIENT complète
// ══════════════════════

// ── Badge compagnie : logo si disponible, sinon monogramme coloré (nom complet au survol) ──
function Cie({ nom, cies, size=18 }) {
  const [err,setErr]=useState(false)
  if(!nom) return <span style={{color:'#cbd5e1'}}>—</span>
  const r=resolveCie(nom,cies); const pad=Math.round(size*0.3)
  if(r.logoUrl && !err)
    return <img src={r.logoUrl} alt={nom} title={nom} onError={()=>setErr(true)}
      style={{height:size,maxWidth:size*3.4,objectFit:'contain',verticalAlign:'middle',background:'#fff',borderRadius:4,padding:'1px 2px'}}/>
  return <span title={nom} style={{display:'inline-block',fontSize:Math.max(10,Math.round(size*0.6)),fontWeight:800,padding:`1px ${pad}px`,borderRadius:6,background:r.couleur+'22',color:r.couleur,lineHeight:`${size}px`,whiteSpace:'nowrap'}}>{r.court}</span>
}

// ── Clé d'un objet de risque : véhicule = plaque, bâtiment = adresse (dans Description) ──
const _firstSeg = d => (d||'').split(' - ')[0].trim()
const _isVeh = t => /hicul|ehicul|voertuig/i.test(t||'')
const _isBat = t => /timent|contenu|immeuble|gebouw|inhoud/i.test(t||'')
const objetCle = (o) => {
  if(_isVeh(o.type_risque)){ const p=_firstSeg(o.description).replace(/[^a-z0-9]/gi,'').toUpperCase(); return p?('V:'+p):null }
  if(_isBat(o.type_risque)){ const a=_firstSeg(o.description).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''); return a?('B:'+a):null }
  return null
}

// ── Couvertures par objet (cross-dossier) : pour chaque objet du client, TOUS les contrats qui le couvrent ──
function VueContrats({ client, objets, contratsClient, garantiesParPolice, cies, onOpenDossier, loadF, previewContrat, openContrat, leaveContrat }) {
  const [rows,setRows]=useState(null); const [loading,setLoading]=useState(true)
  const [liesFam,setLiesFam]=useState(new Set()); const [relsFam,setRelsFam]=useState([])
  const [manuels,setManuels]=useState([]); const [preneurs,setPreneurs]=useState({})
  const [showTermines,setShowTermines]=useState(false); const [selObj,setSelObj]=useState(null)
  const [editOpen,setEditOpen]=useState(false)
  const [q,setQ]=useState(''); const [qres,setQres]=useState([]); const [qSel,setQSel]=useState(null)
  const [qType,setQType]=useState('Société / gérance'); const [saving,setSaving]=useState(false)
  const NOM=(client.nom||'').toUpperCase().trim(); const PRENOM=(client.prenom||'').trim()

  const resolveNames=async(dossiers)=>{ const need=[...new Set(dossiers.filter(Boolean))]; if(!need.length) return {}
    const{data}=await supabase.from('clients').select('dossier,nom,prenom').in('dossier',need)
    const m={}; (data||[]).forEach(c=>{ m[c.dossier]=`${c.nom||''} ${c.prenom||''}`.trim() }); return m }

  const reloadManuels=async()=>{
    const{data}=await supabase.from('liens_preneurs').select('id,dossier_a,dossier_b,type_lien').or(`dossier_a.eq.${client.dossier},dossier_b.eq.${client.dossier}`)
    const list=(data||[]).map(r=>({id:r.id,autreDossier:r.dossier_a===client.dossier?r.dossier_b:r.dossier_a,type:r.type_lien}))
    const names=await resolveNames(list.map(l=>l.autreDossier))
    setManuels(list); setPreneurs(p=>({...p,...names})) }

  useEffect(()=>{
    let alive=true; setLoading(true); setRows(null); setShowTermines(false); setSelObj(null); setEditOpen(false); setQ(''); setQres([]); setQSel(null)
    const veh=new Set(), bat=new Set()
    ;(objets||[]).forEach(o=>{
      if(_isVeh(o.type_risque)){ const p=_firstSeg(o.description).replace(/[^a-z0-9]/gi,'').toUpperCase(); if(p) veh.add(p) }
      else if(_isBat(o.type_risque)){ const a=_firstSeg(o.description); if(a&&a!=='-') bat.add(a) }
    })
    const cols='dossier,police,compagnie,domaine,type_risque,garantie,description,situation,etat_contrat'
    ;(async()=>{
      const queries=[]
      if(veh.size) queries.push(supabase.from('objets_risque').select(cols).or([...veh].map(p=>`description.ilike.*${p}*`).join(',')))
      ;[...bat].forEach(a=>queries.push(supabase.from('objets_risque').select(cols).ilike('description',`%${a}%`)))
      const res=queries.length?await Promise.all(queries):[]
      const all=[]; res.forEach(({data})=>{(data||[]).forEach(r=>all.push(r))})

      const relsList=[]; const famSet=new Set()
      try{
        const [{data:dir},{data:inv}]=await Promise.all([
          supabase.from('famille').select('nom_lie,prenom_lie,type_relation_libelle,physique_morale_libelle').eq('dossier',client.dossier),
          supabase.from('famille').select('dossier,nom_principal,prenom_principal,type_relation_libelle').ilike('nom_lie',NOM).ilike('prenom_lie',PRENOM),
        ])
        ;(inv||[]).forEach(r=>{ if(r.dossier) famSet.add(r.dossier); relsList.push({nom:r.nom_principal,prenom:r.prenom_principal,type:r.type_relation_libelle,dossier:r.dossier}) })
        const dirRows=(dir||[]).map(r=>({nom:r.nom_lie,prenom:r.prenom_lie,type:r.type_relation_libelle,dossier:null}))
        const nomsDir=[...new Set(dirRows.map(r=>(r.nom||'').toUpperCase()).filter(Boolean))]
        if(nomsDir.length){
          const{data:cl}=await supabase.from('clients').select('dossier,nom,prenom').in('nom',nomsDir).not('dossier','is',null)
          const idx={}; (cl||[]).forEach(c=>{const k=`${(c.nom||'').toUpperCase()}|${(c.prenom||'').toUpperCase()}`; if(!idx[k]) idx[k]=c.dossier})
          dirRows.forEach(r=>{ const k=`${(r.nom||'').toUpperCase()}|${(r.prenom||'').toUpperCase()}`; if(idx[k]){ r.dossier=idx[k]; famSet.add(idx[k]) } })
        }
        dirRows.forEach(r=>relsList.push(r))
      }catch(e){}
      famSet.delete(client.dossier)

      let manuList=[]
      try{
        const{data:lp}=await supabase.from('liens_preneurs').select('id,dossier_a,dossier_b,type_lien').or(`dossier_a.eq.${client.dossier},dossier_b.eq.${client.dossier}`)
        manuList=(lp||[]).map(r=>({id:r.id,autreDossier:r.dossier_a===client.dossier?r.dossier_b:r.dossier_a,type:r.type_lien}))
      }catch(e){}

      const dossiersExt=[...new Set([...all.map(r=>r.dossier).filter(d=>d&&d!==client.dossier),...relsList.map(r=>r.dossier).filter(Boolean),...manuList.map(m=>m.autreDossier).filter(Boolean)])]
      const prMap=await resolveNames(dossiersExt)
      if(!alive) return
      setRows(all); setLiesFam(famSet); setRelsFam(relsList); setManuels(manuList); setPreneurs(prMap); setLoading(false)
    })()
    return ()=>{ alive=false }
  },[objets,client.dossier])

  useEffect(()=>{
    if(!editOpen||q.trim().length<2){ setQres([]); return }
    let alive=true; const t=setTimeout(async()=>{
      const term=q.trim()
      const{data}=await supabase.from('clients').select('dossier,nom,prenom').or(`nom.ilike.%${term}%,prenom.ilike.%${term}%`).not('dossier','is',null).limit(8)
      if(alive) setQres((data||[]).filter(c=>c.dossier!==client.dossier))
    },300)
    return ()=>{ alive=false; clearTimeout(t) }
  },[q,editOpen,client.dossier])

  const ajouterLien=async()=>{ if(!qSel) return; setSaving(true)
    await supabase.from('liens_preneurs').insert({dossier_a:client.dossier,dossier_b:qSel.dossier,type_lien:qType})
    setQ(''); setQres([]); setQSel(null); setSaving(false); await reloadManuels() }
  const supprimerLien=async(id)=>{ await supabase.from('liens_preneurs').delete().eq('id',id); await reloadManuels() }

  const dossiersLies=new Set([...liesFam,...manuels.map(m=>m.autreDossier)])
  const catOf=d=> d===client.dossier?'perso':(dossiersLies.has(d)?'lie':'autre')

  const objMap={}, mapPolObjs={}
  ;[...(objets||[]),...(rows||[])].forEach(o=>{
    const k=objetCle(o); if(!k) return
    const g=objMap[k]||(objMap[k]={key:k,type:o.type_risque,label:o.description||''})
    if((o.description||'').length>(g.label||'').length) g.label=o.description
    ;(mapPolObjs[o.police]=mapPolObjs[o.police]||new Set()).add(k)
  })
  const objsOf=pol=> mapPolObjs[pol]?[...mapPolObjs[pol]]:[]

  const persoList=(contratsClient||[]).map(c=>({police:c.police,compagnie:c.compagnie,domaine:c.domaine,situation:c.situation,enc:c.situation==='En cours',gars:(garantiesParPolice&&garantiesParPolice[c.police])?[...garantiesParPolice[c.police]]:[],objs:objsOf(c.police),dossier:client.dossier,externe:false,cat:'perso',raw:c}))
  const persoPol=new Set(persoList.map(p=>p.police))
  const polMap={}
  ;(rows||[]).forEach(o=>{ if(o.dossier===client.dossier||persoPol.has(o.police)) return
    const p=polMap[o.police]||(polMap[o.police]={police:o.police,compagnie:o.compagnie,dossier:o.dossier,domaine:o.domaine,situation:o.situation,gars:new Set(),objs:new Set()})
    if(o.garantie) p.gars.add(o.garantie); if(o.situation==='En cours') p.situation='En cours'; const k=objetCle(o); if(k) p.objs.add(k)
  })
  const crossList=Object.values(polMap).map(p=>({...p,gars:[...p.gars],objs:[...p.objs],enc:p.situation==='En cours',externe:true,cat:catOf(p.dossier)}))
  const allC=[...persoList,...crossList]

  const objetsList=Object.values(objMap).map(g=>({...g,enc:allC.filter(c=>c.enc&&c.objs.includes(g.key)).length,tot:allC.filter(c=>c.objs.includes(g.key)).length})).sort((a,b)=>(b.enc-a.enc)||(b.tot-a.tot))
  const nbTermines=allC.filter(c=>!c.enc).length
  let visC=allC.filter(c=>showTermines||c.enc); if(selObj) visC=visC.filter(c=>c.objs.includes(selObj))

  const CATS=[
    {key:'perso',label:'Contrats personnels',col:'#7c3aed',bg:'#f5f3ff',bd:'#e9d5ff'},
    {key:'lie',label:'Famille & sociétés',col:'#0d9488',bg:'#f0fdfa',bd:'#99f6e4'},
    {key:'autre',label:'Autres preneurs',col:'#b45309',bg:'#fffbeb',bd:'#fde68a'},
  ]
  const TYPES=['Conjoint','Cohabitant','Enfant','Parent','Frère / Sœur','Société / gérance','Apporteur','Autre']
  const SEC='9.5px'
  const liensAff=[]
  relsFam.forEach(r=>{ const nom=`${r.nom||''} ${r.prenom||''}`.trim(); liensAff.push({nom:nom||('Dossier '+(r.dossier||'?')),type:r.type,dossier:r.dossier,source:'famille'}) })
  manuels.forEach(m=>{ liensAff.push({nom:preneurs[m.autreDossier]||('Dossier '+m.autreDossier),type:m.type,dossier:m.autreDossier,source:'manuel',id:m.id}) })

  if(loadF) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {objetsList.length>0&&(
        <div>
          <div style={{fontSize:SEC,fontWeight:800,letterSpacing:.3,textTransform:'uppercase',color:'#7c3aed',marginBottom:6}}>Objets de risque</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:8}}>
            {objetsList.map((g,i)=>{
              const ic=_isVeh(g.type)?'ti-car':(_isBat(g.type)?'ti-building':'ti-point'); const sel=selObj===g.key
              return (
                <div key={i} onClick={()=>setSelObj(sel?null:g.key)} title="Filtrer les contrats de cet objet"
                  style={{border:'1px solid '+(sel?'#7c3aed':'#e9d5ff'),borderRadius:10,padding:'9px 11px',background:sel?'#f5f3ff':'#fdfcff',cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
                  <i className={`ti ${ic}`} style={{fontSize:18,color:'#7c3aed',flexShrink:0}}/>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:12.5,fontWeight:800,color:'#1e293b',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{_firstSeg(g.label)||'—'}</div>
                    <div style={{fontSize:10,color:'#94a3b8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{(g.label||'').split(' - ').slice(1).join(' · ')||'\u00A0'}</div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:5,background:g.enc?'#dcfce7':'#f1f5f9',color:g.enc?'#15803d':'#94a3b8',flexShrink:0}}>{g.enc}</span>
                </div>
              )
            })}
          </div>
          {selObj&&<button onClick={()=>setSelObj(null)} style={{marginTop:6,fontSize:10.5,fontWeight:700,color:'#7c3aed',background:'none',border:'none',cursor:'pointer',padding:0}}>← Voir tous les contrats</button>}
        </div>
      )}

      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{fontSize:SEC,fontWeight:800,letterSpacing:.3,textTransform:'uppercase',color:'#0d9488'}}>Liens (famille, sociétés…)</span>
          <button onClick={()=>setEditOpen(o=>!o)} style={{fontSize:10.5,fontWeight:700,padding:'3px 9px',borderRadius:6,cursor:'pointer',border:'1px solid #99f6e4',background:editOpen?'#f0fdfa':'#fff',color:'#0d9488'}}><i className="ti ti-edit" style={{marginRight:4}}/>Modifier</button>
        </div>
        {liensAff.length? (
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {liensAff.map((l,i)=>(
              <span key={i} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,padding:'3px 9px',borderRadius:7,background:l.source==='manuel'?'#eff6ff':'#f8fafc',border:'1px solid '+(l.source==='manuel'?'#bfdbfe':'#e2e8f0'),color:'#1e293b'}}>
                {l.dossier&&onOpenDossier? <span onClick={()=>onOpenDossier(l.dossier)} style={{cursor:'pointer',fontWeight:700,textDecoration:'underline'}}>{l.nom}</span> : <span style={{fontWeight:700}}>{l.nom}</span>}
                {l.type&&<span style={{color:'#94a3b8'}}>· {l.type}</span>}
                {l.source==='manuel'&&<i className="ti ti-x" onClick={()=>supprimerLien(l.id)} title="Supprimer ce lien" style={{cursor:'pointer',color:'#ef4444',fontSize:13}}/>}
              </span>
            ))}
          </div>
        ) : <div style={{fontSize:11.5,color:'#94a3b8',fontStyle:'italic'}}>Aucun lien connu pour ce dossier.</div>}
        {editOpen&&(
          <div style={{marginTop:8,padding:'10px 12px',border:'1px dashed #99f6e4',borderRadius:9,background:'#f0fdfa'}}>
            <div style={{fontSize:11,color:'#0f766e',marginBottom:6}}>Ajoutez un lien vers un autre preneur : recherchez-le, choisissez le type, validez. Ses contrats couvrant les mêmes objets remonteront alors en « Famille & sociétés ».</div>
            {qSel? (
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{`${qSel.nom||''} ${qSel.prenom||''}`.trim()} <span style={{color:'#94a3b8',fontWeight:400}}>· {qSel.dossier}</span></span>
                <select value={qType} onChange={e=>setQType(e.target.value)} style={{fontSize:12,padding:'4px 8px',borderRadius:6,border:'1px solid #cbd5e1'}}>{TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
                <button disabled={saving} onClick={ajouterLien} style={{fontSize:11,fontWeight:700,padding:'5px 11px',borderRadius:6,cursor:'pointer',border:'none',background:'#0d9488',color:'#fff'}}>{saving?'…':'Ajouter'}</button>
                <button onClick={()=>{setQSel(null);setQ('')}} style={{fontSize:11,fontWeight:700,padding:'5px 9px',borderRadius:6,cursor:'pointer',border:'1px solid #cbd5e1',background:'#fff',color:'#64748b'}}>Annuler</button>
              </div>
            ):(
              <div>
                <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un preneur (nom, prénom, société)…" style={{width:'100%',boxSizing:'border-box',fontSize:12,padding:'6px 10px',borderRadius:7,border:'1px solid #cbd5e1'}}/>
                {qres.length>0&&(
                  <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:3,maxHeight:180,overflowY:'auto'}}>
                    {qres.map((c,i)=>(
                      <div key={i} onClick={()=>setQSel(c)} style={{fontSize:12,padding:'5px 9px',borderRadius:6,background:'#fff',border:'1px solid #e2e8f0',cursor:'pointer',display:'flex',gap:8,alignItems:'center'}}>
                        <span style={{fontWeight:700,color:'#1e293b'}}>{`${c.nom||''} ${c.prenom||''}`.trim()}</span>
                        <span style={{color:'#94a3b8',fontFamily:'monospace',fontSize:11}}>{c.dossier}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.trim().length>=2&&!qres.length&&<div style={{fontSize:11,color:'#94a3b8',marginTop:5}}>Aucun résultat.</div>}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
          <span style={{fontSize:SEC,fontWeight:800,letterSpacing:.3,textTransform:'uppercase',color:'#7c3aed'}}>Contrats{selObj?` · ${_firstSeg((objMap[selObj]||{}).label||'')}`:''}</span>
          {loading&&<span style={{fontSize:10,color:'#cbd5e1'}}>recherche des couvertures liées…</span>}
          {nbTermines>0&&<button onClick={()=>setShowTermines(s=>!s)} style={{marginLeft:'auto',fontSize:11,fontWeight:700,padding:'4px 10px',borderRadius:7,cursor:'pointer',border:'1px solid '+(showTermines?'#cbd5e1':'#e2e8f0'),background:showTermines?'#f1f5f9':'#fff',color:'#475569',whiteSpace:'nowrap'}}><i className={`ti ${showTermines?'ti-eye-off':'ti-eye'}`} style={{marginRight:5}}/>{showTermines?'Masquer les terminés':`Afficher les ${nbTermines} terminé${nbTermines>1?'s':''}`}</button>}
        </div>
        {CATS.map(cat=>{
          const cs=visC.filter(c=>c.cat===cat.key); if(!cs.length) return null
          return (
            <div key={cat.key} style={{marginBottom:9}}>
              <div style={{display:'flex',alignItems:'center',gap:6,margin:'2px 0 5px'}}>
                <span style={{fontSize:SEC,fontWeight:800,letterSpacing:.3,textTransform:'uppercase',padding:'2px 7px',borderRadius:5,background:cat.bg,color:cat.col,border:`1px solid ${cat.bd}`}}>{cat.label}</span>
                <span style={{fontSize:10,color:'#cbd5e1'}}>{cs.length}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {cs.sort((a,b)=>(b.enc?1:0)-(a.enc?1:0)).map((c,j)=>{
                  const enc=c.enc; const pren=c.externe?(preneurs[c.dossier]||`Dossier ${c.dossier}`):null
                  return (
                    <div key={j} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'6px 8px',borderRadius:7,background:enc?'#fff':'#fafafa',border:'1px solid #f1f5f9',opacity:enc?1:.6}}>
                      <Cie nom={c.compagnie} cies={cies} size={18}/>
                      {c.externe
                        ? <span onClick={()=>onOpenDossier&&onOpenDossier(c.dossier)} title={`Ouvrir le dossier ${c.dossier}`} style={{fontFamily:'monospace',fontSize:11,color:'#64748b',cursor:'pointer',textDecoration:'underline'}}>n° {c.police}</span>
                        : (c.raw&&previewContrat
                            ? <span onMouseEnter={()=>previewContrat(c.raw)} onMouseLeave={leaveContrat} onClick={()=>openContrat&&openContrat(c.raw)} title="Survoler pour aperçu · cliquer pour épingler" style={{fontFamily:'monospace',fontSize:11,color:BLUE,fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>n° {c.police}</span>
                            : <span style={{fontFamily:'monospace',fontSize:11,color:'#64748b'}}>n° {c.police||'—'}</span>)}
                      {c.externe&&<span onClick={()=>onOpenDossier&&onOpenDossier(c.dossier)} title={`Ouvrir le dossier ${c.dossier}`} style={{fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:5,background:cat.bg,color:cat.col,cursor:'pointer'}}>{pren} · {c.dossier}</span>}
                      {c.domaine&&<span style={{fontSize:10,color:'#64748b'}}>{c.domaine}</span>}
                      {!selObj&&c.objs.length>0&&<span style={{display:'flex',flexWrap:'wrap',gap:3}}>{c.objs.map((k,z)=><span key={z} style={{fontSize:9.5,fontWeight:700,padding:'1px 5px',borderRadius:4,background:'#eef2ff',color:'#4338ca',whiteSpace:'nowrap'}}>{_firstSeg((objMap[k]||{}).label||k)}</span>)}</span>}
                      <span style={{display:'flex',flexWrap:'wrap',gap:3,flex:1,minWidth:0}}>{c.gars.map((gr,k)=><span key={k} style={{fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:4,background:'#f5f3ff',color:'#7c3aed',whiteSpace:'nowrap'}}>{gr}</span>)}</span>
                      <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:enc?'#dcfce7':'#f1f5f9',color:enc?'#15803d':'#94a3b8'}}>{c.situation||'—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {!visC.length&&<div style={{fontSize:11.5,color:'#94a3b8',fontStyle:'italic'}}>Aucun contrat {showTermines?'':'en cours '}{selObj?'pour cet objet':''}.</div>}
      </div>
    </div>
  )
}

function ObjetsDetail({ objets, loading, cies }) {
  if(loading) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  if(!objets.length) return <div style={{color:'#94a3b8',fontSize:12,fontStyle:'italic'}}>Aucun objet de risque détaillé pour ce dossier.</div>
  // regrouper par police
  const parPolice={}
  objets.forEach(o=>{ const gp=(parPolice[o.police]=parPolice[o.police]||{police:o.police,type:o.type_risque,compagnie:o.compagnie,domaine:o.domaine,descrs:new Set(),gars:[]}); gp.gars.push({g:o.garantie,s:o.situation}); if(o.description) gp.descrs.add(o.description) })
  const groupes=Object.values(parPolice).sort((a,b)=>{
    const ac=a.gars.some(x=>x.s==='En cours'), bc=b.gars.some(x=>x.s==='En cours'); return (bc-ac)
  })
  return(
    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:10}}>
      {groupes.map((p,i)=>{
        const actif=p.gars.some(x=>x.s==='En cours')
        return(
          <div key={i} style={{border:'1px solid #ede9fe',borderRadius:9,padding:'10px 12px',background:actif?'#fbfaff':'#fafafa',opacity:actif?1:.7}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
              <span style={{fontSize:13,fontWeight:800,color:'#6d28d9'}}>{p.type||'Objet de risque'}</span>
              <span style={{fontSize:11,color:'#94a3b8'}}>n° {p.police}</span>
              {p.compagnie&&<Cie nom={p.compagnie} cies={cies} size={16}/>}
              {p.domaine&&<span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:5,background:'#f5f3ff',color:'#7c3aed'}}>{p.domaine}</span>}
            </div>
            {p.descrs&&p.descrs.size>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:8}}>
                {[...p.descrs].map((d,k)=>{
                  const tl=(p.type||'').toLowerCase()
                  const ic=tl.includes('hicule')?'ti-car':(tl.includes('timent')||tl.includes('immeuble')?'ti-building':(tl.includes('individu')||tl.includes('personne')?'ti-user':'ti-point'))
                  return <div key={k} style={{fontSize:12.5,fontWeight:700,color:'#334155',display:'flex',alignItems:'center',gap:6}}><i className={`ti ${ic}`} style={{fontSize:14,color:'#7c3aed'}}/>{d}</div>
                })}
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {p.gars.map((x,j)=>{
                const enc=x.s==='En cours'
                return <span key={j} title={x.s} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:6,background:enc?'#dcfce7':'#f1f5f9',color:enc?'#15803d':'#94a3b8',border:`1px solid ${enc?'#86efac':'#e2e8f0'}`}}>{x.g||'—'}</span>
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Normalisation d'adresse (pour comparer "même adresse de résidence") ──
const normAdr = (...parts) => parts.map(x => x==null?'':String(x)).join(' ')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'')

// ── Modal détail contrat (garanties, objets couverts, primes/mensualités, sinistres) ──
function ContratModal({ contrat, dossier, objets, onClose, preview, cies }) {
  const [quit,setQuit]=useState([]); const [ld,setLd]=useState(true)
  useEffect(()=>{
    setLd(true)
    supabase.from('quittances').select('prime_totale,periodicite,date_comptable,type_quittance,commission,compagnie,compte_producteur,gestionnaire,etat')
      .eq('dossier',dossier).eq('police',contrat.police).order('date_comptable',{ascending:false})
      .then(({data})=>{ setQuit(data||[]); setLd(false) })
  },[dossier,contrat.police])

  const obj=objets.filter(o=>o.police===contrat.police)
  const parObjet={}
  obj.forEach(o=>{ const k=o.description||o.type_risque||'—'; (parObjet[k]=parObjet[k]||{type:o.type_risque,descr:o.description,gars:new Set()}); if(o.garantie) parObjet[k].gars.add(o.garantie) })
  const objList=Object.values(parObjet)
  const derniere=quit[0]||null
  const qval=f=>{ const r=quit.find(x=>x[f]!=null&&x[f]!=='' ); return r?r[f]:null }
  const SIT={'En cours':{bg:'#dcfce7',col:'#16a34a'},'Résilié':{bg:'#fee2e2',col:'#dc2626'},'Terminé':{bg:'#fee2e2',col:'#dc2626'},'Suspendu':{bg:'#fef3c7',col:'#92400e'}}
  const st=SIT[contrat.situation]||{bg:'#f1f5f9',col:'#64748b'}
  const Bloc=({icon,titre,col,children})=>(
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
        <i className={`ti ${icon}`} style={{fontSize:16,color:col}}/>
        <span style={{fontSize:13,fontWeight:800,color:NAVY}}>{titre}</span>
      </div>
      {children}
    </div>
  )
  const Row=({k,v})=> (v==null||v==='')?null:(
    <div style={{display:'flex',gap:10,fontSize:12.5,padding:'3px 0',borderBottom:'1px solid #f8fafc'}}>
      <span style={{color:'#94a3b8',minWidth:140,flexShrink:0}}>{k}</span>
      <span style={{color:'#1e293b',fontWeight:600,wordBreak:'break-word'}}>{v}</span>
    </div>
  )
  return (
    <div onClick={preview?undefined:onClose} style={{position:'fixed',inset:0,background:preview?'transparent':'rgba(15,23,42,0.55)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'40px 16px',overflowY:'auto',pointerEvents:preview?'none':'auto'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:14,maxWidth:720,width:'100%',boxShadow:preview?'0 24px 70px rgba(15,23,42,0.28)':'0 20px 60px rgba(0,0,0,0.35)',overflow:'hidden',border:preview?`1px solid ${BLUE}55`:'none'}}>
        <div style={{background:`linear-gradient(135deg, ${BLUE} 0%, ${NAVY} 140%)`,padding:'16px 20px',display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.75)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Contrat</div>
            <div style={{fontSize:21,fontWeight:800,color:'#fff',fontFamily:'monospace',lineHeight:1.1}}>{contrat.police||'—'}</div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5,flexWrap:'wrap'}}><Cie nom={contrat.compagnie} cies={cies} size={20}/>{contrat.domaine&&<span style={{fontSize:12.5,color:'rgba(255,255,255,0.9)'}}>· {contrat.domaine}</span>}</div>
          </div>
          {preview
            ? <span style={{alignSelf:'center',background:'rgba(255,255,255,0.18)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'5px 10px',color:'#fff',fontSize:11,fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}><i className="ti ti-pin"/> Cliquer pour épingler</span>
            : <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 11px',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:600,flexShrink:0}}><i className="ti ti-x"/></button>}
        </div>
        <div style={{padding:'18px 20px',maxHeight:'72vh',overflowY:'auto'}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:18}}>
            <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:6,background:st.bg,color:st.col}}>{contrat.situation||'—'}</span>
            {contrat.date_creation&&<span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:6,background:'#f1f5f9',color:'#475569'}}>Depuis {fmtDate(contrat.date_creation)}</span>}
            {contrat.garantie_valeur?<span style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:6,background:'#eff6ff',color:'#1d4ed8'}}>Valeur assurée {fmt(contrat.garantie_valeur)}</span>:null}
          </div>

          <Bloc icon="ti-file-info" titre="Détails du contrat" col={BLUE}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}}>
              <Row k="Police" v={contrat.police}/>
              <Row k="CIE" v={contrat.compagnie?<Cie nom={contrat.compagnie} cies={cies} size={18}/>:null}/>
              <Row k="Domaine" v={contrat.domaine}/>
              <Row k="Type de police" v={contrat.type_production}/>
              <Row k="État" v={contrat.situation}/>
              <Row k="Version" v={contrat.version}/>
              <Row k="Producteur" v={contrat.nom_sa?`${contrat.nom_sa}${contrat.sa_code?` (${contrat.sa_code})`:''}`:null}/>
              <Row k="Date de création" v={contrat.date_creation?fmtDate(contrat.date_creation):null}/>
              <Row k="Valeur assurée" v={contrat.garantie_valeur?fmt(contrat.garantie_valeur):null}/>
              <Row k="Compte producteur" v={qval('compte_producteur')}/>
              <Row k="Gestionnaire" v={qval('gestionnaire')}/>
              <Row k="Périodicité" v={derniere?.periodicite}/>
              <Row k="Dernière quittance" v={derniere?`${fmtMois(derniere.date_comptable)} · ${fmt(derniere.prime_totale)}`:null}/>
              <Row k="État quittance" v={derniere?.etat}/>
            </div>
            <p style={{color:'#cbd5e1',fontSize:10.5,margin:'8px 0 0',fontStyle:'italic'}}>Seuls les champs présents dans la base sont affichés. Le reste de la fiche Brio (dates d'effet/échéance, avenants, fractionnement, documents…) n'est pas encore importé.</p>
          </Bloc>

          <Bloc icon="ti-shield-check" titre="Garanties & objets couverts" col="#7c3aed">
            {!objList.length?<p style={{color:'#94a3b8',fontSize:12,margin:0}}>Aucun objet de risque détaillé pour cette police.</p>:
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {objList.map((o,i)=>{
                  const tl=(o.type||'').toLowerCase()
                  const ic=tl.includes('hicule')?'ti-car':(tl.includes('timent')||tl.includes('immeuble')?'ti-building':(tl.includes('individu')||tl.includes('personne')?'ti-user':'ti-point'))
                  return(
                    <div key={i} style={{border:'1px solid #ede9fe',borderRadius:9,padding:'9px 12px',background:'#fbfaff'}}>
                      <div style={{fontSize:12.5,fontWeight:700,color:'#334155',display:'flex',alignItems:'center',gap:6,marginBottom:6}}><i className={`ti ${ic}`} style={{fontSize:14,color:'#7c3aed'}}/>{o.descr||o.type||'Objet'}</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {[...o.gars].length?[...o.gars].map((g,j)=><span key={j} style={{fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:6,background:'#dcfce7',color:'#15803d',border:'1px solid #86efac'}}>{g}</span>):<span style={{fontSize:11,color:'#94a3b8'}}>—</span>}
                      </div>
                    </div>
                  )
                })}
              </div>}
          </Bloc>

          <Bloc icon="ti-cash" titre="Primes & mensualités" col="#16a34a">
            {ld?<p style={{color:'#94a3b8',fontSize:12,margin:0}}>Chargement…</p>:!quit.length?<p style={{color:'#94a3b8',fontSize:12,margin:0}}>Aucune quittance pour cette police.</p>:
              <div>
                {derniere&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:10}}>
                  <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'8px 14px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Dernière prime</div>
                    <div style={{fontSize:17,fontWeight:800,color:NAVY}}>{fmt(derniere.prime_totale)}</div>
                  </div>
                  {derniere.periodicite&&<div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 14px'}}>
                    <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase'}}>Périodicité</div>
                    <div style={{fontSize:15,fontWeight:800,color:'#1d4ed8'}}>{derniere.periodicite}</div>
                  </div>}
                </div>}
                <div style={{maxHeight:180,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead style={{position:'sticky',top:0,background:'#f8fafc'}}><tr>{['Période','Prime','Périodicité','Type'].map(h=><th key={h} style={{padding:'6px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>)}</tr></thead>
                    <tbody>
                      {quit.map((r,i)=>(
                        <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
                          <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b',whiteSpace:'nowrap'}}>{fmtMois(r.date_comptable)}</td>
                          <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',fontWeight:600,color:NAVY}}>{fmt(r.prime_totale)}</td>
                          <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{r.periodicite||'—'}</td>
                          <td style={{padding:'6px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{r.type_quittance||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>}
          </Bloc>

          <Bloc icon="ti-alert-triangle" titre="Sinistres" col="#dc2626">
            <p style={{color:'#94a3b8',fontSize:12,margin:0,fontStyle:'italic'}}>Les sinistres ne sont pas rattachés au n° de police dans les données actuelles (identifiant interne Brio distinct). À raccorder via un mapping dédié.</p>
          </Bloc>
        </div>
      </div>
    </div>
  )
}

// ── Foyer : personnes enregistrées à la MÊME adresse + leurs contrats ──
// (couvertures POSSIBLES du foyer — la donnée « personne couverte » n'existe pas dans la source,
//  donc jamais présenté comme une certitude)
function Foyer({ client, onOpenDossier }) {
  const [membres,setMembres]=useState([]); const [ld,setLd]=useState(true)
  useEffect(()=>{
    if(!client?.dossier){ setMembres([]); setLd(false); return }
    const cle=normAdr(client.rue,client.num_maison,client.boite,client.cp,client.localite)
    if(!cle || (!client.cp && !client.num_maison)){ setMembres([]); setLd(false); return }
    setLd(true)
    ;(async()=>{
      let q=supabase.from('clients').select('dossier,nom,prenom,rue,num_maison,boite,cp,localite').not('dossier','is',null)
      if(client.cp) q=q.eq('cp',client.cp)
      if(client.num_maison) q=q.eq('num_maison',client.num_maison)
      const {data:cl}=await q
      let memb=(cl||[]).filter(c=>c.dossier&&c.dossier!==client.dossier && (c.prenom&&c.prenom.trim()) && normAdr(c.rue,c.num_maison,c.boite,c.cp,c.localite)===cle)
      let liens={}
      try{
        const {data:fam}=await supabase.from('famille').select('nom_lie,prenom_lie,type_relation_libelle').eq('dossier',client.dossier)
        ;(fam||[]).forEach(r=>{ const k=`${(r.nom_lie||'').toUpperCase()}|${(r.prenom_lie||'').toUpperCase()}`; if(r.type_relation_libelle) liens[k]=r.type_relation_libelle })
      }catch(e){}
      memb=memb.map(c=>({...c,lien:liens[`${(c.nom||'').toUpperCase()}|${(c.prenom||'').toUpperCase()}`]||null}))
      if(!memb.length){ setMembres([]); setLd(false); return }
      const {data:ctr}=await supabase.from('contrats').select('dossier,police,compagnie,domaine,situation').in('dossier',memb.map(c=>c.dossier))
      const parDoss={}
      ;(ctr||[]).forEach(c=>{ const k=c.police||JSON.stringify(c); const g=(parDoss[c.dossier]=parDoss[c.dossier]||{seen:new Set(),list:[]}); if(!g.seen.has(k)){ g.seen.add(k); g.list.push(c) } })
      setMembres(memb.map(c=>({...c,contrats:(parDoss[c.dossier]&&parDoss[c.dossier].list)||[]}))); setLd(false)
    })()
  },[client?.dossier])

  if(ld) return <p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>
  if(!membres.length) return <div style={{color:'#94a3b8',fontSize:12,fontStyle:'italic'}}>Aucune autre personne enregistrée à cette adresse.</div>
  const SIT={'En cours':{bg:'#dcfce7',col:'#16a34a'},'Résilié':{bg:'#fee2e2',col:'#dc2626'},'Terminé':{bg:'#fee2e2',col:'#dc2626'},'Suspendu':{bg:'#fef3c7',col:'#92400e'}}
  const adr=[client.rue,client.num_maison,client.boite&&('bte '+client.boite)].filter(Boolean).join(' ')
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>Personnes physiques à la même adresse — boîte comprise — sociétés domiciliées exclues ({adr||'—'}). Leurs garanties « famille / vie privée » peuvent couvrir tout le foyer, mais l'adresse ne prouve pas le foyer : à confirmer.</div>
      {membres.map((g,i)=>(
        <div key={i} style={{border:'1px solid #e2e8f0',borderRadius:10,padding:'10px 13px'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:g.contrats.length?7:0}}>
            <div style={{fontSize:13,fontWeight:800,color:NAVY}}>{[g.prenom,g.nom].filter(Boolean).join(' ')||'—'}
              {g.lien ? <span style={{fontSize:11,fontWeight:700,color:'#0891b2',marginLeft:6}}>· {g.lien}</span> : <span style={{fontSize:10,fontWeight:700,color:'#94a3b8',background:'#f1f5f9',borderRadius:4,padding:'1px 6px',marginLeft:6}}>même adresse</span>}
              <span style={{fontSize:11,fontWeight:600,color:'#94a3b8',marginLeft:6}}>#{g.dossier} · {g.contrats.length} contrat(s)</span>
            </div>
            {onOpenDossier&&<button onClick={()=>onOpenDossier(g.dossier)} style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:BLUE,background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:6,padding:'3px 9px',cursor:'pointer'}}>Ouvrir</button>}
          </div>
          {g.contrats.length>0&&<div style={{display:'flex',flexDirection:'column',gap:5}}>
            {g.contrats.map((c,j)=>{
              const st=SIT[c.situation]||{bg:'#f1f5f9',col:'#64748b'}
              return(
                <div key={j} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                  <span style={{fontFamily:'monospace',fontWeight:600,color:NAVY,minWidth:82}}>{c.police||'—'}</span>
                  <span style={{color:'#1e293b',flex:1,minWidth:0}}>{[c.compagnie,c.domaine].filter(Boolean).join(' · ')||'—'}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:st.bg,color:st.col,whiteSpace:'nowrap'}}>{c.situation||'—'}</span>
                </div>
              )
            })}
          </div>}
        </div>
      ))}
    </div>
  )
}

function Fiche({ client, onClose, onOpenDossier }) {
  const [contrats,setContrats]=useState([]); const [taches,setTaches]=useState([]); const [rdvs,setRdvs]=useState([]); const [groupe,setGroupe]=useState([]); const [objets,setObjets]=useState([]); const [appels,setAppels]=useState([]); const [loadF,setLoadF]=useState(true)
  const [sinistres,setSinistres]=useState([])
  const [dPlus,setDPlus]=useState(null)
  const { perms, isAdmin }=useAuth()
  const canAppel = isAdmin || !!perms?.dyn_appels
  const [commercial,setCommercial]=useState('')
  const [bureauClient,setBureauClient]=useState('')
  const [cies,setCies]=useState([])
  const ref=useRef(null)
  useEffect(()=>{ getCompagnies().then(setCies) },[])

  useEffect(()=>{
    ref.current?.scrollIntoView({behavior:'smooth',block:'start'})
    setLoadF(true)
    Promise.all([
      supabase.from('contrats').select('police,compagnie,nom_client,situation,date_creation,domaine,type_production,garantie_valeur,version,nom_sa,sa_code').eq('dossier',client.dossier).order('date_creation',{ascending:false}),
      supabase.from('taches').select('*').eq('dossier_client',client.dossier).order('echeance',{ascending:true}).limit(20),
      client.id
        ? supabase.from('rdv').select('id,objet,debut,categorie,user_email,web_link,journee_entiere,lieu').eq('client_id',client.id).order('debut',{ascending:false})
        : Promise.resolve({data:[]}),
      supabase.from('parentes').select('groupe_nom,groupe_type,membre_nom,nb_polices,prime_totale').eq('dossier_principal',client.dossier),
      supabase.from('objets_risque').select('police,type_risque,garantie,situation,compagnie,domaine,description,date_effet').eq('dossier',client.dossier),
      (()=>{ const nums=[client.gsm_e164,client.telfixe_e164].filter(Boolean); return (canAppel&&nums.length) ? supabase.from('appels').select('id,direction,numero_externe,numero_e164,agent,duree,debut,nom_3cx').in('numero_e164',nums).order('debut',{ascending:false}).limit(50) : Promise.resolve({data:[]}) })(),
      client.nom ? supabase.from('sinistres').select('reference_sinistre,garantie,domaine,etat,etat_code,responsabilite,date_ouverture,date_etat,sinistre_nom').ilike('sinistre_nom','%'+client.nom+'%').limit(200) : Promise.resolve({data:[]}),
    ]).then(([{data:c},{data:t},{data:rv},{data:gr},{data:ob},{data:ap},{data:si}])=>{
      // Dédoublonnage par police (les imports créent des lignes identiques) — on garde la plus récente
      const seen=new Set(); const uniq=[]
      ;(c||[]).forEach(r=>{ const k=r.police||JSON.stringify(r); if(!seen.has(k)){ seen.add(k); uniq.push(r) } })
      const pren=(client.prenom||'').trim().toLowerCase()
      const sinF=(si||[]).filter(x=>!pren||String(x.sinistre_nom||'').toLowerCase().includes(pren)).sort((a,b)=>String(b.date_ouverture||'').localeCompare(String(a.date_ouverture||'')))
      const polices=[...new Set((c||[]).map(r=>r.police).filter(Boolean))]
      if(polices.length){
        supabase.from('mouvements_production').select('delegue_contrat').in('police',polices).then(({data:mv})=>{
          const cnt={}; (mv||[]).forEach(m=>{ const d=(m.delegue_contrat||'').trim(); if(d) cnt[d]=(cnt[d]||0)+1 })
          const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]; setCommercial(best?best[0]:'')
        })
      } else setCommercial('')
      setContrats(uniq); setTaches(t||[]); setRdvs(rv||[]); setGroupe(gr||[]); setObjets(ob||[]); setAppels(ap||[]); setSinistres(sinF); setLoadF(false)
    })
  },[client.dossier,client.id,canAppel])

  // Bureau (agence) du client = bureau du gestionnaire du dossier
  useEffect(()=>{
    setBureauClient('')
    const gc=client.gestionnaire_code
    if(!gc) return
    supabase.from('collaborateurs').select('bureau_id').eq('code',gc).limit(1).then(({data})=>{
      const bid=data?.[0]?.bureau_id
      if(bid) supabase.from('ref_bureaux').select('libelle').eq('id',bid).limit(1).then(({data:bb})=>setBureauClient(bb?.[0]?.libelle||('Bureau '+bid)))
    })
  },[client.dossier,client.gestionnaire_code])

  useEffect(()=>{
    if(!client?.dossier){ setDPlus(null); return }
    supabase.from('client_donnees_plus').select('*').eq('dossier',client.dossier).maybeSingle().then(({data})=>setDPlus(data||null))
  },[client.dossier])

  const initiales=`${(client.prenom||'?')[0]||''}${(client.nom||'?')[0]||''}`.toUpperCase()
  const actifs=contrats.filter(c=>c.situation==='En cours').length
  const adresse=[client.rue,client.num_maison,client.boite].filter(Boolean).join(' ')
  const adresseComplete=[adresse,[client.cp,client.localite].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const mapsUrl=adresseComplete?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`:null
  const wazeUrl=adresseComplete?`https://waze.com/ul?q=${encodeURIComponent(adresseComplete)}`:null
  const age=calcAge(client.date_naissance)
  const gsm=cleanTel(client.gsm); const fixe=cleanTel(client.tel_fixe)

  // RDV : dernier contact (passé) + prochain (à venir)
  const nowTs=Date.now()
  const rdvPasses=rdvs.filter(r=>tsRdv(r.debut)<=nowTs)          // déjà triés desc
  const rdvFuturs=rdvs.filter(r=>tsRdv(r.debut)>nowTs).sort((a,b)=>tsRdv(a.debut)-tsRdv(b.debut))
  const dernier=rdvPasses[0]||null
  const joursDernier=dernier?Math.floor((nowTs-tsRdv(dernier.debut))/86400000):null
  const prochain=rdvFuturs[0]||null
  // Contacts unifiés = RDV + appels (une seule notion de « contact »)
  const appelTs=a=>{ const t=new Date(a.debut).getTime(); return isNaN(t)?0:t }
  const contactsUnifies=[
    ...rdvs.map(r=>({kind:'rdv',ts:tsRdv(r.debut),data:r})),
    ...appels.map(a=>({kind:'appel',ts:appelTs(a),data:a})),
  ].sort((a,b)=>b.ts-a.ts)
  const dernierContact=contactsUnifies.find(c=>c.ts<=nowTs)||null
  const joursDernierC=dernierContact?Math.floor((nowTs-dernierContact.ts)/86400000):null

  // Risques (dérivés des domaines de contrats actifs)
  const risques={}
  contrats.filter(c=>c.situation==='En cours').forEach(c=>{
    const cfg=getIcon(c.domaine); const k=cfg.label
    if(!risques[k]) risques[k]={...cfg,n:0}
    risques[k].n++
  })
  const SIT={  'En cours':{bg:'#dcfce7',col:'#16a34a'},'Résilié':{bg:'#fee2e2',col:'#dc2626'},'Terminé':{bg:'#fee2e2',col:'#dc2626'},'Suspendu':{bg:'#fef3c7',col:'#92400e'} }

  const [openSec,setOpenSec]=useState('contrats')
  const [pinnedContrat,setPinnedContrat]=useState(null)
  const [hoverContrat,setHoverContrat]=useState(null)
  const hoverTimer=useRef(null); const closeTimer=useRef(null)
  const detail=pinnedContrat||hoverContrat
  const openContrat=c=>{ clearTimeout(hoverTimer.current); clearTimeout(closeTimer.current); setPinnedContrat(c); setHoverContrat(null) }
  const previewContrat=c=>{ clearTimeout(closeTimer.current); if(pinnedContrat) return; clearTimeout(hoverTimer.current); hoverTimer.current=setTimeout(()=>setHoverContrat(c),180) }
  const leaveContrat=()=>{ clearTimeout(hoverTimer.current); if(pinnedContrat) return; closeTimer.current=setTimeout(()=>setHoverContrat(null),160) }
  const closeContrat=()=>{ clearTimeout(hoverTimer.current); clearTimeout(closeTimer.current); setPinnedContrat(null); setHoverContrat(null) }
  const garantiesParPolice={}
  const objetsParPolice={}
  objets.forEach(o=>{ if(o.police){ const gset=(garantiesParPolice[o.police]=garantiesParPolice[o.police]||new Set()); if(o.garantie) gset.add(o.garantie); const oset=(objetsParPolice[o.police]=objetsParPolice[o.police]||new Set()); if(o.description) oset.add(o.description) } })

  const SECTIONS=[
    { key:'contacts', icon:'ti-address-book', title:'Contacts', col:'#0d9488', count:contactsUnifies.length, body:(
      loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!contactsUnifies.length?
        <p style={{color:'#94a3b8',fontSize:12}}>Aucun contact enregistré (ni RDV, ni appel).</p>:(
        <div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
            {dernierContact&&(
              <div style={{flex:'1 1 220px',background:'#f0fdfa',border:'1px solid #99f6e4',borderRadius:10,padding:'12px 16px'}}>
                <div style={{fontSize:10,fontWeight:800,color:'#0d9488',textTransform:'uppercase',letterSpacing:'.05em'}}>Dernier contact</div>
                <div style={{fontSize:20,fontWeight:800,color:NAVY,lineHeight:1.1,marginTop:3}}>{dernierContact.kind==='rdv'?fmtRdv(dernierContact.data.debut):fmtAppel(dernierContact.data.debut)}</div>
                <div style={{fontSize:12,color:'#0d9488',fontWeight:600}}>{ilYa(joursDernierC)}</div>
                <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{dernierContact.kind==='rdv'?(dernierContact.data.objet||'RDV'):`${String(dernierContact.data.direction||'').toLowerCase().startsWith('in')?'Appel entrant':'Appel sortant'}${dernierContact.data.nom_3cx?` · ${dernierContact.data.nom_3cx}`:''}`}</div>
              </div>
            )}
            {prochain&&(
              <div style={{flex:'1 1 220px',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'12px 16px'}}>
                <div style={{fontSize:10,fontWeight:800,color:'#2563eb',textTransform:'uppercase',letterSpacing:'.05em'}}>Prochain RDV</div>
                <div style={{fontSize:20,fontWeight:800,color:NAVY,lineHeight:1.1,marginTop:3}}>{fmtRdv(prochain.debut)}</div>
                <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{prochain.objet}</div>
              </div>
            )}
          </div>
          <div style={{maxHeight:280,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
            {contactsUnifies.map((c,i)=>{
              const last=i===contactsUnifies.length-1
              if(c.kind==='rdv'){
                const r=c.data; const futur=c.ts>nowTs
                return(
                  <div key={'r'+r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:last?'none':'1px solid #f8fafc',background:futur?'#f8fbff':'#fff'}}>
                    <span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:5,background:'#f0fdfa',color:'#0d9488',whiteSpace:'nowrap'}}><i className="ti ti-calendar" style={{marginRight:4}}/>RDV</span>
                    <span style={{fontSize:12,fontWeight:700,color:NAVY,whiteSpace:'nowrap',minWidth:74}}>{fmtRdv(r.debut)}</span>
                    <span style={{flex:1,fontSize:12,color:'#1e293b',minWidth:0}}>
                      {r.web_link?<a href={r.web_link} target="_blank" rel="noreferrer" style={{color:'#1e293b',textDecoration:'none'}}>{r.objet||'—'}</a>:(r.objet||'—')}
                      {r.lieu&&<span style={{fontSize:11,color:'#94a3b8'}}> · {r.lieu}</span>}
                    </span>
                    <span style={{fontSize:10,fontWeight:700,color:'#64748b'}}>{(r.user_email||'').replace('@dynassur.be','')}</span>
                    {futur&&<span style={{fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:4,background:'#dbeafe',color:'#2563eb'}}>À VENIR</span>}
                  </div>
                )
              }
              const a=c.data; const entrant=String(a.direction||'').toLowerCase().startsWith('in')
              return(
                <div key={'a'+a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:last?'none':'1px solid #f8fafc'}}>
                  <span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:5,background:entrant?'#dcfce7':'#dbeafe',color:entrant?'#16a34a':'#1d4ed8',whiteSpace:'nowrap'}}><i className={`ti ${entrant?'ti-phone-incoming':'ti-phone-outgoing'}`} style={{marginRight:4}}/>{entrant?'Entrant':'Sortant'}</span>
                  <span style={{fontSize:12,fontWeight:700,color:NAVY,whiteSpace:'nowrap',minWidth:74}}>{fmtAppel(a.debut)}</span>
                  <span style={{flex:1,fontSize:12,color:'#1e293b',minWidth:0}}>
                    {a.numero_e164||a.numero_externe||'—'}
                    {a.nom_3cx&&<span style={{fontSize:11,color:'#94a3b8'}}> · {a.nom_3cx}</span>}
                  </span>
                  {a.agent&&<span style={{fontSize:10,fontWeight:700,color:'#64748b'}}>poste {a.agent}</span>}
                  <span style={{fontSize:11,color:'#64748b',whiteSpace:'nowrap'}}>{a.duree||''}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    )},
    { key:'relations', icon:'ti-users-group', title:'Relations', col:'#ec4899', count:null, body:(<Relations client={client} onOpenDossier={onOpenDossier}/>) },
    ...(groupe.length>0?[{ key:'groupe', icon:'ti-home-2', title:'Groupe / Ménage', col:'#0d9488', count:groupe.length, body:(
      <div>
        <div style={{fontSize:12,color:'#64748b',marginBottom:8,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <strong style={{color:NAVY}}>{groupe[0].groupe_nom||'Groupe'}</strong>
          {groupe[0].groupe_type&&<span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:5,background:'#f0fdfa',color:'#0d9488',border:'1px solid #99f6e4'}}>{groupe[0].groupe_type}</span>}
          {(groupe[0].nb_polices||groupe[0].prime_totale)?<span style={{color:'#94a3b8'}}>· {Math.round(groupe[0].nb_polices||0)} police(s) · {Math.round(groupe[0].prime_totale||0).toLocaleString('fr-BE')} € de prime</span>:null}
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {groupe.map((m,i)=>(<span key={i} style={{fontSize:12,padding:'5px 10px',borderRadius:7,background:'#f8fafc',border:'1px solid #e2e8f0',color:'#1e293b'}}>{m.membre_nom}</span>))}
        </div>
      </div>
    )}]:[]),
    { key:'objets', icon:'ti-shield', title:'Objets de risque', col:'#7c3aed', count:objets.length, body:(<ObjetsDetail objets={objets} loading={loadF} cies={cies}/>) },
    { key:'sinistres', icon:'ti-alert-triangle', title:'Sinistres', col:'#dc2626', count:sinistres.length, body:(
      loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!sinistres.length?
        <p style={{color:'#16a34a',fontSize:12}}>✓ Aucun sinistre</p>:(
        <div>
          <div style={{fontSize:11,color:'#b45309',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:7,padding:'6px 10px',marginBottom:10,display:'flex',alignItems:'center',gap:6}}><i className="ti ti-info-circle"/>Rapprochement par nom de l'assuré (pas de clé exacte disponible) — vérifiez qu'il s'agit bien de ce client.</div>
          <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{textAlign:'left',color:'#64748b',borderBottom:'1px solid #e2e8f0'}}>
              <th style={{padding:'6px 8px',fontWeight:700,whiteSpace:'nowrap'}}>Réf.</th>
              <th style={{padding:'6px 8px',fontWeight:700}}>Objet / garantie</th>
              <th style={{padding:'6px 8px',fontWeight:700,whiteSpace:'nowrap'}}>Ouverture</th>
              <th style={{padding:'6px 8px',fontWeight:700,whiteSpace:'nowrap'}}>Clôture</th>
              <th style={{padding:'6px 8px',fontWeight:700}}>Responsabilité</th>
              <th style={{padding:'6px 8px',fontWeight:700,whiteSpace:'nowrap'}}>État</th>
            </tr></thead>
            <tbody>
              {sinistres.map((s,i)=>{ const clos=String(s.etat||'').toLowerCase().startsWith('cl')||s.etat_code==='1'; return(
                <tr key={i} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={{padding:'6px 8px',fontWeight:700,color:NAVY,whiteSpace:'nowrap'}}>{s.reference_sinistre||'—'}</td>
                  <td style={{padding:'6px 8px',color:'#1e293b'}}>{s.garantie||'—'}</td>
                  <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}>{fmtDate(s.date_ouverture)}</td>
                  <td style={{padding:'6px 8px',whiteSpace:'nowrap',color:clos?'#1e293b':'#94a3b8'}}>{clos?fmtDate(s.date_etat):'en cours'}</td>
                  <td style={{padding:'6px 8px',color:'#475569'}}>{s.responsabilite||'—'}</td>
                  <td style={{padding:'6px 8px',whiteSpace:'nowrap'}}><span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:5,background:clos?'#f1f5f9':'#fef3c7',color:clos?'#64748b':'#92400e'}}>{s.etat||(clos?'Clôturé':'En cours')}</span></td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
        </div>
      )
    )},
    { key:'contrats', icon:'ti-file-text', title:'Contrats', col:BLUE, count:contrats.length, body:(<div><Analyse360 client={client} contrats={contrats}/><div style={{marginTop:14}}><VueContrats client={client} objets={objets} contratsClient={contrats} garantiesParPolice={garantiesParPolice} cies={cies} onOpenDossier={onOpenDossier} loadF={loadF} previewContrat={previewContrat} openContrat={openContrat} leaveContrat={leaveContrat}/></div></div>) },
    { key:'primes', icon:'ti-cash', title:'Primes & commissions', col:'#16a34a', count:null, body:(<Primes dossier={client.dossier}/>) },
    { key:'taches', icon:'ti-checkbox', title:'Tâches', col:'#f59e0b', count:taches.length, body:(
      loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!taches.length?
        <p style={{color:'#16a34a',fontSize:12}}>✓ Aucune tâche en cours</p>:
        taches.map((t,i)=>{
          const ret=t.echeance&&new Date(t.echeance)<new Date()
          return(
            <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:i<taches.length-1?'1px solid #f8fafc':'none'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:'#1e293b'}}>{t.titre||'—'}</div>
                <div style={{fontSize:11,color:'#94a3b8'}}>{t.gestionnaire}{t.code_type?` · ${t.code_type}`:''}</div>
              </div>
              <span style={{fontSize:11,color:ret?'#dc2626':'#64748b',fontWeight:ret?700:400}}>{fmtDate(t.echeance)}</span>
              <span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:ret?'#fee2e2':'#dbeafe',color:ret?'#dc2626':'#1d4ed8'}}>{t.statut}</span>
            </div>
          )
        })
    )},
  ]
  const active = SECTIONS.find(s=>s.key===openSec) || SECTIONS.find(s=>s.key==='contrats') || SECTIONS[0]
  const coordItems=[
    {icon:'ti-device-mobile',l:'GSM',v:gsm||'—',tel:client.gsm_e164||gsm},
    {icon:'ti-phone',l:'Fixe',v:fixe||'—',tel:client.telfixe_e164||fixe},
    {icon:'ti-mail',l:'Email',v:client.email||'—'},
    {icon:'ti-calendar',l:'Naissance',v:client.date_naissance?`${fmtDateLong(client.date_naissance)}${age?` · ${age.ans} ans`:''}`:'—'},
    {icon:'ti-user',l:'Gestionnaire',v:client.gestionnaire_nom||'—'},
    {icon:'ti-user-star',l:'Sous-agent',v:client.sa_nom||'—'},
    {icon:'ti-briefcase',l:'Commercial',v:commercial||'—'},
    {icon:'ti-building',l:'Bureau',v:bureauClient||'—'},
  ]
  const fmtD = x => x ? String(x).split('-').reverse().join('/') : ''
  const ciExpire = dPlus?.ci_valide_au && new Date(dPlus.ci_valide_au) < new Date(new Date().toDateString())
  const dpItems = dPlus ? [
    dPlus.iban && {icon:'ti-building-bank', l:'Compte bancaire', v:dPlus.iban, sub: dPlus.iban_type==='etranger'?'IBAN étranger':null},
    (dPlus.numero_ci||dPlus.ci_valide_au) && {icon:'ti-id', l:"Carte d'identité", v:dPlus.numero_ci||'—', sub: dPlus.ci_valide_au?`jusqu'au ${fmtD(dPlus.ci_valide_au)}`:null, warn: ciExpire?'expirée':null},
    dPlus.permis_numero && {icon:'ti-car', l:'Permis', v:dPlus.permis_numero},
    dPlus.numero_bce && {icon:'ti-building-store', l:'N° BCE', v:dPlus.numero_bce},
    dPlus.numero_tva && {icon:'ti-receipt-tax', l:'N° TVA', v:dPlus.numero_tva},
  ].filter(Boolean) : []

  return(
    <div ref={ref} style={{background:'#fff',borderRadius:14,border:`2px solid ${BLUE}25`,overflow:'hidden',boxShadow:'0 4px 24px rgba(0,128,189,0.1)'}}>

      <div style={{background:`linear-gradient(135deg, ${ENTITES.dynassur.color} 0%, ${ENTITES.dynassur.colorDark} 140%)`,padding:'14px 20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{width:44,height:44,borderRadius:11,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16,fontWeight:800,color:'#fff'}}>{initiales}</div>
          <div style={{flex:1,minWidth:160}}>
            <h2 style={{fontSize:23,fontWeight:800,color:'#fff',margin:0,lineHeight:1.1}}>{client.prenom} {client.nom}</h2>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',display:'flex',gap:12,flexWrap:'wrap',marginTop:2}}>
              <span>#{client.dossier}</span>
              {client.etat_civil&&<span>{client.etat_civil}</span>}
              {client.sexe&&<span>{client.sexe}</span>}
              {bureauClient&&<span>{bureauClient}</span>}
            </div>
          </div>
          {client.alerte&&(
            <div title={client.alerte} style={{display:'flex',alignItems:'center',gap:6,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'5px 10px',color:'#c2410c',fontSize:12,fontWeight:700,maxWidth:300,flexShrink:0}}>
              <i className="ti ti-alert-triangle" style={{fontSize:15,flexShrink:0}}/>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{client.alerte}</span>
            </div>
          )}
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {[{v:actifs,l:'Actifs'},{v:contrats.length,l:'Contrats'}].map(k=>(
              <div key={k.l} style={{textAlign:'center',background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'5px 12px'}}>
                <div style={{fontSize:18,fontWeight:800,color:'#fff',lineHeight:1}}>{k.v}</div>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.65)',fontWeight:600,marginTop:2}}>{k.l}</div>
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:8,padding:'6px 12px',cursor:'pointer',color:'#fff',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
            <i className="ti ti-x"/>Fermer
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:'8px 18px',marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.18)'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:8,gridColumn:'1 / -1'}}>
            <i className="ti ti-map-pin" style={{fontSize:14,color:'rgba(255,255,255,0.6)',marginTop:2,flexShrink:0}}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:9,color:'rgba(255,255,255,0.55)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>Adresse</div>
              {adresseComplete?(
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                  <span style={{fontSize:13,color:'#fff'}}>{adresseComplete}</span>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#fff',background:'rgba(255,255,255,0.18)',padding:'2px 8px',borderRadius:6,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><i className="ti ti-brand-google-maps" style={{fontSize:12}}/>Maps</a>
                  <a href={wazeUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#fff',background:'rgba(255,255,255,0.18)',padding:'2px 8px',borderRadius:6,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><i className="ti ti-navigation" style={{fontSize:12}}/>Waze</a>
                </div>
              ):<div style={{fontSize:13,color:'#fff'}}>—</div>}
            </div>
          </div>
          {coordItems.map(r=>(
            <div key={r.l} style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <i className={`ti ${r.icon}`} style={{fontSize:14,color:'rgba(255,255,255,0.6)',marginTop:2,flexShrink:0}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.55)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{r.l}</div>
                {canAppel&&r.tel&&r.v!=='—'
                  ?<a href={`tel:${r.tel}`} title="Appeler" style={{fontSize:13,color:'#fff',wordBreak:'break-word',textDecoration:'none',borderBottom:'1px dotted rgba(255,255,255,0.6)'}}>{r.v}</a>
                  :<div style={{fontSize:13,color:'#fff',wordBreak:'break-word'}}>{r.v}</div>}
              </div>
            </div>
          ))}
          {dpItems.map(r=>(
            <div key={r.l} style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <i className={`ti ${r.icon}`} style={{fontSize:14,color:'rgba(255,255,255,0.6)',marginTop:2,flexShrink:0}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.55)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em'}}>{r.l}</div>
                <div style={{fontSize:13,color:'#fff',wordBreak:'break-word'}}>{r.v}{r.warn&&<span style={{marginLeft:6,fontSize:10,fontWeight:700,color:'#fecaca'}}>{r.warn}</span>}</div>
                {r.sub&&<div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:1}}>{r.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'16px 20px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(132px,1fr))',gap:10,marginBottom:16}}>
          {SECTIONS.map(s=>{
            const on=active.key===s.key
            return(
              <button key={s.key} onClick={()=>setOpenSec(s.key)} style={{textAlign:'left',cursor:'pointer',borderRadius:11,padding:'11px 12px',border:on?`2px solid ${s.col}`:'1.5px solid #e2e8f0',background:on?`${s.col}0d`:'#fff',boxShadow:on?`0 3px 12px ${s.col}22`:'0 1px 3px rgba(0,0,0,0.03)',transition:'all .15s',fontFamily:'inherit'}}
                onMouseEnter={e=>{ if(!on){e.currentTarget.style.borderColor=s.col+'70'} }}
                onMouseLeave={e=>{ if(!on){e.currentTarget.style.borderColor='#e2e8f0'} }}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <div style={{width:30,height:30,borderRadius:8,background:`${s.col}18`,display:'flex',alignItems:'center',justifyContent:'center'}}><i className={`ti ${s.icon}`} style={{fontSize:16,color:s.col}}/></div>
                  {s.count!=null&&s.count>0&&<span style={{fontSize:12,fontWeight:800,color:s.col}}>{s.count}</span>}
                </div>
                <div style={{fontSize:12.5,fontWeight:700,color:on?s.col:NAVY,lineHeight:1.15}}>{s.title}</div>
              </button>
            )
          })}
        </div>

        <div style={{borderTop:'1px solid #f1f5f9',paddingTop:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <i className={`ti ${active.icon}`} style={{fontSize:17,color:active.col}}/>
            <span style={{fontSize:15,fontWeight:800,color:NAVY}}>{active.title}</span>
            {active.count!=null&&active.count>0&&<span style={{fontSize:11,fontWeight:800,padding:'1px 8px',borderRadius:20,background:`${active.col}18`,color:active.col}}>{active.count}</span>}
          </div>
          {active.body}
          {detail&&<ContratModal contrat={detail} dossier={client.dossier} objets={objets} cies={cies} preview={!pinnedContrat} onClose={closeContrat}/>}
        </div>
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
  const [bureauCodes,setBureauCodes] = useState([])  // codes des collaborateurs de mon bureau (agence)
  const [myBureauLib,setMyBureauLib] = useState('')
  const [kpis,setKpis]       = useState(null)
  const [counts,setCounts]   = useState({mine:0,bureau:0,total:0})
  const [scope,setScope]     = useState('all')
  const [q,setQ]             = useState('')
  const [clients,setClients] = useState([])
  const [total,setTotal]     = useState(0)
  const [page,setPage]       = useState(0)
  const [loading,setLoading] = useState(false)
  const [selected,setSelected] = useState(null)
  const [contactFilter,setContactFilter] = useState('tous')   // tous | m1 | m3 | m6 | m12 | a2 | a2p
  const [relance,setRelance]   = useState(null)               // null = pas encore chargé
  const [kpiModal,setKpiModal] = useState(null)               // { titre, rows } | 'loading' | null
  const [recents,setRecents] = useState(null)                 // 20 derniers clients consultés par le bureau (partagé)
  const meRef = useRef({ code:null, bureau:null })            // référence fraîche pour le log de consultation
  // Calcule la liste des clients derrière un KPI (réutilise « relance » = tous les clients)
  const openKpi = useCallback(async(kind)=>{
    const all = relance || []
    if(!all.length){ return }
    if(kind==='alerte'){
      const rows = all.filter(c=>c.alerte && String(c.alerte).trim())
      setKpiModal({ titre:`Clients avec alerte (${rows.length})`, rows, showAlerte:true }); return
    }
    setKpiModal('loading')
    if(kind==='sans_contrat'){
      // dossiers présents dans contrats
      const set=new Set(); let from=0
      while(true){ const {data}=await supabase.from('contrats').select('dossier').range(from,from+999); if(!data||!data.length) break; data.forEach(r=>r.dossier&&set.add(String(r.dossier))); if(data.length<1000) break; from+=1000 }
      const rows = all.filter(c=>!set.has(String(c.dossier)))
      setKpiModal({ titre:`Clients sans contrat (${rows.length})`, rows }); return
    }
    if(kind==='sans_comm'){
      // dossiers ayant au moins une commission > 0 en 2026
      const set=new Set(); let from=0
      while(true){ const {data}=await supabase.from('quittances').select('dossier,commission,date_comptable').gte('date_comptable','2026-01-01').lte('date_comptable','2026-12-31').range(from,from+999); if(!data||!data.length) break; data.forEach(r=>{ if(r.dossier&&(Number(r.commission)||0)>0) set.add(String(r.dossier)) }); if(data.length<1000) break; from+=1000 }
      const rows = all.filter(c=>!set.has(String(c.dossier)))
      setKpiModal({ titre:`Clients sans commission 2026 (${rows.length})`, rows }); return
    }
  },[relance])
  const searchRef = useRef(null)
  const deepLink = useRef(new URLSearchParams(window.location.search).get('dossier'))  // fiche à ouvrir via ?dossier= (lien 3CX / dashboard)
  const prevQS = useRef({q:'',scope:'all'})

  // Init user + counts
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user) return
      const code=user.email?.split('@')[0]?.toUpperCase()
      setMyCode(code)
      supabase.from('collaborateurs').select('bureau_id').eq('code',code).limit(1)
        .then(({data})=>{ const bid=data?.[0]?.bureau_id; if(bid){ setMyBureau(bid)
          supabase.from('collaborateurs').select('code').eq('bureau_id',bid).then(({data:cc})=>setBureauCodes((cc||[]).map(x=>x.code).filter(Boolean)))
          supabase.from('ref_bureaux').select('libelle').eq('id',bid).limit(1).then(({data:bb})=>setMyBureauLib(bb?.[0]?.libelle||('Bureau '+bid))) } })
    })
    supabase.rpc('get_clients_kpis').then(({data,error})=>{ if(!error&&data) setKpis(data) })
    supabase.from('clients').select('*',{count:'exact',head:true}).then(({count})=>setCounts(c=>({...c,total:count||0})))
  },[])

  useEffect(()=>{
    if(!myCode) return
    supabase.from('clients').select('*',{count:'exact',head:true}).eq('gestionnaire_code',myCode).then(({count})=>setCounts(c=>({...c,mine:count||0})))
  },[myCode])

  useEffect(()=>{
    if(!bureauCodes.length){ setCounts(c=>({...c,bureau:0})); return }
    supabase.from('clients').select('*',{count:'exact',head:true}).in('gestionnaire_code',bureauCodes).then(({count})=>setCounts(c=>({...c,bureau:count||0})))
  },[bureauCodes])

  // Référence fraîche du collaborateur (code + bureau) pour la journalisation des consultations
  useEffect(()=>{ meRef.current={ code:myCode, bureau:myBureau } },[myCode,myBureau])

  // Journalise l'ouverture d'une fiche, partagée au niveau du bureau (upsert : une ligne par client/bureau)
  async function logConsultation(c){
    const { code, bureau } = meRef.current
    if(!c?.dossier || !bureau) return
    try{
      await supabase.from('clients_consultes').upsert(
        { bureau:String(bureau), dossier:String(c.dossier), consultant_code:code||null, nom:c.nom||null, prenom:c.prenom||null, localite:c.localite||null, consulte_at:new Date().toISOString() },
        { onConflict:'bureau,dossier' })
    }catch(e){}
  }

  // 20 derniers clients consultés par le bureau du collaborateur
  const loadRecents = useCallback(async()=>{
    if(!myBureau) return
    const { data } = await supabase.from('clients_consultes')
      .select('dossier,nom,prenom,localite,consultant_code,consulte_at')
      .eq('bureau',String(myBureau)).order('consulte_at',{ascending:false}).limit(20)
    setRecents(data||[])
  },[myBureau])
  useEffect(()=>{ if(!selected && myBureau) loadRecents() },[myBureau,selected,loadRecents])

  const load = useCallback(async(search,sc,p)=>{
    setLoading(true)
    let qb=supabase.from('clients').select('id,dossier,nom,prenom,cp,localite,gsm,tel_fixe,gsm_e164,telfixe_e164,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte',{count:'exact'})
    if(search.length>=2) qb=qb.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,dossier.ilike.%${search}%,email.ilike.%${search}%,gsm.ilike.%${search}%`)
    if(sc==='mine'&&myCode) qb=qb.eq('gestionnaire_code',myCode)
    else if(sc==='bureau'&&bureauCodes.length) qb=qb.in('gestionnaire_code',bureauCodes)
    const{data,count}=await qb.order('nom').range(p*PER,(p+1)*PER-1)
    const seen=new Set(); const uniq=(data||[]).filter(c=>{ if(!c.dossier||seen.has(c.dossier))return false; seen.add(c.dossier); return true })
    setClients(uniq); setTotal(count||0); setLoading(false)
  },[myCode,myBureau,bureauCodes])

  // Données de relance : dernier contact (RDV passé lié) par client
  const loadRelance = useCallback(async()=>{
    // dernier contact = dernier RDV passé
    const {data:rv}=await supabase.from('rdv').select('client_id,debut').not('client_id','is',null).range(0,9999)
    const now=Date.now(); const last={}
    ;(rv||[]).forEach(r=>{ const t=tsRdv(r.debut); if(t&&t<=now){ if(!last[r.client_id]||t>last[r.client_id]) last[r.client_id]=t } })
    // TOUS les clients : ceux sans RDV passé tombent dans « jamais contacté »
    const rows=[]; let from=0
    while(true){
      const {data}=await supabase.from('clients')
        .select('id,dossier,nom,prenom,cp,localite,gestionnaire_code,gestionnaire_nom,sa_code,sa_nom,bureau,gsm,tel_fixe,email,alerte')
        .range(from,from+999)
      if(!data||!data.length) break
      data.forEach(c=>{
        const t=last[c.id]
        if(t){ const jours=Math.floor((now-t)/86400000); rows.push({...c,last:t,jours,tranche:trancheDe(jours)}) }
        else { rows.push({...c,last:null,jours:Infinity,tranche:'jamais'}) }
      })
      if(data.length<1000) break
      from+=1000
    }
    rows.sort((a,b)=>b.jours-a.jours)   // les plus anciens d'abord = priorité de relance
    setRelance(rows)
  },[])
  useEffect(()=>{ loadRelance() },[loadRelance])

  // recherche liste classique retirée — remplacée par la recherche universelle (colonne gauche)

  // pagination liste retirée

  // Ouvrir une fiche à partir d'un n° de dossier (clic sur une relation)
  const openDossier = useCallback(async(dossier)=>{
    if(!dossier) return
    const{data}=await supabase.from('clients').select('id,dossier,nom,prenom,cp,localite,gsm,tel_fixe,gsm_e164,telfixe_e164,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte').eq('dossier',dossier).limit(1)
    if(data&&data[0]){ setSelected(data[0]); pushRecentClient(data[0]); logConsultation(data[0]); window.scrollTo({top:0,behavior:'smooth'}) }
  },[])

  // Ouverture directe / recherche depuis le menu : réagit à ?dossier= au montage ET aux navigations
  const location = useLocation()
  useEffect(()=>{
    const p=new URLSearchParams(location.search).get('dossier')
    if(p) openDossier(p)
  },[location.search, openDossier])

  const nb=Math.ceil(total/PER)
  const tot=counts.total||1
  const pctMine=counts.mine?((counts.mine/tot)*100).toFixed(1):'—'
  const pctBureau=counts.bureau?((counts.bureau/tot)*100).toFixed(1):'—'

  const SCOPES=[
    { val:'mine',   icon:'ti-user',   label:'Mes clients',  nb:counts.mine,  pct:pctMine,   col:'#0080BD', note:myCode },
    { val:'bureau', icon:'ti-building',label:'Mon bureau',  nb:counts.bureau,pct:pctBureau, col:'#7c3aed', note:myBureauLib },
    { val:'all',    icon:'ti-users',  label:'Tous Dynassur',nb:counts.total, pct:'100',     col:'#16a34a', note:'Dynassur' },
  ]

  // Vue relance (dernier contact), filtrée par scope + tranche + recherche
  const relanceBase = (relance||[]).filter(c =>
    scope==='mine'   ? (myCode && c.gestionnaire_code===myCode)
    : scope==='bureau' ? (bureauCodes.length>0 && bureauCodes.includes(c.gestionnaire_code))
    : true)
  const relanceCounts = TRANCHES.reduce((a,t)=>{ a[t.val]=relanceBase.filter(c=>c.tranche===t.val).length; return a },{})
  const relanceActif = contactFilter!=='tous'
  let relanceView = relanceBase
  if(relanceActif) relanceView = relanceView.filter(c=>c.tranche===contactFilter)
  if(q.length>=2){ const s=q.toLowerCase(); relanceView = relanceView.filter(c=>`${c.nom} ${c.prenom} ${c.dossier}`.toLowerCase().includes(s)) }
  const relanceShow = relanceView.slice(0,500)
  const modeRecents = q.length<2 && contactFilter==='tous'   // vue par défaut = derniers clients consultés du bureau

  return(
    <Layout currentPage="Clients">
      <div style={{fontFamily:"'Source Sans Pro',sans-serif",width:'100%'}}>

        {selected ? (
          <Fiche client={selected} onClose={()=>setSelected(null)} onOpenDossier={openDossier}/>
        ) : (
          <>
            <StatBanner
              color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
              title="Clients" subtitle={`Dynassur SRL — base clients ${new Date().getFullYear()}`}
              stats={[
                { label: 'Avec alerte', value: kpis?.avec_alerte != null ? kpis.avec_alerte.toLocaleString('fr-BE') : '…', onClick: ()=>openKpi('alerte') },
                { label: 'Sans contrat', value: kpis?.sans_contrat != null ? kpis.sans_contrat.toLocaleString('fr-BE') : '…', onClick: ()=>openKpi('sans_contrat') },
                { label: 'Sans comm. 2026', value: kpis?.sans_commissions != null ? kpis.sans_commissions.toLocaleString('fr-BE') : '…', onClick: ()=>openKpi('sans_comm') },
              ]}
            />

            <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',padding:'12px 16px',borderBottom:'1px solid #f1f5f9'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <i className={modeRecents?"ti ti-history":"ti ti-calendar-heart"} style={{fontSize:18,color:'#0d9488'}}/>
                  <span style={{fontSize:15,fontWeight:800,color:NAVY}}>{modeRecents?'Derniers clients consultés':'Relance clients'}</span>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{modeRecents?`· 20 dernières fiches ouvertes par votre bureau${myBureauLib?` (${myBureauLib})`:''}`:'· trie les clients par ancienneté du dernier contact'}</span>
                </div>
                <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
                  <select value={scope} onChange={e=>setScope(e.target.value)} style={{padding:'7px 10px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:13,fontFamily:'inherit',color:NAVY,background:'#fff'}}>
                    <option value="all">Tous Dynassur ({counts.total.toLocaleString('fr-BE')})</option>
                    <option value="mine">Mes clients ({counts.mine.toLocaleString('fr-BE')})</option>
                    <option value="bureau">Mon bureau ({counts.bureau.toLocaleString('fr-BE')})</option>
                  </select>
                  <select value={contactFilter} onChange={e=>setContactFilter(e.target.value)} style={{padding:'7px 10px',borderRadius:8,border:`1px solid ${relanceActif?'#0d9488':'#e2e8f0'}`,fontSize:13,fontFamily:'inherit',color:NAVY,background:'#fff',fontWeight:relanceActif?700:400}}>
                    <option value="tous">Toutes les tranches</option>
                    {TRANCHES.map(t=><option key={t.val} value={t.val}>{t.label} ({relanceCounts[t.val]||0})</option>)}
                  </select>
                  <div style={{position:'relative'}}>
                    <i className="ti ti-filter" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:'#94a3b8',fontSize:14}}/>
                    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filtrer…" style={{padding:'7px 10px 7px 30px',borderRadius:8,border:`1px solid ${q?'#0d9488':'#e2e8f0'}`,fontSize:13,fontFamily:'inherit',outline:'none',width:150,boxSizing:'border-box'}}/>
                  </div>
                </div>
              </div>

              {modeRecents?(
                (recents && recents.length)?(
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead><tr style={{background:'#f8fafc'}}>
                        {['Client','N° Dossier','Localité','Consulté le','Par'].map(h=>(
                          <th key={h} style={{textAlign:'left',padding:'9px 16px',fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',whiteSpace:'nowrap',borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {recents.map((c,i)=>(
                          <tr key={c.dossier} onClick={()=>openDossier(c.dossier)} style={{cursor:'pointer',borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fff':'#fafafe'}}
                            onMouseEnter={e=>e.currentTarget.style.background='#f0fdfa'}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                            <td style={{padding:'9px 16px',fontWeight:600,color:'#1e293b'}}>{c.nom} {c.prenom}</td>
                            <td style={{padding:'9px 16px',fontFamily:'monospace',fontSize:12,color:NAVY}}>{c.dossier}</td>
                            <td style={{padding:'9px 16px',color:'#64748b'}}>{c.localite||'—'}</td>
                            <td style={{padding:'9px 16px',color:'#64748b',whiteSpace:'nowrap'}}>{c.consulte_at?new Date(c.consulte_at).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</td>
                            <td style={{padding:'9px 16px',color:'#64748b'}}>{c.consultant_code||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ):(myBureau===null && myCode)?(
                  <p style={{padding:30,textAlign:'center',color:'#94a3b8'}}>Bureau non déterminé pour votre compte — utilisez la recherche pour ouvrir un client.</p>
                ):recents===null?(
                  <p style={{padding:30,textAlign:'center',color:'#94a3b8'}}>Chargement…</p>
                ):(
                  <p style={{padding:30,textAlign:'center',color:'#94a3b8'}}>Aucune fiche consultée récemment dans votre bureau. Utilisez la recherche pour ouvrir un client.</p>
                )
              ):relance===null?(
                <p style={{padding:30,textAlign:'center',color:'#94a3b8'}}>Chargement de la relance…</p>
              ):!relanceView.length?(
                <p style={{padding:30,textAlign:'center',color:'#94a3b8'}}>Aucun client pour ce filtre.</p>
              ):(
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead><tr style={{background:'#f8fafc'}}>
                      {['Client','N° Dossier','Localité','Dernier contact','Gestionnaire'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'9px 16px',fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',whiteSpace:'nowrap',borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {relanceShow.map((c,i)=>{
                        const col=TRANCHE_COL[c.tranche]||'#64748b'
                        return(
                          <tr key={c.id} onClick={()=>openDossier(c.dossier)} style={{cursor:'pointer',borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fff':'#fafafe'}}
                            onMouseEnter={e=>e.currentTarget.style.background='#f0fdfa'}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                            <td style={{padding:'9px 16px',fontWeight:600,color:'#1e293b'}}>{c.nom} {c.prenom}</td>
                            <td style={{padding:'9px 16px',fontFamily:'monospace',fontSize:12,color:NAVY}}>{c.dossier}</td>
                            <td style={{padding:'9px 16px',color:'#64748b'}}>{c.localite||'—'}</td>
                            <td style={{padding:'9px 16px'}}><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:5,background:col+'18',color:col,whiteSpace:'nowrap'}}>{c.tranche==='jamais'?'Jamais contacté':ilYa(c.jours)}</span></td>
                            <td style={{padding:'9px 16px',color:'#64748b'}}>{c.gestionnaire_nom||c.gestionnaire_code||'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {relanceView.length>relanceShow.length&&(<p style={{padding:'10px 16px',color:'#94a3b8',fontSize:12}}>{relanceShow.length} affichés sur {relanceView.length.toLocaleString('fr-BE')} — affine le filtre.</p>)}
                </div>
              )}
            </div>
          </>
        )}

        {kpiModal&&(
          <div onClick={()=>setKpiModal(null)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:1000,display:'flex',justifyContent:'flex-end'}}>
            <div onClick={e=>e.stopPropagation()} style={{width:'min(820px,96vw)',height:'100%',background:'#fff',display:'flex',flexDirection:'column',boxShadow:'-8px 0 30px rgba(0,0,0,.2)'}}>
              <div style={{background:NAVY,padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{color:'#fff',fontSize:15,fontWeight:800}}>{kpiModal==='loading'?'Calcul en cours…':kpiModal.titre}</div>
                <button onClick={()=>setKpiModal(null)} style={{background:'transparent',border:'none',color:'#fff',fontSize:22,cursor:'pointer'}}>✕</button>
              </div>
              <div style={{flex:1,overflow:'auto'}}>
                {kpiModal==='loading'?(
                  <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Recherche des clients concernés…</div>
                ):(
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                    <thead><tr style={{background:'#f8fafc',position:'sticky',top:0}}>
                      {['N° Dossier','Nom & Prénom','Localité','Gestionnaire / SA',kpiModal.showAlerte?'Alerte':'Contact'].map(h=>(
                        <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:10,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {!kpiModal.rows.length?(<tr><td colSpan={5} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Aucun client.</td></tr>)
                      :kpiModal.rows.slice(0,500).map((c,i)=>(
                        <tr key={c.id} onClick={()=>{openDossier(c.dossier);setKpiModal(null)}} style={{cursor:'pointer',borderBottom:'1px solid #f1f5f9',background:i%2===0?'#fff':'#fafafe'}}
                          onMouseEnter={e=>e.currentTarget.style.background='#f0f9ff'}
                          onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                          <td style={{padding:'7px 12px',fontFamily:'monospace',fontSize:11,color:NAVY,fontWeight:600}}>{c.dossier}</td>
                          <td style={{padding:'7px 12px',fontWeight:600,color:'#1e293b'}}>{c.nom} {c.prenom}</td>
                          <td style={{padding:'7px 12px',color:'#64748b'}}>{c.cp} {c.localite||'—'}</td>
                          <td style={{padding:'7px 12px',color:'#64748b'}}>{c.gestionnaire_nom||c.gestionnaire_code||'—'}{c.sa_nom?` · ${c.sa_nom}`:''}</td>
                          <td style={{padding:'7px 12px',color:kpiModal.showAlerte?'#dc2626':'#64748b'}}>{kpiModal.showAlerte?(c.alerte||'—'):(c.gsm||c.tel_fixe||c.email||'—')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {kpiModal!=='loading'&&kpiModal.rows.length>500&&(<p style={{padding:'12px 16px',color:'#94a3b8',fontSize:12}}>500 premiers affichés sur {kpiModal.rows.length.toLocaleString('fr-BE')}.</p>)}
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}
