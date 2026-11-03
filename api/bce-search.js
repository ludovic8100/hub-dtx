// Recherche Banque-Carrefour des Entreprises (proxy CBEAPI).
//
// Remplace le workflow n8n « 2026 - BCE Search » (webhook bce-search), dans
// lequel la clé CBEAPI était écrite en clair dans un nœud Code. Elle vit
// désormais dans une variable d'environnement Vercel, jamais dans le dépôt.
//
// Appel : POST /api/bce-search  { "query": "0123456789" | "nom d'entreprise" }

import { CBEAPI_KEY } from './_lib/env.js'

const BASE = 'https://cbeapi.be/api/v1/company'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })
  if (!CBEAPI_KEY) return res.status(500).json({ ok: false, error: 'CBEAPI_KEY manquante (variable Vercel)' })

  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const recherche = String(corps.query || '').trim()
  if (!recherche) return res.status(400).json({ ok: false, error: 'query vide' })

  // 10 chiffres = numéro d'entreprise, sinon recherche par nom.
  const chiffres = recherche.replace(/\D/g, '')
  const url = chiffres.length === 10
    ? `${BASE}/${chiffres}`
    : `${BASE}/search?name=${encodeURIComponent(recherche)}`

  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${CBEAPI_KEY}`, Accept: 'application/json' },
    })
    // CBEAPI renvoie 404 sur un numéro inconnu : ce n'est pas une panne,
    // c'est un résultat vide.
    if (r.status === 404) return res.status(200).json({ results: [] })
    if (!r.ok) return res.status(502).json({ ok: false, error: `CBEAPI ${r.status}` })

    // On renvoie les objets CBEAPI tels quels : chaque écran du Hub mappe les
    // champs dont il a besoin (BceSearch, module clients LODE, fiche membre Hexagroup).
    const { data } = await r.json()
    const results = Array.isArray(data) ? data : data ? [data] : []
    return res.status(200).json({ results })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
