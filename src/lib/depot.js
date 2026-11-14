// RÉCUPÉRER DES FICHIERS D'UN GESTE DE L'UTILISATEUR — glisser, coller, choisir.
//
// Demande de Ludovic (14/11/2026) : « je dois pouvoir cliquer avec ma souris et
// le déplacer vers la fenêtre et il me permet de le pousser dedans, pas
// uniquement l'option sélectionner fichier qui ouvre une fenêtre de
// l'explorateur (par exemple, lorsque j'ai le pdf dans mon mail) ».
//
// ⚠️ ET C'EST JUSTEMENT CE CAS-LÀ QUI NE MARCHE PAS TOUT SEUL.
//
// Glisser une pièce jointe depuis OUTLOOK DE BUREAU vers un navigateur est peu
// fiable : Outlook ne transmet pas un vrai fichier mais un descripteur virtuel
// (CF_FILEDESCRIPTOR au lieu de CF_HDROP). L'évènement `drop` se déclenche,
// et `dataTransfer.files` arrive VIDE. Défaut connu de longue date côté
// navigateurs, pas un réglage à corriger.
//
//   Explorateur Windows      → marche toujours
//   Outlook Web / nouvel Outlook → marche en général
//   Outlook classique        → aléatoire, souvent rien
//
// D'où trois voies, et non une :
//
//   1. le glisser-déposer ;
//   2. LE COLLER (Ctrl+V) — le repli qui sauve le cas Outlook : le
//      presse-papiers, lui, porte un vrai fichier ;
//   3. le sélecteur de fichier, qui reste.
//
// Et surtout : quand Outlook lâche un descripteur vide, on le DIT. Une zone de
// dépôt qui ne réagit pas laisse croire que le Hub est cassé ; une zone qui
// explique quoi faire règle le problème en cinq secondes.

/** Ce qu'un `drop` ou un `paste` a réellement apporté. */
export function fichiersDeEvenement(e) {
  const dt = e.dataTransfer || e.clipboardData
  if (!dt) return { fichiers: [], message: '' }

  const fichiers = Array.from(dt.files || []).filter(f => f && f.size > 0)
  if (fichiers.length) return { fichiers, message: '' }

  // Rien d'exploitable. On regarde CE QU'IL Y AVAIT pour dire pourquoi, au
  // lieu de rester muet.
  const types = Array.from(dt.types || [])

  // La signature d'Outlook : il annonce des formats, mais aucun fichier.
  const vientDOutlook = types.some(t =>
    /FileGroupDescriptor|FileContents|RenPrivateMessages|RenPrivateItem|application\/x-moz-file-promise/i.test(t))

  if (vientDOutlook || (types.includes('Files') && !fichiers.length)) {
    return {
      fichiers: [],
      message: "Ce glisser vient d'Outlook, qui n'a pas transmis le fichier lui-même. "
             + "Fais un clic droit sur la pièce jointe → Copier, puis Ctrl+V ici. "
             + "Ou enregistre-la d'abord sur ton disque et glisse-la depuis l'Explorateur.",
    }
  }
  if (types.includes('text/uri-list') || types.includes('text/html')) {
    return {
      fichiers: [],
      message: "C'est un lien qui a été déposé, pas un fichier. "
             + "Ouvre le document, enregistre-le, puis dépose le fichier.",
    }
  }
  return { fichiers: [], message: types.length ? 'Rien d’exploitable dans ce dépôt.' : '' }
}

const MO = 1024 * 1024

/**
 * Ce que le module accepte. PDF et images seulement : Ludovic convertit
 * lui-même ses .msg en PDF, ce qui nous épargne une dépendance à une API
 * Microsoft documentée en beta et explicitement non supportée en production.
 */
export const TYPES_ACCEPTES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
]

export const EXT_ACCEPTEES = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.gif'

/** Limite volontairement haute : une fiche technique scannée pèse lourd. */
export const TAILLE_MAX = 60 * MO

const extension = (nom) => {
  const m = /\.([a-z0-9]+)$/i.exec(String(nom || ''))
  return m ? m[1].toLowerCase() : ''
}

/**
 * Trie en acceptés / refusés AVANT le moindre envoi, avec la raison du refus.
 * Découvrir au dixième fichier que le troisième n'était pas accepté, c'est
 * l'apprendre trop tard.
 */
export function trierFichiers(liste) {
  const ok = [], refuses = []
  for (const f of liste) {
    const ext = extension(f.name)
    const typeOk = TYPES_ACCEPTES.includes(f.type)
      || ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)
    if (!typeOk) {
      refuses.push({ nom: f.name, raison: `format « ${ext || 'inconnu'} » non accepté — PDF et images seulement` })
    } else if (f.size > TAILLE_MAX) {
      refuses.push({ nom: f.name, raison: `${(f.size / MO).toFixed(1)} Mo, au-delà des ${TAILLE_MAX / MO} Mo autorisés` })
    } else if (f.size === 0) {
      refuses.push({ nom: f.name, raison: 'fichier vide' })
    } else {
      ok.push(f)
    }
  }
  return { ok, refuses }
}

