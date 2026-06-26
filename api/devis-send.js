// Fonction serverless Vercel — envoie un devis LODE par email via Microsoft Graph.
// Sécurité : n'accepte que les appels d'un utilisateur connecté au Hub (JWT Supabase vérifié).
// Variables d'environnement requises (Vercel > Settings > Environment Variables) :
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY

const FROM = 'info@lode-group.be'
const CC = 'contact@lode-group.be'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // 1) Authentifier l'appelant (utilisateur connecté du Hub)
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  const { client_nom, client_email, numero, accept_token, date_validite, base } = req.body || {}
  if (!client_email || !accept_token || !numero) return res.status(400).json({ ok: false, error: 'champs manquants' })

  const origin = base || `https://${req.headers.host}`
  const lien = `${origin}/devis/${accept_token}`
  const validite = date_validite ? new Date(date_validite).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' }) : null

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,#ea580c,#7c2d12);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:13px;opacity:.9">LODE</div>
      <div style="font-size:21px;font-weight:800">Votre devis ${numero}</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <p>Bonjour ${client_nom || ''},</p>
      <p>Nous avons le plaisir de vous adresser votre devis <strong>${numero}</strong>. Vous pouvez le consulter et l'<strong>accepter en ligne</strong> en un clic via le bouton ci-dessous.</p>
      ${validite ? `<p>Ce devis est <strong>valable 15 jours calendrier</strong> (jusqu'au ${validite}).</p>` : `<p>Ce devis est <strong>valable 15 jours calendrier</strong> à compter de sa date d'émission.</p>`}
      <p style="text-align:center;margin:28px 0">
        <a href="${lien}" style="background:#16a34a;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:16px;display:inline-block">Voir &amp; accepter le devis</a>
      </p>
      <p>Nous vous en souhaitons bonne réception et restons à votre entière disposition&nbsp;: <strong>n'hésitez pas à nous appeler</strong> pour toute question.</p>
      <p style="margin-bottom:0">Bien à vous,<br><strong>L'équipe LODE</strong></p>
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px">LODE — info@lode-group.be</div>
  </div>`

  try {
    // 2) Jeton Microsoft Graph (client credentials)
    const tr = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID, client_secret: process.env.AZURE_CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }),
    })
    const tj = await tr.json()
    if (!tj.access_token) return res.status(500).json({ ok: false, error: 'token graph', detail: tj.error_description || tj.error })

    // 3) Envoi du mail (depuis info@, CC contact@)
    const mr = await fetch(`https://graph.microsoft.com/v1.0/users/${FROM}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${tj.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: `Votre devis LODE ${numero}`,
          body: { contentType: 'HTML', content: html },
          toRecipients: [{ emailAddress: { address: client_email } }],
          ccRecipients: [{ emailAddress: { address: CC } }],
        },
        saveToSentItems: true,
      }),
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
