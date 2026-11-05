// Déclencheur unique des GitHub Actions appelées depuis le Hub.
//
// POURQUOI UN SEUL FICHIER POUR DEUX BOUTONS
//
// Le plan Vercel du projet autorise 12 fonctions serverless par déploiement.
// En ajoutant « Traiter les factures » le 04/11, on est passé à 13 : TOUS les
// déploiements de production ont échoué depuis, en silence côté Hub —
// `exceeded_serverless_functions_per_deployment`. La production est restée
// figée sur une version ancienne pendant qu'on fusionnait.
//
// Les deux boutons faisaient exactement la même chose : vérifier la session
// Supabase de l'appelant, puis demander à GitHub de lancer un workflow. Les
// réunir ne coûte rien et rend une place.
//
// Ajouter un bouton = ajouter une ligne dans WORKFLOWS, pas un fichier.
//
// Sécurité : n'accepte que les appels d'un utilisateur connecté au Hub (JWT
// Supabase vérifié), et seuls les workflows listés ici sont lançables — un
// nom de workflow venu du navigateur ne traverse jamais vers GitHub.

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY, GITHUB_DISPATCH_TOKEN, GITHUB_REPO as REPO, GITHUB_SYNC_REF, IS_TEST } from './_lib/env.js'

const WORKFLOWS = {
  qlik: {
    fichier: 'qlik-sync.yml',
    entrees: () => ({ dry_run: 'false', target: IS_TEST ? 'test' : 'production' }),
  },
  factures: {
    fichier: 'factures-entrantes.yml',
    entrees: () => ({ annee: '', echantillon: '40', target: IS_TEST ? 'test' : 'production' }),
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  const demande = (req.query?.workflow || req.body?.workflow || '').toString()
  const choix = WORKFLOWS[demande]
  if (!choix) {
    return res.status(400).json({ ok: false, error: `workflow inconnu : ${demande || '(vide)'}` })
  }

  // 1) La session Supabase de l'appelant
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  // 2) Le déclenchement
  if (!GITHUB_DISPATCH_TOKEN) {
    return res.status(500).json({ ok: false, error: 'GITHUB_DISPATCH_TOKEN manquant (variable Vercel)' })
  }
  try {
    const gh = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${choix.fichier}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'hub-dtx',
        },
        body: JSON.stringify({ ref: GITHUB_SYNC_REF, inputs: choix.entrees() }),
      })
    if (gh.status === 204) return res.status(200).json({ ok: true, launched: true, workflow: demande })
    const detail = await gh.text().catch(() => '')
    return res.status(502).json({ ok: false, error: `github ${gh.status}`, detail: detail.slice(0, 300) })
  } catch {
    return res.status(502).json({ ok: false, error: 'github call failed' })
  }
}
