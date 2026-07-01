// /api/3cx/lookup — Recherche de contact pour l'intégration CRM server-side 3CX.
// 3CX appelle : GET /api/3cx/lookup?number=[Number]
// Auth : Basic (le mot de passe = secret partagé) OU ?key=<secret>.
// Le secret n'est PAS stocké ici : il est relayé à la fonction RPC crm_lookup,
// qui le vérifie contre config_secrets (clé « threecx_api_secret ») avant de répondre.
// Aucune donnée n'est renvoyée sans le bon secret.
// Env (Vercel) : SUPABASE_URL, SUPABASE_ANON_KEY (déjà configurées).

function getSecret(req) {
  if (req.query && req.query.key) return String(req.query.key)
  const h = req.headers.authorization || ''
  const m = h.match(/^Basic\s+(.+)$/i)
  if (m) {
    try {
      const s = Buffer.from(m[1], 'base64').toString('utf8')
      // format "user:password" → on prend le password (le secret)
      const parts = s.split(':')
      return parts.length > 1 ? parts.slice(1).join(':') : s
    } catch (e) { /* ignore */ }
  }
  return ''
}

// Capitalise proprement un nom en minuscules ("ludovic" → "Ludovic", "jean-marie" → "Jean-Marie")
const cap = (s) =>
  (s || '').toLowerCase().replace(/(^|[\s'’-])([a-zà-ÿ])/g, (_, a, b) => a + b.toUpperCase())

export default async function handler(req, res) {
  const number = (req.query && (req.query.number || req.query.Number)) || ''
  const secret = getSecret(req)
  if (!number) return res.status(200).json({ contacts: [] })

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/crm_lookup`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_number: String(number), p_secret: secret }),
    })
    const rows = r.ok ? await r.json() : []
    const base = `https://${req.headers.host}`
    const contacts = (Array.isArray(rows) ? rows : []).map((c) => ({
      id: c.id,
      firstName: cap(c.prenom),
      lastName: (c.nom || '').toUpperCase(),
      phoneMobile: c.gsm || '',
      phoneHome: c.tel_fixe || '',
      email: c.email || '',
      gestionnaire: c.gestionnaire || '',
      url: `${base}/dynassur/clients?dossier=${encodeURIComponent(c.dossier || '')}`,
    }))
    return res.status(200).json({ contacts })
  } catch (e) {
    return res.status(200).json({ contacts: [], error: String(e) })
  }
}
