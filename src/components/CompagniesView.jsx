import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const C = { navy:"#1A3A6B", navyMid:"#1E5799", cyan:"#29ABE2", cyanB:"#00AEEF", bg:"#F4F6F9", white:"#FFFFFF", border:"#DDE3ED", textD:"#1A3A6B", textM:"#4A5568", textL:"#8A9BBE", ok:"#27AE60", warn:"#F39C12", danger:"#E74C3C" }
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  input:{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 10px", color:C.textD, fontSize:13, outline:"none", boxSizing:"border-box" },
  btn:(v="primary")=>({ padding:"8px 16px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all 0.15s", border:"none", ...(v==="primary"?{ background:`linear-gradient(135deg,${C.cyan},${C.navyMid})`, color:"#fff" }:v==="ghost"?{ background:"transparent", color:C.navy, border:`1px solid ${C.border}` }:{ background:C.bg, color:C.textM, border:`1px solid ${C.border}` }) }),
  alertBox:(t="warn")=>({ background:t==="warn"?"#FEF3CD":t==="ok"?"#EAF7EC":"#FDECEA", border:`1px solid ${t==="warn"?"#F6D55C":t==="ok"?"#B2DFDB":"#F5C6CB"}`, borderRadius:8, padding:"10px 14px", marginBottom:8, fontSize:13, color:t==="warn"?"#856404":t==="ok"?"#155724":"#721C24" }),
}
const EMPTY_CIE = { code:"", nom:"", nom_court:"", logo_url:"", couleur:"#1A3A6B", site_web:"", email_contact:"", telephone:"", actif:true, notes:"" }

