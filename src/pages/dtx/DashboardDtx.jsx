import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import BlocComptes from '../../components/BlocComptes'

const fmt = v => v==null?'—':new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE',{day:'2-digit',month:'2-digit'}) : '—'

function KpiCard({ label, value, icon, color, sub }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:20, border:'1px solid #e2e8f0', borderTop:'3px solid '+color }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:28, fontWeight:800, color:'#0f172a', lineHeight:1 }}>{value}</div>
          {sub && <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ width:44, height:44, background:color+'18', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <i className={'ti '+icon} style={{ fontSize:22, color:color }} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardDtx() {
  const { perms, user } = useAuth()
  const [taches, setTaches]     = useState([])
  const [txStats, setTxStats]   = useState({ entrees:0, sorties:0 })
  const [loading, setLoading]   = useState(true)

  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]
  const now = new Date()
  const mois = String(now.getMonth()+1).padStart(2,'0')
  const annee = now.getFullYear()

  useEffect(() => {
    async function load() {
      const { data: socData } = await supabase.from('societes').select('id').eq('code', 'DTX').single()
      const socId = socData?.id
      const [{ data: tsk }, { data: txs }] = await Promise.all([
        supabase.from('taches').select('id,titre,gestionnaire,echeance,statut')
          .in('statut',['en_cours','en_attente','retard']).order('echeance',{ascending:true}).limit(10),
        socId ? supabase.from('transactions').select('montant').eq('societe_id', socId)
          .gte('date_valeur', annee+'-'+mois+'-01').lte('date_valeur', annee+'-'+mois+'-31') : { data:[] },
      ])
      setTaches(tsk || [])
      const entrees = (txs||[]).filter(t=>t.montant>0).reduce((s,t)=>s+t.montant,0)
      const sorties = (txs||[]).filter(t=>t.montant<0).reduce((s,t)=>s+Math.abs(t.montant),0)
      setTxStats({ entrees, sorties })
      setLoading(false)
    }
    load()
  }, [])

  const nbRetard = taches.filter(t=>t.echeance&&new Date(t.echeance)<now).length

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:1200 }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#334155', margin:'0 0 4px' }}>Bonjour {firstName} 👋</h1>
          <p style={{ fontSize:14, color:'#64748b', margin:0 }}>DTX SRL — aperçu de l'activité</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          <KpiCard label="Tâches en cours" value={loading?'…':taches.length}        icon="ti-checkbox"      color="#f59e0b" sub={nbRetard+' en retard'} />
          <KpiCard label="Entrées ce mois" value={loading?'…':fmt(txStats.entrees)} icon="ti-trending-up"   color="#16a34a" />
          <KpiCard label="Sorties ce mois" value={loading?'…':fmt(txStats.sorties)} icon="ti-trending-down" color="#dc2626" />
        </div>
        <div style={{ marginBottom:24 }}>
          <BlocComptes societeCode="DTX" color="#94a3b8" />
        </div>
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:8 }}>
            <i className="ti ti-checkbox" style={{ fontSize:15, color:'#f59e0b' }} />
            <span style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>Tâches en cours</span>
            {nbRetard > 0 && <span style={{ fontSize:11, background:'#fee2e2', color:'#dc2626', padding:'2px 7px', borderRadius:10, fontWeight:700 }}>{nbRetard} en retard</span>}
          </div>
          {loading
            ? <div style={{ padding:30, textAlign:'center', color:'#94a3b8' }}>Chargement…</div>
            : taches.length === 0
              ? <div style={{ padding:30, textAlign:'center', color:'#16a34a', fontSize:13 }}>✓ Aucune tâche en cours</div>
              : <div style={{ maxHeight:300, overflowY:'auto' }}>
                  {taches.map((t,i) => {
                    const retard = t.echeance && new Date(t.echeance) < now
                    return (
                      <div key={t.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:8,
                        padding:'9px 18px', borderBottom:i<taches.length-1?'1px solid #f8fafc':'none',
                        background:retard?'#fff5f5':i%2===0?'#fff':'#fafafe' }}>
                        <div>
                          <div style={{ fontSize:13, fontWeight:retard?700:500, color:'#1e293b' }}>{t.titre||'—'}</div>
                          <div style={{ fontSize:11, color:'#94a3b8' }}>{t.gestionnaire||'—'}</div>
                        </div>
                        <span style={{ fontSize:11, color:retard?'#dc2626':'#94a3b8', fontWeight:retard?700:400 }}>{fmtDate(t.echeance)}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4,
                          background:retard?'#fee2e2':'#dbeafe', color:retard?'#dc2626':'#1d4ed8' }}>
                          {retard?'⚠':'✓'}
                        </span>
                      </div>
                    )
                  })}
                </div>
          }
        </div>
      </div>
    </Layout>
  )
}
