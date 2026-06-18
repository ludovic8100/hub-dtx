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
  const [revealed, setRevealed] = useState({})

  function toggle(id) {
    setRevealed(r => ({ ...r, [id]: !r[id] }))
  }

  // Solde total si tout révélé
  const totalVisible = comptes.filter(c => revealed[c.id]).reduce((s,c) => s+(c.solde_actuel||0), 0)
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
          <button onClick={() => {
            const next = !allRevealed
            const all = {}
            comptes.forEach(c => { all[c.id] = next })
            setRevealed(all)
          }} style={{ fontSize:12, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #ede9fe', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>
            {allRevealed ? '🔒 Masquer tout' : '👁 Révéler tout'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8', fontSize:13 }}>Chargement…</div>
      ) : comptes.length === 0 ? (
        <div style={{ padding:30, textAlign:'center', color:'#94a3b8', fontSize:13 }}>
          <i className="ti ti-plug-off" style={{ fontSize:28, display:'block', marginBottom:8 }} />
          Aucun compte connecté — synchronisation Ponto requise
        </div>
      ) : (
        <>
          <div style={{ padding:'8px 0' }}>
            {comptes.map((c, i) => {
              const soc = SOCIETES[c.societes?.code] || {}
              const show = revealed[c.id]
              const bal = c.solde_actuel || 0
              const isNeg = bal < 0
              return (
                <div key={c.id} style={{
                  display:'grid', gridTemplateColumns:'auto 1fr auto auto',
                  alignItems:'center', gap:12,
                  padding:'10px 18px',
                  borderBottom: i < comptes.length-1 ? '1px solid #f8fafc' : 'none',
                  background: i%2===0?'#fff':'#fafafe',
                  transition:'background 0.1s'
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='#f5f3ff20'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafe'}
                >
                  {/* Pastille société */}
                  <div style={{ width:8, height:8, borderRadius:'50%', background:soc.color||'#94a3b8', flexShrink:0 }} />

                  {/* Nom + IBAN */}
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>{c.banque || '—'}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>
                      <span style={{ background:soc.color+'18', color:soc.color, fontWeight:700, padding:'1px 5px', borderRadius:3, fontSize:10, marginRight:5 }}>{soc.short||'?'}</span>
                      {c.iban ? `${c.iban.slice(0,4)} •• ${c.iban.slice(-4)}` : 'Compte courant'}
                    </div>
                  </div>

                  {/* Solde masqué/révélé */}
                  <div style={{ textAlign:'right', minWidth:110 }}>
                    {show ? (
                      <span style={{ fontSize:16, fontWeight:800, color: isNeg?'#dc2626':'#0f172a', letterSpacing:'.01em' }}>
                        {fmt(bal)}
                      </span>
                    ) : (
                      <span style={{ fontSize:16, fontWeight:800, color:'#e2e8f0', letterSpacing:'.05em', userSelect:'none' }}>
                        ● ● ● ● ●
                      </span>
                    )}
                    {c.solde_actuel_date && (
                      <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>
                        {show ? `Mis à jour ${fmtDate(c.solde_actuel_date)}` : ' '}
                      </div>
                    )}
                  </div>

                  {/* Bouton toggle */}
                  <button onClick={() => toggle(c.id)} title={show?'Masquer':'Révéler'} style={{
                    background: show?'#f0fdf4':'#f8fafc',
                    border:`1px solid ${show?'#bbf7d0':'#e2e8f0'}`,
                    borderRadius:6, padding:'5px 8px', cursor:'pointer',
                    color: show?'#16a34a':'#94a3b8', fontSize:14, transition:'all 0.15s'
                  }}>
                    <i className={`ti ${show?'ti-eye-off':'ti-eye'}`} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Total si au moins un compte révélé */}
          {Object.values(revealed).some(Boolean) && (
            <div style={{ padding:'10px 18px', background:'#f8fafc', borderTop:'2px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.05em' }}>
                Total visible ({comptes.filter(c=>revealed[c.id]).length} comptes)
              </span>
              <span style={{ fontSize:18, fontWeight:800, color: totalVisible<0?'#dc2626':'#0f172a' }}>{fmt(totalVisible)}</span>
            </div>
          )}
        </>
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
  const currentMonth = now.getMonth()

  // Soldes par société
  const soldesParSoc = Object.entries(SOCIETES).map(([key, cfg]) => {
    const total = comptes.filter(c=>c.societes?.code===key).reduce((s,c)=>s+(c.solde_actuel||0),0)
    return { key, ...cfg, total }
  }).filter(s => s.total !== 0)

  const totalGroupe = soldesParSoc.reduce((s,r)=>s+r.total,0)

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
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>Solde total groupe</div>
          <div style={{ fontSize:32, fontWeight:900, color: totalGroupe<0?'#dc2626':'#0f172a' }}>{fmt(totalGroupe)}</div>
        </div>

        {/* Par société */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
          {soldesParSoc.map(s => (
            <div key={s.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:s.color, flexShrink:0 }} />
              <span style={{ fontSize:12, color:'#64748b', flex:1 }}>{s.label}</span>
              <span style={{ fontSize:13, fontWeight:700, color: s.total<0?'#dc2626':'#1e293b' }}>{fmt(s.total)}</span>
              <div style={{ width:80 }}>
                <div style={{ background:'#f1f5f9', borderRadius:3, height:5, overflow:'hidden' }}>
                  <div style={{ width:`${Math.abs(s.total)/Math.max(Math.abs(totalGroupe),1)*100}%`, height:'100%', background:s.color, borderRadius:3 }} />
                </div>
              </div>
            </div>
          ))}
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
// BLOC 4 — Objectifs par société
// ══════════════════════════
function BlocObjectifs({ objectifs, loading }) {
  const navigate = useNavigate()

  const SOCIETES_OBJ = [
    { key:'dynassur', label:'Dynassur SRL', route:'/dynassur/objectifs' },
  ]

  const global2026 = objectifs.filter(o => o.year===2026 && o.period_type==='year')

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-target" style={{ fontSize:16, color:'#0080BD' }} />
          <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Objectifs 2026</span>
        </div>
        <button onClick={() => navigate('/dynassur/objectifs')} style={{ fontSize:11, color:'#0080BD', background:'#e0f2fe', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>
          Voir détail →
        </button>
      </div>

      <div style={{ padding:16 }}>
        {loading ? (
          <div style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>Chargement…</div>
        ) : global2026.length === 0 ? (
          <div style={{ textAlign:'center', color:'#94a3b8', padding:20, fontSize:13 }}>Aucun objectif configuré</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {global2026.map(obj => {
              const soc = obj.scope==='global' ? { label:'Dynassur — Global', color:'#0080BD' }
                : { label: obj.agent_code || 'Agent', color:'#64748b' }
              return (
                <div key={obj.id} style={{ padding:'12px 14px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:soc.color, marginBottom:10 }}>{soc.label}</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {obj.target_na > 0 && (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>Nouvelles Affaires</span>
                          <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{fmtN(obj.actual_na)} / {fmtN(obj.target_na)}</span>
                        </div>
                        <Bar pct={obj.pct_na} col={soc.color} />
                      </div>
                    )}
                    {obj.target_primes > 0 && (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>Primes</span>
                          <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{fmt(obj.actual_primes)} / {fmt(obj.target_primes)}</span>
                        </div>
                        <Bar pct={obj.pct_primes} col={soc.color} />
                      </div>
                    )}
                    {obj.target_commissions > 0 && (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>Commissions</span>
                          <span style={{ fontSize:11, fontWeight:700, color:'#0f172a' }}>{fmt(obj.actual_commissions)} / {fmt(obj.target_commissions)}</span>
                        </div>
                        <Bar pct={obj.pct_commissions} col={soc.color} />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
  const [objectifs, setObjectifs]       = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          { data: cpts },
          { data: txs },
          { data: tsk },
          { data: obj },
        ] = await Promise.all([
          supabase.from('comptes_bancaires').select('*, societes(code,nom)').eq('actif', true).order('banque'),
          supabase.from('transactions').select('id,date,date_valeur,montant,societe_id').gte('date', new Date(new Date().setMonth(new Date().getMonth()-6)).toISOString().slice(0,10)).limit(2000),
          supabase.from('taches').select('*').in('statut',['en_cours','en_attente','retard','urgent']).order('echeance',{ascending:true}).limit(100),
          supabase.from('objectives_global').select('*').eq('year',2026).eq('period_type','year'),
        ])
        setComptes(cpts || [])
        setTransactions(txs || [])
        setTaches(tsk || [])
        setObjectifs(obj || [])
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
          <BlocObjectifs objectifs={objectifs} loading={loading} />
        </div>

      </div>
    </Layout>
  )
}
