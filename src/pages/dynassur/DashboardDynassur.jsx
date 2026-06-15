import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '20px',
      border: '1px solid #e2e8f0', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>}
        </div>
        <div style={{ width: '44px', height: '44px', background: color + '18', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ti ${icon}`} style={{ fontSize: '22px', color }} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardDynassur() {
  const { perms, user } = useAuth()
  const [stats, setStats] = useState({ clients: 0, taches: 0, sinistres: 0, mouvements: 0 })
  const [taches, setTaches] = useState([])
  const [loading, setLoading] = useState(true)

  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      const moisActuel = new Date().getMonth() + 1
      const anneeActuelle = new Date().getFullYear()

      const [
        { count: nbClients },
        { count: nbTaches },
        { count: nbSinistres },
        { count: nbMouvements },
        { data: tachesData },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('actif', true),
        supabase.from('taches').select('*', { count: 'exact', head: true }).in('statut', ['en_cours', 'en_attente']),
        supabase.from('sinistres').select('*', { count: 'exact', head: true }).neq('statut', 'clos'),
        supabase.from('mouvements_production').select('*', { count: 'exact', head: true }).eq('annee', anneeActuelle).eq('mois', moisActuel).eq('type_prod', 'N.A.'),
        supabase.from('taches').select('id, titre, gestionnaire, echeance, statut, priorite').in('statut', ['en_cours', 'en_attente', 'retard']).order('echeance', { ascending: true }).limit(8),
      ])

      setStats({ clients: nbClients || 0, taches: nbTaches || 0, sinistres: nbSinistres || 0, mouvements: nbMouvements || 0 })
      setTaches(tachesData || [])
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: '1200px' }}>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0D2F5E', margin: '0 0 4px' }}>
            Bonjour {firstName} 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Dynassur SRL — aperçu de l'activité</p>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
          <StatCard label="Clients actifs" value={loading ? '…' : stats.clients.toLocaleString('fr-BE')} icon="ti-users" color="#0080BD" />
          <StatCard label="NA ce mois" value={loading ? '…' : stats.mouvements} icon="ti-chart-line" color="#16a34a" sub="nouvelles affaires" />
          <StatCard label="Tâches en cours" value={loading ? '…' : stats.taches} icon="ti-checkbox" color="#f59e0b" />
          <StatCard label="Sinistres ouverts" value={loading ? '…' : stats.sinistres} icon="ti-alert-triangle" color="#dc2626" />
        </div>

        {/* Tâches récentes */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Tâches en cours</h2>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{taches.length} tâche{taches.length > 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Chargement…</div>
          ) : taches.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>✓ Aucune tâche en cours</div>
          ) : (
            taches.map((t, i) => {
              const retard = t.echeance && new Date(t.echeance) < now
              return (
                <div key={t.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 120px 90px',
                  padding: '11px 20px', alignItems: 'center',
                  borderBottom: i < taches.length - 1 ? '1px solid #f8fafc' : 'none',
                  background: retard ? '#fff5f5' : '#fff'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b' }}>{t.titre || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{t.gestionnaire || '—'}</div>
                  <div style={{ fontSize: '12px', color: retard ? '#dc2626' : '#64748b', fontWeight: retard ? '600' : '400' }}>
                    {t.echeance ? new Date(t.echeance).toLocaleDateString('fr-BE') : '—'}
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px',
                    background: retard ? '#fee2e2' : '#dbeafe',
                    color: retard ? '#dc2626' : '#1d4ed8'
                  }}>
                    {retard ? '⚠ Retard' : 'En cours'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </Layout>
  )
}
