import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { COUL } from '../lib/theme'
import { AMBIANCES, preferenceLue } from '../lib/themes'

// La page de garde.
//
// LA COUVERTURE PORTE DÉJÀ LE LOGO ET LA SIGNATURE
//
// Les cinq visuels du package sont des images 1672 × 941 où le logo DTX et la
// phrase « Your central platform… » sont INCRUSTÉS. La carte de connexion ne
// doit donc répéter ni l'un ni l'autre — c'est la consigne du brief, et c'est
// aussi la bonne : deux logos l'un sous l'autre, ça se voit.
//
// Avant ce chantier, cette page affichait une icône de banque et le titre
// « Dynassur Hub », alors que l'onglet dit « Hub DTX » depuis le 06/11. Les
// deux disparaissent : l'image dit qui on est, mieux qu'eux.
//
// POURQUOI L'IMAGE EST AU-DESSUS, ET PAS EN FOND
//
// Le logo est au centre de l'image et la signature juste en dessous. Une carte
// posée par-dessus recouvrirait l'un ou l'autre, et un recadrage en bandeau ou
// en demi-écran couperait le logo. L'image est donc montrée ENTIÈRE, en haut
// d'une colonne, la carte dessous. Aucun recadrage, à aucune largeur — ce qui
// règle du même coup la demande de « variantes mobiles moins recadrées ».
//
// ⚠️ LA COUVERTURE AFFICHÉE EST CELLE DU NAVIGATEUR, PAS CELLE DU JOUR
//
// Personne n'est connecté ici : la seule préférence disponible est celle
// mémorisée dans ce navigateur. Quelqu'un qui n'a jamais choisi voit donc
// Standard, même le 24 décembre. C'est la conséquence directe de la règle
// « pas d'ambiance automatique sans validation » — à rouvrir si on veut que
// la page de garde suive le calendrier pour tout le monde.

export default function Login() {
  const { user, loading, signInWithMicrosoft, erreurConnexion } = useAuth()

  // Évite d'afficher à nouveau l'écran de login si une session existe déjà
  // (sinon un simple retour sur /login masque une connexion pourtant réussie).
  if (!loading && user) return <Navigate to="/" replace />

  const pref = preferenceLue()
  const ambiance = AMBIANCES[pref.ambiance] || AMBIANCES.standard

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // Le dégradé reprend le bleu nuit des couvertures : l'image s'y pose
      // sans découpe visible, quelle que soit la taille de l'écran.
      background: 'linear-gradient(160deg, #061325 0%, #0d2f5e 55%, #0b2446 100%)',
      padding: '28px 16px',
      fontFamily: "'Source Sans Pro', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '620px' }}>

        {/* La couverture de l'ambiance, entière. `role="img"` plutôt qu'une
            balise <img> : la source vient d'une variable CSS, qui est ce qui
            permet de changer d'ambiance sans toucher à ce fichier. */}
        <div
          role="img"
          aria-label={`Hub DTX — couverture ${ambiance.label}`}
          style={{
            width: '100%',
            aspectRatio: '1672 / 941',
            backgroundImage: 'var(--hub-couverture)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '14px 14px 0 0',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}
        />

        <div style={{
          background: COUL.surface,
          borderRadius: '0 0 14px 14px',
          padding: '26px 28px 24px',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}>
          <p style={{
            fontSize: '14.5px', color: COUL.texteDoux,
            margin: '0 0 18px', lineHeight: '1.5',
          }}>
            Connecte-toi avec ton compte Microsoft
          </p>

          <button
            onClick={signInWithMicrosoft}
            style={{
              width: '100%',
              padding: '13px 16px',
              background: COUL.bleu,
              color: COUL.blanc,
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#006fa3'}
            onMouseLeave={e => e.currentTarget.style.background = COUL.bleu}
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Se connecter avec Microsoft
          </button>

          {/* Deux cas aboutissent ici : un échec de connexion (provider désactivé,
              clé refusée, URL de redirection non autorisée — à voir, pas à taire),
              et une session expirée par la règle des 24 h / 4 h d'inactivité. */}
          {erreurConnexion && (
            <p style={{
              fontSize: '13px', color: COUL.dangerFonce, background: COUL.dangerFondDoux,
              border: `1px solid ${COUL.dangerBord}`, borderRadius: '8px',
              padding: '10px 12px', marginTop: '16px', marginBottom: 0,
              lineHeight: '1.45', textAlign: 'left', wordBreak: 'break-word',
            }}>
              {erreurConnexion}
            </p>
          )}

          <p style={{ fontSize: '12px', color: COUL.texteFaible, margin: '18px 0 0' }}>
            Seuls les comptes @dynassur.be et @dtx-group.be sont autorisés
          </p>
        </div>
      </div>
    </div>
  )
}
