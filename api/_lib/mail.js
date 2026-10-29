// Garde-fou mails hors production.
//
// En TEST (APP_ENV=test) avec MAIL_REDIRECT_TO renseignée, TOUT message Microsoft Graph est
// redirigé vers cette adresse : destinataires et copies remplacés, objet préfixé [TEST],
// destinataires d'origine rappelés en tête du corps. Sans MAIL_REDIRECT_TO en test, l'envoi
// est refusé (jamais de mail réel depuis un environnement de test).
// En production, la fonction ne touche à rien.
import { IS_TEST, MAIL_REDIRECT_TO, APP_ENV } from './env.js'

const adresses = (liste) => (liste || []).map(r => r?.emailAddress?.address).filter(Boolean)

/**
 * Applique la redirection de test à un message Graph (objet `message` de sendMail), en place.
 * Lève une erreur si l'environnement de test n'a pas d'adresse de redirection.
 * @returns {{ redirige: boolean, destinatairesOrigine: string[] }}
 */
export function redirigerEnTest(message) {
  if (!IS_TEST) return { redirige: false, destinatairesOrigine: adresses(message.toRecipients) }
  if (!MAIL_REDIRECT_TO) {
    throw new Error(`[Hub api] Envoi de mail refusé : APP_ENV=${APP_ENV} sans MAIL_REDIRECT_TO.`)
  }
  const to = adresses(message.toRecipients)
  const cc = adresses(message.ccRecipients)
  const bcc = adresses(message.bccRecipients)

  message.toRecipients = [{ emailAddress: { address: MAIL_REDIRECT_TO } }]
  delete message.ccRecipients
  delete message.bccRecipients
  message.subject = `[TEST] ${message.subject || ''}`.trim()

  const rappel = `Destinataires d'origine — À : ${to.join(', ') || '—'}` +
    (cc.length ? ` | Cc : ${cc.join(', ')}` : '') + (bcc.length ? ` | Cci : ${bcc.join(', ')}` : '')
  if (message.body && message.body.contentType === 'HTML') {
    message.body.content = `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;font-family:sans-serif;font-size:13px"><b>ENVIRONNEMENT DE TEST</b> — ${rappel}</p>` + (message.body.content || '')
  } else if (message.body) {
    message.body.content = `ENVIRONNEMENT DE TEST — ${rappel}\n\n` + (message.body.content || '')
  }
  return { redirige: true, destinatairesOrigine: to }
}
