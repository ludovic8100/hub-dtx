import { useNavigate } from 'react-router-dom'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import { OUTILS, aDroitOutil } from '../../lib/outils'
import { COUL } from '../../lib/theme'

// Page d'accueil de la boîte à outils. Elle ne décide rien : elle affiche le
// registre (src/lib/outils.js), filtré par les droits du collaborateur.
// Un outil auquel on n'a pas accès n'apparaît plus du tout — avant, la carte
// « Droit de Succession » s'affichait pour tout le monde et menait à un refus.

const cardBase = {
  border: '1px solid #e2e8f0',
  borderRadius: 14,
  background: COUL.surface,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'row',
  minHeight: 160,
  transition: 'all 0.2s ease',
}

// Carte annoncée en permanence en fin de liste — pas un outil du registre.
const A_VENIR = {
  cle: '__a-venir',
  titre: 'En cours de développement',
  description: 'De nouveaux outils arrivent bientôt. Restez connectés !',
  icone: '/assets/tools/icon-ai.png',
}

export default function ToolsHome() {
  const navigate = useNavigate()
  const { perms } = useAuth()

  const cartes = [
    ...OUTILS.filter(o => o.composant && aDroitOutil(perms, o.permission)),
    A_VENIR,
  ]

  return (
    <Layout currentPage="Outils">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: COUL.marineClair, margin: 0 }}>
            Outils
          </h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>
            Boîte à outils interne — utilitaires pour nous faciliter le travail
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 18,
        }}>
          {cartes.map(t => {
            const pret = !!t.chemin
            return (
              <div
                key={t.cle}
                onClick={() => pret && navigate(t.chemin)}
                onMouseEnter={e => {
                  if (pret) {
                    e.currentTarget.style.borderColor = '#0ea5e9'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(14,165,233,0.18)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = COUL.bord
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'none'
                }}
                style={{
                  ...cardBase,
                  cursor: pret ? 'pointer' : 'default',
                  opacity: pret ? 1 : 0.7,
                }}
              >
                {/* Moitié gauche — icône */}
                <div style={{
                  width: '42%',
                  background: pret
                    ? 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)'
                    : 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  flexShrink: 0,
                }}>
                  <img
                    src={t.icone}
                    alt={t.titre}
                    style={{
                      width: '85%',
                      maxWidth: 120,
                      height: 'auto',
                      objectFit: 'contain',
                      filter: pret ? 'none' : 'grayscale(0.4)',
                    }}
                  />
                </div>

                {/* Moitié droite — texte */}
                <div style={{
                  flex: 1,
                  padding: '18px 18px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COUL.texte, marginBottom: 8 }}>
                    {t.titre}
                  </div>
                  <div style={{ fontSize: 12.5, color: COUL.texteDoux, lineHeight: 1.55, flex: 1 }}>
                    {t.description}
                  </div>
                  <div style={{
                    marginTop: 12,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: pret ? '#0ea5e9' : COUL.texteFaible,
                  }}>
                    {pret ? 'Ouvrir →' : 'Bientôt'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}
