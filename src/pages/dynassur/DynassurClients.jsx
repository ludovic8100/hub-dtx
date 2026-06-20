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

// ══ Objets de risque (table risques liée par police de contrat) ══
function Risques({ contrats, loadContrats }) {
  const [risques,setRisques]=useState([]); const [load,setLoad]=useState(true)
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

  // Grouper par type
  const parType={}
  risques.forEach(r=>{ const k=r.type_risque_libelle||'Autre'; if(!parType[k])parType[k]=[]; parType[k].push(r) })

  // ── Analyse 360 : couvertures essentielles présentes / absentes ──
  // On combine domaines de contrats EN COURS + types de risque pour déterminer ce qui est couvert
  const blob=(contrats.filter(c=>c.situation==='En cours').map(c=>`${c.domaine} ${c.type_production}`).join(' ')+' '+risques.map(r=>r.type_risque_libelle+' '+r.description).join(' ')).toUpperCase()
  const ESSENTIELS=[
    {label:'Auto / Véhicule', icon:'🚗', kw:['AUTO','VÉHIC','VEHIC','MOTO','CAMION']},
    {label:'Habitation / Incendie', icon:'🏠', kw:['HABITATION','INCENDIE','MAISON','BÂTIMENT','BATIMENT','IMMEUBLE']},
    {label:'RC Familiale', icon:'⚖️', kw:['FAMILIALE','RC VIE PRIVÉE','VIE PRIVEE','RESPONSABILIT']},
    {label:'Protection juridique', icon:'🛡️', kw:['JURIDIQUE','PROTECTION JUR']},
    {label:'Soins de santé / Hospi', icon:'🏥', kw:['SANTÉ','SANTE','HOSPI','MALADIE','SOINS']},
    {label:'Vie / Décès / Pension', icon:'💙', kw:['VIE','DÉCÈS','DECES','PENSION','ÉPARGNE','EPARGNE']},
    {label:'Accidents', icon:'🩹', kw:['ACCIDENT','CORPO']},
  ]
  const couv=ESSENTIELS.map(e=>({...e,ok:e.kw.some(k=>blob.includes(k))}))
  const manquants=couv.filter(e=>!e.ok)

  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {/* ── Analyse 360 ── */}
      <div style={{background:'#fafafe',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px'}}>
        <div style={{fontSize:11,fontWeight:700,color:NAVY,textTransform:'uppercase',letterSpacing:'.04em',marginBottom:9,display:'flex',alignItems:'center',gap:6}}>
          <i className="ti ti-radar" style={{color:'#7c3aed'}}/>Analyse 360 — couverture
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
          {couv.map((e,i)=>(
            <div key={i} title={e.ok?'Couvert':'Non couvert — opportunité'} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,fontSize:12,fontWeight:600,
              background:e.ok?'#f0fdf4':'#fef2f2',color:e.ok?'#16a34a':'#dc2626',border:`1px solid ${e.ok?'#bbf7d0':'#fecaca'}`}}>
              <span style={{fontSize:14,filter:e.ok?'none':'grayscale(1)',opacity:e.ok?1:0.6}}>{e.icon}</span>
              {e.label}
              <i className={`ti ${e.ok?'ti-check':'ti-x'}`} style={{fontSize:13}}/>
            </div>
          ))}
        </div>
        {manquants.length>0&&(
          <div style={{fontSize:11,color:'#92400e',marginTop:9,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:7,padding:'7px 11px'}}>
            <strong>{manquants.length} couverture{manquants.length>1?'s':''} potentielle{manquants.length>1?'s':''} à proposer :</strong> {manquants.map(m=>m.label).join(', ')}
          </div>
        )}
      </div>
      {/* Badges résumé par type */}
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        {Object.entries(parType).map(([type,arr],i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:'#faf5ff',borderRadius:9,padding:'9px 14px',border:'1px solid #e9d5ff'}}>
            <span style={{fontSize:22}}>{RICON(type)}</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:'#1e293b'}}>{type}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{arr.length} objet{arr.length>1?'s':''}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Détail */}
      {risques.length>0&&<div style={{overflowX:'auto',maxHeight:240,overflowY:'auto',border:'1px solid #f1f5f9',borderRadius:7}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:'#f8fafc',zIndex:1}}>
            <tr>{['Police','Type','Description','Contrats','Statut'].map(h=>(
              <th key={h} style={{padding:'7px 12px',textAlign:'left',fontWeight:700,color:'#94a3b8',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap'}}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {risques.map((r,i)=>(
              <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
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
        type:r.type_relation_libelle, active:r.relation_active,
        autreNom:r.nom_lie, autrePrenom:r.prenom_lie, autreDossier:null,
        cp:r.cp_lie, localite:r.localite_lie, morale:(r.physique_morale_libelle||'').toLowerCase().includes('morale'),
      }))
      ;(inv||[]).forEach(r=>list.push({
        type:r.type_relation_libelle, active:r.relation_active,
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
        return(
          <div key={i} onClick={()=>clickable&&onOpenDossier(r.autreDossier)}
            title={clickable?'Ouvrir la fiche':''}
            style={{background:cfg.bg,border:`1px solid ${cfg.col}30`,borderRadius:10,padding:'10px 14px',cursor:clickable?'pointer':'default',minWidth:185,transition:'box-shadow 0.15s,transform 0.1s'}}
            onMouseEnter={e=>{if(clickable){e.currentTarget.style.boxShadow=`0 4px 12px ${cfg.col}30`;e.currentTarget.style.transform='translateY(-1px)'}}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform=''}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
              <span style={{fontSize:18}}>{cfg.icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:cfg.col,textTransform:'uppercase',letterSpacing:'.03em',lineHeight:1.2}}>{r.type||'Relation'}</span>
              {!r.active&&<span style={{fontSize:9,color:'#dc2626',marginLeft:'auto',fontWeight:600}}>inactive</span>}
            </div>
            <div style={{fontSize:13,fontWeight:700,color:'#1e293b'}}>{nomAffiche||'—'}</div>
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
  const [contrats,setContrats]=useState([]); const [taches,setTaches]=useState([]); const [loadF,setLoadF]=useState(true)
  const ref=useRef(null)

  useEffect(()=>{
    ref.current?.scrollIntoView({behavior:'smooth',block:'start'})
    setLoadF(true)
    Promise.all([
      supabase.from('contrats').select('police,compagnie,nom_client,situation,date_creation,domaine,type_production,garantie_valeur,version').eq('dossier',client.dossier).order('date_creation',{ascending:false}),
      supabase.from('taches').select('*').eq('dossier_client',client.dossier).order('echeance',{ascending:true}).limit(20),
    ]).then(([{data:c},{data:t}])=>{
      // Dédoublonnage par police (les imports créent des lignes identiques) — on garde la plus récente
      const seen=new Set(); const uniq=[]
      ;(c||[]).forEach(r=>{ const k=r.police||JSON.stringify(r); if(!seen.has(k)){ seen.add(k); uniq.push(r) } })
      setContrats(uniq); setTaches(t||[]); setLoadF(false)
    })
  },[client.dossier])

  const initiales=`${(client.prenom||'?')[0]||''}${(client.nom||'?')[0]||''}`.toUpperCase()
  const actifs=contrats.filter(c=>c.situation==='En cours').length
  const adresse=[client.rue,client.num_maison,client.boite].filter(Boolean).join(' ')
  const adresseComplete=[adresse,[client.cp,client.localite].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const mapsUrl=adresseComplete?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresseComplete)}`:null
  const wazeUrl=adresseComplete?`https://waze.com/ul?q=${encodeURIComponent(adresseComplete)}`:null
  const age=calcAge(client.date_naissance)
  const gsm=cleanTel(client.gsm); const fixe=cleanTel(client.tel_fixe)

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

        {/* Relations familiales ET sociétés */}
        <Sec icon="ti-users-group" title="Relations & sociétés" col="#ec4899" open={true} count={0}>
          <Relations client={client} onOpenDossier={onOpenDossier}/>
        </Sec>

        {/* Objets de risque (vraie table risques, liée par police) */}
        <Sec icon="ti-shield" title="Objets de risque" count={0} col="#7c3aed" open={true}>
          <Risques contrats={contrats} loadContrats={loadF}/>
        </Sec>

        {/* Contrats */}
        <Sec icon="ti-file-text" title="Contrats" count={contrats.length} col={BLUE} open={true}>
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
                      <tr key={i} style={{background:i%2===0?'#fff':'#fafafe'}}>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',fontFamily:'monospace',fontSize:11,fontWeight:600,color:NAVY}}>{c.police||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#1e293b'}}>{c.compagnie||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.domaine||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,background:s.bg,color:s.col}}>{c.situation||'—'}</span></td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}}>{c.type_production||'—'}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b',whiteSpace:'nowrap'}}>{fmtDate(c.date_creation)}</td>
                        <td style={{padding:'7px 12px',borderBottom:'1px solid #f1f5f9',color:'#64748b'}} title={c.garantie_valeur?`Valeur assurée : ${fmt(c.garantie_valeur)}`:''}>{c.garantie_valeur?fmt(c.garantie_valeur):'—'}</td>
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
    let qb=supabase.from('clients').select('dossier,nom,prenom,cp,localite,gsm,tel_fixe,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte',{count:'exact'})
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

  // Ouvrir une fiche à partir d'un n° de dossier (clic sur une relation)
  const openDossier = useCallback(async(dossier)=>{
    if(!dossier) return
    const{data}=await supabase.from('clients').select('dossier,nom,prenom,cp,localite,gsm,tel_fixe,email,rue,num_maison,boite,date_naissance,etat_civil,sexe,sa_code,sa_nom,gestionnaire_code,gestionnaire_nom,bureau,classe,alerte').eq('dossier',dossier).limit(1)
    if(data&&data[0]){ setSelected(data[0]); window.scrollTo({top:0,behavior:'smooth'}) }
  },[])

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
        {selected&&<Fiche client={selected} onClose={()=>setSelected(null)} onOpenDossier={openDossier}/>}

      </div>
    </Layout>
  )
}
