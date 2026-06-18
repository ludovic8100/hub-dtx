import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const C = { navy:"#1A3A6B", navyMid:"#1E5799", cyan:"#29ABE2", cyanB:"#00AEEF", bg:"#F4F6F9", white:"#FFFFFF", border:"#DDE3ED", textD:"#1A3A6B", textM:"#4A5568", textL:"#8A9BBE", ok:"#27AE60", warn:"#F39C12", danger:"#E74C3C" }
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  cardTitle:{ fontSize:11, fontWeight:700, color:C.textL, marginBottom:14, textTransform:"uppercase", letterSpacing:1 },
  table:{ width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:{ textAlign:"left", padding:"8px 12px", fontSize:11, fontWeight:700, color:C.textL, borderBottom:`1px solid ${C.border}`, textTransform:"uppercase", letterSpacing:.5 },
  td:{ padding:"10px 12px", borderBottom:`1px solid ${C.border}`, color:C.textM },
  input:{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 10px", color:C.textD, fontSize:13, outline:"none", boxSizing:"border-box" },
  btn:(v="primary")=>({ padding:"8px 16px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all 0.15s", border:"none", ...(v==="primary"?{ background:`linear-gradient(135deg,${C.cyan},${C.navyMid})`, color:"#fff" }:v==="ghost"?{ background:"transparent", color:C.navy, border:`1px solid ${C.border}` }:{ background:C.bg, color:C.textM, border:`1px solid ${C.border}` }) }),
  badge:(c)=>({ display:"inline-block", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:c+"18", color:c, textTransform:"uppercase" }),
  kpi:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:"18px 20px", boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  alertBox:(t="warn")=>({ background:t==="warn"?"#FEF3CD":t==="ok"?"#EAF7EC":"#FDECEA", border:`1px solid ${t==="warn"?"#F6D55C":t==="ok"?"#B2DFDB":"#F5C6CB"}`, borderRadius:8, padding:"10px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10, fontSize:13, color:t==="warn"?"#856404":t==="ok"?"#155724":"#721C24" }),
}
const MOIS_L = { "1":"Jan","2":"Fév","3":"Mar","4":"Avr","5":"Mai","6":"Jun","7":"Jul","8":"Aoû","9":"Sep","10":"Oct","11":"Nov","12":"Déc","01":"Jan","02":"Fév","03":"Mar","04":"Avr","05":"Mai","06":"Jun","07":"Jul","08":"Aoû","09":"Sep" }
const MOIS = ["01","02","03","04","05","06","07","08","09","10","11","12"]
const MOIS_FULL = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

export default function BordereauxView() {
  const [view, setView] = useState("quittances")
  const [qRows, setQRows] = useState([])
  const [bRows, setBRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMois, setFilterMois] = useState(String(new Date().getMonth()+1))
  const [filterAnnee, setFilterAnnee] = useState("2026")

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data: b } = await supabase.from("bordereaux").select("*").order("annee", { ascending: false }).order("mois").order("compagnie").limit(100000)
        setBRows(Array.isArray(b) ? b : [])
        const { data: q } = await supabase.from("quittances").select("compagnie,date_comptable,prime_totale,commission,commission_sa,sous_agent,compte_producteur").limit(100000)
        const qq = Array.isArray(q) ? q : []
        setQRows(qq)
        // Défaut : dernier mois de l'année sélectionnée ayant des quittances (évite l'onglet vide)
        const moisDispo = {}
        qq.forEach(r => { if (r.date_comptable) { const d = new Date(r.date_comptable); if (String(d.getFullYear()) === filterAnnee) moisDispo[d.getMonth()+1] = true } })
        const mois = Object.keys(moisDispo).map(Number).sort((a,b) => b-a)
        if (mois.length) setFilterMois(String(mois[0]))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const qAgg = useMemo(() => {
    const agg = {}
    for (const r of qRows) {
      if (!r.date_comptable) continue
      const d = new Date(r.date_comptable)
      const m = String(d.getMonth() + 1)
      const y = String(d.getFullYear())
      if (m !== filterMois || y !== filterAnnee) continue
      const cie = r.compagnie || "Inconnu"
      if (!agg[cie]) agg[cie] = { nb:0, primes:0, commission:0, commission_sa:0 }
      agg[cie].nb += 1
      agg[cie].primes += parseFloat(r.prime_totale) || 0
      agg[cie].commission += parseFloat(r.commission) || 0
      agg[cie].commission_sa += parseFloat(r.commission_sa) || 0
    }
    return Object.entries(agg).sort((a, b) => b[1].primes - a[1].primes)
  }, [qRows, filterMois, filterAnnee])

  const totQ = useMemo(() => qAgg.reduce((s, [, v]) => ({ primes:s.primes+v.primes, commission:s.commission+v.commission, commission_sa:s.commission_sa+v.commission_sa }), { primes:0, commission:0, commission_sa:0 }), [qAgg])

  const CIE_TYPES = { AG:"BQT+RCP",AXA:"BQT+RCP",AEDES:"BQT+RCP",APRIL:"BQT+RCP",ASSUDIS:"BQT+RCP",BALOISE:"BQT+RCP",AMMA:"BQT+RCP",VIVIUM:"BQT+RCP",DKV:"BQT+RCP",DAS:"BQT+RCP",ATHORA:"BQT+RCP",TVM:"BQT",RECORD:"RCP",ALPHACREDIT:"RCP",BNP:"RCP",CARES:"RCP",DELA:"RCP",MONUMENT:"RCP" }
  // Normalise : majuscules, sans espaces ni accents (pour matcher "ALPHA CREDIT" -> "ALPHACREDIT")
  const norm = (s) => (s || "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "")
  const normMois = (m) => String(parseInt(m, 10)).padStart(2, "0")
  // Année sélectionnée pour la matrice (réutilise filterAnnee)
  const idx = useMemo(() => {
    const m = {}
    bRows.forEach(r => {
      if (String(r.annee) !== String(filterAnnee)) return
      m[`${norm(r.compagnie)}-${normMois(r.mois)}-${norm(r.type)}`] = r
    })
    return m
  }, [bRows, filterAnnee])
  const alertes = useMemo(() => {
    const a = []
    Object.entries(CIE_TYPES).forEach(([cie, type]) => {
      if (type === "BQT+RCP" || type === "BQT") MOIS.slice(0,6).forEach(m => { if (!idx[`${norm(cie)}-${m}-BQT`]) a.push({ cie, mois:m, type:"BQT" }) })
      if (type === "BQT+RCP" || type === "RCP") MOIS.slice(0,6).forEach(m => { if (idx[`${norm(cie)}-${m}-BQT`] && !idx[`${norm(cie)}-${m}-RCP`]) a.push({ cie, mois:m, type:"RCP" }) })
    })
    return a
  }, [idx])

  const fmt = (n) => Number(n).toLocaleString("fr-BE", { minimumFractionDigits:2 }) + " €"

  // --- Réconciliation quittances ↔ bordereaux (par compagnie, mois sélectionné) ---
  const RST = {
    complet:     { l:"✅ Complet",          c:C.ok },
    a_reclamer:  { l:"💰 Bordereau à réclamer", c:C.warn },
    sans_quittance: { l:"📄 Bordereau sans quittance", c:C.cyanB },
  }
  const reconcil = useMemo(() => {
    const mm = normMois(filterMois)
    // 1) Agréger les quittances du mois par compagnie
    const byCie = {}
    for (const r of qRows) {
      if (!r.date_comptable) continue
      const d = new Date(r.date_comptable)
      if (String(d.getMonth()+1) !== filterMois || String(d.getFullYear()) !== filterAnnee) continue
      const cie = r.compagnie || "Inconnu"
      if (!byCie[cie]) byCie[cie] = { cie, nb:0, primes:0, commission:0, commission_sa:0 }
      byCie[cie].nb++
      byCie[cie].primes += parseFloat(r.prime_totale)||0
      byCie[cie].commission += parseFloat(r.commission)||0
      byCie[cie].commission_sa += parseFloat(r.commission_sa)||0
    }
    const rows = []
    const vus = new Set()
    for (const cie of Object.keys(byCie)) {
      const hasRcp = !!idx[`${norm(cie)}-${mm}-RCP`]
      const hasBqt = !!idx[`${norm(cie)}-${mm}-BQT`]
      const hasBord = hasRcp || hasBqt
      rows.push({ ...byCie[cie], hasRcp, hasBqt, statut: hasBord ? "complet" : "a_reclamer" })
      vus.add(norm(cie))
    }
    // 2) Bordereaux du mois sans quittances correspondantes
    bRows.forEach(b => {
      if (String(b.annee) !== filterAnnee || normMois(b.mois) !== mm) return
      if (vus.has(norm(b.compagnie))) return
      vus.add(norm(b.compagnie))
      rows.push({ cie:b.compagnie, nb:0, primes:0, commission:0, commission_sa:0, hasRcp:b.type==="RCP", hasBqt:b.type==="BQT", statut:"sans_quittance" })
    })
    return rows.sort((a,b) => b.commission - a.commission)
  }, [qRows, bRows, idx, filterMois, filterAnnee])

  const reconKpi = useMemo(() => ({
    nbCie: reconcil.filter(r=>r.nb>0).length,
    commission: reconcil.reduce((s,r)=>s+r.commission,0),
    commissionSa: reconcil.reduce((s,r)=>s+r.commission_sa,0),
    aReclamer: reconcil.filter(r=>r.statut==="a_reclamer").length,
  }), [reconcil])

  // Commissions par sous-agent (mois sélectionné) — calcul automatique
  const parSousAgent = useMemo(() => {
    const m = {}
    for (const r of qRows) {
      if (!r.date_comptable) continue
      const d = new Date(r.date_comptable)
      if (String(d.getMonth()+1) !== filterMois || String(d.getFullYear()) !== filterAnnee) continue
      const sa = (r.sous_agent || "").trim() || "(aucun)"
      if (!m[sa]) m[sa] = { sa, nb:0, commission_sa:0 }
      m[sa].nb++
      m[sa].commission_sa += parseFloat(r.commission_sa)||0
    }
    return Object.values(m).filter(x => x.commission_sa > 0).sort((a,b) => b.commission_sa - a.commission_sa)
  }, [qRows, filterMois, filterAnnee])

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.textL, fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement…</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      {/* Onglets */}
      <div style={{ display:"flex", gap:8, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        {[["quittances","💰 Quittances réelles"],["matrice","📊 Matrice BQT/RCP"],["reconciliation","🔗 Réconciliation"],["alertes",`⚠ Alertes (${alertes.length})`]].map(([k,l]) =>
          <button key={k} style={D.btn(view===k?"primary":"ghost")} onClick={() => setView(k)}>{l}</button>)}
      </div>

      {/* Quittances réelles */}
      {view === "quittances" && <div>
        <div style={{ ...D.card, padding:"12px 18px", marginBottom:12 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>Période :</span>
            <select style={{ ...D.input, width:"auto" }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
              {["1","2","3","4","5","6","7","8","9","10","11","12"].map((m,i) => <option key={m} value={m}>{MOIS_FULL[i]}</option>)}
            </select>
            <select style={{ ...D.input, width:"auto" }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
              {["2026","2025","2024"].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ marginLeft:"auto", fontSize:12, color:C.textL }}>{qAgg.length} compagnies · {qRows.filter(r => { if(!r.date_comptable) return false; const d=new Date(r.date_comptable); return String(d.getMonth()+1)===filterMois && String(d.getFullYear())===filterAnnee }).length.toLocaleString("fr-BE")} quittances</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
          {[
            { l:"Total primes", v:fmt(totQ.primes), c:C.navy },
            { l:"Commissions Dynassur", v:fmt(totQ.commission), c:C.cyanB },
            { l:"Commissions sous-agents", v:fmt(totQ.commission_sa), c:"#9B59B6" }
          ].map((k,i) => <div key={i} style={{ ...D.kpi, borderTop:`3px solid ${k.c}` }}>
            <div style={{ fontSize:22, fontWeight:700, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:11, color:C.textL, marginTop:3 }}>{k.l}</div>
          </div>)}
        </div>

        {qAgg.length === 0 ? (
          <div style={{ ...D.card, textAlign:"center", padding:40, color:C.textL }}>Aucune quittance pour cette période</div>
        ) : (
          <div style={D.card}>
            <div style={D.cardTitle}>Détail par compagnie — {MOIS_FULL[parseInt(filterMois)-1]} {filterAnnee}</div>
            <div style={{ overflowX:"auto" }}>
            <table style={D.table}><thead><tr style={{ background:C.bg }}>
              {["Compagnie","Quittances","Primes totales","Commission Dynassur","Commission SA","Taux net"].map(h =>
                <th key={h} style={{ ...D.th, textAlign:h==="Compagnie"?"left":"right" }}>{h}</th>)}
            </tr></thead><tbody>
              {qAgg.map(([cie, v], i) => {
                const tauxNet = v.primes > 0 ? (v.commission / v.primes * 100) : 0
                return <tr key={i} style={{ background:i%2?C.bg:"#fff" }}>
                  <td style={{ ...D.td, fontWeight:600, color:C.navy }}>{cie}</td>
                  <td style={{ ...D.td, textAlign:"right", color:C.textM }}>{v.nb.toLocaleString("fr-BE")}</td>
                  <td style={{ ...D.td, textAlign:"right", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fmt(v.primes)}</td>
                  <td style={{ ...D.td, textAlign:"right", color:C.ok, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fmt(v.commission)}</td>
                  <td style={{ ...D.td, textAlign:"right", color:"#9B59B6", fontVariantNumeric:"tabular-nums" }}>{fmt(v.commission_sa)}</td>
                  <td style={{ ...D.td, textAlign:"right", color:tauxNet>10?C.ok:tauxNet>5?C.warn:C.danger, fontWeight:600 }}>{tauxNet.toFixed(1)}%</td>
                </tr>
              })}
              <tr style={{ background:C.navy+"08", fontWeight:700, borderTop:`2px solid ${C.navy}` }}>
                <td style={{ ...D.td, fontWeight:700, color:C.navy }}>TOTAL</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700 }}>{qAgg.reduce((s,[,v])=>s+v.nb,0).toLocaleString("fr-BE")}</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700, color:C.navy }}>{fmt(totQ.primes)}</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700, color:C.ok }}>{fmt(totQ.commission)}</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700, color:"#9B59B6" }}>{fmt(totQ.commission_sa)}</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700, color:C.navy }}>{totQ.primes>0?(totQ.commission/totQ.primes*100).toFixed(1):0}%</td>
              </tr>
            </tbody></table>
            </div>
          </div>
        )}
      </div>}

      {/* Matrice BQT/RCP */}
      {view === "matrice" && <div>
        <div style={{ ...D.card, marginBottom:8 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>Année :</span>
            <select style={{ ...D.input, width:"auto" }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
              {["2026","2025","2024","2023","2022","2021","2020"].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ marginLeft:"auto", fontSize:12, color:C.textL }}>{Object.keys(idx).length} bordereau(x) trouvé(s) en {filterAnnee}</div>
          </div>
          <div style={{ fontSize:11, color:C.textL }}>● BQT reçu · ○ BQT manquant · ▲ RCP reçu · △ RCP manquant</div>
        </div>
        <div style={D.card}><div style={{ overflowX:"auto" }}>
          <table style={D.table}><thead><tr style={{ background:C.bg }}>
            <th style={D.th}>Compagnie</th><th style={D.th}>Type attendu</th>
            {MOIS.map(m => <th key={m} style={{ ...D.th, textAlign:"center" }}>{MOIS_L[m]}</th>)}
          </tr></thead><tbody>
            {Object.entries(CIE_TYPES).map(([name, type]) => (
              <tr key={name}>
                <td style={{ ...D.td, fontWeight:700, color:C.navy }}>{name}</td>
                <td style={D.td}><span style={D.badge(type==="RCP"?C.navyMid:C.cyanB)}>{type}</span></td>
                {MOIS.map(m => {
                  const bqt=idx[`${norm(name)}-${m}-BQT`]; const rcp=idx[`${norm(name)}-${m}-RCP`]
                  const hasBQT=type==="BQT+RCP"||type==="BQT"; const hasRCP=type==="BQT+RCP"||type==="RCP"
                  const ok=(!hasBQT||!!bqt)&&(!hasRCP||!!rcp)
                  return <td key={m} style={{ ...D.td, textAlign:"center", background:ok?"#EAF7EC":"#FDECEA", padding:"6px 4px" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:ok?C.ok:C.danger }}>
                      {hasBQT && <span title={bqt?`${Number(bqt.montant).toLocaleString("fr-BE")} €`:"manquant"}>{bqt?"●":"○"}</span>}
                      {hasBQT&&hasRCP&&" "}
                      {hasRCP && <span title={rcp?`${Number(rcp.montant).toLocaleString("fr-BE")} €`:"manquant"}>{rcp?"▲":"△"}</span>}
                    </span>
                  </td>
                })}
              </tr>
            ))}
          </tbody></table>
        </div></div>
      </div>}

      {/* Réconciliation quittances ↔ bordereaux */}
      {view === "reconciliation" && <div>
        <div style={{ ...D.card, padding:"12px 18px", marginBottom:12 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:600, color:C.navy }}>Période :</span>
            <select style={{ ...D.input, width:"auto" }} value={filterMois} onChange={e => setFilterMois(e.target.value)}>
              {["1","2","3","4","5","6","7","8","9","10","11","12"].map((m,i) => <option key={m} value={m}>{MOIS_FULL[i]}</option>)}
            </select>
            <select style={{ ...D.input, width:"auto" }} value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}>
              {["2026","2025","2024"].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ marginLeft:"auto", fontSize:12, color:C.textL }}>{reconcil.length} compagnie(s)</div>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
          {[
            { l:"Compagnies actives", v:reconKpi.nbCie, c:C.navy },
            { l:"Commission Dynassur", v:fmt(reconKpi.commission), c:C.ok, small:true },
            { l:"Commission sous-agents", v:fmt(reconKpi.commissionSa), c:"#9B59B6", small:true },
            { l:"Bordereaux à réclamer 💰", v:reconKpi.aReclamer, c:C.warn },
          ].map((k,i) => <div key={i} style={{ ...D.kpi, borderTop:`3px solid ${k.c}` }}>
            <div style={{ fontSize:k.small?16:22, fontWeight:700, color:k.c }}>{k.v}</div>
            <div style={{ fontSize:11, color:C.textL, marginTop:3 }}>{k.l}</div>
          </div>)}
        </div>

        {reconcil.length === 0 ? (
          <div style={{ ...D.card, textAlign:"center", padding:40, color:C.textL }}>Aucune donnée pour {MOIS_FULL[parseInt(filterMois)-1]} {filterAnnee}</div>
        ) : (
          <div style={{ ...D.card }}>
            <div style={D.cardTitle}>Réconciliation par compagnie — {MOIS_FULL[parseInt(filterMois)-1]} {filterAnnee}</div>
            <div style={{ overflowX:"auto" }}>
            <table style={D.table}><thead><tr style={{ background:C.bg }}>
              {["Compagnie","Polices","Prime","Comm. Dynassur","Comm. sous-agents","Bordereau","Statut"].map((h,i) =>
                <th key={h} style={{ ...D.th, textAlign:i>=1&&i<=4?"right":"left" }}>{h}</th>)}
            </tr></thead><tbody>
              {reconcil.map((r,i) => {
                const st = RST[r.statut] || RST.complet
                return <tr key={i} style={{ background:i%2?C.bg:"#fff" }}>
                  <td style={{ ...D.td, fontWeight:600, color:C.navy }}>{r.cie}</td>
                  <td style={{ ...D.td, textAlign:"right", color:C.textM }}>{r.nb || "—"}</td>
                  <td style={{ ...D.td, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{r.primes ? fmt(r.primes) : "—"}</td>
                  <td style={{ ...D.td, textAlign:"right", color:C.ok, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{r.commission ? fmt(r.commission) : "—"}</td>
                  <td style={{ ...D.td, textAlign:"right", color:"#9B59B6", fontVariantNumeric:"tabular-nums" }}>{r.commission_sa ? fmt(r.commission_sa) : "—"}</td>
                  <td style={D.td}>
                    {r.hasRcp && <span style={D.badge(C.navyMid)}>RCP</span>}
                    {r.hasBqt && <span style={{ ...D.badge(C.cyanB), marginLeft:4 }}>BQT</span>}
                    {!r.hasRcp && !r.hasBqt && <span style={{ color:C.danger, fontSize:12, fontWeight:700 }}>✗ aucun</span>}
                  </td>
                  <td style={D.td}><span style={D.badge(st.c)}>{st.l}</span></td>
                </tr>
              })}
            </tbody></table>
            </div>
          </div>
        )}

        {/* Commissions sous-agents (calcul automatique) */}
        {parSousAgent.length > 0 && (
          <div style={{ ...D.card, marginTop:16 }}>
            <div style={D.cardTitle}>💸 Commissions sous-agents à reverser — {MOIS_FULL[parseInt(filterMois)-1]} {filterAnnee}</div>
            <div style={{ overflowX:"auto" }}>
            <table style={D.table}><thead><tr style={{ background:C.bg }}>
              {["Sous-agent","Quittances","Commission à reverser"].map((h,i) =>
                <th key={h} style={{ ...D.th, textAlign:i===0?"left":"right" }}>{h}</th>)}
            </tr></thead><tbody>
              {parSousAgent.map((s,i) => (
                <tr key={i} style={{ background:i%2?C.bg:"#fff" }}>
                  <td style={{ ...D.td, fontWeight:600, color:C.navy }}>{s.sa}</td>
                  <td style={{ ...D.td, textAlign:"right", color:C.textM }}>{s.nb}</td>
                  <td style={{ ...D.td, textAlign:"right", color:"#9B59B6", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{fmt(s.commission_sa)}</td>
                </tr>
              ))}
              <tr style={{ background:"#9B59B608", fontWeight:700, borderTop:`2px solid #9B59B6` }}>
                <td style={{ ...D.td, fontWeight:700, color:C.navy }}>TOTAL</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700 }}>{parSousAgent.reduce((s,x)=>s+x.nb,0)}</td>
                <td style={{ ...D.td, textAlign:"right", fontWeight:700, color:"#9B59B6" }}>{fmt(parSousAgent.reduce((s,x)=>s+x.commission_sa,0))}</td>
              </tr>
            </tbody></table>
            </div>
          </div>
        )}
      </div>}

      {/* Alertes */}
      {view === "alertes" && <div style={D.card}>
        <div style={{ marginBottom:12, fontSize:13, color:C.textM }}>{alertes.length} bordereau(x) manquant(s) sur les 6 premiers mois 2026</div>
        {alertes.length === 0
          ? <div style={{ padding:20, textAlign:"center", color:C.ok, fontWeight:600 }}>✅ Tous les bordereaux attendus sont présents</div>
          : alertes.map((a,i) => <div key={i} style={D.alertBox("warn")}>
              <span style={{ fontSize:15 }}>⚠</span>
              <div style={{ flex:1 }}><strong>{a.cie}</strong> — {a.type} manquant · {MOIS_L[a.mois]} 2026</div>
            </div>)}
      </div>}
    </div>
  )
}