/**
 * Envoi direct du navigateur vers SharePoint, par morceaux.
 *
 * ⚠️ La taille d'un morceau doit être un multiple de 320 Ko — Graph l'exige,
 * et un morceau mal dimensionné est refusé sans explication utile.
 *
 * `onProgres` reçoit un nombre entre 0 et 1 : sur une fiche technique de 40 Mo
 * et une connexion de chantier, une barre qui n'avance pas se lit comme un
 * blocage, et l'utilisateur recommence — en créant un doublon.
 */
export async function envoyerParMorceaux(uploadUrl, fichier, onProgres) {
  const MORCEAU = 320 * 1024 * 10   // 3,2 Mo
  let envoye = 0
  let dernier = null

  while (envoye < fichier.size) {
    const fin = Math.min(envoye + MORCEAU, fichier.size)
    const morceau = fichier.slice(envoye, fin)
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Length': String(fin - envoye),
        'Content-Range': `bytes ${envoye}-${fin - 1}/${fichier.size}`,
      },
      body: morceau,
    })
    if (!res.ok && res.status !== 202) {
      throw new Error(`Envoi interrompu à ${(envoye / MO).toFixed(1)} Mo (${res.status}) : ${(await res.text()).slice(0, 200)}`)
    }
    // 202 = morceau accepté, la suite est attendue. 200/201 = fichier complet,
    // et c'est seulement là que Graph rend la fiche de l'élément.
    if (res.status === 200 || res.status === 201) dernier = await res.json()
    envoye = fin
    onProgres?.(envoye / fichier.size)
  }
  return dernier
}

// ── La vignette ───────────────────────────────────────────────────────────
//
// Ludovic : « je dois pouvoir passer avec ma souris dessus et voir apparaître
// le devis, la facture, les documents ».
//
// ⚠️ Les vignettes passaient par n8n (« Miniatures Factures v2 »), qui est
// ARRÊTÉ. Les 418 vignettes du bucket `factures-thumbs` ne sont plus
// alimentées depuis. Aucune dépendance n8n nouvelle n'étant permise, on la
// fabrique ici — `pdfjs-dist` est déjà une dépendance du projet, employée par
// `devisExtraction.js` et l'outil Questionnaire.
//
// Générée AU DÉPÔT et non au survol : un survol qui met deux secondes à
// afficher quelque chose n'est pas un survol, c'est une attente. Le coût est
// payé une fois, par celui qui dépose.
//
// ⚠️ Et elle ne doit JAMAIS faire échouer le dépôt. Un PDF protégé, corrompu
// ou exotique fait tomber pdf.js ; le document reste parfaitement valable et
// doit être enregistré quand même — simplement sans aperçu. D'où le `null`
// silencieux plutôt qu'une exception.
export async function vignetteDe(fichier, largeur = 360) {
  try {
    if (fichier.type.startsWith('image/')) return await vignetteImage(fichier, largeur)
    if (fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)) {
      return await vignettePdf(fichier, largeur)
    }
  } catch { /* un aperçu absent n'est pas une erreur de dépôt */ }
  return null
}

const enWebp = (canvas) => new Promise(r => canvas.toBlob(r, 'image/webp', 0.72))

async function vignetteImage(fichier, largeur) {
  const url = URL.createObjectURL(fichier)
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image()
      i.onload = () => ok(i); i.onerror = ko; i.src = url
    })
    const ech = Math.min(1, largeur / (img.width || largeur))
    const c = document.createElement('canvas')
    c.width = Math.round((img.width || largeur) * ech)
    c.height = Math.round((img.height || largeur) * ech)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return await enWebp(c)
  } finally { URL.revokeObjectURL(url) }
}

async function vignettePdf(fichier, largeur) {
  const pdfjsLib = await import('pdfjs-dist')
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.js?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker

  const pdf = await pdfjsLib.getDocument({ data: await fichier.arrayBuffer() }).promise
  const page = await pdf.getPage(1)               // la première page suffit à reconnaître un document
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: largeur / base.width })

  const c = document.createElement('canvas')
  c.width = Math.round(viewport.width); c.height = Math.round(viewport.height)
  const ctx = c.getContext('2d')
  // Fond blanc explicite : un PDF sans fond rendu sur un canvas transparent
  // donne une vignette noire une fois enregistrée en WebP.
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return await enWebp(c)
}
