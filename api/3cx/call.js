// /api/3cx/call — Journalisation d'appel depuis 3CX (scénario réservé « ReportCall »).
// 3CX appelle : POST /api/3cx/call  (JSON) après chaque appel externe.
// Auth : Basic (mot de passe = secret) OU ?key=<secret>, relayé à la RPC crm_log_appel.
// La RPC vérifie le secret, retrouve le client par son numéro normalisé, et insère dans « appels ».
// Env (Vercel) : SUPABASE_URL, SUPABASE_ANON_KEY.

function getSecret(req) {
  if (req.query && req.query.key) return String(req.query.key)
  const h = req.headers.authorization || ''
  const m = h.match(/^Basic\s+(.+)$/i)
  if (m) {
    try {
      const s = Buffer.from(m[1], 'base64').toString('utf8')
      const parts = s.split(':')
      return parts.length > 1 ? parts.slice(1).join(':') : s
    } catch (e) { /* ignore */ }
  }
  return ''
}

export default async function handler(req, res) {
  const b = req.body || {}
  const q = req.query || {}
  const pick = (...k) => { for (const x of k) { if (b[x] != null && b[x] !== '') return b[x]; if (q[x] != null && q[x] !== '') return q[x] } return '' }

  const secret = getSecret(req)
  const direction = pick('callType', 'CallType', 'direction')
  const number = pick('number', 'Number')
  const name = pick('name', 'Name')
  const agent = pick('agent', 'Agent')
  const duration = pick('duration', 'Duration')
  const start = pick('start', 'CallStartTimeUTC', 'datetime', 'DateTime') || null

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/crm_log_appel`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_secret: secret,
        p_direction: String(direction || ''),
        p_number: String(number || ''),
        p_name: String(name || ''),
        p_agent: String(agent || ''),
        p_duration: String(duration || ''),
        p_start: start || null,
      }),
    })
    const out = r.ok ? await r.json() : null
    return res.status(200).json({ ok: true, id: out })
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) })
  }
}
