import Layout from './Layout'

export default function PageEnConstruction({ titre, icon, color = '#0080BD', currentPage }) {
  return (
    <Layout currentPage={currentPage || titre}>
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: '1200px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px' }}>{titre}</h1>
        </div>
        <div style={{
          background: '#fff', borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '64px 32px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '72px', height: '72px',
            background: color + '18',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <i className={`ti ${icon}`} style={{ fontSize: '36px', color }} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>
            {titre}
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 6px' }}>
            Ce module est en cours de développement.
          </p>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
            La structure de données est prête — l'interface arrive prochainement.
          </p>
        </div>
      </div>
    </Layout>
  )
}
