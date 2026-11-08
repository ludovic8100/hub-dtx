import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { COUL } from '../lib/theme'
import { AMBIANCES, ambianceEffective } from '../lib/themes'

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
// ⚠️ LA COUVERTURE VIENT DU CACHE, PAS DE LA BASE
//
// Personne n'est connecté ici : la page ne peut pas lire `ref_ambiances`,
// qui n'est lisible que par un compte authentifié. Elle affiche donc le
// dernier réglage que CE navigateur a vu — posé à la connexion précédente.
//
// Conséquence : un navigateur qui n'a jamais ouvert le Hub voit Standard,
// même si l'administrateur a mis Noël. Dès la première connexion, le cache
// est à jour et la page de garde suit.

// Les fonds de la page de garde, un par ambiance.
//
// Écrits en dur ici et NON lus depuis les variables CSS, pour la même raison
// que COUL_BRUT : cette page s'affiche avant toute connexion, et les variables
// d'ambiance ne sont posées qu'ensuite. Une valeur en dur qui s'assume vaut
// mieux qu'une variable qui rendrait du vide.
const FONDS_GARDE = {
  standard:    { fondSombre: '#061325', fondMoyen: '#0d2f5e', halo: 'rgba(30,128,236,.22)' },
  noel:        { fondSombre: '#04141f', fondMoyen: '#0b3040', halo: 'rgba(245,202,120,.20)' },
  'nouvel-an': { fondSombre: '#070c1d', fondMoyen: '#17254a', halo: 'rgba(245,197,107,.22)' },
  halloween:   { fondSombre: '#0d0a1c', fondMoyen: '#2b2144', halo: 'rgba(255,128,52,.20)' },
  vacances:    { fondSombre: '#04141e', fondMoyen: '#0b3a4b', halo: 'rgba(83,224,203,.20)' },
}

export default function Login() {
  const { user, loading, signInWithMicrosoft, erreurConnexion } = useAuth()

  // Évite d'afficher à nouveau l'écran de login si une session existe déjà
  // (sinon un simple retour sur /login masque une connexion pourtant réussie).
  if (!loading && user) return <Navigate to="/" replace />

  const cle = ambianceEffective()
  const ambiance = AMBIANCES[cle] || AMBIANCES.standard

  // La page de garde n'est PAS connectée : elle ne peut pas lire les variables
  // CSS posées après connexion. Elle calcule donc ses couleurs directement
  // depuis l'ambiance, comme le fait déjà COUL_BRUT pour les canvas et les PDF.
  const COUL_BRUT_AMBIANCE = FONDS_GARDE[cle] || FONDS_GARDE.standard
  // Le fond de la page de garde est sombre dans toutes les ambiances : on
  // prend donc le motif du mode sombre, dont les symboles sont clairs.
  const motifSaison = ambiance.sombre?.saisonMotif || ambiance.clair?.saisonMotif || 'none'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // ⚠️ LA PAGE ENTIÈRE SUIT L'AMBIANCE, PAS SEULEMENT L'IMAGE.
      //
      // Ludovic : « dans la page de garde, tu n'as changé que l'image, pas
      // toute la page ». C'était exact : le dégradé était écrit en dur en
      // bleu nuit, donc identique à Noël, au Nouvel An et en Vacances —
      // l'image changeait, son cadre non.
      //
      // Le dégradé est désormais bâti sur les jetons de l'ambiance, et le
      // motif de saison se pose par-dessus.
      backgroundColor: COUL_BRUT_AMBIANCE.fondSombre,
      backgroundImage: `${motifSaison && motifSaison !== 'none' ? motifSaison + ',' : ''}radial-gradient(ellipse 120% 80% at 50% 0%, ${COUL_BRUT_AMBIANCE.halo}, transparent 70%), linear-gradient(160deg, ${COUL_BRUT_AMBIANCE.fondSombre} 0%, ${COUL_BRUT_AMBIANCE.fondMoyen} 55%, ${COUL_BRUT_AMBIANCE.fondSombre} 100%)`,
      backgroundRepeat: 'repeat, no-repeat, no-repeat',
      backgroundSize: '96px 96px, 100% 100%, 100% 100%',
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
