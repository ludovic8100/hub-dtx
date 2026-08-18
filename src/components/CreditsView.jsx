import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const C = { navy:"#1A3A6B", navyMid:"#1E5799", cyan:"#29ABE2", bg:"#F4F6F9", white:"#FFFFFF", border:"#DDE3ED", textD:"#1A3A6B", textM:"#4A5568", textL:"#8A9BBE", ok:"#27AE60", warn:"#F39C12", danger:"#E74C3C" }
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  input:{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 10px", color:C.textD, fontSize:13, outline:"none", boxSizing:"border-box", width:"100%" },
  label:{ fontSize:11, fontWeight:600, color:C.textM, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.03em" },
  btn:(v="primary")=>({ padding:"8px 16px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, border:"none", ...(v==="primary"?{ background:`linear-gradient(135deg,${C.cyan},${C.navyMid})`, color:"#fff" }:v==="ghost"?{ background:"transparent", color:C.navy, border:`1px solid ${C.border}` }:{ background:C.bg, color:C.textM, border:`1px solid ${C.border}` }) }),
}
const fmtEUR = n => (n==null||isNaN(n))?"—":new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n)
const fmtEUR2 = n => (n==null||isNaN(n))?"—":new Intl.NumberFormat("fr-BE",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(n)

// temps restant "173 mois, 14 ans 5 mois"
function fmtDuree(mois) {
  if (mois==null || isNaN(mois)) return "—"
  if (mois <= 0) return "Échu"
  const a = Math.floor(mois/12), m = mois%12
  let t = `${mois} mois, ${a} an${a>1?"s":""}`
  if (m>0) t += ` ${m} mois`
  return t
}

// ===== CALCUL =====
function mensualite(cap, txPct, duree){ const i=(txPct/100)/12; if(i===0)return cap/duree; return cap*i/(1-Math.pow(1+i,-duree)) }
function capitalRestant(cap, txPct, duree, payees){ const i=(txPct/100)/12; const m=mensualite(cap,txPct,duree); if(i===0)return cap-m*payees; const f=Math.pow(1+i,payees); return cap*f-m*(f-1)/i }
function moisEcoules(d){ const dd=new Date(d),now=new Date(); return Math.max(0,(now.getFullYear()-dd.getFullYear())*12+(now.getMonth()-dd.getMonth())) }
function tauxPour(fin, taux){
  if(fin.type_credit==='PAT') return taux.find(t=>t.categorie==='PAT')?.taux ?? 7
  if(fin.type_taux==='variable') return taux.find(t=>t.categorie==='PH_variable')?.taux ?? 4.15
  const restAns=(fin.duree_mois-moisEcoules(fin.date_debut))/12
  return restAns>10 ? (taux.find(t=>t.categorie==='PH_fixe_10plus')?.taux??3.35) : (taux.find(t=>t.categorie==='PH_fixe_5_10')?.taux??3.27)
}
function analyser(fin, tauxMarche, frais){
  const ecoulees=moisEcoules(fin.date_debut)
  const dureeRestante=Math.max(0,fin.duree_mois-ecoulees)
  if(dureeRestante<=0)return null
  const mensAct=fin.mensualite_actuelle||mensualite(fin.capital_initial,fin.taux_actuel,fin.duree_mois)
  const capRest=Math.max(0,capitalRestant(fin.capital_initial,fin.taux_actuel,fin.duree_mois,ecoulees))
  const indemnite=capRest*(fin.taux_actuel/100)*(frais.indemnite_remploi_mois/12)
  const mainlevee=fin.capital_initial*(frais.mainlevee_pct/100)
  const droitEnr=capRest*(frais.droit_enregistrement_pct/100)
  const droitInscr=capRest*(frais.droit_inscription_pct/100)
  const totalFrais=indemnite+mainlevee+droitEnr+droitInscr+frais.frais_dossier+frais.honoraires_notaire
  const nouveauCapital=capRest+totalFrais
  const nouvelleMens=mensualite(nouveauCapital,tauxMarche,dureeRestante)
  const baisse=mensAct-nouvelleMens
  const gain=(mensAct*dureeRestante)-(nouvelleMens*dureeRestante)
  const ecart=fin.taux_actuel-tauxMarche
  return { capRest,dureeRestante,mensAct,totalFrais,nouvelleMens,baisse,gain,ecart, interessant:(gain>0&&ecart>=1&&dureeRestante>=120) }
}

const EMPTY = { type_credit:"PH", type_taux:"fixe", capital_initial:"", taux_actuel:"", date_debut:"", duree_mois:"", mensualite_actuelle:"", notes:"" }

// ===== FORMULAIRE (complète les données financières d'un contrat) =====
function CreditForm({ contrat, existingFin, onClose, onSave }) {
  const [form,setForm]=useState({ ...EMPTY, ...(existingFin||{}),
    type_credit: existingFin?.type_credit || (contrat.type_production==='Prêts Individuels'?'PAT':'PH') })
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState("")
  const set=(k,v)=>setForm(f=>({...f,[k]:v}))
  const save=async()=>{
    if(!form.capital_initial||!form.taux_actuel||!form.date_debut||!form.duree_mois){ setError("Capital, taux, date et durée obligatoires"); return }
    setSaving(true); setError("")
    try{
      const payload={ contrat_id:contrat.id, police:contrat.police, organisme:contrat.compagnie,
        type_credit:form.type_credit, type_taux:form.type_taux,
        capital_initial:Number(form.capital_initial), taux_actuel:Number(form.taux_actuel),
        date_debut:form.date_debut, duree_mois:Number(form.duree_mois),
        mensualite_actuelle:form.mensualite_actuelle?Number(form.mensualite_actuelle):null,
        notes:form.notes||null, actif:true, updated_at:new Date().toISOString() }
      if(existingFin?.id){ const {error:e}=await supabase.from("credits").update(payload).eq("id",existingFin.id); if(e)throw e }
      else { const {error:e}=await supabase.from("credits").insert(payload); if(e)throw e }
      onSave(); onClose()
    }catch(err){ setError("Erreur : "+(err.message||"")) }
    setSaving(false)
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:"#fff"}}>
          <div style={{fontSize:16,fontWeight:700,color:C.navy}}>Données financières du crédit</div>
          <div style={{fontSize:13,color:C.textL,marginTop:4}}>{contrat.prenom_client} {contrat.nom_client} — {contrat.compagnie} — {contrat.police}</div>
        </div>
        <div style={{padding:"20px 24px"}}>
          {error&&<div style={{background:"#FDECEA",border:"1px solid #F5C6CB",color:"#721C24",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13}}>{error}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div><label style={D.label}>Type</label><select style={D.input} value={form.type_credit} onChange={e=>set("type_credit",e.target.value)}><option value="PH">PH — Hypothécaire</option><option value="PAT">PAT — À tempérament</option></select></div>
            <div><label style={D.label}>Type de taux</label><select style={D.input} value={form.type_taux} onChange={e=>set("type_taux",e.target.value)}><option value="fixe">Fixe</option><option value="variable">Variable</option></select></div>
            <div><label style={D.label}>Capital initial (€)</label><input style={D.input} type="number" value={form.capital_initial} onChange={e=>set("capital_initial",e.target.value)} /></div>
            <div><label style={D.label}>Taux actuel (%)</label><input style={D.input} type="number" step="0.01" value={form.taux_actuel} onChange={e=>set("taux_actuel",e.target.value)} /></div>
            <div><label style={D.label}>Date de début</label><input style={D.input} type="date" value={form.date_debut} onChange={e=>set("date_debut",e.target.value)} /></div>
            <div><label style={D.label}>Durée (mois)</label><input style={D.input} type="number" value={form.duree_mois} onChange={e=>set("duree_mois",e.target.value)} placeholder="240" /></div>
            <div style={{gridColumn:"1/3"}}><label style={D.label}>Mensualité actuelle (€) — optionnel</label><input style={D.input} type="number" step="0.01" value={form.mensualite_actuelle} onChange={e=>set("mensualite_actuelle",e.target.value)} placeholder="calculée si vide" /></div>
          </div>
        </div>
        <div style={{padding:"16px 24px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end",gap:10,position:"sticky",bottom:0,background:"#fff"}}>
          <button style={D.btn("ghost")} onClick={onClose}>Annuler</button>
          <button style={D.btn("primary")} onClick={save} disabled={saving}>{saving?"...":"Enregistrer"}</button>
        </div>
      </div>
    </div>
  )
}

// tranche temps restant
function trancheRestant(mois){
  if(mois==null)return null
  const a=mois/12
  if(a<=1)return "1 an"; if(a<=2)return "2 ans"; if(a<=3)return "3 ans"; if(a<=4)return "4 ans"; if(a<=5)return "5 ans"
  if(a<=10)return "5-10 ans"; if(a<=15)return "10-15 ans"; if(a<=20)return "15-20 ans"; if(a<=25)return "20-25 ans"; return "+25 ans"
}

export default function CreditsView() {
  const [contrats,setContrats]=useState([])
  const [finMap,setFinMap]=useState({})   // contrat_id -> données financières
  const [taux,setTaux]=useState([])
  const [frais,setFrais]=useState({})
  const [loading,setLoading]=useState(true)
  const [fType,setFType]=useState("tous")
  const [fAnnee,setFAnnee]=useState("toutes")
  const [fRestant,setFRestant]=useState("tous")
  const [fInteressant,setFInteressant]=useState(false)
  const [edit,setEdit]=useState(null)

  const load=async()=>{
    setLoading(true)
    // 487 contrats de prêt, paginés (>1000 non nécessaire ici mais on sécurise)
    const {data:ctr}=await supabase.from("contrats").select("id,police,nom_client,prenom_client,compagnie,type_production,situation,date_creation").eq("domaine","Prêt").limit(2000)
    const [{data:fin},{data:tx},{data:fr}]=await Promise.all([
      supabase.from("credits").select("*").eq("actif",true).limit(2000),
      supabase.from("taux_reference").select("*").eq("actif",true),
      supabase.from("parametres_frais").select("*"),
    ])
    setContrats(ctr||[])
    const fm={}; (fin||[]).forEach(f=>{ if(f.contrat_id) fm[f.contrat_id]=f }); setFinMap(fm)
    setTaux(tx||[])
    const fo={}; (fr||[]).forEach(p=>{fo[p.cle]=Number(p.valeur)}); setFrais(fo)
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  // Enrichir chaque contrat
  const rows = contrats.map(ct=>{
    const fin=finMap[ct.id]
    const typeC = fin?.type_credit || (ct.type_production==='Prêts Individuels'?'PAT':(ct.type_production==='Leasing'?'Leasing':'PH'))
    const annee = ct.date_creation ? new Date(ct.date_creation).getFullYear() : null
    let a=null
    if(fin){
      const tm=tauxPour({...fin,capital_initial:Number(fin.capital_initial),taux_actuel:Number(fin.taux_actuel),duree_mois:Number(fin.duree_mois)},taux)
      a=analyser({...fin,capital_initial:Number(fin.capital_initial),taux_actuel:Number(fin.taux_actuel),duree_mois:Number(fin.duree_mois),mensualite_actuelle:fin.mensualite_actuelle?Number(fin.mensualite_actuelle):null},tm,frais)
    }
    return { ct, fin, typeC, annee, a, complet: !!fin }
  })

  const annees = [...new Set(rows.map(r=>r.annee).filter(Boolean))].sort((a,b)=>b-a)

  const filtres = rows.filter(r=>{
    if(fType!=="tous" && r.typeC!==fType) return false
    if(fAnnee!=="toutes" && String(r.annee)!==String(fAnnee)) return false
    if(fInteressant && !(r.a && r.a.interessant)) return false
    if(fRestant!=="tous"){
      if(!r.a) return false
      if(trancheRestant(r.a.dureeRestante)!==fRestant) return false
    }
    return true
  })

  const nbComplets = rows.filter(r=>r.complet).length
  const nbInteressants = rows.filter(r=>r.a&&r.a.interessant).length
  const gainPot = rows.filter(r=>r.a&&r.a.interessant).reduce((s,r)=>s+r.a.gain,0)

  if(loading) return <div style={{padding:40,textAlign:"center",color:C.textL}}>Chargement des crédits...</div>

  return (
    <div style={{fontFamily:"'Source Sans Pro', sans-serif"}}>
      {/* résumé */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
        <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Crédits total</div><div style={{fontSize:26,fontWeight:700,color:C.navy}}>{rows.length}</div></div>
        <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Données complétées</div><div style={{fontSize:26,fontWeight:700,color:C.navyMid}}>{nbComplets}</div></div>
        <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Intéressants à refinancer</div><div style={{fontSize:26,fontWeight:700,color:C.ok}}>{nbInteressants}</div></div>
        <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Gain potentiel</div><div style={{fontSize:22,fontWeight:700,color:C.ok}}>{fmtEUR(gainPot)}</div></div>
      </div>

      {/* filtres */}
      <div style={{display:"flex",gap:10,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <select style={{...D.input,width:"auto"}} value={fType} onChange={e=>setFType(e.target.value)}>
          <option value="tous">Tous types</option><option value="PH">PH</option><option value="PAT">PAT</option><option value="Leasing">Leasing</option>
        </select>
        <select style={{...D.input,width:"auto"}} value={fAnnee} onChange={e=>setFAnnee(e.target.value)}>
          <option value="toutes">Toutes années</option>
          {annees.map(a=><option key={a} value={a}>{a}</option>)}
        </select>
        <select style={{...D.input,width:"auto"}} value={fRestant} onChange={e=>setFRestant(e.target.value)}>
          <option value="tous">Tout temps restant</option>
          {["1 an","2 ans","3 ans","4 ans","5 ans","5-10 ans","10-15 ans","15-20 ans","20-25 ans","+25 ans"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:C.textM,cursor:"pointer"}}>
          <input type="checkbox" checked={fInteressant} onChange={e=>setFInteressant(e.target.checked)} /> Intéressants uniquement
        </label>
        <div style={{flex:1}} />
        <div style={{fontSize:12,color:C.textL}}>{filtres.length} crédit(s)</div>
      </div>

      {/* tableau */}
      <div style={{...D.card,padding:0,overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:C.bg,color:C.textM,textAlign:"left"}}>
            {["Client","Organisme","Type","Année","Cap. restant","Temps restant","Baisse/mois","Gain total","Statut",""].map(h=>(
              <th key={h} style={{padding:"10px 12px",fontWeight:600,whiteSpace:"nowrap",borderBottom:`1px solid ${C.border}`}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtres.map((r,idx)=>{
              const {ct,a,complet}=r
              const positif=a&&a.gain>0
              return (
                <tr key={ct.id||idx} style={{borderBottom:`1px solid ${C.border}`,background:a&&a.interessant?"#EAF7EC":"#fff"}}>
                  <td style={{padding:"10px 12px",fontWeight:600,color:C.navy}}>{ct.prenom_client} {ct.nom_client}</td>
                  <td style={{padding:"10px 12px"}}>{ct.compagnie}<div style={{fontSize:11,color:C.textL}}>{ct.police}</div></td>
                  <td style={{padding:"10px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:r.typeC==="PH"?"#E3F2FD":r.typeC==="PAT"?"#FFF3E0":"#EEE",color:r.typeC==="PH"?"#1565C0":r.typeC==="PAT"?"#E65100":"#666"}}>{r.typeC}</span></td>
                  <td style={{padding:"10px 12px"}}>{r.annee||"—"}</td>
                  <td style={{padding:"10px 12px"}}>{a?fmtEUR(a.capRest):"—"}</td>
                  <td style={{padding:"10px 12px",whiteSpace:"nowrap"}}>{a?fmtDuree(a.dureeRestante):"—"}</td>
                  <td style={{padding:"10px 12px",fontWeight:600,color:a?(a.baisse>0?C.ok:C.danger):C.textL}}>{a?(a.baisse>0?"−":"+")+fmtEUR2(Math.abs(a.baisse)):"—"}</td>
                  <td style={{padding:"10px 12px",fontWeight:700,color:a?(positif?C.ok:C.danger):C.textL}}>{a?(positif?"+":"")+fmtEUR(a.gain):"—"}</td>
                  <td style={{padding:"10px 12px"}}>{!complet?<span style={{color:C.warn,fontWeight:600}}>⚠ À compléter</span>:a&&a.interessant?<span style={{color:C.ok,fontWeight:600}}>✓ Intéressant</span>:<span style={{color:C.textL}}>—</span>}</td>
                  <td style={{padding:"10px 12px"}}><button style={D.btn("ghost")} onClick={()=>setEdit(r)}>{complet?"✏️":"Compléter"}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:11,color:C.textL,marginTop:10,fontStyle:"italic"}}>
        Calculs indicatifs d'aide à la décision. Les frais réels peuvent varier selon le dossier. Ne remplace pas un décompte officiel.
      </div>

      {edit && <CreditForm contrat={edit.ct} existingFin={edit.fin} onClose={()=>setEdit(null)} onSave={load} />}
    </div>
  )
}
