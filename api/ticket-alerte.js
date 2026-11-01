// Alerte mail d'un ticket, envoyée via Microsoft Graph.
//
// Remplace le workflow n8n « Tickets - Alertes mail » (webhook ticket-alerte).
// Passe par api/_lib/mail.js : en environnement de test, le message est
// redirigé vers MAIL_REDIRECT_TO et jamais envoyé à un vrai destinataire.
//
// Appel : POST /api/ticket-alerte  { to: string | string[], subject, html }

import { graph } from './_lib/graph.js'
import { MAIL_EXPEDITEUR_ID } from './_lib/env.js'
import { redirigerEnTest } from './_lib/mail.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const destinataires = (Array.isArray(corps.to) ? corps.to : corps.to ? [corps.to] : [])
    .map(a => String(a).trim())
    .filter(Boolean)

  // Pas de destinataire = rien à faire : on répond ok pour ne pas faire échouer
  // l'action métier qui a déclenché l'alerte.
  if (!destinataires.length) return res.status(200).json({ ok: true, envoye: false, raison: 'aucun destinataire' })

  const message = {
    subject: corps.subject || 'Notification Hub DTX',
    body: { contentType: 'HTML', content: corps.html || corps.text || '' },
    toRecipients: destinataires.map(a => ({ emailAddress: { address: a } })),
  }

  try {
    redirigerEnTest(message)   // lève en test si MAIL_REDIRECT_TO n'est pas défini

    const r = await graph(`/users/${MAIL_EXPEDITEUR_ID}/sendMail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })
    if (!r.ok) return res.status(502).json({ ok: false, error: `Graph sendMail ${r.status} : ${await r.text()}` })

    return res.status(200).json({ ok: true, envoye: true })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
