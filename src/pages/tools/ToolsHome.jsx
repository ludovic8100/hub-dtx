import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'

// ─── Boîte à outils interne ───
// Ajouter un outil = ajouter une entrée ici (ready:false => carte grisée "Bientôt").
// Chaque outil ready:true doit avoir sa route dans App.jsx (gated need="acc_tools").
const TOOLS = [
  {
    key: 'bce',
    title: 'Recherche BCE',
    desc: "Rechercher une entreprise belge par nom ou n° BCE et consulter ses données officielles (KBO/BCE).",
    icon: 'ti-building-bank',
    path: '/tools/bce',
    ready: true,
  },
]

export default function ToolsHome() {
  const navigate = useNavigate()
  return (
    <Layout currentPage="Outils">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>🧰 Outils</h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>Boîte à outils interne — utilitaires pour nous faciliter le travail</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {TOOLS.map(t => (
            <div key={t.key}
              onClick={() => t.ready && navigate(t.path)}
              onMouseEnter={e => { if (t.ready) { e.currentTarget.style.borderColor = '#0ea5e9'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(14,165,233,0.15)' } }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
              style={{
                border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 16px 14px', background: '#fff',
                cursor: t.ready ? 'pointer' : 'default', opacity: t.ready ? 1 : 0.55, transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', minHeight: 140,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${t.icon}`} style={{ fontSize: 20, color: '#0369a1' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{t.title}</div>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, flex: 1 }}>{t.desc}</div>
              <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: t.ready ? '#0ea5e9' : '#94a3b8' }}>
                {t.ready ? 'Ouvrir →' : 'Bientôt'}
              </div>
            </div>
          ))}

          <div style={{
            border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: '16px', background: '#fafafa',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', minHeight: 140, color: '#94a3b8',
          }}>
            <i className="ti ti-plus" style={{ fontSize: 22, marginBottom: 6 }} />
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>Un outil à ajouter ?<br />Dis-le et on le branche ici.</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
