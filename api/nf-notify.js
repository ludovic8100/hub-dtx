// Notes de frais : les deux mails de notification, envoyés via Microsoft Graph.
//
// Remplace le workflow n8n « Notes de frais - Notifications » (webhook
// nf-notify), dernier des quatre appels n8n que l'application faisait encore.
//
// Passe par api/_lib/mail.js : en environnement de test le message est
// redirigé vers MAIL_REDIRECT_TO et n'atteint jamais un vrai destinataire.
//
// Appel : POST /api/nf-notify
//   { event: 'soumise'|'validee', societe, numero, titre, periode, total,
//     auteur_nom, auteur_email, pdf_url? }
//
// ⚠️ LE DESTINATAIRE NE VIENT PAS DU NAVIGATEUR POUR « soumise ».
// L'écran envoyait l'adresse de l'administrateur dans le corps de la requête,
// et cette adresse était donc écrite en clair dans le code de la page — donc
// dans ce dépôt, qui est public. Elle vient maintenant de NF_ADMIN_EMAIL,
// côté serveur. Accessoirement, une adresse envoyée par le navigateur est
// une adresse que n'importe qui peut remplacer par la sienne.

import { graph } from './_lib/graph.js'
import { MAIL_EXPEDITEUR_ID, HUB_URL } from './_lib/env.js'
import { redirigerEnTest } from './_lib/mail.js'

const eur = n => (Number(n) || 0).toLocaleString('fr-BE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}) + ' €'

/** Échappe le texte repris dans le HTML : un titre de note est saisi par un humain. */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const cadre = (titre, lignes, bouton) => `
<div style="font-family:'Source Sans Pro',Segoe UI,sans-serif;font-size:15px;color:#1e293b;max-width:560px">
  <h2 style="font-size:18px;color:#0D2F5E;margin:0 0 14px">${esc(titre)}</h2>
  <table style="border-collapse:collapse;width:100%;font-size:14.5px">
    ${lignes.map(([k, v]) => `<tr>
      <td style="padding:5px 12px 5px 0;color:#64748b;white-space:nowrap">${esc(k)}</td>
      <td style="padding:5px 0;font-weight:600">${esc(v)}</td></tr>`).join('')}
  </table>
  ${bouton ? `<p style="margin:18px 0 0">
    <a href="${esc(bouton.url)}" style="background:#0080BD;color:#fff;text-decoration:none;
       padding:9px 18px;border-radius:7px;font-weight:600;display:inline-block">${esc(bouton.texte)}</a>
  </p>` : ''}
  <p style="margin:20px 0 0;font-size:12.5px;color:#94a3b8">Hub DTX — message automatique.</p>
</div>`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  const c = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const evenement = c.event === 'validee' ? 'validee' : c.event === 'soumise' ? 'soumise' : null
  if (!evenement) return res.status(400).json({ ok: false, error: 'event doit valoir soumise ou validee' })

  const numero = c.numero || '(sans numéro)'
  const infos = [
    ['Société', c.societe],
    ['Numéro', numero],
    ['Titre', c.titre],
    ['Période', c.periode],
    ['Total', eur(c.total)],
    ['Auteur', c.auteur_nom],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '')

  let destinataires, subject, html
  if (evenement === 'soumise') {
    const admin = (process.env.NF_ADMIN_EMAIL || c.admin_email || '').trim()
    destinataires = admin ? [admin] : []
    subject = `Note de frais ${numero} à valider — ${c.societe || ''}`.trim()
    html = cadre('Une note de frais attend ta validation', infos,
      { url: `${HUB_URL}/admin/notes-frais`, texte: 'Ouvrir dans le Hub' })
  } else {
    // La validation se notifie à CELUI QUI A SOUMIS, pas à l'administrateur :
    // c'est lui qui attend la réponse.
    destinataires = [String(c.auteur_email || '').trim()].filter(Boolean)
    subject = `Note de frais ${numero} approuvée`
    html = cadre('Ta note de frais a été approuvée', infos,
      c.pdf_url ? { url: c.pdf_url, texte: 'Télécharger le document' } : null)
  }

  // Pas de destinataire : on répond ok plutôt qu'en erreur. La notification
  // est un à-côté — faire échouer la soumission d'une note de frais parce
  // qu'un mail n'a pas pu partir serait pire que le mail manquant.
  if (!destinataires.length) {
    return res.status(200).json({ ok: true, envoye: false, raison: 'aucun destinataire' })
  }

  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
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
    return res.status(200).json({ ok: true, envoye: true, evenement })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
