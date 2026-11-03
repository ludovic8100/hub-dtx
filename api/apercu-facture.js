// Aperçu d'un document SharePoint — vignette JPEG.
//
// Remplace le workflow n8n « 2026 - Apercu facture » (webhook apercu-facture).
// Le Hub affiche ces vignettes dans la comptabilité et dans les sélecteurs de
// facture ; sans ce proxy, les images ne s'affichent plus.
//
// Appel : GET /api/apercu-facture?fid=<identifiant de l'élément SharePoint>

import { graph } from './_lib/graph.js'
import { SHAREPOINT_SITE_ID } from './_lib/env.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' })

  const fid = String(req.query.fid || '').trim()
  // Les identifiants Graph sont alphanumériques : on refuse tout le reste plutôt
  // que de laisser construire une URL arbitraire côté Microsoft.
  if (!fid || !/^[A-Za-z0-9!._-]{5,250}$/.test(fid)) {
    return res.status(400).json({ ok: false, error: 'fid invalide' })
  }

  try {
    const r = await graph(
      `/sites/${SHAREPOINT_SITE_ID}/drive/items/${encodeURIComponent(fid)}/thumbnails/0/large/content`
    )
    if (!r.ok) {
      return res.status(r.status === 404 ? 404 : 502).json({ ok: false, error: `Graph ${r.status}` })
    }

    const image = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    return res.status(200).send(image)
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
