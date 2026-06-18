import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'

// ── Constantes ──
const SOCIETES = {
  dynassur:  { label:'Dynassur SRL',   color:'#0080BD', colorDark:'#0D2F5E', short:'DYN' },
  dtx:       { label:'DTX SRL',        color:'#94a3b8', colorDark:'#334155', short:'DTX' },
  lode:      { label:'LODE SRL',       color:'#ea580c', colorDark:'#7c2d12', short:'LODE' },
  hexagroup: { label:'Hexagroup ASBL', color:'#dc2626', colorDark:'#7f1d1d', short:'HEX' },
  prive:     { label:'Privé',          color:'#0d9488', colorDark:'#134e4a', short:'PRV' },
}

const ROUTES = {
  dynassur:'/dynassur', dtx:'/dtx', lode:'/lode', hexagroup:'/hexagroup', prive:'/prive'
}

const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtN = v => v == null ? '—' : new Intl.NumberFormat('fr-BE').format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}) : '—'

// ── Barre de progression ──
function Bar({ pct, col }) {
  const p = Math.min(pct||0, 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, background:'#e2e8f0', borderRadius:4, height:6, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:4, transition:'width 0.4s',
          background: p>=100?'#16a34a':p>=70?(col||'#0080BD'):'#f59e0b' }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, minWidth:32, color:p>=100?'#16a34a':p>=70?(col||'#0080BD'):'#f59e0b' }}>
        {Math.round(p)}%
      </span>
    </div>
  )
}

