// DÉPÔT D'UN DOCUMENT SUR UN CHANTIER — préparation côté serveur (14/11/2026)
//
// Demandé par Ludovic : « je dois pouvoir ajouter un document qui est sur mon
// disque dur — le bon de commande du fournisseur, le devis du fournisseur, les
// fiches techniques, les QR codes qui servent à connecter le moteur » et
// « avoir un dossier rien qu'avec ces documents ».
//
// ⚠️ CETTE FONCTION NE TRANSPORTE PAS LE FICHIER, et c'est délibéré.
//
// Une fonction serverless Vercel plafonne à ~4,5 Mo de corps de requête. Une
// fiche technique scannée ou une photo de chantier dépasse vite. Elle se
// contente donc de deux choses que seul le serveur peut faire — il détient le
// secret Azure, que le navigateur ne doit jamais voir :
//
//   1. créer le dossier du chantier s'il n'existe pas ;
//   2. ouvrir une SESSION D'ENVOI Graph et en rendre l'adresse.
//
// Le navigateur envoie ensuite le fichier directement à SharePoint, par
// morceaux. Pas de limite de taille, pas de double transfert, et le secret
// reste au serveur.
//
// ⚠️ GARDE-FOU DE TEST EN PREMIER. `APP_ENV=test` n'isole QUE Supabase : le
// site SharePoint est le même en préversion qu'en production. Sans ce refus,
// une PR déposerait des fichiers dans les vrais documents.

import { SHAREPOINT_SITE_ID, refuserEcritureSharePoint } from './_lib/env.js'
import { graph } from './_lib/graph.js'

// Le dossier validé par Ludovic le 14/11, créé par lui à la racine de
// « Documents partagés » du site ADMINISTRATION.
const RACINE = 'LODE_CHANTIERS'

/**
 * Un nom de dossier sûr : SharePoint refuse " * : < > ? / \ | et les points
 * ou espaces en fin de nom. Un chantier qui ne peut pas créer son dossier à
 * cause d'une apostrophe dans un nom de client est un module qui s'arrête au
 * premier vrai client.
 */
const nomSur = (s) =>
  String(s || '').replace(/["*:<>?/\\|]/g, '-').replace(/\s+/g, ' ').trim()
    .replace(/[. ]+$/, '').slice(0, 120) || 'Sans nom'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ erreur: 'Méthode non autorisée' })

  const refus = refuserEcritureSharePoint('le dépôt d’un document de chantier')
  if (refus) return res.status(503).json({ erreur: refus, test: true })

  try {
    const { numero, client, fichier, taille } = req.body || {}
    if (!numero) return res.status(400).json({ erreur: 'Numéro de chantier manquant.' })
    if (!fichier) return res.status(400).json({ erreur: 'Nom de fichier manquant.' })

    // « DOS-2026-002 - HENNEAUX » : le numéro d'abord, pour que le tri du
    // dossier suive celui des chantiers.
    const dossier = nomSur(client ? `${numero} - ${client}` : numero)
    const base = `/sites/${SHAREPOINT_SITE_ID}/drive/root:/${encodeURIComponent(RACINE)}`

    // Créer le dossier du chantier. `conflictBehavior: replace` sur un dossier
    // EXISTANT ne le vide pas — il se contente de le réutiliser. On lit quand
    // même le résultat : un échec ici doit se dire, pas se deviner plus tard
    // quand l'envoi échouera sans raison visible.
    const rDossier = await graph(`${base}:/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: dossier, folder: {}, '@microsoft.graph.conflictBehavior': 'replace',
      }),
    })
    if (!rDossier.ok && rDossier.status !== 409) {
      const txt = await rDossier.text()
      return res.status(502).json({ erreur: `Création du dossier refusée (${rDossier.status}) : ${txt.slice(0, 300)}` })
    }

    // La session d'envoi. `rename` et non `replace` : deux bons de commande du
    // même fournisseur le même jour portent souvent le même nom de fichier, et
    // écraser silencieusement une pièce du dossier est pire qu'un doublon.
    const chemin = `${base}/${encodeURIComponent(dossier)}/${encodeURIComponent(nomSur(fichier))}`
    const rSession = await graph(`${chemin}:/createUploadSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: { '@microsoft.graph.conflictBehavior': 'rename', name: nomSur(fichier) },
      }),
    })
    if (!rSession.ok) {
      const txt = await rSession.text()
      return res.status(502).json({ erreur: `Session d’envoi refusée (${rSession.status}) : ${txt.slice(0, 300)}` })
    }
    const session = await rSession.json()

    return res.status(200).json({
      uploadUrl: session.uploadUrl,
      expire: session.expirationDateTime,
      dossier,
      taille: taille ?? null,
    })
  } catch (e) {
    return res.status(500).json({ erreur: `Erreur inattendue — ${e?.message || e}` })
  }
}
