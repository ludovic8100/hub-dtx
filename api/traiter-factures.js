// Fonction serverless Vercel — traite maintenant les factures deposees dans SharePoint.
//
// Declenche la GitHub Action `factures-entrantes.yml`, qui enchaine les quatre
// etapes : scan, lecture du PDF, renommage, rapprochement bancaire.
//
// Pourquoi passer par une Action et non faire le travail ici : une fonction
// Vercel est coupee au bout de quelques secondes, et le scan de SharePoint
// prend environ deux minutes. L'Action, elle, a le temps.
//
// Securite : n'accepte que les appels d'un utilisateur connecte au Hub
// (JWT Supabase verifie). Le token GitHub reste cote serveur.

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY, GITHUB_DISPATCH_TOKEN, GITHUB_REPO as REPO, GITHUB_SYNC_REF, IS_TEST } from './_lib/env.js'
const WORKFLOW = 'factures-entrantes.yml'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // 1) La session Supabase de l'appelant
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  // 2) Le declenchement
  if (!GITHUB_DISPATCH_TOKEN) {
    return res.status(500).json({ ok: false, error: 'GITHUB_DISPATCH_TOKEN manquant (variable Vercel)' })
  }
  try {
    const gh = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'hub-dtx',
      },
      body: JSON.stringify({
        ref: GITHUB_SYNC_REF,
        inputs: { annee: '', echantillon: '40', target: IS_TEST ? 'test' : 'production' },
      }),
    })
    if (gh.status === 204) return res.status(200).json({ ok: true, launched: true })
    const detail = await gh.text().catch(() => '')
    return res.status(502).json({ ok: false, error: `github ${gh.status}`, detail: detail.slice(0, 300) })
  } catch {
    return res.status(502).json({ ok: false, error: 'github call failed' })
  }
}
