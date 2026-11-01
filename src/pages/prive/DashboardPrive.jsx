import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import BlocComptes from '../../components/BlocComptes'
import { ENTITES } from '../../lib/entites'
import { StatBanner, DataCard, StatusBadge } from '../../components/ui/AccountableUI'
import { SyncButtonsRow } from '../../components/SyncCards'

const E = ENTITES.prive
const fmt = v => v == null ? '—' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit' }) : '—'

function KpiCard({ label, value, icon, color, sub, onClick }) {
  return (
    <div onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
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
    </div>
  )
}

export default function DashboardPrive() {
  const { perms, user, isAdmin } = useAuth()
  const [tickets, setTickets] = useState([])
  const navigate = useNavigate()
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
      const [{ data: txs }, { data: tck }] = await Promise.all([
        socId ? supabase.from('transactions').select('montant').eq('societe_id', socId)
          .gte('date_valeur', annee + '-' + mois + '-01').lte('date_valeur', annee + '-' + mois + '-31') : { data: [] },
        supabase.from('taches').select('id,titre,gestionnaire,ticket_statut,priorite,derniere_activite').eq('is_ticket', true).neq('statut', 'terminee').eq('entite', 'prive').order('derniere_activite', { ascending: false }).limit(50),
      ])
      setTickets(tck || [])
      const entrees = (txs || []).filter(t => t.montant > 0).reduce((s, t) => s + t.montant, 0)
      const sorties = (txs || []).filter(t => t.montant < 0).reduce((s, t) => s + Math.abs(t.montant), 0)
      setTxStats({ entrees, sorties })
      setLoading(false)
    }
    load()
  }, [])

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title={`Bonjour ${firstName || ''}`.trim()}
          subtitle="Privé — aperçu de l'activité"
          stats={[
            { label: 'Tickets ouverts', value: loading ? '…' : tickets.length },
            { label: 'Entrées ce mois', value: loading ? '…' : fmt(txStats.entrees) },
            { label: 'Sorties ce mois', value: loading ? '…' : fmt(txStats.sorties) },
          ]}
        />

        <div style={{ marginBottom:20 }}>
          <SyncButtonsRow />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 22 }}>
          <KpiCard label="Tickets ouverts" value={loading ? '…' : tickets.length} icon="ti-ticket" color="#0ea5e9" sub="cliquer pour voir" onClick={() => navigate('/tickets')} />
          <KpiCard label="Entrées ce mois" value={loading ? '…' : fmt(txStats.entrees)} icon="ti-trending-up" color="#16a34a" />
          <KpiCard label="Sorties ce mois" value={loading ? '…' : fmt(txStats.sorties)} icon="ti-trending-down" color="#dc2626" />
        </div>

        <div style={{ marginBottom: 22 }}>
          {isAdmin && <BlocComptes societeCode="PRIVE" color={E.color} />}
        </div>

        <DataCard>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-ticket" style={{ fontSize: 15, color: '#0ea5e9' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Tickets ouverts</span>
            <span onClick={() => navigate('/tickets')} style={{ marginLeft: 'auto', fontSize: 12, color: '#0ea5e9', cursor: 'pointer', fontWeight: 600 }}>Tous les tickets →</span>
          </div>
          {loading
            ? <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Chargement…</div>
            : tickets.length === 0
              ? <div style={{ padding: 30, textAlign: 'center', color: '#16a34a', fontSize: 13 }}>Aucun ticket ouvert</div>
              : <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {tickets.map((t, i) => (
                    <div key={t.id} onClick={() => navigate('/tickets?ticket=' + t.id)} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 8, padding: '10px 18px', borderBottom: i < tickets.length - 1 ? '1px solid #f8fafc' : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>#{t.id} — {t.titre || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.gestionnaire || 'non assigné'} · {fmtDate(t.derniere_activite)}</div>
                      </div>
                      <StatusBadge tone="blue" label={t.ticket_statut || 'ouvert'} />
                    </div>
                  ))}
                </div>
          }
        </DataCard>
      </div>
    </Layout>
  )
}
