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

// Un échec d'authentification est mémorisé lui aussi, 60 s. 3CX tient une liste
// noire anti-intrusion : enchaîner les demandes de jeton avec de mauvais
// identifiants fait bannir l'adresse IP sortante. Observé le 02/11/2026 — deux
// 401 puis six 403 d'affilée. On ne retente donc pas en rafale.
let echec = { message: null, jusqua: 0 }

// La documentation de 3CX et ses exemples ne disent pas la même chose : la
// spécification demande une authentification Basic, les exemples passent les
// identifiants dans le corps du formulaire. On tente le corps, puis Basic.
async function demanderJeton(mode) {
  const corps = { grant_type: 'client_credentials' }
  const entetes = { 'Content-Type': 'application/x-www-form-urlencoded' }

  if (mode === 'basic') {
    entetes.Authorization = 'Basic ' + Buffer
      .from(`${THREECX_CLIENT_ID}:${THREECX_CLIENT_SECRET}`).toString('base64')
  } else {
    corps.client_id = THREECX_CLIENT_ID
    corps.client_secret = THREECX_CLIENT_SECRET
  }

  const r = await avecDelai(`${THREECX_URL}/connect/token`, {
    method: 'POST', headers: entetes, body: new URLSearchParams(corps),
  })
  const txt = await r.text()
  return { ok: r.ok, status: r.status, txt }
}

/**
 * fetch avec garde-temps.
 *
 * SANS LUI, LE DIAGNOSTIC RENVOYAIT UN 500 OPAQUE. `fetch` n'a aucune limite
 * par defaut : un central injoignable laissait la requete pendante, les neuf
 * appels du diagnostic s'empilaient, et Vercel tuait la fonction au bout de
 * dix secondes — FUNCTION_INVOCATION_FAILED. L'ecran etait pourtant construit
 * pour expliquer chaque echec ; il n'en avait simplement plus le temps.
 *
 * Quatre secondes suffisent largement a un PBX qui repond. Celui qui ne repond
 * pas en quatre secondes ne repondra pas en trente.
 */
const DELAI_MS = 4000

async function avecDelai(url, options = {}, ms = DELAI_MS) {
  const ctrl = new AbortController()
  const minuteur = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`Le central n'a pas repondu en ${ms / 1000} s (${url.replace(/\?.*$/, '')})`)
    }
    throw e
  } finally {
    clearTimeout(minuteur)
  }
}

export async function jeton3cx() {
  if (!troisCxConfigure()) throw new Error('3CX non configuré (THREECX_URL / THREECX_CLIENT_ID / THREECX_CLIENT_SECRET)')
  if (cache.jeton && Date.now() < cache.expire) return cache.jeton
  if (echec.message && Date.now() < echec.jusqua) throw new Error(echec.message)

  let dernier = null
  for (const mode of ['corps', 'basic']) {
    const r = await demanderJeton(mode)
    dernier = r
    if (!r.ok) continue
    let j
    try { j = JSON.parse(r.txt) } catch { continue }
    if (!j.access_token) continue
    cache = { jeton: j.access_token, expire: Date.now() + Math.max(30, (j.expires_in || 3600) - 30) * 1000 }
    echec = { message: null, jusqua: 0 }
    cache.mode = mode
    return cache.jeton
  }

  const msg = `Jeton 3CX refusé (HTTP ${dernier?.status}) en identifiants dans le corps ET en Basic`
            + (dernier?.txt ? ` : ${dernier.txt.slice(0, 200)}` : '')
  // 60 s de silence : ne pas nourrir la liste noire du central.
  echec = { message: msg, jusqua: Date.now() + 60000 }
  throw new Error(msg)
}

/** Mode d'authentification retenu, une fois le jeton obtenu. */
export const modeAuth = () => cache.mode || null

/** GET sur l'API 3CX. Renvoie { ok, status, data|texte }. Ne jette pas. */
export async function lire3cx(chemin) {
  try {
    const t = await jeton3cx()
    const r = await avecDelai(`${THREECX_URL}${chemin}`, {
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
