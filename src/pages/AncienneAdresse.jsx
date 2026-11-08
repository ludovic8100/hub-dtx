import { COUL } from '../lib/theme'
import { HUB_URL } from '../config/env'

// La page que voient ceux qui ont gardé l'ancienne adresse en favori.
//
// POURQUOI ELLE EXISTE
//
// `hub-dtx.vercel.app` a été retiré du projet le 07/11. Résultat : quiconque
// avait un favori tombait sur la page d'erreur de Vercel — en anglais, avec
// un code « 404 DEPLOYMENT_NOT_FOUND » et aucune indication de l'endroit où
// aller. Pour quelqu'un qui cherche simplement son outil de travail, c'est un
// cul-de-sac.
//
// Le domaine a donc été remis sur le projet, et il sert cette page-ci.
//
// LE TON EST CELUI D'UNE ANNONCE, PAS D'UNE ERREUR. Un visiteur qui lit
// « cette adresse n'est plus la bonne » croit avoir fait une faute ; un
// visiteur qui lit « notre plateforme a déménagé » comprend qu'on l'a
// déplacée pour lui. La seconde formule dit la même chose et ne met personne
// en défaut.
//
// POURQUOI PAS UNE REDIRECTION AUTOMATIQUE
//
// Parce qu'une redirection silencieuse ne corrige pas le favori : la personne
// arrive sur le Hub sans comprendre que l'adresse a changé, et refait le même
// chemin le lendemain. Ici elle lit que l'adresse a changé, elle clique, et
// elle peut mettre le nouveau lien en favori — c'est le geste qu'on cherche.
//
// Le chemin demandé est conservé : qui visait `/config` repart vers
// `hub.dtx-group.be/config`, pas vers l'accueil.

const FONT = "'Source Sans Pro', sans-serif"

export default function AncienneAdresse() {
  // On garde le chemin et la requête, mais jamais le fragment : il peut porter
  // un jeton de session renvoyé par Microsoft, qui n'a rien à faire ici.
  const suite = window.location.pathname + window.location.search
  const cible = HUB_URL + (suite === '/' ? '' : suite)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #061325 0%, #0d2f5e 55%, #0b2446 100%)',
      padding: '28px 16px',
      fontFamily: FONT,
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>

        <div
          role="img"
          aria-label="Hub DTX"
          style={{
            width: '100%', aspectRatio: '1672 / 941',
            backgroundImage: "url('/ambiances/standard.webp')",
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: '14px 14px 0 0',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          }}
        />

        <div style={{
          background: COUL.surface,
          borderRadius: '0 0 14px 14px',
          padding: '28px 30px 26px',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}>
          <h1 style={{
            fontSize: 21, fontWeight: 700, color: COUL.marine,
            margin: '0 0 10px', lineHeight: 1.3,
          }}>
            Notre plateforme a déménagé
          </h1>

          <p style={{
            fontSize: 15, color: COUL.texteDoux, lineHeight: 1.55,
            margin: '0 0 22px',
          }}>
            Pour votre confort et votre sécurité, le Hub DTX est désormais
            accessible à son adresse définitive. Vos identifiants et vos données
            restent inchangés.
          </p>

          <a
            href={cible}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', boxSizing: 'border-box',
              padding: '14px 16px',
              background: COUL.bleu, color: COUL.blanc,
              borderRadius: 8, textDecoration: 'none',
              fontSize: 15.5, fontWeight: 700,
            }}
          >
            Accéder au Hub DTX
            <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>→</span>
          </a>

          <p style={{
            fontSize: 13, color: COUL.texteFaible, margin: '18px 0 0', lineHeight: 1.5,
          }}>
            Pensez à mettre à jour votre favori :<br />
            <span style={{
              display: 'inline-block', marginTop: 5,
              fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
              fontSize: 13, color: COUL.texteSombre,
              background: COUL.fondDoux, borderRadius: 6, padding: '4px 9px',
              wordBreak: 'break-all',
            }}>
              {HUB_URL.replace(/^https?:\/\//, '')}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
