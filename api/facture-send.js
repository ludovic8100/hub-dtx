// Fonction serverless Vercel — envoie une FACTURE par email via Microsoft Graph, PDF en piece jointe.
// Expediteur / CC choisis selon `entite` (lode | dtx | dyn). Securite : session Supabase verifiee (JWT).
// Variables d'env (Vercel) : AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY } from './_lib/env.js'
import { redirigerEnTest } from './_lib/mail.js'

const ENTITES = {
  lode: { from: 'info@lode-group.be', cc: 'contact@lode-group.be', bcc: 'info@lode-group.be', nom: 'LODE' },
  dtx:  { from: 'info@dtx-group.be',  cc: null, bcc: null,          nom: 'DTX' },
  dyn:  { from: 'info@dynassur.be',   cc: null, bcc: null,          nom: 'Dynassur' },
}

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// « a@x.be, b@y.be ; c@z.be » -> liste de destinataires Graph.
// Une chaine vide donne une liste vide : l'appelant peut effacer le champ.
const destinataires = (v) => String(v || '')
  .split(/[,;]+/).map(x => x.trim()).filter(Boolean)
  .map(address => ({ emailAddress: { address } }))

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  const { entite, client_email, cc, bcc, subject, body, numero, fileName, pdfBase64 } = req.body || {}
  if (!client_email || !numero || !pdfBase64) return res.status(400).json({ ok: false, error: 'champs manquants' })

  const E = ENTITES[entite] || ENTITES.lode
  const htmlBody = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:14px;line-height:1.5;white-space:pre-wrap">${esc(body)}</div>`

  try {
    const tr = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID, client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }),
    })
    const tj = await tr.json()
    if (!tj.access_token) return res.status(500).json({ ok: false, error: 'token graph', detail: tj.error_description || tj.error })

    const destinatairesTo = destinataires(client_email)
    if (!destinatairesTo.length) return res.status(400).json({ ok: false, error: 'destinataire invalide' })

    const message = {
      subject: subject || `Facture ${E.nom} ${numero}`,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: destinatairesTo,
      attachments: [{
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: fileName || `Facture ${numero}.pdf`,
        contentType: 'application/pdf',
        contentBytes: pdfBase64,
      }],
    }
    // Champ absent du corps -> valeur par defaut de l'entite. Champ present
    // mais vide -> l'utilisateur l'a efface, on n'ajoute rien.
    const ccList  = destinataires(cc  === undefined ? E.cc  : cc)
    const bccList = destinataires(bcc === undefined ? E.bcc : bcc)
    if (ccList.length)  message.ccRecipients  = ccList
    if (bccList.length) message.bccRecipients = bccList

    redirigerEnTest(message)  // en TEST : tout mail part vers MAIL_REDIRECT_TO

    const mr = await fetch(`https://graph.microsoft.com/v1.0/users/${E.from}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${tj.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })
    if (mr.status !== 202) {
      const t = await mr.text()
      return res.status(500).json({ ok: false, error: 'sendMail', status: mr.status, detail: t.slice(0, 300) })
    }
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e).slice(0, 200) })
  }
}
