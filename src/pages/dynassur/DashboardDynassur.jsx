import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import BlocComptes from '../../components/BlocComptes'

const C = { navy:'#0D2F5E', blue:'#0080BD', cyan:'#5DC3E8', ok:'#16a34a', warn:'#f59e0b', danger:'#dc2626', border:'#e2e8f0', bg:'#f8fafc', text:'#1e293b', muted:'#94a3b8' }
const fmt = v => v==null?'—':new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtN = v => v==null?'—':new Intl.NumberFormat('fr-BE').format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}) : '—'

function KpiCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:20, border:`1px solid ${C.border}`, borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ width:44, height:44, background:color+'18', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className={`ti ${icon}`} style={{ fontSize:22, color }} />
        </div>
      </div>
    </div>
  )
}

function Bar({ pct, col }) {
  const p = Math.min(pct||0, 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, background:'#e2e8f0', borderRadius:4, height:6, overflow:'hidden' }}>
        <div style={{ width:`${p}%`, height:'100%', borderRadius:4, background: p>=100?C.ok:p>=70?(col||C.blue):C.warn, transition:'width 0.4s' }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, minWidth:32, color: p>=100?C.ok:p>=70?(col||C.blue):C.warn }}>{Math.round(p)}%</span>
    </div>
  )
}

