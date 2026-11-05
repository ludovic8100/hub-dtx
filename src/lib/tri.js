// Tri d'un tableau par en-tête de colonne — la logique, une seule fois.
//
// POURQUOI UN FICHIER PARTAGÉ PLUTÔT QU'UN TRI PAR TABLEAU
//
// Demande du 05/11 : « on doit pouvoir faire ça partout ce genre de tri ».
// Recopié table par table, un tri se met à diverger : ici le numéro de
// dossier se compare comme du texte (102 avant 14), là les lignes vides
// remontent en tête au premier clic et le tri a l'air cassé. Les règles
// ci-dessous valent pour tous les tableaux du Hub.
//
// LES DEUX RÈGLES QUI FONT LA DIFFÉRENCE
//
// 1. Une valeur VIDE va en dernier dans les DEUX sens. Un client sans bureau
//    n'est pas « avant A », il est absent. Le remonter en tête au premier
//    clic ferait passer le tri pour défectueux.
//
// 2. Ce qui est un NOMBRE se compare comme un nombre (14 avant 102), et ce
//    qui est une DATE se compare comme une date — pas comme « 05/11 » contre
//    « 12/03 », qui en texte range mars après novembre.

/** Minuscules, sans accent — pour comparer « Éghezée » et « eghezee ». */
const cmpTexte = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true })

const versNombre = v => {
  const n = Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

// Accepte ISO (2026-05-06) et belge (30/01/1978) : les deux formats coexistent
// en base selon la source (Qlik écrit du belge, Supabase de l'ISO).
const versDate = v => {
  const s = String(v).trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime()
  // L'analyse native vient AVANT le repli sur AAAA-MM-JJ : elle garde l'heure.
  // Ne lire que la date rangerait au meme niveau deux consultations du meme
  // jour, alors que « derniers consultes » se lit justement a l'heure pres.
  const d = new Date(s)
  if (!isNaN(d)) return d.getTime()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime() : null
}

/**
 * Compare deux valeurs. `type` vaut 'texte' (défaut), 'nombre' ou 'date'.
 * Le vide est toujours renvoyé en dernier, quel que soit le sens.
 */
export function comparerValeurs(a, b, type = 'texte') {
  const va = a == null ? '' : String(a).trim()
  const vb = b == null ? '' : String(b).trim()
  if (!va && !vb) return 0
  if (!va) return 1
  if (!vb) return -1
  if (type === 'nombre' || type === 'date') {
    const conv = type === 'nombre' ? versNombre : versDate
    const na = conv(va), nb = conv(vb)
    // Une valeur illisible retombe sur le texte plutôt que de se faire ranger
    // arbitrairement : on ne jette pas une ligne parce qu'on ne sait pas la lire.
    if (na != null && nb != null) { if (na !== nb) return na - nb }
    else return cmpTexte(va, vb)
  }
  return cmpTexte(va, vb)
}

/**
 * Trie `lignes` selon `tri` = { col, sens }.
 *
 * `cols` décrit les colonnes : { cle, titre, val, type }. `val(ligne)` donne
 * la valeur de TRI, qui n'est pas forcément celle affichée — un « Gestionnaire
 * / SA » s'affiche en deux morceaux et se trie sur le premier.
 *
 * `secours` départage les ex æquo pour que l'ordre soit stable d'un affichage
 * à l'autre, et non dépendant de l'ordre d'arrivée des lignes.
 */
export function trierLignes(lignes, cols, tri, secours = null) {
  const col = (cols || []).find(c => c.cle === tri?.col)
  if (!col || !Array.isArray(lignes)) return lignes
  const sens = tri.sens < 0 ? -1 : 1
  // Copie : trier en place un tableau venu de l'état ne redéclencherait pas le
  // rendu et casserait la comparaison de React.
  return [...lignes].sort((a, b) => {
    const r = comparerValeurs(col.val(a), col.val(b), col.type)
    if (r) return r * sens
    return secours ? comparerValeurs(secours(a), secours(b)) * sens : 0
  })
}

/** Le clic sur un en-tête : même colonne → on inverse, autre colonne → ascendant. */
export function basculerTri(tri, cle) {
  return { col: cle, sens: tri?.col === cle ? -(tri.sens || 1) : 1 }
}
