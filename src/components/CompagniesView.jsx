import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

import { LOGOS_URL as STORAGE_BASE } from '../config/env'

// Liste des fichiers présents dans le bucket logos (fallback si le listing Storage est bloqué)
const LOGOS_CONNUS = [
  "ag.jpg","ARAG.png","ARDENNE.jpg","ATHORA.jpg","AVIZA.png","AXA.jpg","baloise.jpg",
  "bnp.bmp","CARDIF.jpg","DAS.jpg","DELA.jpg","DKV.jpg","dtx.png","Dynassur.jpg",
  "DYNASSUR_bouclier_22.png","Dynassur_logo.png","EA.PSD","eb-lease.bmp","elantis.bmp",
  "EUROMEX.jpg","GENERALI.png","lode.png","Logo_blanc.png","logo_prive.svg","NN.png",
  "TVM.jpg","VIVIUM.jpg","X_LOGO.png",
].sort((a,b)=>a.localeCompare(b))

const C = { navy:"#1A3A6B", navyMid:"#1E5799", cyan:"#29ABE2", cyanB:"#00AEEF", bg:"#F4F6F9", white:"#FFFFFF", border:"#DDE3ED", textD:"#1A3A6B", textM:"#4A5568", textL:"#8A9BBE", ok:"#27AE60", warn:"#F39C12", danger:"#E74C3C" }
const D = {
  card:{ background:C.white, border:`1px solid ${C.border}`, borderRadius:10, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(26,58,107,0.06)" },
  input:{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 10px", color:C.textD, fontSize:13, outline:"none", boxSizing:"border-box" },
  btn:(v="primary")=>({ padding:"8px 16px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:600, transition:"all 0.15s", border:"none", ...(v==="primary"?{ background:`linear-gradient(135deg,${C.cyan},${C.navyMid})`, color:"#fff" }:v==="ghost"?{ background:"transparent", color:C.navy, border:`1px solid ${C.border}` }:{ background:C.bg, color:C.textM, border:`1px solid ${C.border}` }) }),
  alertBox:(t="warn")=>({ background:t==="warn"?"#FEF3CD":t==="ok"?"#EAF7EC":"#FDECEA", border:`1px solid ${t==="warn"?"#F6D55C":t==="ok"?"#B2DFDB":"#F5C6CB"}`, borderRadius:8, padding:"10px 14px", marginBottom:8, fontSize:13, color:t==="warn"?"#856404":t==="ok"?"#155724":"#721C24" }),
}
const EMPTY_CIE = { code:"", nom:"", nom_court:"", numero:"", logo_url:"", couleur:"#1A3A6B", site_web:"", email_contact:"", telephone:"", actif:true, attend_bqt:true, attend_rcp:true, notes:"" }

const STATUT_PROD = {
  actif:   { label:"Actif",    couleur:"#27AE60" },
  runoff:  { label:"Run-off",  couleur:"#F39C12" },
  cloture: { label:"Clôturé",  couleur:"#8A9BBE" },
}

function CieFormModal({ cie, comptes = [], logos = [], onClose, onSave, onDelete, onAddProd, onSetStatut, onSetDescriptif, onDelProd }) {
  const isNew = !cie.id
  const [form, setForm] = useState({ ...cie })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [newProd, setNewProd] = useState({ numero:"", fsma:"", descriptif:"" })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const ajouterProd = async () => {
    if (!newProd.numero.trim()) return
    await onAddProd({ id: form.id, nom: form.nom }, newProd.numero.trim(), newProd.fsma.trim(), newProd.descriptif.trim())
    setNewProd({ numero:"", fsma:"", descriptif:"" })
  }
  const supprimerCie = async () => {
    if (comptes.length > 0) { setError("Cette compagnie a des numéros de producteur : désactive-la plutôt que la supprimer."); return }
    if (!window.confirm(`Supprimer définitivement « ${form.nom} » ?`)) return
    await onDelete(form.id); onClose()
  }

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
            {(() => {
              const apercu = form.logo_url ? (form.logo_url.startsWith("http") ? form.logo_url : STORAGE_BASE + encodeURIComponent(form.logo_url)) : null
              return (
            <div style={{ width:72, height:72, borderRadius:12, background:apercu?"#fff":form.couleur+"30", border:`2px solid ${form.couleur||C.border}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
              {apercu
                ? <img src={apercu} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt={form.code} />
                : <span style={{ fontSize:22, fontWeight:800, color:form.couleur||C.navy }}>{(form.code||"?").slice(0,3)}</span>}
            </div>
              )})()}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.navy, marginBottom:6 }}>Logo de la compagnie</div>
              <select style={{ ...D.input, width:"100%" }} value={form.logo_url && !form.logo_url.startsWith("http") ? form.logo_url : ""} onChange={e => set("logo_url", e.target.value)}>
                <option value="">— Choisir un fichier dans le bucket —</option>
                {[...logos].sort((a,b)=>a.localeCompare(b)).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {form.logo_url && <button style={{ marginTop:6, fontSize:11, background:"none", border:"none", color:C.danger, cursor:"pointer", padding:0 }} onClick={() => set("logo_url", "")}>🗑 Retirer le logo</button>}
            </div>
          </div>

          {/* Comptes producteurs */}
          <div style={{ marginBottom:16, padding:"14px 16px", background:C.bg, borderRadius:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.textL, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>
              {comptes.length} numéro{comptes.length>1?"s":""} de producteur
            </div>
            {isNew ? (
              <div style={{ fontSize:12, color:C.textM }}>Enregistre d'abord la compagnie pour lui ajouter des numéros de producteur.</div>
            ) : (
              <>
                {comptes.length === 0 && <div style={{ fontSize:12, color:C.danger, fontWeight:600, marginBottom:8 }}>⚠ Aucun numéro de producteur</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {comptes.map(p => {
                    const st = STATUT_PROD[p.statut] || STATUT_PROD.actif
                    return (
                    <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 8px" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:C.navy, fontFamily:"monospace" }}>{p.numero_producteur}</span>
                      {p.fsma && <span style={{ fontSize:10, color:C.textL }}>FSMA {p.fsma}</span>}
                      {/* À quoi sert ce compte : AG en a cinq, Record un PAT et un PH. */}
                      <input defaultValue={p.descriptif || ""} placeholder="À quoi sert ce compte ? (PH, PAT, portefeuille…)"
                        onBlur={e => { const v = e.target.value.trim(); if (v !== (p.descriptif || "")) onSetDescriptif(p.id, v) }}
                        style={{ ...D.input, flex:1, minWidth:120, fontSize:12, padding:"4px 8px" }} />
                      <select value={p.statut||"actif"} onChange={e => onSetStatut(p.id, e.target.value)}
                        style={{ border:"none", borderRadius:5, padding:"2px 6px", fontSize:11, fontWeight:600, cursor:"pointer", color:"#fff", background:st.couleur }}>
                        <option value="actif" style={{ color:"#000", background:"#fff" }}>Actif</option>
                        <option value="runoff" style={{ color:"#000", background:"#fff" }}>Run-off</option>
                        <option value="cloture" style={{ color:"#000", background:"#fff" }}>Clôturé</option>
                      </select>
                      <button onClick={() => window.confirm(`Supprimer le n° ${p.numero_producteur} ?`) && onDelProd(p.id)}
                        style={{ border:"none", background:"none", color:C.danger, cursor:"pointer", fontSize:14, padding:0 }} title="Supprimer">🗑</button>
                    </div>
                  )})}
                </div>
                <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                  <input style={{ ...D.input, width:150 }} placeholder="Nouveau n° producteur" value={newProd.numero} onChange={e => setNewProd(n => ({ ...n, numero:e.target.value }))} />
                  <input style={{ ...D.input, width:90 }} placeholder="FSMA" value={newProd.fsma} onChange={e => setNewProd(n => ({ ...n, fsma:e.target.value }))} />
                  <input style={{ ...D.input, flex:1, minWidth:140 }} placeholder="Descriptif (PH, PAT, portefeuille…)" value={newProd.descriptif} onChange={e => setNewProd(n => ({ ...n, descriptif:e.target.value }))} />
                  <button style={D.btn("ghost")} onClick={ajouterProd}>➕ Ajouter</button>
                </div>
              </>
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
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, marginBottom:12, alignItems:"end" }}>
            <div>
              <label style={{ fontSize:11, color:C.textL, display:"block", marginBottom:4 }}>N° compagnie (FSMA)</label>
              <input style={{ ...D.input, width:"100%" }} placeholder="79" value={form.numero||""} onChange={e => set("numero", e.target.value)} />
            </div>
            <div style={{ display:"flex", gap:16, paddingBottom:8 }}>
              <label style={{ fontSize:12, color:C.textD, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <input type="checkbox" checked={!!form.attend_bqt} onChange={e => set("attend_bqt", e.target.checked)} /> Attend un BQT (bordereau à terme)
              </label>
              <label style={{ fontSize:12, color:C.textD, display:"flex", alignItems:"center", gap:6, cursor:"pointer" }}>
                <input type="checkbox" checked={!!form.attend_rcp} onChange={e => set("attend_rcp", e.target.checked)} /> Attend un RCP (commissions)
              </label>
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
          <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
            {!isNew && <button onClick={supprimerCie} style={{ ...D.btn("ghost"), color:C.danger, borderColor:"#F5C6CB" }}>🗑 Supprimer</button>}
            <button onClick={onClose} style={{ ...D.btn("ghost"), marginLeft:"auto" }}>Annuler</button>
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
  const [logos, setLogos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState("")
  const [statutFiltre, setStatutFiltre] = useState("tous")   // tous | actives | inactives
  const [tri, setTri] = useState("nom")                      // nom | comptes
  const [selId, setSelId] = useState(null)                   // fiche ouverte à droite
  const [copie, setCopie] = useState(null)                   // n° copié, pour le retour visuel

  useEffect(() => { loadCies() }, [])

  const loadCies = async () => {
    setLoading(true)
    const { data } = await supabase.from("compagnies").select("*").order("nom")
    setCies(Array.isArray(data) ? data : [])
    const { data: prod } = await supabase.from("producteurs").select("*").order("compagnie_nom")
    setProducteurs(Array.isArray(prod) ? prod : [])
    // Lister les fichiers du bucket logos (avec fallback en dur si le listing est bloqué)
    const { data: files } = await supabase.storage.from("logos").list("", { limit: 500 })
    const listeBucket = Array.isArray(files) && files.length ? files.map(f => f.name) : LOGOS_CONNUS
    setLogos(listeBucket)
    setLoading(false)
  }

  // Trouve l'URL du logo pour une compagnie (matching tolérant casse + suffixes type _JPG/_PNG)
  const logoUrl = (cie) => {
    // logo_url peut être une URL complète OU un nom de fichier du bucket (choisi via le modal)
    if (cie.logo_url) {
      return cie.logo_url.startsWith("http") ? cie.logo_url : STORAGE_BASE + encodeURIComponent(cie.logo_url)
    }
    const code = (cie.code || "").toUpperCase()
    if (!code) return null
    const baseNom = (name) => name.toUpperCase().replace(/\.[^.]+$/, "").replace(/[_\s-]?(JPG|JPEG|PNG|BMP|SVG|GIF)\b/g, "").replace(/[_\s-]?\d{4}\b/g, "").replace(/\s*\(\d+\)\s*$/, "").replace(/[^A-Z0-9]/g, "")
    const f = logos.find(name => baseNom(name) === code)
    return f ? STORAGE_BASE + encodeURIComponent(f) : null
  }

  // Rattachement fiable par compagnie_id
  const comptesDe = (cie) => producteurs.filter(p => p.compagnie_id === cie.id)
  const nonRattaches = producteurs.filter(p => !p.compagnie_id)

  const reloadProd = async () => {
    const { data } = await supabase.from("producteurs").select("*").order("compagnie_nom")
    setProducteurs(Array.isArray(data) ? data : [])
  }
  const addProd = async (cie, numero, fsma, descriptif) => {
    await supabase.from("producteurs").insert({ numero_producteur:numero, fsma:fsma||null, descriptif:descriptif||null, compagnie_id:cie.id, compagnie_nom:cie.nom, statut:"actif" })
    await reloadProd()
  }
  const setProdStatut = async (id, statut) => {
    await supabase.from("producteurs").update({ statut, updated_at:new Date().toISOString() }).eq("id", id)
    await reloadProd()
  }
  const setProdDescriptif = async (id, descriptif) => {
    await supabase.from("producteurs").update({ descriptif: descriptif || null, updated_at:new Date().toISOString() }).eq("id", id)
    await reloadProd()
  }
  const delProd = async (id) => {
    await supabase.from("producteurs").delete().eq("id", id)
    await reloadProd()
  }
  const rattacherProd = async (id, cie) => {
    await supabase.from("producteurs").update({ compagnie_id: cie ? cie.id : null, compagnie_nom: cie ? cie.nom : null, updated_at:new Date().toISOString() }).eq("id", id)
    await reloadProd()
  }
  const delCie = async (id) => {
    await supabase.from("compagnies").delete().eq("id", id)
    setCies(prev => prev.filter(c => c.id !== id))
  }

  const handleSave = (saved) => {
    setCies(prev => {
      const exists = prev.find(c => c.id === saved.id)
      if (exists) return prev.map(c => c.id === saved.id ? saved : c)
      return [...prev, saved].sort((a,b) => (a.nom||"").localeCompare(b.nom||""))
    })
  }

  const filtered = cies.filter(c => {
    if (statutFiltre === "actives" && !c.actif) return false
    if (statutFiltre === "inactives" && c.actif) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    if ((c.nom||"").toLowerCase().includes(q)) return true
    if ((c.code||"").toLowerCase().includes(q)) return true
    // Recherche sur les numéros de producteurs
    if (comptesDe(c).some(p => (p.numero_producteur||"").toLowerCase().includes(q))) return true
    return false
  }).sort((a,b) => tri === "comptes"
    ? comptesDe(b).length - comptesDe(a).length || (a.nom||"").localeCompare(b.nom||"", "fr")
    : (a.nom||"").localeCompare(b.nom||"", "fr"))

  const selection = cies.find(c => c.id === selId) || null

  // Les numéros producteurs sont des chaînes : les zéros initiaux comptent.
  const copier = async (txt) => {
    try { await navigator.clipboard.writeText(txt); setCopie(txt); setTimeout(() => setCopie(null), 1800) }
    catch { setCopie(null) }
  }

  // Le logo s'affiche sans cadre ni tuile : seuls les fonds propres à la marque restent.
  const Logo = ({ c, taille = 34 }) => {
    const lu = logoUrl(c)
    return (
      <div style={{ width:taille, height:taille, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        {lu
          ? <img src={lu} alt="" style={{ maxWidth:"100%", maxHeight:"100%", objectFit:"contain" }}
              onError={e => { e.currentTarget.style.display = "none" }} />
          : <span style={{ fontSize:taille/3, fontWeight:800, color:c.couleur||C.navy }}>{(c.code||"?").slice(0,3)}</span>}
      </div>
    )
  }

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.textL, fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement…</div>

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <h2 style={{ fontSize:26, fontWeight:800, color:C.navy, margin:0 }}>Compagnies</h2>
        <span style={{ fontSize:13, fontWeight:700, color:C.navyMid, background:"#E6F2FB", borderRadius:14, padding:"2px 10px" }}>{cies.length}</span>
        <button style={{ ...D.btn("primary"), marginLeft:"auto" }} onClick={() => setModal({ ...EMPTY_CIE })}>➕ Nouvelle compagnie</button>
      </div>

      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
        <input style={{ ...D.input, flex:1, minWidth:240 }} value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher une compagnie, un code ou un n° producteur…" />
        <select style={{ ...D.input, width:"auto" }} value={statutFiltre} onChange={e => setStatutFiltre(e.target.value)}>
          <option value="tous">Statut : tous</option>
          <option value="actives">Actives</option>
          <option value="inactives">Inactives</option>
        </select>
        <select style={{ ...D.input, width:"auto" }} value={tri} onChange={e => setTri(e.target.value)}>
          <option value="nom">Nom A-Z</option>
          <option value="comptes">Nombre de comptes</option>
        </select>
      </div>

      <div style={{ display:"grid", gridTemplateColumns: selection ? "minmax(0,1fr) minmax(0,340px)" : "1fr", gap:16, alignItems:"start" }}>
        <div style={{ ...D.card, marginBottom:0, padding:0, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 110px 100px 28px", gap:8, padding:"10px 16px", borderBottom:`1px solid ${C.border}`, background:C.bg }}>
            {["Compagnie","Code","Comptes","Statut",""].map(h =>
              <span key={h} style={{ fontSize:10.5, fontWeight:700, color:C.textL, textTransform:"uppercase", letterSpacing:.5 }}>{h}</span>)}
          </div>
          {filtered.length === 0 && <div style={{ padding:36, textAlign:"center", color:C.textL, fontSize:13 }}>Aucune compagnie ne correspond.</div>}
          {filtered.map(c => {
            const comptes = comptesDe(c)
            const choisie = selId === c.id
            return (
              <div key={c.id} onClick={() => setSelId(choisie ? null : c.id)}
                style={{ display:"grid", gridTemplateColumns:"1fr 120px 110px 100px 28px", gap:8, alignItems:"center",
                  padding:"10px 16px", borderBottom:`1px solid ${C.bg}`, cursor:"pointer",
                  background: choisie ? "#EAF4FC" : "#fff",
                  borderLeft: choisie ? `3px solid ${C.cyanB}` : "3px solid transparent", opacity:c.actif?1:.55 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
                  <Logo c={c} />
                  <span style={{ fontSize:15, fontWeight:700, color: choisie ? C.cyanB : C.navy, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nom}</span>
                </div>
                <span style={{ fontSize:13, color:C.textL }}>{c.code}</span>
                <span style={{ fontSize:13, fontWeight:700, color: comptes.length ? C.navy : C.danger }}>
                  {comptes.length ? `${comptes.length} compte${comptes.length>1?"s":""}` : "aucun n°"}
                </span>
                <span style={{ fontSize:12, fontWeight:700, borderRadius:14, padding:"3px 10px", justifySelf:"start",
                  background: c.actif ? "#E6F7EC" : "#F1F5F9", color: c.actif ? C.ok : C.textL }}>
                  {c.actif ? "● Active" : "● Inactive"}
                </span>
                <span style={{ color:C.textL, fontSize:16, textAlign:"right" }}>›</span>
              </div>
            )
          })}
          <div style={{ padding:"10px 16px", fontSize:12, color:C.textL }}>
            {filtered.length} compagnie{filtered.length>1?"s":""} affichée{filtered.length>1?"s":""} sur {cies.length}
          </div>
        </div>

        {selection && (
          <div style={{ ...D.card, marginBottom:0, position:"sticky", top:12 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontSize:10.5, fontWeight:700, color:C.textL, textTransform:"uppercase", letterSpacing:.5 }}>Fiche compagnie</span>
              <button onClick={() => setSelId(null)} aria-label="Fermer la fiche"
                style={{ border:"none", background:"none", color:C.textL, fontSize:18, cursor:"pointer", lineHeight:1 }}>✕</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
              <Logo c={selection} taille={52} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:19, fontWeight:800, color:C.navy }}>{selection.nom}</div>
                <div style={{ fontSize:13, color:C.textL }}>Code : {selection.code}</div>
              </div>
            </div>
            <span style={{ display:"inline-block", fontSize:12, fontWeight:700, borderRadius:14, padding:"3px 10px", marginBottom:14,
              background: selection.actif ? "#E6F7EC" : "#F1F5F9", color: selection.actif ? C.ok : C.textL }}>
              {selection.actif ? "● Active" : "● Inactive"}
            </span>

            {(selection.telephone || selection.email_contact || selection.site_web) && (
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginBottom:14, display:"flex", flexDirection:"column", gap:5 }}>
                {selection.telephone && <div style={{ fontSize:13, color:C.textM }}>☎ {selection.telephone}</div>}
                {selection.email_contact && <div style={{ fontSize:13, color:C.textM, wordBreak:"break-all" }}>✉ {selection.email_contact}</div>}
                {selection.site_web && <a href={selection.site_web} target="_blank" rel="noreferrer" style={{ fontSize:13, color:C.cyanB, wordBreak:"break-all" }}>🌐 {selection.site_web}</a>}
              </div>
            )}

            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.navy }}>Comptes producteurs</span>
                <span style={{ fontSize:12, fontWeight:700, color:C.navyMid, background:"#E6F2FB", borderRadius:12, padding:"1px 8px" }}>{comptesDe(selection).length}</span>
              </div>
              {comptesDe(selection).length === 0
                ? <div style={{ fontSize:13, color:C.danger, fontWeight:600 }}>⚠ Aucun numéro de producteur enregistré</div>
                : comptesDe(selection).map(p => (
                    <div key={p.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:600, color:C.navy, fontFamily:"monospace" }}>{p.numero_producteur}</span>
                        {p.statut && p.statut !== "actif" && <span style={{ fontSize:10.5, color:C.warn, fontWeight:700 }}>{p.statut}</span>}
                        <button onClick={() => copier(p.numero_producteur)} title="Copier le numéro"
                          style={{ marginLeft:"auto", border:"none", background:"none", cursor:"pointer", color:C.textL, fontSize:14 }}>
                          {copie === p.numero_producteur ? "✓" : "⧉"}
                        </button>
                      </div>
                      {p.descriptif && <div style={{ fontSize:12, color:C.textM, marginTop:3 }}>{p.descriptif}</div>}
                    </div>
                  ))}
              <div aria-live="polite" style={{ fontSize:12, color:C.ok, minHeight:16 }}>
                {copie ? `Numéro ${copie} copié` : ""}
              </div>
            </div>

            <button onClick={() => setModal({ ...selection })} style={{ ...D.btn("ghost"), width:"100%", marginTop:10 }}>✏️ Modifier la compagnie</button>
          </div>
        )}
      </div>


      {nonRattaches.length > 0 && (
        <div style={{ ...D.card, borderColor:"#F6D55C", background:"#FEFBF0" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#856404", marginBottom:10 }}>⚠ {nonRattaches.length} numéro{nonRattaches.length>1?"s":""} de producteur non rattaché{nonRattaches.length>1?"s":""}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {nonRattaches.map(p => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#fff", border:`1px solid ${C.border}`, borderRadius:6, padding:"6px 8px", flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontWeight:700, color:C.navy, fontFamily:"monospace" }}>{p.numero_producteur}</span>
                <span style={{ fontSize:11, color:C.textM }}>{p.compagnie_nom}</span>
                {p.fsma && <span style={{ fontSize:10, color:C.textL }}>FSMA {p.fsma}</span>}
                <select defaultValue="" onChange={e => { const c = cies.find(x => x.id === e.target.value); if (c) rattacherProd(p.id, c) }}
                  style={{ ...D.input, marginLeft:"auto", width:"auto", fontSize:12 }}>
                  <option value="">Rattacher à…</option>
                  {cies.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
                <button onClick={() => window.confirm(`Supprimer le n° ${p.numero_producteur} ?`) && delProd(p.id)}
                  style={{ border:"none", background:"none", color:C.danger, cursor:"pointer", fontSize:14, padding:0 }} title="Supprimer">🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && <CieFormModal cie={modal} comptes={comptesDe(modal)} logos={logos} onClose={() => setModal(null)} onSave={handleSave} onDelete={delCie} onAddProd={addProd} onSetStatut={setProdStatut} onSetDescriptif={setProdDescriptif} onDelProd={delProd} />}
    </div>
  )
}