function CieFormModal({ cie, comptes = [], onClose, onSave }) {
  const isNew = !cie.id
  const [form, setForm] = useState({ ...cie })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.code || !form.nom) { setError("Code et nom obligatoires"); return }
    setSaving(true); setError("")
    try {
      const payload = { ...form, updated_at: new Date().toISOString() }
      if (isNew) {
        const { data, error:e } = await supabase.from("compagnies").insert({ ...payload, created_at:new Date().toISOString() }).select()
        if (e) throw e
        onSave(Array.isArray(data) ? data[0] : data)
      } else {
        const { error:e } = await supabase.from("compagnies").update(payload).eq("id", form.id)
        if (e) throw e
        onSave(form)
      }
      onClose()
    } catch { setError("Erreur lors de la sauvegarde") }
    setSaving(false)
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Source Sans Pro', sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#fff", borderRadius:"16px 16px 0 0" }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.navy }}>{isNew ? "➕ Nouvelle compagnie" : `✏️ ${cie.nom}`}</div>
          <button onClick={onClose} style={{ border:"none", background:C.bg, borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"20px 24px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:20, padding:"16px", background:C.bg, borderRadius:10 }}>
            <div style={{ width:72, height:72, borderRadius:12, background:form.logo_url?"transparent":form.couleur+"30", border:`2px solid ${form.couleur||C.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
              {form.logo_url
                ? <img src={form.logo_url} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt={form.code} />
                : <span style={{ fontSize:22, fontWeight:800, color:form.couleur||C.navy }}>{(form.code||"?").slice(0,3)}</span>}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.navy, marginBottom:6 }}>Logo de la compagnie</div>
              <input style={{ ...D.input, width:"100%" }} placeholder="URL du logo (https://…)" value={form.logo_url||""} onChange={e => set("logo_url", e.target.value)} />
            </div>
          </div>

          {/* Comptes producteurs */}
          <div style={{ marginBottom:16, padding:"14px 16px", background:C.bg, borderRadius:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>
              {comptes.length} compte{comptes.length>1?"s":""} producteur{comptes.length>1?"s":""}
            </div>
            {comptes.length === 0 ? (
              <div style={{ fontSize:12, color:C.danger, fontWeight:600 }}>⚠ Aucun numéro de producteur — non ouvert chez cette compagnie</div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {comptes.map((p,j) => (
                  <span key={j} style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:6, background:"#fff", border:`1px solid ${C.border}`, color:C.navy }} title={p.fsma?`FSMA ${p.fsma}`:""}>{p.numero_producteur}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Code *</label>
              <input style={{ ...D.input, width:"100%", textTransform:"uppercase" }} placeholder="AG" value={form.code||""} onChange={e => set("code", e.target.value.toUpperCase())} disabled={!isNew} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Nom complet *</label>
              <input style={{ ...D.input, width:"100%" }} placeholder="AG Insurance" value={form.nom||""} onChange={e => set("nom", e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Nom court</label>
              <input style={{ ...D.input, width:"100%" }} placeholder="AG" value={form.nom_court||""} onChange={e => set("nom_court", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Couleur</label>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <input type="color" value={form.couleur||"#1A3A6B"} onChange={e => set("couleur", e.target.value)} style={{ width:40, height:36, border:`1px solid ${C.border}`, borderRadius:6, cursor:"pointer", padding:2 }} />
                <input style={{ ...D.input, flex:1 }} value={form.couleur||"#1A3A6B"} onChange={e => set("couleur", e.target.value)} />
              </div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Site web</label>
              <input style={{ ...D.input, width:"100%" }} placeholder="https://www.ag.be" value={form.site_web||""} onChange={e => set("site_web", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Email contact</label>
              <input style={{ ...D.input, width:"100%" }} placeholder="contact@ag.be" value={form.email_contact||""} onChange={e => set("email_contact", e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Téléphone</label>
            <input style={{ ...D.input, width:"100%" }} placeholder="+32 2 ..." value={form.telephone||""} onChange={e => set("telephone", e.target.value)} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Notes internes</label>
            <textarea style={{ ...D.input, width:"100%", minHeight:60, resize:"vertical" }} placeholder="Notes..." value={form.notes||""} onChange={e => set("notes", e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>Statut</label>
            <select style={{ ...D.input, width:"auto" }} value={form.actif?"1":"0"} onChange={e => set("actif", e.target.value==="1")}>
              <option value="1">✅ Active</option>
              <option value="0">🔴 Inactive</option>
            </select>
          </div>

          {error && <div style={{ ...D.alertBox("danger"), marginTop:12 }}>{error}</div>}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
            <button onClick={onClose} style={D.btn("ghost")}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={D.btn("primary")}>{saving ? "Sauvegarde…" : isNew ? "✅ Créer" : "✅ Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CompagniesView() {
  const [cies, setCies] = useState([])
  const [producteurs, setProducteurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState("")

  useEffect(() => { loadCies() }, [])

  const loadCies = async () => {
    setLoading(true)
    const { data } = await supabase.from("compagnies").select("*").order("nom")
    setCies(Array.isArray(data) ? data : [])
    const { data: prod } = await supabase.from("producteurs").select("*").order("compagnie_nom")
    setProducteurs(Array.isArray(prod) ? prod : [])
    setLoading(false)
  }

  // Normalise pour matcher compagnies.nom <-> producteurs.compagnie_nom
  const norm = (s) => (s || "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "")
  const comptesDe = (cie) => {
    const cibles = [norm(cie.nom), norm(cie.nom_court), norm(cie.code)].filter(Boolean)
    return producteurs.filter(p => {
      const pn = norm(p.compagnie_nom)
      return cibles.some(c => c && (pn === c || pn.startsWith(c) || c.startsWith(pn)))
    })
  }

  const handleSave = (saved) => {
    setCies(prev => {
      const exists = prev.find(c => c.id === saved.id)
      if (exists) return prev.map(c => c.id === saved.id ? saved : c)
      return [...prev, saved].sort((a,b) => (a.nom||"").localeCompare(b.nom||""))
    })
  }

  const filtered = cies.filter(c => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    if ((c.nom||"").toLowerCase().includes(q)) return true
    if ((c.code||"").toLowerCase().includes(q)) return true
    // Recherche sur les numéros de producteurs
    if (comptesDe(c).some(p => (p.numero_producteur||"").toLowerCase().includes(q))) return true
    return false
  })

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.textL, fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement…</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      <div style={{ ...D.card, padding:"14px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.navy }}>{cies.length} compagnie{cies.length>1?"s":""}</div>
          <input style={{ ...D.input, flex:1, maxWidth:280 }} placeholder="🔍 Compagnie, code ou n° producteur..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={{ ...D.btn("primary"), marginLeft:"auto" }} onClick={() => setModal({ ...EMPTY_CIE })}>➕ Nouvelle compagnie</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:12 }}>
        {filtered.map(c => {
          const comptes = comptesDe(c)
          const ouvert = comptes.length > 0
          return (
          <div key={c.id} style={{ ...D.card, marginBottom:0, padding:0, overflow:"hidden", opacity:c.actif?1:0.5, cursor:"pointer", transition:"transform 0.15s, box-shadow 0.15s", border: ouvert?`1px solid ${C.border}`:`1px solid #F5C6CB` }}
            onClick={() => setModal({ ...c })}
            onMouseOver={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.12)" }}
            onMouseOut={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="" }}>
            <div style={{ height:6, background:c.couleur||C.navy }} />
            <div style={{ padding:"16px 16px 12px" }}>
              <div style={{ width:52, height:52, borderRadius:10, background:c.logo_url?"transparent":(c.couleur||C.navy)+"20", border:`2px solid ${c.couleur||C.border}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10, overflow:"hidden" }}>
                {c.logo_url
                  ? <img src={c.logo_url} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt={c.code} />
                  : <span style={{ fontSize:16, fontWeight:800, color:c.couleur||C.navy }}>{(c.code||"?").slice(0,3)}</span>}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:C.navy, marginBottom:2 }}>{c.nom}</div>
              <div style={{ fontSize:11, color:C.textL, marginBottom:8 }}>{c.code}</div>
              {/* Comptes producteurs */}
              {ouvert ? (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:C.textL, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>{comptes.length} compte{comptes.length>1?"s":""} producteur{comptes.length>1?"s":""}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {comptes.slice(0,6).map((p,j) => (
                      <span key={j} style={{ fontSize:10, fontWeight:600, padding:"2px 6px", borderRadius:5, background:(c.couleur||C.navy)+"14", color:c.couleur||C.navy }}>{p.numero_producteur}</span>
                    ))}
                    {comptes.length>6 && <span style={{ fontSize:10, color:C.textL, padding:"2px 4px" }}>+{comptes.length-6}</span>}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize:11, fontWeight:700, color:C.danger }}>⚠ Aucun n° producteur</div>
              )}
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, padding:"6px 16px", background: ouvert?C.bg:"#FDECEA", fontSize:11, color:C.textL, display:"flex", justifyContent:"space-between" }}>
              <span>{c.actif ? "✅ Active" : "🔴 Inactive"}</span>
              <span style={{ color:C.cyanB }}>✏️ Modifier</span>
            </div>
          </div>
        )})}
      </div>

      {modal && <CieFormModal cie={modal} comptes={comptesDe(modal)} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}
