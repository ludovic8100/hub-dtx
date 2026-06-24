import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

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
]
const trancheDe = jours => TRANCHES.find(t=>jours>=t.min&&jours<t.max)?.val || null
const TRANCHE_COL = { m1:'#16a34a', m3:'#65a30d', m6:'#ca8a04', m12:'#ea580c', a2:'#dc2626', a2p:'#991b1b' }
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
      <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
        {couv.map((e,i)=>{
          const s=STY[e.etat]
          return(
            <div key={i} title={e.etat==='relation'?`Couvert via ${e.src.via} (${e.src.type})`:e.etat==='direct'?'Couvert par un contrat du client':'Non couvert — opportunité'}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,fontSize:12,fontWeight:600,background:s.bg,color:s.col,border:`1px solid ${s.bd}`}}>
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
function Fiche({ client, onClose, onOpenDossier }) {
  const [contrats,setContrats]=useState([]); const [taches,setTaches]=useState([]); const [rdvs,setRdvs]=useState([]); const [groupe,setGroupe]=useState([]); const [loadF,setLoadF]=useState(true)
  const ref=useRef(null)

  useEffect(()=>{
    ref.current?.scrollIntoView({behavior:'smooth',block:'start'})
    setLoadF(true)
    Promise.all([
      supabase.from('contrats').select('police,compagnie,nom_client,situation,date_creation,domaine,type_production,garantie_valeur,version').eq('dossier',client.dossier).order('date_creation',{ascending:false}),
      supabase.from('taches').select('*').eq('dossier_client',client.dossier).order('echeance',{ascending:true}).limit(20),
      client.id
        ? supabase.from('rdv').select('id,objet,debut,categorie,user_email,web_link,journee_entiere,lieu').eq('client_id',client.id).order('debut',{ascending:false})
        : Promise.resolve({data:[]}),
      supabase.from('parentes').select('groupe_nom,groupe_type,membre_nom,nb_polices,prime_totale').eq('dossier_principal',client.dossier),
    ]).then(([{data:c},{data:t},{data:rv},{data:gr}])=>{
      // Dédoublonnage par police (les imports créent des lignes identiques) — on garde la plus récente
      const seen=new Set(); const uniq=[]
      ;(c||[]).forEach(r=>{ const k=r.police||JSON.stringify(r); if(!seen.has(k)){ seen.add(k); uniq.push(r) } })
      setContrats(uniq); setTaches(t||[]); setRdvs(rv||[]); setGroupe(gr||[]); setLoadF(false)
    })
  },[client.dossier,client.id])

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

  // Risques (dérivés des domaines de contrats actifs)
  const risques={}
  contrats.filter(c=>c.situation==='En cours').forEach(c=>{
    const cfg=getIcon(c.domaine); const k=cfg.label
    if(!risques[k]) risques[k]={...cfg,n:0}
    risques[k].n++
  })
  const SIT={  'En cours':{bg:'#dcfce7',col:'#16a34a'},'Résilié':{bg:'#fee2e2',col:'#dc2626'},'Terminé':{bg:'#fee2e2',col:'#dc2626'},'Suspendu':{bg:'#fef3c7',col:'#92400e'} }

  return(
    <div ref={ref} style={{marginTop:20,background:'#fff',borderRadius:14,border:`2px solid ${BLUE}25`,overflow:'hidden',boxShadow:'0 4px 24px rgba(0,128,189,0.1)'}}>

      {/* ── Header compact : nom mis en avant ── */}
      <div style={{background:`linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`,padding:'12px 20px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
        <div style={{width:42,height:42,borderRadius:11,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:16,fontWeight:800,color:'#fff'}}>{initiales}</div>
        <div style={{flex:1,minWidth:160}}>
          <h2 style={{fontSize:24,fontWeight:800,color:'#fff',margin:0,lineHeight:1.1}}>{client.prenom} {client.nom}</h2>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.65)',display:'flex',gap:12,flexWrap:'wrap',marginTop:2}}>
            <span>#{client.dossier}</span>
            {client.etat_civil&&<span>{client.etat_civil}</span>}
            {client.bureau&&<span>{client.bureau}</span>}
          </div>
        </div>
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

      <div style={{padding:'18px 22px'}}>
        {client.alerte&&(
          <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'8px 14px',marginBottom:12,display:'flex',gap:8,fontSize:13,color:'#c2410c',alignItems:'center'}}>
            <i className="ti ti-alert-triangle" style={{fontSize:16}}/><strong>Alerte :</strong>{client.alerte}
          </div>
        )}

        {/* Coordonnées inline compact */}
        <Sec icon="ti-user" title="Coordonnées" col="#64748b" open={true} count={0}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>
            {/* Adresse cliquable */}
            <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
              <i className="ti ti-map-pin" style={{fontSize:13,color:'#94a3b8',marginTop:2,flexShrink:0}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em'}}>Adresse</div>
                {adresseComplete?(
                  <div>
                    <div style={{fontSize:13,color:'#1e293b'}}>{adresseComplete}</div>
                    <div style={{display:'flex',gap:10,marginTop:3}}>
                      <a href={mapsUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:BLUE,fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><i className="ti ti-brand-google-maps" style={{fontSize:12}}/>Maps</a>
                      <a href={wazeUrl} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#0d9488',fontWeight:600,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><i className="ti ti-navigation" style={{fontSize:12}}/>Waze</a>
                    </div>
                  </div>
                ):<div style={{fontSize:13,color:'#1e293b'}}>—</div>}
              </div>
            </div>
            {[
              {icon:'ti-device-mobile',l:'GSM',       v:gsm||'—'},
              {icon:'ti-phone',    l:'Fixe',          v:fixe||'—'},
              {icon:'ti-mail',     l:'Email',         v:client.email||'—'},
              {icon:'ti-calendar', l:'Naissance',     v:client.date_naissance?`${fmtDateLong(client.date_naissance)}${age?` · ${age.ans} ans`:''}`:'—'},
              {icon:'ti-heart',    l:'État civil',    v:client.etat_civil||'—'},
              {icon:'ti-gender-bigender',l:'Sexe',    v:client.sexe||'—'},
              {icon:'ti-user',     l:'Gestionnaire',  v:client.gestionnaire_nom||'—'},
              {icon:'ti-user-star',l:'Sous-agent',    v:client.sa_nom||'—'},
            ].map(r=>(
              <div key={r.l} style={{display:'flex',alignItems:'flex-start',gap:8}}>
                <i className={`ti ${r.icon}`} style={{fontSize:13,color:'#94a3b8',marginTop:2,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.04em'}}>{r.l}</div>
                  <div style={{fontSize:13,color:'#1e293b'}}>{r.v}</div>
                </div>
              </div>
            ))}
          </div>
        </Sec>

        {/* Dernier contact / RDV */}
        <Sec icon="ti-calendar-heart" title="Dernier contact" count={rdvs.length} col="#0d9488" open={true}>
          {loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!rdvs.length?
            <p style={{color:'#94a3b8',fontSize:12}}>Aucun RDV lié à ce client. <span style={{color:'#cbd5e1'}}>(Lie un RDV depuis la page RDV / Agenda.)</span></p>:(
            <div>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:rdvPasses.length>1||prochain?12:0}}>
                {dernier&&(
                  <div style={{flex:'1 1 220px',background:'#f0fdfa',border:'1px solid #99f6e4',borderRadius:10,padding:'12px 16px'}}>
                    <div style={{fontSize:10,fontWeight:800,color:'#0d9488',textTransform:'uppercase',letterSpacing:'.05em'}}>Dernier contact</div>
                    <div style={{fontSize:20,fontWeight:800,color:NAVY,lineHeight:1.1,marginTop:3}}>{fmtRdv(dernier.debut)}</div>
                    <div style={{fontSize:12,color:'#0d9488',fontWeight:600}}>{ilYa(joursDernier)}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:4}}>{dernier.objet}</div>
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
              <div style={{maxHeight:200,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
                {rdvs.map((r,i)=>{
                  const futur=tsRdv(r.debut)>nowTs
                  return(
                    <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:i<rdvs.length-1?'1px solid #f8fafc':'none',background:futur?'#f8fbff':'#fff'}}>
                      <span style={{fontSize:12,fontWeight:700,color:NAVY,whiteSpace:'nowrap',minWidth:78}}>{fmtRdv(r.debut)}</span>
                      <span style={{flex:1,fontSize:12,color:'#1e293b'}}>
                        {r.web_link?<a href={r.web_link} target="_blank" rel="noreferrer" style={{color:'#1e293b',textDecoration:'none'}}>{r.objet||'—'}</a>:(r.objet||'—')}
                        {r.lieu&&<span style={{fontSize:11,color:'#94a3b8'}}> · {r.lieu}</span>}
                      </span>
                      <span style={{fontSize:10,fontWeight:700,color:'#64748b'}}>{(r.user_email||'').replace('@dynassur.be','')}</span>
                      {futur&&<span style={{fontSize:9,fontWeight:800,padding:'2px 6px',borderRadius:4,background:'#dbeafe',color:'#2563eb'}}>À VENIR</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Sec>

        {/* Relations familiales ET sociétés */}
        <Sec icon="ti-users-group" title="Relations & sociétés" col="#ec4899" open={true} count={0}>
          <Relations client={client} onOpenDossier={onOpenDossier}/>
        </Sec>

        {/* Groupe / Ménage (vue Qlik GroupePreneur) */}
        {groupe.length>0 && (
          <Sec icon="ti-home-2" title="Groupe / Ménage" col="#0d9488" open={true} count={groupe.length}>
            <div style={{fontSize:12,color:'#64748b',marginBottom:8,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <strong style={{color:NAVY}}>{groupe[0].groupe_nom||'Groupe'}</strong>
              {groupe[0].groupe_type&&<span style={{fontSize:10,fontWeight:800,padding:'2px 7px',borderRadius:5,background:'#f0fdfa',color:'#0d9488',border:'1px solid #99f6e4'}}>{groupe[0].groupe_type}</span>}
              {(groupe[0].nb_polices||groupe[0].prime_totale)?<span style={{color:'#94a3b8'}}>· {Math.round(groupe[0].nb_polices||0)} police(s) · {Math.round(groupe[0].prime_totale||0).toLocaleString('fr-BE')} € de prime</span>:null}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {groupe.map((m,i)=>(
                <span key={i} style={{fontSize:12,padding:'5px 10px',borderRadius:7,background:'#f8fafc',border:'1px solid #e2e8f0',color:'#1e293b'}}>{m.membre_nom}</span>
              ))}
            </div>
          </Sec>
        )}

        {/* Objets de risque (vraie table risques, liée par police) */}
        <Sec icon="ti-shield" title="Objets de risque" count={0} col="#7c3aed" open={true}
          extra={<EnDev label="Fiche risque à venir" mini />}>
          <Analyse360 client={client} contrats={contrats}/>
          <Risques contrats={contrats} loadContrats={loadF}/>
        </Sec>

        {/* Contrats */}
        <Sec icon="ti-file-text" title="Contrats" count={contrats.length} col={BLUE} open={true}
          extra={<EnDev label="Contrats des relations à venir" mini />}>
          {loadF?<p style={{color:'#94a3b8',fontSize:12}}>Chargement…</p>:!contrats.length?<p style={{color:'#94a3b8',fontSize:12}}>Aucun contrat</p>:
            <div style={{overflowX:'auto',maxHeight:240,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
                  <tr>{['Police','Compagnie','Domaine','Situation','Type','Date','Garantie'].map(h=>(
                    <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {contrats.map((c,i)=>{
                    const s=SIT[c.situation]||{bg:'#f1f5f9',col:'#64748b'}
                    return(
                      <tr key={i} title="Fiche contrat détaillée — en cours de développement" style={{background:i%2===0?'#fff':'#fafafe'}}>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,fontWeight:600,color:NAVY}}>{c.police||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#1e293b'}}>{c.compagnie||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.domaine||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:s.bg,color:s.col}}>{c.situation||'—'}</span></td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.type_production||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b',whiteSpace:'nowrap'}}>{fmtDate(c.date_creation)}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}} title="Détail des garanties — en cours de développement">
                          {c.garantie_valeur?fmt(c.garantie_valeur):'—'}
                          <i className="ti ti-tools" style={{fontSize:11,color:'#fb923c',marginLeft:5,verticalAlign:'middle'}}/>
                        </td>
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
  const [contactFilter,setContactFilter] = useState('tous')   // tous | m1 | m3 | m6 | m12 | a2 | a2p
  const [relance,setRelance]   = useState(null)               // null = pas encore chargé
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
    let qb=supabase.from('clients').select('id,dossier,nom,prenom,cp,localite,gsm,tel_fixe,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte',{count:'exact'})
    if(search.length>=2) qb=qb.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,dossier.ilike.%${search}%,email.ilike.%${search}%,gsm.ilike.%${search}%`)
    if(sc==='mine'&&myCode) qb=qb.eq('gestionnaire_code',myCode)
    else if(sc==='bureau'&&myBureau) qb=qb.eq('bureau',myBureau)
    const{data,count}=await qb.order('nom').range(p*PER,(p+1)*PER-1)
    const seen=new Set(); const uniq=(data||[]).filter(c=>{ if(!c.dossier||seen.has(c.dossier))return false; seen.add(c.dossier); return true })
    setClients(uniq); setTotal(count||0); setLoading(false)
  },[myCode,myBureau])

  // Données de relance : dernier contact (RDV passé lié) par client
  const loadRelance = useCallback(async()=>{
    const {data:rv}=await supabase.from('rdv').select('client_id,debut').not('client_id','is',null).range(0,4999)
    const now=Date.now(); const last={}
    ;(rv||[]).forEach(r=>{ const t=tsRdv(r.debut); if(t&&t<=now){ if(!last[r.client_id]||t>last[r.client_id]) last[r.client_id]=t } })
    const ids=Object.keys(last).map(Number)
    if(!ids.length){ setRelance([]); return }
    const rows=[]
    for(let i=0;i<ids.length;i+=200){
      const {data}=await supabase.from('clients')
        .select('id,dossier,nom,prenom,cp,localite,gestionnaire_code,gestionnaire_nom,sa_code,sa_nom,bureau,gsm,tel_fixe,email')
        .in('id',ids.slice(i,i+200))
      ;(data||[]).forEach(c=>{ const t=last[c.id]; const jours=Math.floor((now-t)/86400000); rows.push({...c,last:t,jours,tranche:trancheDe(jours)}) })
    }
    rows.sort((a,b)=>b.jours-a.jours)   // les plus anciens d'abord = priorité de relance
    setRelance(rows)
  },[])
  useEffect(()=>{ loadRelance() },[loadRelance])

  useEffect(()=>{
    const t=setTimeout(()=>{ setPage(0); setSelected(null); load(q,scope,0) },300)
    return ()=>clearTimeout(t)
  },[q,scope,myCode,myBureau])

  useEffect(()=>{ load(q,scope,page) },[page])

  // Ouvrir une fiche à partir d'un n° de dossier (clic sur une relation)
  const openDossier = useCallback(async(dossier)=>{
    if(!dossier) return
    const{data}=await supabase.from('clients').select('id,dossier,nom,prenom,cp,localite,gsm,tel_fixe,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte').eq('dossier',dossier).limit(1)
    if(data&&data[0]){ setSelected(data[0]); pushRecentClient(data[0]); window.scrollTo({top:0,behavior:'smooth'}) }
  },[])

  // Ouverture directe via ?dossier= (depuis le tableau de bord « derniers clients »)
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search).get('dossier')
    if(p) openDossier(p)
  },[openDossier])

  const nb=Math.ceil(total/PER)
  const tot=counts.total||1
  const pctMine=counts.mine?((counts.mine/tot)*100).toFixed(1):'—'
  const pctBureau=counts.bureau?((counts.bureau/tot)*100).toFixed(1):'—'

  const SCOPES=[
    { val:'mine',   icon:'ti-user',   label:'Mes clients',  nb:counts.mine,  pct:pctMine,   col:'#0080BD', note:myCode },
    { val:'bureau', icon:'ti-building',label:'Mon bureau',  nb:counts.bureau,pct:pctBureau, col:'#7c3aed', note:myBureau },
    { val:'all',    icon:'ti-users',  label:'Tous Dynassur',nb:counts.total, pct:'100',     col:'#16a34a', note:'Dynassur' },
  ]

  // Vue relance (dernier contact), filtrée par scope + tranche + recherche
  const relanceBase = (relance||[]).filter(c =>
    scope==='mine'   ? (myCode && c.gestionnaire_code===myCode)
    : scope==='bureau' ? (myBureau && c.bureau===myBureau)
    : true)
  const relanceCounts = TRANCHES.reduce((a,t)=>{ a[t.val]=relanceBase.filter(c=>c.tranche===t.val).length; return a },{})
  const relanceActif = contactFilter!=='tous'
  let relanceView = relanceBase
  if(relanceActif) relanceView = relanceView.filter(c=>c.tranche===contactFilter)
  if(q.length>=2){ const s=q.toLowerCase(); relanceView = relanceView.filter(c=>`${c.nom} ${c.prenom} ${c.dossier}`.toLowerCase().includes(s)) }

  return(
    <Layout currentPage="Clients">
      <div style={{fontFamily:"'Source Sans Pro',sans-serif",width:'100%'}}>

        <StatBanner
          color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo}
          title="Clients" subtitle={`Dynassur SRL — base clients ${new Date().getFullYear()}`}
          stats={[
            { label: 'Avec alerte', value: kpis?.avec_alerte != null ? kpis.avec_alerte.toLocaleString('fr-BE') : '…' },
            { label: 'Sans contrat', value: kpis?.sans_contrat != null ? kpis.sans_contrat.toLocaleString('fr-BE') : '…' },
            { label: 'Sans comm. 2026', value: kpis?.sans_commissions != null ? kpis.sans_commissions.toLocaleString('fr-BE') : '…' },
          ]}
        />

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

        {/* ── Filtre relance : dernier contact ── */}
        {!selected&&(
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:18}}>
            <span style={{fontSize:13,color:'#64748b',fontWeight:600}}><i className="ti ti-calendar-heart" style={{marginRight:5,color:'#0d9488'}}/>Dernier contact :</span>
            <select value={contactFilter} onChange={e=>setContactFilter(e.target.value)}
              style={{padding:'7px 12px',borderRadius:8,border:`1.5px solid ${relanceActif?'#0d9488':'#e2e8f0'}`,fontSize:13,color:NAVY,background:'#fff',fontFamily:"'Source Sans Pro',sans-serif",fontWeight:relanceActif?700:400}}>
              <option value="tous">Tous les clients (base complète)</option>
              {TRANCHES.map(t=><option key={t.val} value={t.val}>{t.label} ({relanceCounts[t.val]||0})</option>)}
            </select>
            {relance===null
              ? <span style={{fontSize:12,color:'#94a3b8'}}>chargement des contacts…</span>
              : relanceActif && <span style={{fontSize:12,color:'#0d9488',fontWeight:600}}>{relanceView.length} client(s) — du plus ancien au plus récent</span>}
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
        {!selected&&!relanceActif&&(
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
                    <tr key={c.dossier||i} onClick={()=>{ setSelected(c); pushRecentClient(c) }} style={{cursor:'pointer',background:i%2===0?'#fff':'#fafafe',transition:'background 0.1s'}}
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

        {/* ── Tableau relance (dernier contact) ── */}
        {!selected&&relanceActif&&(
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden',marginBottom:4}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f8fafc'}}>
                    {['N° Dossier','Nom & Prénom','Localité','Dernier contact','Ancienneté','Gestionnaire / SA',''].map(h=>(
                      <th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relance===null?(<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Chargement…</td></tr>)
                  :!relanceView.length?(<tr><td colSpan={7} style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Aucun client dans cette tranche.</td></tr>)
                  :relanceView.map((c,i)=>{
                    const col=TRANCHE_COL[c.tranche]||'#64748b'
                    return(
                      <tr key={c.id} onClick={()=>openDossier(c.dossier)} style={{cursor:'pointer',background:i%2===0?'#fff':'#fafafe'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#f0fdfa'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,color:NAVY,fontWeight:600}}>{c.dossier}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9'}}>
                          <div style={{fontWeight:600,color:'#1e293b'}}>{c.nom} {c.prenom}</div>
                          {(c.gsm||c.tel_fixe)&&<div style={{fontSize:11,color:'#94a3b8'}}>{c.gsm||c.tel_fixe}</div>}
                        </td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.cp} {c.localite||'—'}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:NAVY,fontWeight:600,whiteSpace:'nowrap'}}>{new Date(c.last).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'})}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:col+'18',color:col,whiteSpace:'nowrap'}}>{ilYa(c.jours)}</span></td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',color:'#64748b',fontSize:12}}>{c.gestionnaire_nom||c.gestionnaire_code||'—'}{c.sa_nom?` · ${c.sa_nom}`:''}</td>
                        <td style={{padding:'9px 14px',borderBottom:'1px solid #f1f5f9',textAlign:'right'}}><span style={{fontSize:11,color:'#0d9488',fontWeight:600}}>Fiche ▼</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Fiche ── */}
        {selected&&<Fiche client={selected} onClose={()=>setSelected(null)} onOpenDossier={openDossier}/>}

      </div>
    </Layout>
  )
}
