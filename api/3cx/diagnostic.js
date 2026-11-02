// /api/3cx/diagnostic — Que sait faire VOTRE central 3CX ?
//
// Avant d'écrire la moindre ligne de supervision temps réel, il faut savoir ce
// que l'API du PBX expose réellement. La documentation publique de 3CX est
// incomplète sur ce point : « ActiveCalls » est confirmé temps réel, le statut
// de file sur les utilisateurs est signalé mais non documenté, et aucun
// endpoint officiel ne donne le nombre d'appels en attente. Seul le central
// lui-même peut répondre.
//
// Cette fonction s'authentifie, interroge une liste d'endroits candidats, et
// rapporte lesquels répondent. Elle ne renvoie JAMAIS de secret, et se limite
// à une ligne par endpoint, dont elle ne liste que les NOMS de champs — pas
// les valeurs, qui seraient des données de collaborateurs.
//
// Appel : POST /api/3cx/diagnostic, avec le jeton de session Supabase.

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY } from '../_lib/env.js'
import { lire3cx, troisCxConfigure } from '../_lib/threecx.js'

// Ce qu'on cherche, et pourquoi.
const SONDES = [
  { chemin: '/xapi/v1/$metadata',                                            pour: 'Catalogue complet de l\'API (OData)' },
  { chemin: '/xapi/v1/SystemStatus',                                         pour: 'Version et état du central' },
  { chemin: '/xapi/v1/ActiveCalls',                                          pour: 'Appels en cours — « En appel »' },
  { chemin: '/xapi/v1/Users?$top=1',                                         pour: 'Postes et leur statut' },
  { chemin: '/xapi/v1/Users?$top=1&$select=Number,QueueStatus',              pour: 'Statut de file par poste — « Disponible / Pause »' },
  { chemin: '/xapi/v1/Queues?$top=1',                                        pour: 'Files d\'attente (configuration)' },
  { chemin: '/xapi/v1/Groups?$top=1',                                        pour: 'Groupes' },
  { chemin: '/xapi/v1/ReportExtensionStatisticsByGroup?$top=1',              pour: 'Statistiques par poste (si présent)' },
]

// Noms de champs seulement : un diagnostic n'a pas à promener des données.
function formeDe(data) {
  if (data == null) return null
  const n = Array.isArray(data?.value) ? data.value.length : null
  const premier = Array.isArray(data?.value) ? data.value[0] : (Array.isArray(data) ? data[0] : data)
  const champs = premier && typeof premier === 'object' ? Object.keys(premier).slice(0, 40) : null
  return { lignes: n, champs }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // Session Supabase obligatoire — même garde que /api/reload-qlik.
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  if (!troisCxConfigure()) {
    return res.status(200).json({
      ok: false,
      configure: false,
      message: "3CX n'est pas configuré. Créez un client API dans la console 3CX "
             + '(Admin → Intégrations → API), puis ajoutez THREECX_URL, THREECX_CLIENT_ID '
             + 'et THREECX_CLIENT_SECRET dans Vercel → Settings → Environment Variables.',
    })
  }

  const resultats = []
  for (const s of SONDES) {
    const r = await lire3cx(s.chemin)
    resultats.push({
      chemin: s.chemin,
      pour: s.pour,
      repond: r.ok,
      status: r.status,
      forme: r.ok ? formeDe(r.data) : null,
      // En cas d'échec : le début du message, utile pour distinguer un 404
      // (endpoint absent) d'un 401 (droits du client API insuffisants).
      detail: r.ok ? null : (r.texte || '').slice(0, 200),
    })
  }

  const ok = resultats.filter(r => r.repond).map(r => r.chemin)
  return res.status(200).json({
    ok: ok.length > 0,
    configure: true,
    disponibles: ok,
    resultats,
    suite: ok.length
      ? 'Transmettez ce rapport : il dit exactement quelles colonnes de la maquette sont alimentables.'
      : "Aucun endpoint n'a répondu. Vérifiez l'URL du central, les droits du client API, et que le PBX est joignable depuis internet.",
  })
}
