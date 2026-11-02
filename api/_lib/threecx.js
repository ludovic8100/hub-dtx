// Client 3CX — côté serveur uniquement.
//
// Le Hub n'a JAMAIS appelé 3CX jusqu'ici : l'intégration existante est à sens
// unique, c'est 3CX qui écrit dans le Hub (api/3cx/lookup.js, api/3cx/call.js).
// Ce module ouvre le sens inverse, pour lire l'état du standard en direct.
//
// Authentification : XAPI v20 expose une API REST OData sur /xapi/v1, en
// OAuth2 « client_credentials ». Les identifiants se créent dans la console
// d'administration 3CX et se stockent côté Vercel — jamais dans ce dépôt,
// qui est public.
//
// Variables : THREECX_URL, THREECX_CLIENT_ID, THREECX_CLIENT_SECRET.

import { THREECX_URL, THREECX_CLIENT_ID, THREECX_CLIENT_SECRET } from './env.js'

export const troisCxConfigure = () =>
  Boolean(THREECX_URL && THREECX_CLIENT_ID && THREECX_CLIENT_SECRET)

// Jeton gardé en mémoire tant que l'instance serverless vit. Court par nature :
// on remplace 30 s avant l'échéance pour ne pas tomber en plein appel.
let cache = { jeton: null, expire: 0 }

export async function jeton3cx() {
  if (!troisCxConfigure()) throw new Error('3CX non configuré (THREECX_URL / THREECX_CLIENT_ID / THREECX_CLIENT_SECRET)')
  if (cache.jeton && Date.now() < cache.expire) return cache.jeton

  const r = await fetch(`${THREECX_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: THREECX_CLIENT_ID,
      client_secret: THREECX_CLIENT_SECRET,
    }),
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`Jeton 3CX refusé (HTTP ${r.status}) : ${txt.slice(0, 200)}`)

  let j
  try { j = JSON.parse(txt) } catch { throw new Error('Réponse de jeton 3CX illisible') }
  if (!j.access_token) throw new Error('Réponse de jeton 3CX sans access_token')

  cache = { jeton: j.access_token, expire: Date.now() + Math.max(30, (j.expires_in || 60) - 30) * 1000 }
  return cache.jeton
}

/** GET sur l'API 3CX. Renvoie { ok, status, data|texte }. Ne jette pas. */
export async function lire3cx(chemin) {
  try {
    const t = await jeton3cx()
    const r = await fetch(`${THREECX_URL}${chemin}`, {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
    })
    const txt = await r.text()
    let data = null
    try { data = JSON.parse(txt) } catch { /* pas du JSON (swagger en YAML, page d'erreur…) */ }
    return { ok: r.ok, status: r.status, data, texte: data ? null : txt.slice(0, 400) }
  } catch (e) {
    return { ok: false, status: 0, data: null, texte: String(e.message || e) }
  }
}
