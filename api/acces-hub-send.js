// Fonction serverless Vercel — envoie le mail « Vos accès au Hub DTX » via Microsoft Graph.
//
// Remplace l'ancien `mailto:` de Paramètres, qui ouvrait le client mail de
// l'administrateur avec un texte brut : un mailto ne peut pas porter de HTML,
// donc la charte Dynassur ne pouvait pas y passer. Et rien ne garantissait que
// le mail parte vraiment — la fiche enregistrait pourtant « accès envoyés ».
//
// Variables d'env (Vercel) : AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET.

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY } from './_lib/env.js'
import { redirigerEnTest } from './_lib/mail.js'
import { rendreMailAccesHub } from './_lib/mail-acces-hub.js'

const EXPEDITEUR = 'info@dynassur.be'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // 1) Qui appelle ? Le jeton Supabase donne l'adresse, pas la parole.
  let appelant = null
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
    const uj = await u.json()
    appelant = { email: uj?.email || '', token }
    if (!appelant.email) return res.status(401).json({ ok: false, error: 'session sans adresse' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  // 2) Est-il administrateur ? L'écran Paramètres le vérifie déjà, mais un
  //    écran ne protège rien : cette route envoie du courrier au nom de
  //    Dynassur, elle doit le revérifier elle-même, avec le jeton de
  //    l'appelant (donc sous ses propres droits, jamais au-dessus).
  try {
    const q = new URLSearchParams({
      select: 'est_admin,compte_hub_actif',
      email: `eq.${appelant.email}`,
      compte_hub_actif: 'is.true',
      limit: '1',
    })
    const r = await fetch(`${SB_URL}/rest/v1/collaborateurs?${q}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${appelant.token}` },
    })
    const lignes = await r.json().catch(() => [])
    if (!Array.isArray(lignes) || lignes[0]?.est_admin !== true) {
      return res.status(403).json({ ok: false, error: 'réservé aux administrateurs' })
    }
  } catch (e) { return res.status(403).json({ ok: false, error: 'droits non vérifiables' }) }

  const { email, prenom, hub_url } = req.body || {}
  if (!email) return res.status(400).json({ ok: false, error: 'destinataire manquant' })

  // 3) Le logo doit être lisible SANS connexion, sinon la boîte mail du
  //    destinataire affiche un cadre vide. Il est servi par le Hub lui-même,
  //    sur la même origine que le lien du bouton.
  let rendu
  try {
    const origine = new URL(String(hub_url || 'https://hub-dtx.vercel.app/')).origin
    rendu = rendreMailAccesHub({
      prenom, email,
      hubUrl: `${origine}/`,
      logoUrl: `${origine}/logo_dynassur_complet.png`,
    })
  } catch (e) { return res.status(400).json({ ok: false, error: String(e.message || e) }) }

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

    const message = {
      subject: rendu.sujet,
      body: { contentType: 'HTML', content: rendu.html },
      toRecipients: [{ emailAddress: { address: String(email).trim() } }],
      // « Répondez simplement à cet e-mail » doit tomber chez un humain :
      // l'administrateur qui vient d'ouvrir l'accès, pas une boîte générique.
      replyTo: [{ emailAddress: { address: appelant.email } }],
    }

    redirigerEnTest(message)  // en TEST : tout mail part vers MAIL_REDIRECT_TO

    const mr = await fetch(`https://graph.microsoft.com/v1.0/users/${EXPEDITEUR}/sendMail`, {
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
