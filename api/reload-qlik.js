// Fonction serverless Vercel — relance l'import Qlik BRIO → Supabase.
// Déclenche la GitHub Action `qlik-sync.yml` (workflow_dispatch, écriture réelle :
// dry_run=false) qui recharge clients, contrats, production, quittances,
// objets de risque, famille, segmentation et sinistres.
// Sécurité : n'accepte que les appels d'un utilisateur connecté au Hub (JWT Supabase vérifié).
// Le token GitHub reste côté serveur — jamais exposé au navigateur.
// Variables d'env (Vercel) : SUPABASE_URL, SUPABASE_ANON_KEY, GITHUB_DISPATCH_TOKEN

const REPO = 'ludovic8100/hub-dtx'
const WORKFLOW = 'qlik-sync.yml'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // 1) Vérifie la session Supabase de l'appelant
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  // 2) Déclenche la GitHub Action (écriture réelle)
  if (!process.env.GITHUB_DISPATCH_TOKEN) {
    return res.status(500).json({ ok: false, error: 'GITHUB_DISPATCH_TOKEN manquant (variable Vercel)' })
  }
  try {
    const gh = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'hub-dtx',
      },
      body: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false' } }),
    })
    if (gh.status === 204) return res.status(200).json({ ok: true, launched: true })
    const detail = await gh.text().catch(() => '')
    return res.status(502).json({ ok: false, error: `github ${gh.status}`, detail: detail.slice(0, 300) })
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'github call failed' })
  }
}
