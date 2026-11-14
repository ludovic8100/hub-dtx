// Archivage d'une facture de vente dans SharePoint.
//
// REMPLACE LE WORKFLOW n8n « LODE - Facture Archive » (webhook lode-facture-archive).
//
// POURQUOI MAINTENANT : la page des devis/factures appelait encore ce webhook
// à DEUX endroits, alors que le Hub a quitté n8n. Elle dépendait donc d'un
// outil qu'on a décidé d'arrêter, pour ranger un PDF que le Hub sait très bien
// déposer lui-même — `api/apercu-facture.js` parle déjà à Graph.
//
// CE QUE LA MESURE A MONTRÉ, et qui justifie de ne plus avaler l'erreur :
// sur les 7 factures LODE envoyées le 22/10, SIX ont été rangées et UNE non —
// la 2026-018, 2 860,30 €. Personne ne l'a su, parce que l'archivage était
// enveloppé dans un try/catch muet. Une facture de vente qui n'arrive pas dans
// SharePoint est un document comptable manquant : ça se dit.
//
// Appel : POST /api/facture-archive
//   { fileName, annee, pdfBase64, entite? }   entite : lode (défaut) | dtx | dyn
//   → { ok: true, fid, url }

import { graph } from './_lib/graph.js'
import {
  SHAREPOINT_SITE_ID, SUPABASE_URL, SUPABASE_ANON_KEY, IS_TEST, APP_ENV,
} from './_lib/env.js'

// Le dossier de vente par société. Une seule table ici : quand Dynassur et DTX
// émettront leurs factures, il n'y aura qu'une ligne à ajouter, pas une
// deuxième fonction.
const DOSSIERS = {
  lode: 'COMPTA/FACTURES/_LODE/VENTES',
  dtx:  'COMPTA/FACTURES/_DTX/VENTES',
  dyn:  'COMPTA/FACTURES/_DYNASSUR/VENTES',
}

// Graph accepte un envoi simple jusqu'à 4 Mo ; au-delà il faut une session
// d'upload. Une facture PDF en fait quelques dizaines de kilo-octets — si on
// dépasse, c'est une anomalie, et mieux vaut le dire que de tronquer.
const TAILLE_MAX = 4 * 1024 * 1024

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // Qui appelle ? Même garde que les autres routes d'écriture : une session
  // Supabase valide. Sans ça, n'importe qui déposerait des fichiers dans la
  // comptabilité du groupe.
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'auth' })
  } catch {
    return res.status(401).json({ ok: false, error: 'auth failed' })
  }

  const { fileName, annee, pdfBase64, entite = 'lode' } = req.body || {}

  const dossier = DOSSIERS[String(entite).toLowerCase()]
  if (!dossier) return res.status(400).json({ ok: false, error: `entite inconnue : ${entite}` })

  // Un nom de fichier ne doit jamais pouvoir sortir du dossier visé.
  const nom = String(fileName || '').trim()
  if (!nom || nom.length > 200 || /[\\/]|\.\./.test(nom)) {
    return res.status(400).json({ ok: false, error: 'fileName invalide' })
  }
  const an = String(annee || '').trim()
  if (!/^\d{4}$/.test(an)) return res.status(400).json({ ok: false, error: 'annee invalide' })
  if (!pdfBase64) return res.status(400).json({ ok: false, error: 'pdfBase64 manquant' })

  // GARDE-FOU D'ENVIRONNEMENT, même esprit que refuser_ecriture_sharepoint()
  // côté Python : en test, on REFUSE l'écriture au lieu de la rediriger vers un
  // dossier de test. Un dossier de test se périme et donne une fausse
  // assurance ; un refus se voit. Ce qu'on vérifie en préversion, c'est que la
  // page appelle bien la bonne route — pas que Graph sait déposer un fichier.
  if (IS_TEST) {
    console.log(`[${APP_ENV}] écriture SharePoint refusée : ${dossier}/${an}/${nom}`)
    return res.status(200).json({
      ok: false,
      test: true,
      error: `Environnement de test : l'archivage SharePoint est refusé (${dossier}/${an}/${nom}).`,
    })
  }

  let contenu
  try {
    contenu = Buffer.from(String(pdfBase64).replace(/^data:[^,]+,/, ''), 'base64')
  } catch {
    return res.status(400).json({ ok: false, error: 'pdfBase64 illisible' })
  }
  if (!contenu.length) return res.status(400).json({ ok: false, error: 'PDF vide' })
  if (contenu.length > TAILLE_MAX) {
    return res.status(413).json({ ok: false, error: `PDF trop gros (${contenu.length} o, maximum ${TAILLE_MAX})` })
  }

  try {
    // `root:/chemin:/content` crée les dossiers manquants de l'arborescence ?
    // NON — Graph exige que le dossier parent existe. Les dossiers d'année sont
    // créés d'avance côté SharePoint ; si celui-ci manque, Graph répond 404 et
    // on le dit, plutôt que de déposer la facture ailleurs.
    const chemin = `${dossier}/${an}/${nom}`.split('/').map(encodeURIComponent).join('/')
    const r = await graph(
      `/sites/${SHAREPOINT_SITE_ID}/drive/root:/${chemin}:/content`,
      { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: contenu }
    )
    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      return res.status(502).json({
        ok: false,
        error: r.status === 404
          ? `Dossier introuvable dans SharePoint : ${dossier}/${an}`
          : `Graph ${r.status}`,
        detail: detail.slice(0, 300),
      })
    }
    const item = await r.json()
    return res.status(200).json({ ok: true, fid: item.id, url: item.webUrl })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}
