import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (v) => v === null || v === undefined ? '—'
  : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v)

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-BE') : '—'
const fmtSync = d => d ? new Date(d).toLocaleString('fr-BE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'Non synchronisé'

// ── VUE CONSOLIDÉE GROUPE ──
function VueConsolidee({ comptes }) {
  const COLORS = { DYNASSUR:'#0080BD', DTX:'#94a3b8', LODE:'#ea580c', HEXAGROUP:'#dc2626', PRIVE:'#0d9488' }
  const LOGOS  = { DYNASSUR:'/logo_dynassur.png', DTX:'/logo_dtx.png', LODE:'/logo_lode.png', HEXAGROUP:'/logo_hexagroup.svg', PRIVE:'/logo_prive.svg' }

  const parSociete = {}
  comptes.forEach(c => {
    const code = c.societes?.code || '?'
    if (!parSociete[code]) parSociete[code] = { comptes:[], total:0, nom:c.societes?.nom }
    parSociete[code].comptes.push(c)
    parSociete[code].total += parseFloat(c.solde_actuel || 0)
  })

  const soldeTotal = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Trésorerie groupe', value: fmt(soldeTotal), color:'#7c3aed' },
          { label:'Comptes synchronisés', value: `${comptes.filter(c=>c.ponto_account_id).length} / ${comptes.length}`, color:'#0080BD' },
          { label:'Entités', value: Object.keys(parSociete).length, color:'#16a34a' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${k.color}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{k.label}</div>
            <div style={{ fontSize:'24px', fontWeight:'800', color:'#0f172a' }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px,1fr))', gap:'16px' }}>
        {Object.entries(parSociete).map(([code, data]) => {
          const col = COLORS[code] || '#64748b'
          const logo = LOGOS[code]
          return (
            <div key={code} style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
              <div style={{ background:col, padding:'12px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
                {logo && <img src={logo} alt={code} style={{ width:26, height:26, objectFit:'contain' }} />}
                <div style={{ flex:1, color:'#fff', fontWeight:'700', fontSize:'13px' }}>{data.nom || code}</div>
                <div style={{ color:'#fff', fontWeight:'800', fontSize:'18px' }}>{fmt(data.total)}</div>
              </div>
              {data.comptes.map((c,i) => (
                <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 16px', borderBottom: i<data.comptes.length-1?'1px solid #f1f5f9':'none' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'#1e293b' }}>{c.banque}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace' }}>{c.iban?.replace(/(.{4})/g,'$1 ').trim()}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'15px', fontWeight:'700', color: parseFloat(c.solde_actuel)>=0?'#16a34a':'#dc2626' }}>{fmt(c.solde_actuel)}</div>
                    {!c.ponto_account_id && <span style={{ fontSize:'10px', background:'#fef3c7', color:'#92400e', padding:'1px 6px', borderRadius:'3px', fontWeight:'700' }}>Non Ponto</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── VUE MONO-SOCIÉTÉ ──
export default function ComptabiliteView({ societeCodes, color, colorDark, titre }) {
  const [comptes, setComptes] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingTx, setLoadingTx] = useState(false)
  const [filtre, setFiltre] = useState({ compte: 'tous', type: 'tous', libelle: '', annee: '', categorie: 'toutes' })
  const [tri, setTri] = useState({ col: 'date', sens: 'desc' })
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState([])
  const [txSelection, setTxSelection] = useState(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [catExpanded, setCatExpanded] = useState(null)
  const PAR_PAGE = 100

  const isConsolide = societeCodes.length > 1

  useEffect(() => {
    async function load() {
      const { data: socs } = await supabase.from('societes').select('id,code').in('code', societeCodes)
      if (!socs?.length) { setLoading(false); return }
      const { data } = await supabase
        .from('comptes_bancaires')
        .select('*, societes(code,nom)')
        .in('societe_id', socs.map(s=>s.id))
        .eq('actif', true)
        .order('banque')
      setComptes(data || [])
      setLoading(false)
    }
    load()
  }, [societeCodes.join(',')])

  // Charger toutes les transactions des comptes accessibles
  useEffect(() => {
    if (isConsolide || !comptes.length) return
    setLoadingTx(true)
    const ids = comptes.map(c => c.id)
    ;(async () => {
      const PAGE = 1000
      let from = 0, all = []
      while (true) {
        const { data, error } = await supabase.from('transactions').select('*')
          .in('compte_id', ids)
          .order('date_valeur', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error) { console.error('Erreur transactions:', error); break }
        const rows = Array.isArray(data) ? data : []
        all = all.concat(rows)
        if (rows.length < PAGE) break
        from += PAGE
      }
      // Enrichir avec les infos compte depuis comptes déjà chargés
      const enriched = all.map(t => ({
        ...t,
        _date: t.date_valeur || t.date_execution || null,
        comptes_bancaires: comptes.find(c => c.id === t.compte_id) || null
      }))
      // Tri par date unifiée décroissante
      enriched.sort((a,b) => (b._date || '').localeCompare(a._date || ''))
      setTransactions(enriched)
      setLoadingTx(false)
    })()
  }, [comptes.map(c=>c.id).join(',')])

  // Reset pagination quand les filtres changent
  useEffect(() => { setPage(1) }, [filtre.compte, filtre.type, filtre.libelle, filtre.annee, filtre.categorie])

  // Charger les catégories
  useEffect(() => {
    supabase.from('categories').select('*').order('nom').then(({ data }) => setCategories(data || []))
  }, [])

  // Assigner une catégorie à une transaction
  async function assignerCategorie(txId, categorieId) {
    await supabase.from('transactions').update({ categorie_id: categorieId }).eq('id', txId)
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, categorie_id: categorieId } : t))
    setTxSelection(prev => prev ? { ...prev, categorie_id: categorieId } : prev)
  }

  // Appliquer une catégorie à TOUTES les transactions d'une contrepartie + créer une règle
  async function appliquerParContrepartie(contrepartie, categorieId) {
    if (!contrepartie || !categorieId) return
    // 1. Mettre à jour toutes les transactions existantes de cette contrepartie
    await supabase.from('transactions').update({ categorie_id: categorieId }).eq('contrepartie_nom', contrepartie)
    // 2. Créer/mettre à jour la règle pour les futures
    const { data: existante } = await supabase.from('categories_regles').select('id').eq('motif', contrepartie).maybeSingle()
    if (existante) {
      await supabase.from('categories_regles').update({ categorie_id: categorieId }).eq('id', existante.id)
    } else {
      await supabase.from('categories_regles').insert({ motif: contrepartie, categorie_id: categorieId })
    }
    // 3. Rafraîchir l'état local
    setTransactions(prev => prev.map(t => t.contrepartie_nom === contrepartie ? { ...t, categorie_id: categorieId } : t))
    const nb = transactions.filter(t => t.contrepartie_nom === contrepartie).length
    alert(`✅ ${nb} transaction(s) de "${contrepartie}" catégorisées. Les futures le seront automatiquement.`)
  }

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8', fontFamily:"'Source Sans Pro', sans-serif" }}>Chargement…</div>
  if (isConsolide) return <VueConsolidee comptes={comptes} />

  // KPIs
  const soldeTotal = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const txFiltrees = transactions.filter(t => {
    if (filtre.compte !== 'tous' && t.compte_id !== filtre.compte) return false
    if (filtre.type === 'entrees' && parseFloat(t.montant) <= 0) return false
    if (filtre.type === 'sorties' && parseFloat(t.montant) >= 0) return false
    if (filtre.libelle) {
      const q = filtre.libelle.toLowerCase()
      if (!t.information_paiement?.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q) && !t.contrepartie_nom?.toLowerCase().includes(q)) return false
    }
    if (filtre.annee && !(t._date || '').startsWith(filtre.annee)) return false
    if (filtre.categorie === 'sans' && t.categorie_id) return false
    if (filtre.categorie !== 'toutes' && filtre.categorie !== 'sans' && t.categorie_id !== filtre.categorie) return false
    return true
  })
  // Tri
  txFiltrees.sort((a, b) => {
    let va, vb
    if (tri.col === 'montant') { va = parseFloat(a.montant)||0; vb = parseFloat(b.montant)||0 }
    else if (tri.col === 'categorie') {
      va = (categories.find(c=>c.id===a.categorie_id)?.nom || 'zzz').toLowerCase()
      vb = (categories.find(c=>c.id===b.categorie_id)?.nom || 'zzz').toLowerCase()
    }
    else if (tri.col === 'contrepartie') { va = (a.contrepartie_nom||'zzz').toLowerCase(); vb = (b.contrepartie_nom||'zzz').toLowerCase() }
    else { va = a._date || ''; vb = b._date || '' }
    if (va < vb) return tri.sens === 'asc' ? -1 : 1
    if (va > vb) return tri.sens === 'asc' ? 1 : -1
    return 0
  })
  const totalEntrees = txFiltrees.filter(t=>parseFloat(t.montant)>0).reduce((s,t)=>s+parseFloat(t.montant),0)
  const totalSorties = txFiltrees.filter(t=>parseFloat(t.montant)<0).reduce((s,t)=>s+parseFloat(t.montant),0)

  // Synthèse par catégorie (sur transactions filtrées)
  const parCategorie = {}
  txFiltrees.forEach(t => {
    const key = t.categorie_id || '_none'
    if (!parCategorie[key]) parCategorie[key] = { recettes: 0, depenses: 0, nb: 0 }
    const m = parseFloat(t.montant) || 0
    if (m >= 0) parCategorie[key].recettes += m
    else parCategorie[key].depenses += m
    parCategorie[key].nb++
  })
  const syntheseRecettes = Object.entries(parCategorie)
    .map(([id, v]) => ({ cat: categories.find(c=>c.id===id), ...v }))
    .filter(x => x.recettes > 0)
    .sort((a,b) => b.recettes - a.recettes)
  const syntheseDepenses = Object.entries(parCategorie)
    .map(([id, v]) => ({ cat: categories.find(c=>c.id===id), ...v }))
    .filter(x => x.depenses < 0)
    .sort((a,b) => a.depenses - b.depenses)
  const nonCategorise = txFiltrees.filter(t => !t.categorie_id).length

  // Synthèse mensuelle (recettes / dépenses par mois)
  const MOIS_NOMS = ['', 'Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const parMois = {}
  txFiltrees.forEach(t => {
    const d = t._date || ''
    if (d.length < 7) return
    const key = d.substring(0, 7) // YYYY-MM
    if (!parMois[key]) parMois[key] = { recettes: 0, depenses: 0, nb: 0 }
    const m = parseFloat(t.montant) || 0
    if (m >= 0) parMois[key].recettes += m
    else parMois[key].depenses += m
    parMois[key].nb++
  })
  const syntheseMensuelle = Object.entries(parMois)
    .map(([ym, v]) => ({ ym, annee: ym.substring(0,4), mois: parseInt(ym.substring(5,7)), ...v, solde: v.recettes + v.depenses }))
    .sort((a, b) => a.ym.localeCompare(b.ym))
  const maxFluxMois = Math.max(1, ...syntheseMensuelle.map(m => Math.max(m.recettes, Math.abs(m.depenses))))

  // Détail par fournisseur/contrepartie pour une catégorie donnée
  function detailFournisseurs(catId, sens) {
    const map = {}
    txFiltrees.forEach(t => {
      const key = t.categorie_id || '_none'
      if (key !== catId) return
      const m = parseFloat(t.montant) || 0
      if (sens === 'recette' && m < 0) return
      if (sens === 'depense' && m >= 0) return
      const nom = t.contrepartie_nom || '(sans contrepartie)'
      if (!map[nom]) map[nom] = { total: 0, nb: 0 }
      map[nom].total += m
      map[nom].nb++
    })
    return Object.entries(map)
      .map(([nom, v]) => ({ nom, ...v }))
      .sort((a,b) => sens === 'recette' ? b.total - a.total : a.total - b.total)
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(txFiltrees.length / PAR_PAGE))
  const pageActuelle = Math.min(page, totalPages)
  const txPage = txFiltrees.slice((pageActuelle-1)*PAR_PAGE, pageActuelle*PAR_PAGE)

  // Années disponibles
  const anneesDispo = [...new Set(transactions.map(t => (t._date || '').substring(0,4)).filter(Boolean))].sort((a,b)=>b-a)

  return (
    <div style={{ fontFamily:"'Source Sans Pro', sans-serif" }}>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'14px', marginBottom:'24px' }}>
        {[
          { label:'Trésorerie totale', value: fmt(soldeTotal), color },
          { label:'Comptes actifs', value: `${comptes.length} (${comptes.filter(c=>c.ponto_account_id).length} Ponto)`, color },
          { label:'Entrées', value: fmt(totalEntrees), color:'#16a34a' },
          { label:'Sorties', value: fmt(totalSorties), color:'#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ background:'#fff', borderRadius:'10px', border:'1px solid #e2e8f0', borderTop:`3px solid ${k.color}`, padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>{k.label}</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#0f172a', lineHeight:1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barre de filtres */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'14px 16px', marginBottom:'14px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>

        {/* Filtre compte */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Compte</label>
          <select value={filtre.compte} onChange={e=>setFiltre(f=>({...f,compte:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", minWidth:'200px', cursor:'pointer' }}>
            <option value="tous">Tous les comptes</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.banque} — {c.iban?.slice(-4)}</option>)}
          </select>
        </div>

        {/* Filtre type */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Type</label>
          <div style={{ display:'flex', gap:'4px' }}>
            {[['tous','Tout'],['entrees','▲ Entrées'],['sorties','▼ Sorties']].map(([val,lab]) => (
              <button key={val} onClick={()=>setFiltre(f=>({...f,type:val}))} style={{
                padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
                background: filtre.type===val ? (val==='entrees'?'#dcfce7':val==='sorties'?'#fee2e2':`${color}18`) : '#f1f5f9',
                color: filtre.type===val ? (val==='entrees'?'#16a34a':val==='sorties'?'#dc2626':color) : '#64748b',
                transition:'all 0.15s'
              }}>{lab}</button>
            ))}
          </div>
        </div>

        {/* Filtre libellé */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', flex:1, minWidth:'200px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Libellé / Contrepartie</label>
          <input type="text" placeholder="Rechercher…" value={filtre.libelle}
            onChange={e=>setFiltre(f=>({...f,libelle:e.target.value}))}
            style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif" }}
          />
        </div>

        {/* Filtre année */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Année</label>
          <select value={filtre.annee} onChange={e=>setFiltre(f=>({...f,annee:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
            <option value="">Toutes</option>
            {anneesDispo.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Filtre catégorie */}
        <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
          <label style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>Catégorie</label>
          <select value={filtre.categorie} onChange={e=>setFiltre(f=>({...f,categorie:e.target.value}))} style={{ padding:'7px 10px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
            <option value="toutes">Toutes</option>
            <option value="sans">⚠️ Sans catégorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        {/* Reset */}
        {(filtre.compte!=='tous'||filtre.type!=='tous'||filtre.libelle||filtre.annee||filtre.categorie!=='toutes') && (
          <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            <label style={{ fontSize:'10px', color:'transparent' }}>.</label>
            <button onClick={()=>setFiltre({compte:'tous',type:'tous',libelle:'',annee:'',categorie:'toutes'})} style={{ padding:'7px 12px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'1px solid #e2e8f0', background:'#fff', color:'#64748b' }}>
              ✕ Reset
            </button>
          </div>
        )}
      </div>

      {/* Synthèse par catégorie */}
      {txFiltrees.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'14px', marginBottom:'14px' }}>
          {/* Recettes par catégorie */}
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'#f0fdf4', borderBottom:'1px solid #dcfce7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'12px', fontWeight:'700', color:'#16a34a', textTransform:'uppercase', letterSpacing:'0.05em' }}>▲ Recettes par catégorie</span>
              <span style={{ fontSize:'15px', fontWeight:'800', color:'#16a34a' }}>+{fmt(totalEntrees)}</span>
            </div>
            <div>
              {syntheseRecettes.length === 0 ? (
                <div style={{ padding:'20px 16px', fontSize:'13px', color:'#94a3b8', textAlign:'center' }}>Aucune recette</div>
              ) : syntheseRecettes.map((x, i) => {
                const pct = totalEntrees > 0 ? (x.recettes / totalEntrees * 100) : 0
                const cat = x.cat
                const catId = cat?.id || '_none'
                const expKey = 'r_' + catId
                const ouvert = catExpanded === expKey
                const detail = ouvert ? detailFournisseurs(catId, 'recette') : []
                return (
                  <div key={i} style={{ borderBottom: i<syntheseRecettes.length-1?'1px solid #f8fafc':'none' }}>
                    <div onClick={()=>setCatExpanded(ouvert?null:expKey)} style={{ padding:'10px 16px', cursor:'pointer' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ fontSize:'10px', color:'#cbd5e1' }}>{ouvert?'▼':'▶'}</span>
                          <span style={{ width:'9px', height:'9px', borderRadius:'50%', background: cat?.couleur || '#94a3b8' }}></span>
                          <span style={{ fontSize:'13px', fontWeight:'600', color:'#1e293b' }}>{cat?.nom || 'Non catégorisé'}</span>
                          <span style={{ fontSize:'11px', color:'#cbd5e1' }}>({x.nb})</span>
                        </span>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:'#16a34a' }}>+{fmt(x.recettes)}</span>
                      </div>
                      <div style={{ height:'5px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: cat?.couleur || '#94a3b8', borderRadius:'3px' }}></div>
                      </div>
                    </div>
                    {ouvert && (
                      <div style={{ background:'#fafafa', padding:'4px 16px 10px 32px' }}>
                        {detail.map((d, j) => (
                          <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom: j<detail.length-1?'1px solid #f1f5f9':'none' }}>
                            <span style={{ fontSize:'12px', color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'10px' }}>{d.nom} <span style={{ color:'#cbd5e1' }}>({d.nb})</span></span>
                            <span style={{ fontSize:'12px', fontWeight:'600', color:'#16a34a', flexShrink:0 }}>+{fmt(d.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dépenses par catégorie */}
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', background:'#fef2f2', borderBottom:'1px solid #fee2e2', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'12px', fontWeight:'700', color:'#dc2626', textTransform:'uppercase', letterSpacing:'0.05em' }}>▼ Dépenses par catégorie</span>
              <span style={{ fontSize:'15px', fontWeight:'800', color:'#dc2626' }}>{fmt(totalSorties)}</span>
            </div>
            <div>
              {syntheseDepenses.length === 0 ? (
                <div style={{ padding:'20px 16px', fontSize:'13px', color:'#94a3b8', textAlign:'center' }}>Aucune dépense</div>
              ) : syntheseDepenses.map((x, i) => {
                const pct = totalSorties < 0 ? (x.depenses / totalSorties * 100) : 0
                const cat = x.cat
                const catId = cat?.id || '_none'
                const expKey = 'd_' + catId
                const ouvert = catExpanded === expKey
                const detail = ouvert ? detailFournisseurs(catId, 'depense') : []
                return (
                  <div key={i} style={{ borderBottom: i<syntheseDepenses.length-1?'1px solid #f8fafc':'none' }}>
                    <div onClick={()=>setCatExpanded(ouvert?null:expKey)} style={{ padding:'10px 16px', cursor:'pointer' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ fontSize:'10px', color:'#cbd5e1' }}>{ouvert?'▼':'▶'}</span>
                          <span style={{ width:'9px', height:'9px', borderRadius:'50%', background: cat?.couleur || '#94a3b8' }}></span>
                          <span style={{ fontSize:'13px', fontWeight:'600', color:'#1e293b' }}>{cat?.nom || 'Non catégorisé'}</span>
                          <span style={{ fontSize:'11px', color:'#cbd5e1' }}>({x.nb})</span>
                        </span>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:'#dc2626' }}>{fmt(x.depenses)}</span>
                      </div>
                      <div style={{ height:'5px', background:'#f1f5f9', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background: cat?.couleur || '#94a3b8', borderRadius:'3px' }}></div>
                      </div>
                    </div>
                    {ouvert && (
                      <div style={{ background:'#fafafa', padding:'4px 16px 10px 32px' }}>
                        {detail.map((d, j) => (
                          <div key={j} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom: j<detail.length-1?'1px solid #f1f5f9':'none' }}>
                            <span style={{ fontSize:'12px', color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'10px' }}>{d.nom} <span style={{ color:'#cbd5e1' }}>({d.nb})</span></span>
                            <span style={{ fontSize:'12px', fontWeight:'600', color:'#dc2626', flexShrink:0 }}>{fmt(d.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {nonCategorise > 0 && (
        <div style={{ marginBottom:'14px', padding:'10px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'13px', color:'#92400e' }}>
          ⚠️ {nonCategorise} transaction{nonCategorise>1?'s':''} non catégorisée{nonCategorise>1?'s':''} — cliquez dessus pour leur attribuer une catégorie.
        </div>
      )}

      {/* Synthèse mensuelle */}
      {syntheseMensuelle.length > 0 && (
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden', marginBottom:'14px' }}>
          <div style={{ padding:'12px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'12px', fontWeight:'700', color:'#475569', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            📅 Évolution mensuelle
          </div>
          <div>
            {syntheseMensuelle.map((m, i) => {
              const pctR = (m.recettes / maxFluxMois) * 100
              const pctD = (Math.abs(m.depenses) / maxFluxMois) * 100
              return (
                <div key={m.ym} style={{ padding:'10px 16px', borderBottom: i<syntheseMensuelle.length-1?'1px solid #f8fafc':'none', display:'grid', gridTemplateColumns: isMobile?'70px 1fr':'90px 1fr 120px', gap:'12px', alignItems:'center' }}>
                  <div style={{ fontSize:'13px', fontWeight:'700', color:'#1e293b' }}>{MOIS_NOMS[m.mois]} {m.annee}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                    {/* Barre recettes */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ flex:1, height:'8px', background:'#f1f5f9', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pctR}%`, background:'#16a34a', borderRadius:'4px' }}></div>
                      </div>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:'#16a34a', minWidth:'70px', textAlign:'right' }}>+{fmt(m.recettes)}</span>
                    </div>
                    {/* Barre dépenses */}
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ flex:1, height:'8px', background:'#f1f5f9', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pctD}%`, background:'#dc2626', borderRadius:'4px' }}></div>
                      </div>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:'#dc2626', minWidth:'70px', textAlign:'right' }}>{fmt(m.depenses)}</span>
                    </div>
                  </div>
                  {!isMobile && (
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'10px', color:'#94a3b8', textTransform:'uppercase', fontWeight:'700' }}>Solde</div>
                      <div style={{ fontSize:'15px', fontWeight:'800', color: m.solde>=0?'#16a34a':'#dc2626' }}>{m.solde>=0?'+':''}{fmt(m.solde)}</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tableau transactions pleine largeur */}
      <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', overflow:'hidden' }}>
        {/* En-tête (desktop) */}
        {!isMobile && (
        <div style={{ display:'grid', gridTemplateColumns:'100px 110px 1fr 170px 140px 110px', padding:'9px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>
          {(() => {
            const trier = (col) => setTri(t => ({ col, sens: t.col === col && t.sens === 'desc' ? 'asc' : 'desc' }))
            const fleche = (col) => tri.col === col ? (tri.sens === 'desc' ? ' ↓' : ' ↑') : ''
            const Th = ({ col, children, align }) => (
              <div onClick={()=>trier(col)} style={{ cursor:'pointer', textAlign:align||'left', color: tri.col===col?color:'#94a3b8', userSelect:'none' }}>{children}{fleche(col)}</div>
            )
            return <>
              <Th col="date">Date</Th>
              <div>Compte</div>
              <div>Libellé</div>
              <Th col="contrepartie">Contrepartie</Th>
              <Th col="categorie">Catégorie</Th>
              <Th col="montant" align="right">Montant</Th>
            </>
          })()}
        </div>
        )}
        {/* Tri compact (mobile) */}
        {isMobile && (
          <div style={{ display:'flex', gap:'6px', padding:'10px 12px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', overflowX:'auto' }}>
            {[['date','Date'],['montant','Montant'],['contrepartie','Tiers'],['categorie','Catégorie']].map(([col,lab]) => (
              <button key={col} onClick={()=>setTri(t => ({ col, sens: t.col===col && t.sens==='desc' ? 'asc' : 'desc' }))} style={{ flexShrink:0, padding:'5px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:'600', border:'1px solid #e2e8f0', background: tri.col===col?`${color}14`:'#fff', color: tri.col===col?color:'#64748b', cursor:'pointer' }}>
                {lab}{tri.col===col?(tri.sens==='desc'?' ↓':' ↑'):''}
              </button>
            ))}
          </div>
        )}

        {loadingTx ? (
          <div style={{ padding:'60px', textAlign:'center', color:'#94a3b8' }}>Chargement des transactions…</div>
        ) : txFiltrees.length === 0 ? (
          <div style={{ padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#64748b', marginBottom:'4px' }}>Aucune transaction</div>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>
              {transactions.length === 0 ? 'Synchronisation Ponto en attente.' : 'Aucun résultat pour ces filtres.'}
            </div>
          </div>
        ) : (
          <>
            {txPage.map((t, i) => {
              const cat = categories.find(c => c.id === t.categorie_id)
              const positif = parseFloat(t.montant) >= 0
              if (isMobile) {
                return (
                  <div key={t.id} onClick={() => setTxSelection(t)} style={{
                    padding:'12px 14px', cursor:'pointer',
                    borderBottom: i < txPage.length-1 ? '1px solid #f1f5f9' : 'none',
                    background:'#fff'
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'10px' }}>
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {t.contrepartie_nom || t.information_paiement || t.description || '—'}
                        </div>
                        <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
                          {fmtDate(t._date)} · {t.comptes_bancaires?.banque || '—'}
                        </div>
                      </div>
                      <div style={{ fontSize:'15px', fontWeight:'700', color: positif?'#16a34a':'#dc2626', flexShrink:0 }}>
                        {positif?'+':''}{fmt(t.montant)}
                      </div>
                    </div>
                    <div style={{ marginTop:'6px' }}>
                      {cat ? (
                        <span style={{ fontSize:'11px', fontWeight:'600', padding:'2px 8px', borderRadius:'10px', background:`${cat.couleur}18`, color:cat.couleur }}>{cat.nom}</span>
                      ) : (
                        <span style={{ fontSize:'11px', color:'#cbd5e1' }}>Sans catégorie</span>
                      )}
                    </div>
                  </div>
                )
              }
              return (
              <div key={t.id} onClick={() => setTxSelection(t)} style={{
                display:'grid', gridTemplateColumns:'100px 110px 1fr 170px 140px 110px',
                padding:'9px 16px', alignItems:'center', cursor:'pointer',
                borderBottom: i < txPage.length-1 ? '1px solid #f8fafc' : 'none',
                background: i%2===0 ? '#fff' : '#fafafa'
              }}>
                <div style={{ fontSize:'12px', color:'#64748b' }}>{fmtDate(t._date)}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.comptes_bancaires?.banque || '—'}
                </div>
                <div style={{ fontSize:'13px', color:'#1e293b', fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:'12px' }}>
                  {t.information_paiement || t.description || '—'}
                </div>
                <div style={{ fontSize:'12px', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {t.contrepartie_nom || '—'}
                </div>
                <div style={{ overflow:'hidden' }}>
                  {cat ? (
                    <span style={{ fontSize:'11px', fontWeight:'600', padding:'2px 8px', borderRadius:'10px', background:`${cat.couleur}18`, color:cat.couleur, whiteSpace:'nowrap' }}>{cat.nom}</span>
                  ) : (
                    <span style={{ fontSize:'11px', color:'#cbd5e1' }}>—</span>
                  )}
                </div>
                <div style={{ textAlign:'right', fontSize:'14px', fontWeight:'700', color: parseFloat(t.montant)>=0?'#16a34a':'#dc2626' }}>
                  {parseFloat(t.montant)>=0?'+':''}{fmt(t.montant)}
                </div>
              </div>
            )})}
            {/* Footer totaux */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', padding:'10px 16px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', fontSize:'12px', fontWeight:'700' }}>
              <div style={{ color:'#64748b' }}>{txFiltrees.length} transaction{txFiltrees.length>1?'s':''}</div>
              <div style={{ textAlign:'right' }}>
                <span style={{ color:'#16a34a' }}>+{fmt(totalEntrees)}</span>
                <span style={{ color:'#94a3b8', margin:'0 4px' }}>·</span>
                <span style={{ color:'#dc2626' }}>{fmt(totalSorties)}</span>
              </div>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'8px', padding:'14px 16px', borderTop:'1px solid #f1f5f9' }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={pageActuelle<=1} style={{ padding:'6px 14px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', border:'1px solid #e2e8f0', background: pageActuelle<=1?'#f1f5f9':'#fff', color: pageActuelle<=1?'#cbd5e1':color, cursor: pageActuelle<=1?'default':'pointer' }}>← Précédent</button>
                <span style={{ fontSize:'13px', color:'#64748b', fontWeight:'600', minWidth:'120px', textAlign:'center' }}>Page {pageActuelle} / {totalPages}</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={pageActuelle>=totalPages} style={{ padding:'6px 14px', borderRadius:'6px', fontSize:'13px', fontWeight:'600', border:'1px solid #e2e8f0', background: pageActuelle>=totalPages?'#f1f5f9':'#fff', color: pageActuelle>=totalPages?'#cbd5e1':color, cursor: pageActuelle>=totalPages?'default':'pointer' }}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal détail transaction */}
      {txSelection && (() => {
        const t = txSelection
        const positif = parseFloat(t.montant) >= 0
        const Row = ({ label, value }) => (
          <div style={{ display:'flex', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
            <div style={{ width:'160px', flexShrink:0, fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
            <div style={{ fontSize:'14px', color:'#1e293b', wordBreak:'break-word' }}>{value || '—'}</div>
          </div>
        )
        return (
          <div onClick={()=>setTxSelection(null)} style={{ position:'fixed', inset:0, background:'rgba(15,23,42,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'20px' }}>
            <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:'16px', maxWidth:'560px', width:'100%', maxHeight:'85vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding:'20px 24px', background:`linear-gradient(135deg, ${color}, ${colorDark||color})`, borderRadius:'16px 16px 0 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', fontWeight:'600' }}>{fmtDate(t._date)}</div>
                  <div style={{ fontSize:'28px', fontWeight:'800', color:'#fff' }}>{positif?'+':''}{fmt(t.montant)}</div>
                </div>
                <button onClick={()=>setTxSelection(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'8px', width:'32px', height:'32px', color:'#fff', fontSize:'18px', cursor:'pointer' }}>×</button>
              </div>
              <div style={{ padding:'20px 24px' }}>
                {/* Sélecteur catégorie */}
                <div style={{ marginBottom:'18px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'8px' }}>Catégorie</div>
                  <select value={t.categorie_id || ''} onChange={e=>assignerCategorie(t.id, e.target.value || null)} style={{ width:'100%', padding:'10px 12px', border:'1px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', fontFamily:"'Source Sans Pro', sans-serif", cursor:'pointer' }}>
                    <option value="">— Non catégorisé —</option>
                    <optgroup label="Recettes">
                      {categories.filter(c=>c.type==='recette').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </optgroup>
                    <optgroup label="Dépenses">
                      {categories.filter(c=>c.type==='depense').map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </optgroup>
                  </select>
                  {t.categorie_id && t.contrepartie_nom && (
                    <button onClick={()=>appliquerParContrepartie(t.contrepartie_nom, t.categorie_id)} style={{ marginTop:'8px', width:'100%', padding:'9px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', border:`1px solid ${color}`, background:`${color}0d`, color, cursor:'pointer', fontFamily:"'Source Sans Pro', sans-serif" }}>
                      ⚡ Appliquer à toutes les transactions de « {t.contrepartie_nom} »
                    </button>
                  )}
                </div>
                <Row label="Contrepartie" value={t.contrepartie_nom} />
                <Row label="IBAN contrepartie" value={t.contrepartie_iban} />
                <Row label="Communication" value={t.information_paiement} />
                <Row label="Description" value={t.description} />
                <Row label="Compte" value={`${t.comptes_bancaires?.banque || ''} ${t.comptes_bancaires?.iban || ''}`} />
                <Row label="Date valeur" value={fmtDate(t.date_valeur)} />
                <Row label="Date exécution" value={fmtDate(t.date_execution)} />
                <Row label="Type" value={t.type_transaction} />
                <Row label="Devise" value={t.devise} />
                <Row label="ID Ponto" value={t.ponto_transaction_id} />
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
