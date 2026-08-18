import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const C = { navy:"#1A3A6B", navyMid:"#1E5799", cyan:"#29ABE2", bg:"#F4F6F9", white:"#FFFFFF", border:"#DDE3ED", textD:"#1A3A6B", textM:"#4A5568", textL:"#8A9BBE", ok:"#27AE60", warn:"#F39C12", danger:"#E74C3C" }
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  input:{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 10px", color:C.textD, fontSize:13, outline:"none", boxSizing:"border-box", width:"100%" },
  label:{ fontSize:11, fontWeight:600, color:C.textM, marginBottom:4, display:"block", textTransform:"uppercase", letterSpacing:"0.03em" },
  btn:(v="primary")=>({ padding:"8px 16px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, border:"none", ...(v==="primary"?{ background:`linear-gradient(135deg,${C.cyan},${C.navyMid})`, color:"#fff" }:v==="ghost"?{ background:"transparent", color:C.navy, border:`1px solid ${C.border}` }:{ background:C.bg, color:C.textM, border:`1px solid ${C.border}` }) }),
}

const fmtEUR = n => (n==null || isNaN(n)) ? "—" : new Intl.NumberFormat("fr-BE",{ style:"currency", currency:"EUR", maximumFractionDigits:0 }).format(n)
const fmtEUR2 = n => (n==null || isNaN(n)) ? "—" : new Intl.NumberFormat("fr-BE",{ style:"currency", currency:"EUR", maximumFractionDigits:2 }).format(n)
const fmtPct = n => (n==null || isNaN(n)) ? "—" : n.toFixed(2).replace(".",",")+" %"

// ============ MODULE DE CALCUL ============
function mensualite(capital, tauxAnnuelPct, dureeMois) {
  const i = (tauxAnnuelPct/100)/12
  if (i === 0) return capital/dureeMois
  return capital * i / (1 - Math.pow(1+i, -dureeMois))
}
function capitalRestant(capitalInitial, tauxAnnuelPct, dureeMois, mensPayees) {
  const i = (tauxAnnuelPct/100)/12
  const m = mensualite(capitalInitial, tauxAnnuelPct, dureeMois)
  if (i === 0) return capitalInitial - m*mensPayees
  const f = Math.pow(1+i, mensPayees)
  return capitalInitial*f - m*(f-1)/i
}
function moisEcoules(dateDebut) {
  const d = new Date(dateDebut), now = new Date()
  return Math.max(0, (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()))
}
function analyser(credit, tauxMarche, frais) {
  const ecoulees = moisEcoules(credit.date_debut)
  const dureeRestante = Math.max(0, credit.duree_mois - ecoulees)
  if (dureeRestante <= 0) return null
  const mensActuelle = credit.mensualite_actuelle || mensualite(credit.capital_initial, credit.taux_actuel, credit.duree_mois)
  const capRestant = Math.max(0, capitalRestant(credit.capital_initial, credit.taux_actuel, credit.duree_mois, ecoulees))
  const indemniteRemploi = capRestant * (credit.taux_actuel/100) * (frais.indemnite_remploi_mois/12)
  const mainlevee = credit.capital_initial * (frais.mainlevee_pct/100)
  const droitEnr = capRestant * (frais.droit_enregistrement_pct/100)
  const droitInscr = capRestant * (frais.droit_inscription_pct/100)
  const totalFrais = indemniteRemploi + mainlevee + droitEnr + droitInscr + frais.frais_dossier + frais.honoraires_notaire
  const nouveauCapital = capRestant + totalFrais
  const nouvelleMens = mensualite(nouveauCapital, tauxMarche, dureeRestante)
  const baisseMensualite = mensActuelle - nouvelleMens
  const gainTotal = (mensActuelle*dureeRestante) - (nouvelleMens*dureeRestante)
  const ecartTaux = credit.taux_actuel - tauxMarche
  const interessant = (gainTotal > 0) && (ecartTaux >= 1.0) && (dureeRestante >= 120)
  return { capRestant, dureeRestante, mensActuelle, totalFrais, indemniteRemploi, mainlevee, droitEnr, droitInscr, nouveauCapital, nouvelleMens, baisseMensualite, gainTotal, ecartTaux, interessant }
}

// choisir le bon taux de référence selon le crédit
function tauxPour(credit, taux) {
  if (credit.type_credit === 'PAT') return taux.find(t=>t.categorie==='PAT')?.taux ?? 7
  if (credit.type_taux === 'variable') return taux.find(t=>t.categorie==='PH_variable')?.taux ?? 4.15
  // PH fixe : selon durée restante
  const ecoulees = moisEcoules(credit.date_debut)
  const dureeRestanteAns = (credit.duree_mois - ecoulees)/12
  if (dureeRestanteAns > 10) return taux.find(t=>t.categorie==='PH_fixe_10plus')?.taux ?? 3.35
  return taux.find(t=>t.categorie==='PH_fixe_5_10')?.taux ?? 3.27
}

const EMPTY = { contrat_id:null, police:"", type_credit:"PH", organisme:"", capital_initial:"", taux_actuel:"", type_taux:"fixe", date_debut:"", duree_mois:"", mensualite_actuelle:"", notes:"", actif:true }

// ============ FORMULAIRE SAISIE ============
function CreditForm({ credit, onClose, onSave }) {
  const isNew = !credit.id
  const [form, setForm] = useState({ ...EMPTY, ...credit })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (k,v) => setForm(f=>({ ...f, [k]:v }))

  const save = async () => {
    if (!form.capital_initial || !form.taux_actuel || !form.date_debut || !form.duree_mois) {
      setError("Capital, taux, date de début et durée sont obligatoires"); return
    }
    setSaving(true); setError("")
    try {
      const payload = {
        contrat_id: form.contrat_id || null,
        police: form.police || null,
        type_credit: form.type_credit,
        organisme: form.organisme || null,
        capital_initial: Number(form.capital_initial),
        taux_actuel: Number(form.taux_actuel),
        type_taux: form.type_taux,
        date_debut: form.date_debut,
        duree_mois: Number(form.duree_mois),
        mensualite_actuelle: form.mensualite_actuelle ? Number(form.mensualite_actuelle) : null,
        notes: form.notes || null,
        actif: form.actif,
        updated_at: new Date().toISOString(),
      }
      if (isNew) {
        const { data, error:e } = await supabase.from("credits").insert(payload).select()
        if (e) throw e
        onSave(Array.isArray(data)?data[0]:data)
      } else {
        const { error:e } = await supabase.from("credits").update(payload).eq("id", form.id)
        if (e) throw e
        onSave({ ...form, ...payload })
      }
      onClose()
    } catch(err) { setError("Erreur sauvegarde : "+(err.message||"")) }
    setSaving(false)
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"#fff" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.navy }}>{isNew?"➕ Nouveau crédit":"✏️ Modifier le crédit"}</div>
          <button onClick={onClose} style={{ border:"none", background:C.bg, borderRadius:8, padding:"6px 10px", cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          {error && <div style={{ background:"#FDECEA", border:"1px solid #F5C6CB", color:"#721C24", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:13 }}>{error}</div>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div><label style={D.label}>Type</label>
              <select style={D.input} value={form.type_credit} onChange={e=>set("type_credit",e.target.value)}>
                <option value="PH">Prêt Hypothécaire (PH)</option>
                <option value="PAT">Prêt à Tempérament (PAT)</option>
              </select></div>
            <div><label style={D.label}>Type de taux</label>
              <select style={D.input} value={form.type_taux} onChange={e=>set("type_taux",e.target.value)}>
                <option value="fixe">Fixe</option>
                <option value="variable">Variable</option>
              </select></div>
            <div><label style={D.label}>Organisme</label><input style={D.input} value={form.organisme} onChange={e=>set("organisme",e.target.value)} placeholder="RECORD BANK..." /></div>
            <div><label style={D.label}>N° Police</label><input style={D.input} value={form.police} onChange={e=>set("police",e.target.value)} /></div>
            <div><label style={D.label}>Capital initial (€)</label><input style={D.input} type="number" value={form.capital_initial} onChange={e=>set("capital_initial",e.target.value)} /></div>
            <div><label style={D.label}>Taux actuel (%)</label><input style={D.input} type="number" step="0.01" value={form.taux_actuel} onChange={e=>set("taux_actuel",e.target.value)} /></div>
            <div><label style={D.label}>Date de début</label><input style={D.input} type="date" value={form.date_debut} onChange={e=>set("date_debut",e.target.value)} /></div>
            <div><label style={D.label}>Durée (mois)</label><input style={D.input} type="number" value={form.duree_mois} onChange={e=>set("duree_mois",e.target.value)} placeholder="240" /></div>
            <div><label style={D.label}>Mensualité actuelle (€) <span style={{fontWeight:400,textTransform:"none"}}>— optionnel</span></label><input style={D.input} type="number" step="0.01" value={form.mensualite_actuelle} onChange={e=>set("mensualite_actuelle",e.target.value)} placeholder="calculée si vide" /></div>
          </div>
          <div style={{ marginTop:14 }}><label style={D.label}>Notes</label><textarea style={{...D.input, minHeight:60, resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} /></div>
        </div>
        <div style={{ padding:"16px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end", gap:10, position:"sticky", bottom:0, background:"#fff" }}>
          <button style={D.btn("ghost")} onClick={onClose}>Annuler</button>
          <button style={D.btn("primary")} onClick={save} disabled={saving}>{saving?"...":"Enregistrer"}</button>
        </div>
      </div>
    </div>
  )
}

// ============ COMPOSANT PRINCIPAL ============
export default function CreditsView() {
  const [tab, setTab] = useState("analyse")
  const [credits, setCredits] = useState([])
  const [taux, setTaux] = useState([])
  const [frais, setFrais] = useState({})
  const [loading, setLoading] = useState(true)
  const [filtreInteressant, setFiltreInteressant] = useState(false)
  const [filtreType, setFiltreType] = useState("tous")
  const [editCredit, setEditCredit] = useState(null)

  const load = async () => {
    setLoading(true)
    const [cr, tx, fr] = await Promise.all([
      supabase.from("credits").select("*").eq("actif", true).order("created_at",{ascending:false}),
      supabase.from("taux_reference").select("*").eq("actif", true),
      supabase.from("parametres_frais").select("*"),
    ])
    setCredits(cr.data || [])
    setTaux(tx.data || [])
    const fobj = {}; (fr.data||[]).forEach(p=>{ fobj[p.cle] = Number(p.valeur) })
    setFrais(fobj)
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  const analyses = credits.map(c => {
    const tm = tauxPour(c, taux)
    const a = analyser({ ...c, capital_initial:Number(c.capital_initial), taux_actuel:Number(c.taux_actuel), duree_mois:Number(c.duree_mois), mensualite_actuelle:c.mensualite_actuelle?Number(c.mensualite_actuelle):null }, tm, frais)
    return { credit:c, tauxMarche:tm, a }
  }).filter(x => x.a)

  const filtres = analyses.filter(x => {
    if (filtreType !== "tous" && x.credit.type_credit !== filtreType) return false
    if (filtreInteressant && !x.a.interessant) return false
    return true
  })

  const nbInteressants = analyses.filter(x=>x.a.interessant).length
  const gainPotentiel = analyses.filter(x=>x.a.interessant).reduce((s,x)=>s+x.a.gainTotal,0)

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.textL }}>Chargement...</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      {/* Onglets */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["analyse","Analyse refinancement"],["params","Taux & frais"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{ ...D.btn(tab===k?"primary":"ghost"), padding:"9px 18px" }}>{l}</button>
        ))}
        <div style={{ flex:1 }} />
        <button style={D.btn("primary")} onClick={()=>setEditCredit(EMPTY)}>➕ Nouveau crédit</button>
      </div>

      {tab === "analyse" && (
        <>
          {/* Cartes résumé */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:16 }}>
            <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Crédits analysés</div><div style={{fontSize:26,fontWeight:700,color:C.navy}}>{analyses.length}</div></div>
            <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Refinancements intéressants</div><div style={{fontSize:26,fontWeight:700,color:C.ok}}>{nbInteressants}</div></div>
            <div style={D.card}><div style={{fontSize:12,color:C.textL,marginBottom:6}}>Gain potentiel total</div><div style={{fontSize:26,fontWeight:700,color:C.ok}}>{fmtEUR(gainPotentiel)}</div></div>
          </div>

          {/* Filtres */}
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
            <select style={{...D.input, width:"auto"}} value={filtreType} onChange={e=>setFiltreType(e.target.value)}>
              <option value="tous">Tous types</option>
              <option value="PH">PH uniquement</option>
              <option value="PAT">PAT uniquement</option>
            </select>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.textM, cursor:"pointer" }}>
              <input type="checkbox" checked={filtreInteressant} onChange={e=>setFiltreInteressant(e.target.checked)} />
              Intéressants uniquement
            </label>
          </div>

          {/* Tableau */}
          {filtres.length === 0 ? (
            <div style={{ ...D.card, textAlign:"center", color:C.textL, padding:40 }}>
              {credits.length === 0 ? "Aucun crédit encodé. Cliquez sur « Nouveau crédit » pour commencer." : "Aucun crédit ne correspond aux filtres."}
            </div>
          ) : (
            <div style={{ ...D.card, padding:0, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead><tr style={{ background:C.bg, color:C.textM, textAlign:"left" }}>
                  {["Organisme","Type","Capital restant","Durée rest.","Mens. actuelle","Nouv. mens.","Baisse/mois","Gain total","Statut",""].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", fontWeight:600, whiteSpace:"nowrap", borderBottom:`1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtres.map(({credit,a})=>{
                    const positif = a.gainTotal > 0
                    return (
                      <tr key={credit.id} style={{ borderBottom:`1px solid ${C.border}`, background: a.interessant ? "#EAF7EC" : "#fff" }}>
                        <td style={{ padding:"10px 12px", fontWeight:600, color:C.navy }}>{credit.organisme||"—"}<div style={{fontSize:11,color:C.textL,fontWeight:400}}>{credit.police}</div></td>
                        <td style={{ padding:"10px 12px" }}><span style={{ fontSize:11, padding:"2px 8px", borderRadius:12, background:credit.type_credit==="PH"?"#E3F2FD":"#FFF3E0", color:credit.type_credit==="PH"?"#1565C0":"#E65100" }}>{credit.type_credit}</span></td>
                        <td style={{ padding:"10px 12px" }}>{fmtEUR(a.capRestant)}</td>
                        <td style={{ padding:"10px 12px" }}>{Math.round(a.dureeRestante/12*10)/10} ans</td>
                        <td style={{ padding:"10px 12px" }}>{fmtEUR2(a.mensActuelle)}</td>
                        <td style={{ padding:"10px 12px" }}>{fmtEUR2(a.nouvelleMens)}</td>
                        <td style={{ padding:"10px 12px", fontWeight:600, color: a.baisseMensualite>0?C.ok:C.danger }}>{a.baisseMensualite>0?"−":"+"}{fmtEUR2(Math.abs(a.baisseMensualite))}</td>
                        <td style={{ padding:"10px 12px", fontWeight:700, color: positif?C.ok:C.danger }}>{positif?"+":""}{fmtEUR(a.gainTotal)}</td>
                        <td style={{ padding:"10px 12px" }}>{a.interessant ? <span style={{color:C.ok,fontWeight:600}}>✓ Intéressant</span> : <span style={{color:C.textL}}>—</span>}</td>
                        <td style={{ padding:"10px 12px" }}><button style={D.btn("ghost")} onClick={()=>setEditCredit(credit)}>✏️</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ fontSize:11, color:C.textL, marginTop:10, fontStyle:"italic" }}>
            Calculs indicatifs d'aide à la décision. Les frais réels (notaire, indemnités) peuvent varier selon le dossier. Ne remplace pas un décompte officiel.
          </div>
        </>
      )}

      {tab === "params" && (
        <ParamsTab taux={taux} frais={frais} onReload={load} />
      )}

      {editCredit && <CreditForm credit={editCredit} onClose={()=>setEditCredit(null)} onSave={()=>load()} />}
    </div>
  )
}

// ============ ONGLET PARAMÈTRES ============
function ParamsTab({ taux, frais, onReload }) {
  const [savingT, setSavingT] = useState(null)
  const [localTaux, setLocalTaux] = useState(taux)
  useEffect(()=>{ setLocalTaux(taux) }, [taux])

  const saveTaux = async (id, val) => {
    setSavingT(id)
    await supabase.from("taux_reference").update({ taux:Number(val), date_maj:new Date().toISOString().slice(0,10) }).eq("id", id)
    setSavingT(null); onReload()
  }

  return (
    <div>
      <div style={D.card}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:14 }}>Taux de référence marché (BNB)</div>
        <div style={{ fontSize:12, color:C.textL, marginBottom:14 }}>Mets à jour ces taux chaque mois selon les données BNB ou tes tableaux fournisseurs.</div>
        {localTaux.map(t=>(
          <div key={t.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ flex:1, fontSize:13, color:C.textD }}>{t.libelle}</div>
            <input style={{...D.input, width:100}} type="number" step="0.01" defaultValue={t.taux} onBlur={e=>{ if(Number(e.target.value)!==Number(t.taux)) saveTaux(t.id, e.target.value) }} />
            <span style={{ fontSize:12, color:C.textL }}>%</span>
            <span style={{ fontSize:11, color:C.textL, width:90 }}>{savingT===t.id?"...":`maj ${t.date_maj||""}`}</span>
          </div>
        ))}
      </div>
      <div style={D.card}>
        <div style={{ fontSize:15, fontWeight:700, color:C.navy, marginBottom:14 }}>Paramètres de frais de refinancement</div>
        {Object.entries(frais).map(([k,v])=>(
          <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
            <span style={{ color:C.textM }}>{k}</span><span style={{ fontWeight:600, color:C.navy }}>{v}</span>
          </div>
        ))}
        <div style={{ fontSize:11, color:C.textL, marginTop:10, fontStyle:"italic" }}>Modification des frais via la base pour l'instant (édition inline à venir).</div>
      </div>
    </div>
  )
}
