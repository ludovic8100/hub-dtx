import Layout from './Layout'
import { StatBanner } from './ui/AccountableUI'

export default function PageEnConstruction({ titre, icon, color = '#0080BD', colorDark, logoUrl, currentPage, sousTitre }) {
  return (
    <Layout currentPage={currentPage || titre}>
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={color} colorDark={colorDark || color} logoUrl={logoUrl} title={titre} subtitle={sousTitre} />
        <div style={{
          background: '#fff', borderRadius: 14, border: '1px solid #eef2f6',
          padding: '64px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width: 72, height: 72, background: color + '18', borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <i className={`ti ${icon}`} style={{ fontSize: 36, color }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>{titre}</h2>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 6px' }}>Ce module est en cours de développement.</p>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>La structure de données est prête — l'interface arrive prochainement.</p>
        </div>
      </div>
    </Layout>
  )
}
