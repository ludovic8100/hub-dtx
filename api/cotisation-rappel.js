// Fonction serverless Vercel — envoie un RAPPEL de cotisation Hexagroup par email via Microsoft Graph.
// Deux niveaux : 'simple' (courtois) ou 'frais' (indemnité forfaitaire 40 € + intérêts légaux 10,5 %, mention huissier).
// Expéditeur : info@hexagroup.be. QR de paiement inline (au montant réellement dû).
// Sécurité : n'accepte que les appels d'un utilisateur connecté au Hub (JWT Supabase vérifié).

const SB_URL = 'https://tndwonqdbeszkcztkzqe.supabase.co'
const SB_KEY = 'sb_publishable_xBt6ZaZGh5trEloyMCNRuA_MN-jesVJ'

const HEX = {
  from: 'info@hexagroup.be', nom: 'Hexagroup',
  iban: 'BE30 0689 5494 4011', bic: 'GKCCBEBB',
  siege: 'Chaussée de Tongres, 474 – 4450 Juprelle', bce: 'BE 1019.092.589',
}
const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  const { email, nom, numero, niveau, montant_original, forfait, interets, total_du, jours_retard, qr_base64 } = req.body || {}
  if (!email || !numero) return res.status(400).json({ ok: false, error: 'champs manquants (email, numero)' })

  const avecFrais = niveau === 'frais'
  const montantAffiche = avecFrais ? total_du : montant_original

  const qrBlock = qr_base64 ? `
    <div style="text-align:center;margin:18px 0">
      <img src="cid:qrpay" width="150" height="150" alt="QR de paiement" style="border:1px solid #eee;border-radius:8px;padding:6px;background:#fff" />
      <div style="font-size:13px;color:#6E2C91;font-weight:700;margin-top:6px">Payer en un scan</div>
      <div style="font-size:11px;color:#94a3b8">Scannez avec votre app bancaire — le virement est pré-rempli</div>
    </div>` : ''

  const detailFrais = avecFrais ? `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:14px 0">
      <tr><td style="padding:5px 0;color:#555">Cotisation ${numero}</td><td style="padding:5px 0;text-align:right">${eur(montant_original)}</td></tr>
      <tr><td style="padding:5px 0;color:#555">Indemnité forfaitaire (frais de recouvrement)</td><td style="padding:5px 0;text-align:right">${eur(forfait)}</td></tr>
      <tr><td style="padding:5px 0;color:#555">Intérêts de retard (10,5 %/an · ${jours_retard} j)</td><td style="padding:5px 0;text-align:right">${eur(interets)}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #eee;font-weight:700">Total à payer</td><td style="padding:8px 0;border-top:1px solid #eee;text-align:right;font-weight:700;color:#6E2C91">${eur(total_du)}</td></tr>
    </table>` : ''

  const corps = avecFrais
    ? `<p>Bonjour ${nom || ''},</p>
       <p>Malgré notre précédent envoi, votre <strong>facture de cotisation ${numero}</strong> demeure impayée à ce jour.</p>
       <p>Conformément aux dispositions légales relatives au retard de paiement, le montant dû est majoré des frais de recouvrement suivants :</p>
       ${detailFrais}
       <p style="color:#b91c1c"><strong>Sauf paiement sous 8 jours</strong>, le dossier sera transmis à un huissier de justice en vue du recouvrement.</p>`
    : `<p>Bonjour ${nom || ''},</p>
       <p>Sauf erreur de notre part, votre <strong>facture de cotisation ${numero}</strong> d'un montant de <strong>${eur(montant_original)}</strong> reste ouverte à ce jour.</p>
       <p>Nous vous remercions de bien vouloir procéder au paiement dès que possible.</p>`

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#20202a;max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(90deg,#1B75BC,#7A2B90,#E6007E,#F39300);color:#fff;padding:22px 24px;border-radius:12px 12px 0 0">
      <div style="font-size:13px;opacity:.92">${HEX.nom}</div>
      <div style="font-size:21px;font-weight:800">${avecFrais ? 'Rappel avec frais' : 'Rappel'} — cotisation ${numero}</div>
    </div>
    <div style="border:1px solid #e7e2ee;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      ${corps}
      <div style="background:#f4f0f9;border-radius:10px;padding:14px 16px;margin:18px 0">
        <div style="font-size:13px;color:#6E2C91;font-weight:700;margin-bottom:6px">Coordonnées de paiement</div>
        <div style="font-size:14px">IBAN <strong>${HEX.iban}</strong> (${HEX.bic})</div>
        <div style="font-size:14px">Communication : <strong>${numero}</strong> — Montant : <strong>${eur(montantAffiche)}</strong></div>
      </div>
      ${qrBlock}
      <p style="margin-bottom:0">Bien à vous,<br><strong>${HEX.nom}</strong></p>
    </div>
    <div style="text-align:center;color:#94a3b8;font-size:12px;padding:14px">
      ${HEX.nom} — ${HEX.siege} — N° ${HEX.bce} — ${HEX.from}
    </div>
  </div>`

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
      subject: `${avecFrais ? 'Rappel avec frais' : 'Rappel'} — facture de cotisation ${HEX.nom} ${numero}`,
      body: { contentType: 'HTML', content: html },
      toRecipients: [{ emailAddress: { address: email } }],
      attachments: qr_base64 ? [{ '@odata.type': '#microsoft.graph.fileAttachment', name: 'qr-paiement.png', contentType: 'image/png', contentBytes: qr_base64, isInline: true, contentId: 'qrpay' }] : [],
    }

    const mr = await fetch(`https://graph.microsoft.com/v1.0/users/${HEX.from}/sendMail`, {
      method: 'POST', headers: { Authorization: `Bearer ${tj.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    })
    if (mr.status !== 202) { const t = await mr.text(); return res.status(500).json({ ok: false, error: 'sendMail', status: mr.status, detail: t.slice(0, 400) }) }
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e).slice(0, 200) })
  }
}
