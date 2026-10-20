import Layout from '../../components/Layout'
import { useNavigate } from 'react-router-dom'

// ─── Boîte à outils interne ───
const TOOLS = [
  {
    key: 'bce',
    title: 'Recherche BCE',
    desc: "Rechercher une entreprise belge par nom ou n° BCE et consulter ses données officielles (KBO/BCE).",
    img: '/assets/tools/icon-bce.png',
    path: '/tools/bce',
    ready: true,
  },
  {
    key: 'questionnaire',
    title: 'Questionnaire Investisseur',
    desc: "Reconstituer un questionnaire profil investisseur à partir d'un contrat d'assurance-vie (PDF). Profil déduit automatiquement.",
    img: '/assets/tools/icon-questionnaire.png',
    path: '/tools/questionnaire',
    ready: true,
  },
  {
    key: 'devoir-info',
    title: "Devoir d'information non-vie",
    desc: "Remplir le devoir d'information IARD depuis le client et le contrat, conseil personnalisé généré depuis les garanties, signature sur tablette.",
    img: '/assets/tools/icon-questionnaire.png',
    path: '/tools/devoir-information',
    ready: true,
  },
  {
    key: 'dev',
    title: 'En cours de développement',
    desc: "De nouveaux outils arrivent bientôt. Restez connectés !",
    img: '/assets/tools/icon-ai.png',
    path: null,
    ready: false,
  },
]

/* ── Card style ── */
const cardBase = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  background: '#fff',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'row',
  minHeight: 160,
  transition: 'all 0.2s ease',
}

export default function ToolsHome() {
  const navigate = useNavigate()

  return (
    <Layout currentPage="Outils">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>
            Outils
          </h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>
            Boîte à outils interne — utilitaires pour nous faciliter le travail
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 18,
        }}>
          {TOOLS.map(t => (
            <div
              key={t.key}
              onClick={() => t.ready && navigate(t.path)}
              onMouseEnter={e => {
                if (t.ready) {
                  e.currentTarget.style.borderColor = '#0ea5e9'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,165,233,0.18)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'none'
              }}
              style={{
                ...cardBase,
                cursor: t.ready ? 'pointer' : 'default',
                opacity: t.ready ? 1 : 0.7,
              }}
            >
              {/* Left half — icon */}
              <div style={{
                width: '42%',
                background: t.ready
                  ? 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)'
                  : 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                flexShrink: 0,
              }}>
                <img
                  src={t.img}
                  alt={t.title}
                  style={{
                    width: '85%',
                    maxWidth: 120,
                    height: 'auto',
                    objectFit: 'contain',
                    filter: t.ready ? 'none' : 'grayscale(0.4)',
                  }}
                />
              </div>

              {/* Right half — text */}
              <div style={{
                flex: 1,
                padding: '18px 18px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: 8,
                }}>
                  {t.title}
                </div>
                <div style={{
                  fontSize: 12.5,
                  color: '#64748b',
                  lineHeight: 1.55,
                  flex: 1,
                }}>
                  {t.desc}
                </div>
                <div style={{
                  marginTop: 12,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: t.ready ? '#0ea5e9' : '#94a3b8',
                }}>
                  {t.ready ? 'Ouvrir →' : 'Bientôt'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
