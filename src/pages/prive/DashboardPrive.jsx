import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import BlocComptes from '../../components/BlocComptes'
import { ENTITES } from '../../lib/entites'
import { StatBanner, DataCard, StatusBadge } from '../../components/ui/AccountableUI'

const E = ENTITES.prive
const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'

function KpiCard({ label, value, icon, color, sub }) {
  return (
    <DataCard style={{ padding: 20, borderTop: `3px solid ${color}`, borderRadius: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, background: color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className={'ti ' + icon} style={{ fontSize: 22, color }} />
        </div>
      </div>
    </DataCard>
  )
}

export default function DashboardPrive() {
  const { perms, user } = useAuth()
  const [taches, setTaches] = useState([])
  const [txStats, setTxStats] = useState({ entrees: 0, sorties: 0 })
  const [loading, setLoading] = useState(true)

  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]
  const now = new Date()
  const mois = String(now.getMonth() + 1).padStart(2, '0')
  const annee = now.getFullYear()

  useEffect(() => {
    async function load() {
      const { data: socData } = await supabase.from('societes').select('id').eq('code', 'PRIVE').single()
      const socId = socData?.id
      const [{ data: tsk }, { data: txs }] = await Promise.all([
        supabase.from('taches').select('id,titre,gestionnaire,echeance,statut')
          .in('statut', ['en_cours', 'en_attente', 'retard']).order('echeance', { ascending: true }).limit(10),
        socId ? supabase.from('transactions').select('montant').eq('societe_id', socId)
          .gte('date_valeur', annee + '-' + mois + '-01').lte('date_valeur', annee + '-' + mois + '-31') : { data: [] },
      ])
      setTaches(tsk || [])
      const entrees = (txs || []).filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0)
      const sorties = (txs || []).filter(t => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0)
      setTxStats({ entrees, sorties })
      setLoading(false)
    }
    load()
  }, [])

  const nbRetard = taches.filter(t => t.echeance && new Date(t.echeance) < now).length

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title={`Bonjour ${firstName || ''}`.trim()}
          subtitle="Privé — aperçu de l'activité"
          stats={[
            { label: 'Tâches en cours', value: loading ? '…' : taches.length },
            { label: 'Entrées ce mois', value: loading ? '…' : fmt(txStats.entrees) },
            { label: 'Sorties ce mois', value: loading ? '…' : fmt(txStats.sorties) },
          ]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
          <KpiCard label="Tâches en cours" value={loading ? '…' : taches.length} icon="ti-checkbox" color="#f59e0b" sub={nbRetard + ' en retard'} />
          <KpiCard label="Entrées ce mois" value={loading ? '…' : fmt(txStats.entrees)} icon="ti-trending-up" color="#16a34a" />
          <KpiCard label="Sorties ce mois" value={loading ? '…' : fmt(txStats.sorties)} icon="ti-trending-down" color="#dc2626" />
        </div>

        <div style={{ marginBottom: 22 }}>
          <BlocComptes societeCode="PRIVE" color={E.color} />
        </div>

        <DataCard>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-checkbox" style={{ fontSize: 15, color: '#f59e0b' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Tâches en cours</span>
            {nbRetard > 0 && <StatusBadge tone="red" label={`${nbRetard} en retard`} />}
          </div>
          {loading
            ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div>
            : taches.length === 0
              ? <div style={{ padding: 30, textAlign: 'center', color: '#16a34a', fontSize: 13 }}>Aucune tâche en cours</div>
              : <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {taches.map((t, i) => {
                    const retard = t.echeance && new Date(t.echeance) < now
                    return (
                      <div key={t.id} style={{
                        display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 8,
                        padding: '10px 18px', borderBottom: i < taches.length - 1 ? '1px solid #f8fafc' : 'none',
                        background: retard ? '#fff5f5' : '#fff',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: retard ? 700 : 500, color: '#1e293b' }}>{t.titre || '—'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.gestionnaire || '—'}</div>
                        </div>
                        <span style={{ fontSize: 11, color: retard ? '#dc2626' : '#94a3b8', fontWeight: retard ? 700 : 400 }}>{fmtDate(t.echeance)}</span>
                        <StatusBadge tone={retard ? 'red' : 'blue'} label={retard ? 'En retard' : 'En cours'} />
                      </div>
                    )
                  })}
                </div>
          }
        </DataCard>
      </div>
    </Layout>
  )
}