export default function DashboardDynassur() {
  const { perms, user } = useAuth()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [data, setData] = useState({ stats:{clients:0,taches:0,sinistres:0,naAnnee:0,naMois:0,renonAnnee:0}, taches:[], bordereaux:[], objectifs:[], prodMois:[] })
  const [loading, setLoading] = useState(true)

  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]
  const now = new Date()
  const mois = String(now.getMonth()+1).padStart(2,'0')
  const annee = now.getFullYear()

  useEffect(() => {
    async function load() {
      const [
        { count: nbClients },
        { count: nbTaches },
        { count: nbSinistres },
        { data: tachesData },
        { data: prod },
        { data: bord },
        { data: obj },
      ] = await Promise.all([
        supabase.from('clients').select('*',{count:'exact',head:true}).eq('actif',true),
        supabase.from('taches').select('*',{count:'exact',head:true}).in('statut',['en_cours','en_attente']),
        supabase.from('sinistres').select('*',{count:'exact',head:true}).neq('statut','clos'),
        supabase.from('taches').select('id,titre,gestionnaire,echeance,statut,code_type').in('statut',['en_cours','en_attente','retard']).order('echeance',{ascending:true}).limit(10),
        supabase.from('mouvements_production').select('type_prod,mois,agent_code').eq('annee',annee),
        supabase.from('v_bordereaux_reconciliation').select('annee,mois,type,compagnie,statut_reconciliation').in('statut_reconciliation',['fichier_ok_non_encaisse','fichier_sans_chiffres','commission_sans_fichier','manquant']).eq('annee',annee),
        supabase.from('objectives_global').select('*').eq('year',annee).eq('period_type','year').eq('scope','global'),
      ])

      const naAnnee   = (prod||[]).filter(p=>p.type_prod==='N.A.').length
      const naMois    = (prod||[]).filter(p=>p.type_prod==='N.A.'&&p.mois===mois).length
      const renonAnnee= (prod||[]).filter(p=>['Renon','Résiliation Non paiement','Mandat défaveur'].includes(p.type_prod)).length

      // Top agents NA ce mois
      const agMap = {}
      ;(prod||[]).filter(p=>p.type_prod==='N.A.'&&p.mois===mois).forEach(p=>{agMap[p.agent_code]=(agMap[p.agent_code]||0)+1})
      const prodMois = Object.entries(agMap).sort((a,b)=>b[1]-a[1]).slice(0,5)

      setData({ stats:{clients:nbClients||0,taches:nbTaches||0,sinistres:nbSinistres||0,naAnnee,naMois,renonAnnee}, taches:tachesData||[], bordereaux:bord||[], objectifs:obj||[], prodMois })
      setLoading(false)
    }
    load()
  }, [])

  const { stats, taches, bordereaux, objectifs, prodMois } = data

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data: nb, error } = await supabase.rpc('sync_taches_bordereaux_manquants')
      if (error) throw error
      setSyncResult({ ok: true, nb })
      // Recharger les bordereaux et tâches
      const [{ data: bord }, { data: tsk }] = await Promise.all([
        supabase.from('v_bordereaux_reconciliation').select('annee,mois,type,compagnie,statut_reconciliation').in('statut_reconciliation',['fichier_ok_non_encaisse','fichier_sans_chiffres','commission_sans_fichier','manquant']).eq('annee',annee),
        supabase.from('taches').select('id,titre,gestionnaire,echeance,statut,code_type').in('statut',['en_cours','en_attente','retard']).order('echeance',{ascending:true}).limit(10),
      ])
      setData(d => ({ ...d, bordereaux: bord||[], taches: tsk||[] }))
    } catch(e) {
      setSyncResult({ ok: false, msg: e.message })
    }
    setSyncing(false)
  }
  const obj = objectifs[0]
  const soldeNet = stats.naAnnee - stats.renonAnnee
  const AGENT_NOMS = { GGO:'G. Godfroid', TJA:'T. Japsenne', PFQ:'P. Fernandez', MTE:'M. Terrana', NGI:'N. Ginis', LDE:'L. Detilloux' }

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:1300 }}>

        {/* Titre */}
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:C.navy, margin:'0 0 4px' }}>Bonjour {firstName} 👋</h1>
          <p style={{ fontSize:14, color:C.muted, margin:0 }}>Dynassur SRL — aperçu de l'activité {annee}</p>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          <KpiCard label="Clients actifs"   value={loading?'…':fmtN(stats.clients)}  icon="ti-users"          color={C.blue} />
          <KpiCard label="NA ce mois"       value={loading?'…':stats.naMois}         icon="ti-trending-up"    color={C.ok}   sub={`${fmtN(stats.naAnnee)} sur l'année`} />
          <KpiCard label="Solde net"        value={loading?'…':`${soldeNet>0?'+':''}${fmtN(soldeNet)}`} icon="ti-calculator" color={soldeNet>=0?C.ok:C.danger} sub={`NA − résiliations`} />
          <KpiCard label="Tâches en cours"  value={loading?'…':stats.taches}         icon="ti-checkbox"       color={C.warn} />
          <KpiCard label="Sinistres ouverts"value={loading?'…':stats.sinistres}       icon="ti-alert-triangle" color={C.danger} />
          {bordereaux.length > 0 && <KpiCard label="Bordereaux ⚠" value={bordereaux.length} icon="ti-file-alert" color={C.danger} sub="non réconciliés" />}
        </div>

        {/* Grille 3 colonnes */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:18 }}>

          {/* COL 1 — Production */}
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* Objectifs progression */}
            {obj && (
              <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:18 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:14 }}>Objectifs {annee}</div>
                {obj.target_na > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>Nouvelles Affaires</span>
                      <span style={{ fontSize:12, fontWeight:700 }}>{fmtN(obj.actual_na)} / {fmtN(obj.target_na)}</span>
                    </div>
                    <Bar pct={obj.pct_na} col={C.blue} />
                  </div>
                )}
                {obj.target_primes > 0 && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>Primes</span>
                      <span style={{ fontSize:12, fontWeight:700 }}>{fmt(obj.actual_primes)} / {fmt(obj.target_primes)}</span>
                    </div>
                    <Bar pct={obj.pct_primes} col={C.blue} />
                  </div>
                )}
                {obj.target_commissions > 0 && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:12, color:'#64748b' }}>Commissions</span>
                      <span style={{ fontSize:12, fontWeight:700 }}>{fmt(obj.actual_commissions)} / {fmt(obj.target_commissions)}</span>
                    </div>
                    <Bar pct={obj.pct_commissions} col={C.blue} />
                  </div>
                )}
              </div>
            )}

            {/* Top agents NA ce mois */}
            <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:18 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>Top NA — mois {mois}</div>
              {loading ? <div style={{ color:C.muted, fontSize:13 }}>Chargement…</div>
              : prodMois.length === 0 ? <div style={{ color:C.muted, fontSize:13 }}>Aucune NA ce mois</div>
              : prodMois.map(([code,nb]) => (
                <div key={code} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:12, color:'#64748b', width:90, flexShrink:0 }}>{AGENT_NOMS[code]||code}</span>
                  <div style={{ flex:1, background:'#e2e8f0', borderRadius:3, height:6, overflow:'hidden' }}>
                    <div style={{ width:`${nb/Math.max(...prodMois.map(a=>a[1]))*100}%`, height:'100%', background:C.blue, borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:C.blue, minWidth:20, textAlign:'right' }}>{nb}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COL 2 — Tâches */}
          <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
              <i className="ti ti-checkbox" style={{ fontSize:15, color:C.warn }} />
              <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Tâches en cours</span>
              <span style={{ fontSize:11, background:'#fef3c7', color:'#92400e', padding:'2px 7px', borderRadius:10, fontWeight:700 }}>
                {taches.filter(t=>t.echeance&&new Date(t.echeance)<now).length} en retard
              </span>
            </div>
            {loading ? <div style={{ padding:30, textAlign:'center', color:C.muted }}>Chargement…</div>
            : taches.length === 0 ? <div style={{ padding:30, textAlign:'center', color:C.ok, fontSize:13 }}>✓ Aucune tâche en cours</div>
            : (
              <div style={{ maxHeight:380, overflowY:'auto' }}>
                {taches.map((t,i) => {
                  const retard = t.echeance && new Date(t.echeance) < now
                  return (
                    <div key={t.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:8,
                      padding:'9px 18px', borderBottom:i<taches.length-1?`1px solid ${C.bg}`:'none',
                      background:retard?'#fff5f5':i%2===0?'#fff':C.bg }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:retard?700:500, color:C.text }}>{t.titre||'—'}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{t.gestionnaire||'—'}{t.code_type?` · ${t.code_type}`:''}</div>
                      </div>
                      <span style={{ fontSize:11, color:retard?C.danger:C.muted, fontWeight:retard?700:400 }}>{fmtDate(t.echeance)}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4,
                        background:retard?'#fee2e2':'#dbeafe', color:retard?C.danger:'#1d4ed8' }}>
                        {retard?'⚠ Retard':'En cours'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* COL 3 — Bordereaux */}
          <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <i className="ti ti-file-alert" style={{ fontSize:15, color:C.danger }} />
              <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Bordereaux {annee}</span>
              {bordereaux.length > 0
                ? <span style={{ fontSize:11, background:'#fee2e2', color:C.danger, padding:'2px 7px', borderRadius:10, fontWeight:700 }}>{bordereaux.length} alertes</span>
                : <span style={{ fontSize:11, background:'#dcfce7', color:C.ok, padding:'2px 7px', borderRadius:10, fontWeight:700 }}>✓ OK</span>
              }
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
                {syncResult && (
                  <span style={{ fontSize:11, color: syncResult.ok ? C.ok : C.danger, fontWeight:600 }}>
                    {syncResult.ok ? `✓ ${syncResult.nb} tâche${syncResult.nb>1?'s':''} créée${syncResult.nb>1?'s':''}` : `⚠ ${syncResult.msg}`}
                  </span>
                )}
                <button onClick={handleSync} disabled={syncing} style={{
                  fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6, cursor:syncing?'wait':'pointer',
                  background: syncing?'#f1f5f9':C.blue, color:syncing?C.muted:'#fff',
                  border:`1px solid ${syncing?C.border:C.blue}`, transition:'all 0.15s', display:'flex', alignItems:'center', gap:5
                }}>
                  <i className={`ti ${syncing?'ti-loader-2':'ti-refresh'}`} style={{ fontSize:12, animation:syncing?'spin 1s linear infinite':'' }} />
                  {syncing ? 'Sync…' : 'Créer tâches'}
                </button>
              </div>
            </div>
            <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            {loading ? <div style={{ padding:30, textAlign:'center', color:C.muted }}>Chargement…</div>
            : bordereaux.length === 0 ? <div style={{ padding:30, textAlign:'center', color:C.ok, fontSize:13 }}>✓ Tous les bordereaux sont réconciliés</div>
            : (
              <div style={{ maxHeight:380, overflowY:'auto' }}>
                {bordereaux.map((b,i) => {
                  const STATUT = {
                    fichier_ok_non_encaisse: { label:'Non encaissé',        col:C.warn,   bg:'#fef3c7' },
                    fichier_sans_chiffres:   { label:'Sans chiffres',        col:'#ea580c', bg:'#fff7ed' },
                    commission_sans_fichier: { label:'Sans fichier',         col:'#7c3aed', bg:'#f5f3ff' },
                    manquant:                { label:'Manquant',             col:C.danger,  bg:'#fee2e2' },
                  }
                  const s = STATUT[b.statut_reconciliation]||STATUT.manquant
                  return (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:8,
                      padding:'9px 18px', borderBottom:i<bordereaux.length-1?`1px solid ${C.bg}`:'none',
                      background:i%2===0?'#fff':C.bg }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 5px', borderRadius:3, background:C.blue+'18', color:C.blue }}>{b.type||'RCP'}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{b.compagnie||'—'}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{b.mois}/{b.annee}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, background:s.bg, color:s.col, whiteSpace:'nowrap' }}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop:18 }}>
          <BlocComptes societeCode="DYNASSUR" color="#0080BD" />
        </div>

      </div>
    </Layout>
  )
}
