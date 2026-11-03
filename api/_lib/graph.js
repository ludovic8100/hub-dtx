// Accès Microsoft Graph depuis les fonctions serverless.
//
// Flux client_credentials : l'application s'authentifie pour elle-même, sans
// utilisateur ni refresh token à entretenir — c'est ce qui rend le portage des
// workflows n8n vers Vercel sans douleur. Les permissions sont celles de
// l'app registration Entra (Sites.Read.All, Mail.Send…), avec consentement admin.
//
// Variables (Vercel > Settings > Environment Variables) :
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET — voir api/_lib/env.js

import { AZURE } from './env.js'

const GRAPH = 'https://graph.microsoft.com/v1.0'

// Un jeton Graph vaut ~1 h : on le garde en mémoire tiède entre deux invocations
// de la même instance Lambda plutôt que d'en redemander un à chaque requête.
let cache = { jeton: null, expire: 0 }

export async function jetonGraph() {
  if (cache.jeton && Date.now() < cache.expire) return cache.jeton

  const { tenantId, clientId, clientSecret } = AZURE
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Variables AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET manquantes')
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Token Graph ${res.status} : ${await res.text()}`)

  const data = await res.json()
  cache = {
    jeton: data.access_token,
    // 60 s de marge pour ne pas présenter un jeton qui expire en vol
    expire: Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000,
  }
  return cache.jeton
}

/** Appel Graph authentifié. Renvoie la Response brute (à vous de lire json/arrayBuffer). */
export async function graph(chemin, options = {}) {
  const jeton = await jetonGraph()
  return fetch(chemin.startsWith('http') ? chemin : `${GRAPH}${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${jeton}`, ...(options.headers || {}) },
  })
}

export { GRAPH }