// ── KPI Card ──
function KpiCard({ label, value, sub, col, icon }) {
  return (
    <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e8f0', borderTop:`3px solid ${col||'#0080BD'}`, padding:'16px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
        {icon && <i className={`ti ${icon}`} style={{ fontSize:18, color:col+'60' }} />}
      </div>
      <div style={{ fontSize:24, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{sub}</div>}
    </div>
  )
}

// ══════════════════════════
// BLOC 1 — Comptes bancaires (chiffres masqués par défaut)
// ══════════════════════════
function BlocBanque({ comptes, loading }) {
  const [open, setOpen] = useState({})
  const [revealed, setRevealed] = useState({})

  const SOC_COLOR = { DYNASSUR:'#0080BD', DTX:'#94a3b8', LODE:'#ea580c', HEXAGROUP:'#dc2626', PRIVE:'#0d9488' }

  // Grouper par société
  const parSociete = {}
  comptes.forEach(c => {
    const code = (c.societes?.code || 'AUTRE').toUpperCase()
    if (!parSociete[code]) parSociete[code] = { comptes:[], total:0, nom:c.societes?.nom || code, color: SOC_COLOR[code]||'#94a3b8' }
    parSociete[code].comptes.push(c)
    parSociete[code].total += parseFloat(c.solde_actuel || 0)
  })

  const totalGroupe = comptes.reduce((s,c) => s + parseFloat(c.solde_actuel||0), 0)
  const allRevealed = comptes.length > 0 && comptes.every(c => revealed[c.id])

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-credit-card" style={{ fontSize:16, color:'#7c3aed' }} />
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Comptes bancaires</span>
          <span style={{ fontSize:11, background:'#f1f5f9', color:'#64748b', padding:'2px 7px', borderRadius:10, fontWeight:600 }}>{comptes.length} comptes</span>
        </div>
        {comptes.length > 0 && (
          <button onClick={() => { const all={}; comptes.forEach(c=>{all[c.id]=!allRevealed}); setRevealed(all) }}
            style={{ fontSize:11, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #ede9fe', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Tout masquer' : '👁 Tout révéler'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : comptes.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
          <i className="ti ti-plug-off" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucun compte — synchronisation Ponto requise
        </div>
      ) : (
        <div>
          {Object.entries(parSociete).map(([code, soc]) => {
            const isOpen = open[code]
            const socRevealed = revealed[`soc_${code}`]
            return (
              <div key={code} style={{ borderBottom:'1px solid #f1f5f9' }}>

                {/* Ligne société — montant global + flèche déroulante */}
                <div style={{ display:'flex', alignItems:'center', padding:'11px 18px', gap:10,
                  background: isOpen ? soc.color+'08' : '#fff',
                  transition:'background 0.15s', cursor:'default' }}>

                  {/* Pastille couleur + nom */}
                  <div style={{ width:10, height:10, borderRadius:'50%', background:soc.color, flexShrink:0 }} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#1e293b', flex:1 }}>{soc.nom || code}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>{soc.comptes.length} compte{soc.comptes.length>1?'s':''}</span>

                  {/* Montant global — avec œil pour révéler */}
                  <span style={{ fontSize:15, fontWeight:800, minWidth:100, textAlign:'right',
                    color: socRevealed ? (soc.total<0?'#dc2626':soc.color) : '#cbd5e1',
                    letterSpacing: socRevealed?'.01em':'.1em' }}>
                    {socRevealed ? fmt(soc.total) : '● ● ● ●'}
                  </span>

                  {/* Bouton œil */}
                  <button onClick={() => setRevealed(r => ({ ...r, [`soc_${code}`]: !r[`soc_${code}`] }))}
                    title={socRevealed?'Masquer':'Révéler'}
                    style={{ background:socRevealed?'#f0fdf4':'#f8fafc', border:`1px solid ${socRevealed?'#bbf7d0':'#e2e8f0'}`,
                      borderRadius:6, padding:'4px 7px', cursor:'pointer', color:socRevealed?'#16a34a':'#94a3b8', fontSize:13, transition:'all 0.15s' }}>
                    <i className={`ti ${socRevealed?'ti-eye-off':'ti-eye'}`} />
                  </button>

                  {/* Flèche déroulant */}
                  <button onClick={() => setOpen(o => ({ ...o, [code]: !o[code] }))}
                    style={{ background:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', padding:'4px 6px', fontSize:13, transition:'transform 0.2s',
                      transform: isOpen?'rotate(180deg)':'rotate(0deg)' }}>
                    <i className="ti ti-chevron-down" />
                  </button>
                </div>

                {/* Détail comptes — visible si ouvert */}
                {isOpen && (
                  <div style={{ background:'#fafafe', borderTop:`1px solid ${soc.color}20` }}>
                    {soc.comptes.map((c, i) => {
                      const show = revealed[c.id]
                      const bal = parseFloat(c.solde_actuel || 0)
                      return (
                        <div key={c.id} style={{
                          display:'grid', gridTemplateColumns:'1fr auto auto',
                          alignItems:'center', gap:12,
                          padding:'9px 18px 9px 36px',
                          borderBottom: i<soc.comptes.length-1?'1px solid #f1f5f9':'none' }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500, color:'#374151' }}>{c.banque}</div>
                            <div style={{ fontSize:11, color:'#94a3b8', fontFamily:'monospace' }}>
                              {c.iban ? `${c.iban.slice(0,4)} •• ${c.iban.slice(-4)}` : 'Compte courant'}
                              {!c.ponto_account_id && <span style={{ marginLeft:6, background:'#fef3c7', color:'#92400e', padding:'1px 4px', borderRadius:3, fontSize:9, fontWeight:700 }}>Non Ponto</span>}
                            </div>
                          </div>
                          <span style={{ fontSize:14, fontWeight:700, minWidth:100, textAlign:'right',
                            color: show?(bal<0?'#dc2626':soc.color):'#cbd5e1',
                            letterSpacing: show?'.01em':'.1em' }}>
                            {show ? fmt(bal) : '● ● ●'}
                          </span>
                          <button onClick={() => setRevealed(r => ({ ...r, [c.id]: !r[c.id] }))}
                            style={{ background:show?'#f0fdf4':'#f8fafc', border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`,
                              borderRadius:6, padding:'4px 7px', cursor:'pointer', color:show?'#16a34a':'#94a3b8', fontSize:13 }}>
                            <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Total groupe */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', background:'#0f172a' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'.05em' }}>Total Groupe</span>
            <span style={{ fontSize:16, fontWeight:800, color: allRevealed?(totalGroupe<0?'#f87171':'#86efac'):'#374151' }}>
              {allRevealed ? fmt(totalGroupe) : '● ● ● ● ●'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════
// BLOC 2 — Tâches en cours
// ══════════════════════════
function BlocTaches({ taches, loading }) {
  const now = new Date()
  const STATUT_STYLE = {
    en_retard:  { bg:'#fee2e2', color:'#dc2626', label:'⚠ Retard' },
    urgent:     { bg:'#fff7ed', color:'#ea580c', label:'🔥 Urgent' },
    en_cours:   { bg:'#dbeafe', color:'#1d4ed8', label:'En cours' },
    en_attente: { bg:'#f1f5f9', color:'#64748b', label:'En attente' },
  }

  const enriched = taches.map(t => ({
    ...t,
    isRetard: t.echeance && new Date(t.echeance) < now && t.statut !== 'terminee'
  })).sort((a,b) => (b.isRetard?1:0)-(a.isRetard?1:0))

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8 }}>
        <i className="ti ti-checkbox" style={{ fontSize:16, color:'#f59e0b' }} />
        <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Tâches en cours</span>
        <span style={{ fontSize:11, background:'#fef3c7', color:'#92400e', padding:'2px 7px', borderRadius:10, fontWeight:700 }}>
          {taches.filter(t=>t.echeance&&new Date(t.echeance)<now).length} en retard
        </span>
        <span style={{ fontSize:11, background:'#f1f5f9', color:'#64748b', padding:'2px 7px', borderRadius:10, fontWeight:600 }}>
          {taches.length} total
        </span>
      </div>

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : taches.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:'#16a34a', fontSize:13 }}>
          <i className="ti ti-circle-check" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucune tâche en cours — tout est à jour ✓
        </div>
      ) : (
        <div style={{ maxHeight:320, overflowY:'auto' }}>
          {enriched.slice(0,20).map((t, i) => {
            const s = t.isRetard ? STATUT_STYLE.en_retard : (STATUT_STYLE[t.statut] || STATUT_STYLE.en_cours)
            const socCfg = t.societe ? SOCIETES[t.societe.toLowerCase()] : null
            return (
              <div key={t.id} style={{
                display:'grid', gridTemplateColumns:'1fr auto auto',
                alignItems:'center', gap:10,
                padding:'9px 18px',
                borderBottom: i < Math.min(enriched.length,20)-1 ? '1px solid #f8fafc' : 'none',
                background: t.isRetard ? '#fff5f5' : i%2===0?'#fff':'#fafafa'
              }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:t.isRetard?700:500, color:'#1e293b' }}>
                    {t.titre || '—'}
                  </div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, display:'flex', gap:8 }}>
                    {socCfg && <span style={{ background:socCfg.color+'18', color:socCfg.color, fontWeight:700, padding:'1px 5px', borderRadius:3, fontSize:10 }}>{socCfg.short}</span>}
                    {t.gestionnaire && <span>{t.gestionnaire}</span>}
                    {t.code_type && <span>• {t.code_type}</span>}
                  </div>
                </div>
                <div style={{ fontSize:11, color: t.isRetard?'#dc2626':'#64748b', fontWeight:t.isRetard?700:400, textAlign:'right' }}>
                  {fmtDate(t.echeance)}
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:'3px 7px', borderRadius:4, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
                  {s.label}
                </span>
              </div>
            )
          })}
          {enriched.length > 20 && (
            <div style={{ padding:'10px 18px', textAlign:'center', fontSize:12, color:'#94a3b8' }}>
              + {enriched.length-20} tâches supplémentaires
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════
// BLOC 3 — Trésorerie consolidée
// ══════════════════════════
function BlocTresorerie({ comptes, transactions, loading }) {
  const MOIS = ['Jan','Fév','Mar','Apr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
  const now = new Date()
  const [revealed, setRevealed] = useState({})

  // Soldes par société
  const soldesParSoc = Object.entries(SOCIETES).map(([key, cfg]) => {
    const total = comptes.filter(c=>(c.societes?.code||'').toUpperCase()===key.toUpperCase()).reduce((s,c)=>s+parseFloat(c.solde_actuel||0),0)
    return { key, ...cfg, total }
  }).filter(s => s.total !== 0)

  const totalGroupe = soldesParSoc.reduce((s,r)=>s+r.total,0)
  const allRevealed = soldesParSoc.length > 0 && soldesParSoc.every(s => revealed[s.key])

  // Revenus/dépenses des 6 derniers mois depuis transactions
  const sixMois = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
    return { month: d.getMonth(), year: d.getFullYear(), label: MOIS[d.getMonth()] }
  })

  const flowData = sixMois.map(m => {
    const txs = transactions.filter(t => {
      const d = new Date(t.date || t.date_valeur)
      return d.getMonth()===m.month && d.getFullYear()===m.year
    })
    const entrees = txs.filter(t=>t.montant>0).reduce((s,t)=>s+t.montant,0)
    const sorties = txs.filter(t=>t.montant<0).reduce((s,t)=>s+Math.abs(t.montant),0)
    return { ...m, entrees, sorties }
  })

  const maxFlow = Math.max(...flowData.map(f=>Math.max(f.entrees,f.sorties)), 1)

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8 }}>
        <i className="ti ti-chart-line" style={{ fontSize:16, color:'#0d9488' }} />
        <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Trésorerie consolidée</span>
      </div>

      <div style={{ padding:18 }}>
        {/* Total groupe */}
        <div style={{ marginBottom:18, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde total groupe</div>
            <div style={{ fontSize:32, fontWeight:900,
              color: allRevealed?(totalGroupe<0?'#dc2626':'#0f172a'):'#cbd5e1',
              letterSpacing: allRevealed?'normal':'.1em' }}>
              {allRevealed ? fmt(totalGroupe) : '● ● ● ● ●'}
            </div>
          </div>
          <button onClick={() => { const all={}; soldesParSoc.forEach(s=>{all[s.key]=!allRevealed}); setRevealed(all) }}
            style={{ fontSize:11, color:'#0d9488', background:'#f0fdfa', border:'1px solid #99f6e4', borderRadius:6, padding:'5px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Masquer' : '👁 Révéler'}
          </button>
        </div>

        {/* Par société */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:18 }}>
          {soldesParSoc.map(s => {
            const show = revealed[s.key]
            return (
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background:'#f8fafc' }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:'#64748b', flex:1 }}>{s.label}</span>
                <span style={{ fontSize:13, fontWeight:700, minWidth:90, textAlign:'right',
                  color: show?(s.total<0?'#dc2626':s.color):'#cbd5e1',
                  letterSpacing: show?'normal':'.1em' }}>
                  {show ? fmt(s.total) : '● ● ●'}
                </span>
                <div style={{ width:70 }}>
                  <div style={{ background:'#e2e8f0', borderRadius:3, height:5, overflow:'hidden' }}>
                    <div style={{ width: show?`${Math.abs(s.total)/Math.max(Math.abs(totalGroupe),1)*100}%`:'0%', height:'100%', background:s.color, borderRadius:3, transition:'width 0.4s' }} />
                  </div>
                </div>
                <button onClick={() => setRevealed(r => ({ ...r, [s.key]: !r[s.key] }))}
                  style={{ background:show?'#f0fdf4':'#fff', border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`,
                    borderRadius:6, padding:'3px 6px', cursor:'pointer', color:show?'#16a34a':'#94a3b8', fontSize:12 }}>
                  <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                </button>
              </div>
            )
          })}
          {soldesParSoc.length === 0 && (
            <div style={{ fontSize:12, color:'#94a3b8', padding:'12px 0' }}>Synchronisation Ponto requise pour afficher les soldes</div>
          )}
        </div>

        {/* Mini graphe flux 6 mois */}
        {flowData.some(f=>f.entrees>0||f.sorties>0) && (
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Flux 6 derniers mois</div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:60 }}>
              {flowData.map((f,i) => (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:50 }}>
                    <div style={{ flex:1, background:'#bbf7d0', borderRadius:'3px 3px 0 0', height:`${f.entrees/maxFlow*100}%`, minHeight: f.entrees>0?3:0, transition:'height 0.3s' }} title={`Entrées: ${fmt(f.entrees)}`} />
                    <div style={{ flex:1, background:'#fecaca', borderRadius:'3px 3px 0 0', height:`${f.sorties/maxFlow*100}%`, minHeight: f.sorties>0?3:0, transition:'height 0.3s' }} title={`Sorties: ${fmt(f.sorties)}`} />
                  </div>
                  <span style={{ fontSize:9, color:'#94a3b8' }}>{f.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:6 }}>
              <span style={{ fontSize:10, color:'#16a34a' }}>■ Entrées</span>
              <span style={{ fontSize:10, color:'#dc2626' }}>■ Sorties</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════
// BLOC 4 — Production Dynassur
// ══════════════════════════
function BlocProduction({ loading: loadingExt }) {
  const [prod, setProd] = useState([])
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const annee = now.getFullYear()
  const mois = String(now.getMonth() + 1).padStart(2, '0')

  const TYPES = {
    'N.A.':                    { label:'Nouvelles Affaires',       col:'#16a34a', sign:+1 },
    'Mandat faveur':            { label:'Mandats faveur',           col:'#0080BD', sign:+1 },
    'Mandat défaveur':          { label:'Mandats défaveur',         col:'#f59e0b', sign:-1 },
    'Renon':                    { label:'Résiliations',             col:'#dc2626', sign:-1 },
    'Résiliation Non paiement': { label:'Résil. non-paiement',      col:'#dc2626', sign:-1 },
    'Avenant':                  { label:'Avenants',                 col:'#94a3b8', sign:0  },
  }

  useEffect(() => {
    supabase.from('mouvements_production')
      .select('type_prod, agent_code, annee, mois')
      .eq('annee', annee)
      .then(({ data }) => { setProd(data || []); setLoading(false) })
  }, [])

  // Comptage par type pour le mois en cours et l'année
  const byType = {}
  Object.keys(TYPES).forEach(t => { byType[t] = { mois: 0, annee: 0 } })
  prod.forEach(p => {
    if (!byType[p.type_prod]) return
    byType[p.type_prod].annee++
    if (p.mois === mois) byType[p.type_prod].mois++
  })

  // Solde net NA
  const naAnnee = byType['N.A.']?.annee || 0
  const renonAnnee = (byType['Renon']?.annee || 0) + (byType['Résiliation Non paiement']?.annee || 0) + (byType['Mandat défaveur']?.annee || 0)
  const soldeNet = naAnnee - renonAnnee

  // Top agents NA ce mois
  const agentsMois = {}
  prod.filter(p => p.mois === mois && p.type_prod === 'N.A.').forEach(p => {
    agentsMois[p.agent_code] = (agentsMois[p.agent_code] || 0) + 1
  })
  const topAgents = Object.entries(agentsMois).sort((a,b) => b[1]-a[1]).slice(0,5)

  const AGENT_NOMS = { GGO:'G. Godfroid', TJA:'T. Japsenne', PFQ:'P. Fernandez', MTE:'M. Terrana', NGI:'N. Ginis', LDE:'L. Detilloux' }

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-chart-line" style={{ fontSize:16, color:'#0080BD' }} />
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Production {annee}</span>
        </div>
        <span style={{ fontSize:11, background:'#e0f2fe', color:'#0080BD', padding:'2px 8px', borderRadius:10, fontWeight:700 }}>DYNASSUR</span>
      </div>

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
      ) : (
        <div style={{ padding:16 }}>

          {/* Solde net en gros */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div style={{ background: soldeNet>=0?'#f0fdf4':'#fff5f5', borderRadius:8, padding:'12px 14px', border:`1px solid ${soldeNet>=0?'#bbf7d0':'#fecaca'}` }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde net {annee}</div>
              <div style={{ fontSize:26, fontWeight:900, color: soldeNet>=0?'#16a34a':'#dc2626' }}>{soldeNet>0?'+':''}{fmtN(soldeNet)}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{fmtN(naAnnee)} NA − {fmtN(renonAnnee)} résil.</div>
            </div>
            <div style={{ background:'#eff6ff', borderRadius:8, padding:'12px 14px', border:'1px solid #bfdbfe' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>NA ce mois</div>
              <div style={{ fontSize:26, fontWeight:900, color:'#0080BD' }}>{fmtN(byType['N.A.']?.mois||0)}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>Mois {mois}/{annee}</div>
            </div>
          </div>

          {/* Tableau types de mouvements */}
          <div style={{ marginBottom:14 }}>
            {Object.entries(TYPES).filter(([,v])=>v.sign!==0).map(([type, cfg]) => {
              const d = byType[type] || { mois:0, annee:0 }
              if (d.annee === 0 && d.mois === 0) return null
              return (
                <div key={type} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid #f8fafc' }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:cfg.col, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#64748b', flex:1 }}>{cfg.label}</span>
                  <span style={{ fontSize:11, color:'#94a3b8' }}>ce mois : <strong style={{ color:cfg.col }}>{d.mois}</strong></span>
                  <span style={{ fontSize:12, fontWeight:700, color:cfg.col, minWidth:30, textAlign:'right' }}>{d.annee}</span>
                </div>
              )
            })}
          </div>

          {/* Top agents NA ce mois */}
          {topAgents.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Top NA — mois en cours</div>
              {topAgents.map(([code, nb]) => (
                <div key={code} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <span style={{ fontSize:11, color:'#64748b', flex:1 }}>{AGENT_NOMS[code]||code}</span>
                  <div style={{ flex:2, background:'#f1f5f9', borderRadius:3, height:6, overflow:'hidden' }}>
                    <div style={{ width:`${nb/Math.max(...topAgents.map(a=>a[1]))*100}%`, height:'100%', background:'#0080BD', borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'#0080BD', minWidth:20, textAlign:'right' }}>{nb}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════
export default function DashboardGroupe() {
  const [comptes, setComptes]           = useState([])
  const [transactions, setTransactions] = useState([])
  const [taches, setTaches]             = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          { data: cpts },
          { data: txs },
          { data: tsk },
        ] = await Promise.all([
          supabase.from('comptes_bancaires').select('*, societes(code,nom)').eq('actif', true).order('banque'),
          supabase.from('transactions').select('id,date,date_valeur,montant,societe_id').gte('date', new Date(new Date().setMonth(new Date().getMonth()-6)).toISOString().slice(0,10)).limit(2000),
          supabase.from('taches').select('*').in('statut',['en_cours','en_attente','retard','urgent']).order('echeance',{ascending:true}).limit(100),
        ])
        setComptes(cpts || [])
        setTransactions(txs || [])
        setTaches(tsk || [])
      } catch(e) { console.error('DashboardGroupe load error:', e) }
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const nbRetard  = taches.filter(t => t.echeance && new Date(t.echeance) < now).length
  const nbEnCours = taches.filter(t => t.statut==='en_cours').length
  const totalSoldes = comptes.reduce((s,c) => s+(c.solde_actuel||0), 0)

  return (
    <Layout currentPage="Tableau de bord général">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:1300 }}>

        {/* Titre */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:'0 0 4px' }}>Tableau de bord général</h1>
          <p style={{ fontSize:14, color:'#64748b', margin:0 }}>Vue consolidée — Groupe DTX · Dynassur · LODE · Hexagroup · Privé</p>
        </div>

        {/* KPIs rapides */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:28 }}>
          <KpiCard label="Tâches en cours" value={nbEnCours} col="#f59e0b" icon="ti-checkbox" sub={`dont ${nbRetard} en retard`} />
          <KpiCard label="Tâches en retard" value={nbRetard} col={nbRetard>0?"#dc2626":"#16a34a"} icon="ti-alert-triangle" sub={nbRetard>0?'⚠ action requise':'✓ aucun retard'} />
          <KpiCard label="Comptes connectés" value={comptes.length} col="#7c3aed" icon="ti-credit-card" sub="via Ponto / ING" />
          <KpiCard label="Objectifs 2026" value="configurés" col="#0080BD" icon="ti-target" sub="Dynassur — voir détail" />
        </div>

        {/* Grille principale : 2 colonnes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
          <BlocBanque comptes={comptes} loading={loading} />
          <BlocTaches taches={taches} loading={loading} />
        </div>

        {/* Grille secondaire : 2 colonnes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <BlocTresorerie comptes={comptes} transactions={transactions} loading={loading} />
          <BlocProduction />
        </div>

      </div>
    </Layout>
  )
}
