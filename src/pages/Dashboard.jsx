import Layout from '../components/Layout'
import { useAuth } from '../lib/auth'

export default function Dashboard() {
  const { perms, user } = useAuth()

  const displayName = perms?.nom || user?.user_metadata?.full_name || ''
  const firstName = displayName.split(' ')[0]

  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: '1200px' }}>

        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0D2F5E', margin: '0 0 6px' }}>
          Bonjour, {firstName} 👋
        </h1>
        <p style={{ fontSize: '15px', color: '#64748b', margin: '0 0 32px' }}>
          Voici un aperçu de l'activité du groupe
        </p>

        {/* Cards stats — à connecter aux vraies données */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Clients actifs', icon: 'ti-users', value: '28 391', color: '#0080BD' },
            { label: 'Contrats en cours', icon: 'ti-file-text', value: '187 612', color: '#0D2F5E' },
            { label: 'Tâches en cours', icon: 'ti-checkbox', value: '—', color: '#f59e0b' },
            { label: 'Sinistres ouverts', icon: 'ti-alert-triangle', value: '—', color: '#dc2626' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>{card.label}</div>
                  <div style={{ fontSize: '26px', fontWeight: '700', color: '#0D2F5E' }}>{card.value}</div>
                </div>
                <div style={{
                  width: '42px', height: '42px',
                  background: card.color + '1a',
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <i className={`ti ${card.icon}`} style={{ fontSize: '20px', color: card.color }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '32px',
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          color: '#94a3b8',
          textAlign: 'center',
          fontSize: '14px'
        }}>
          Les modules de détail (production, bordereaux, objectifs...) sont en cours de développement.
        </div>
      </div>
    </Layout>
  )
}
