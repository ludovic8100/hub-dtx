/**
 * LECTURE DU FICHIER DE PROSPECTION — la traduction, séparée de l'écran.
 *
 * Ici il n'y a aucune écriture et aucun appel réseau : on prend un classeur
 * et on rend des lignes prêtes à insérer, plus un compte rendu de ce qui
 * cloche. C'est ce qui permet de MONTRER avant d'écrire, et c'est tout
 * l'intérêt — un import qui écrit d'abord et explique ensuite ne laisse
 * aucune occasion de dire non.
 */

/** Les colonnes attendues. Le fichier vient d'un prestataire extérieur :
 *  ses en-têtes peuvent bouger d'un envoi à l'autre, donc on les reconnaît
 *  sur une forme aplatie plutôt que sur une égalité stricte. */
const COLONNES = {
  bce:               ["numero d entreprise", "numero entreprise", "bce"],
  denomination:      ["denomination", "nom"],
  client:            ["client"],
  dossier_brio:      ["dossier brio"],
  relation_brio:     ["relation brio"],
  forme_legale:      ["forme legale"],
  date_constitution: ["date de constitution"],
  nace:              ["secteur principal nace 2025", "secteur principal", "nace"],
  rue:               ["rue"],
  numero_rue:        ["numero"],
  code_postal:       ["code postal"],
  commune:           ["commune"],
  telephone:         ["telephone"],
  email:             ["e mail", "email", "mail"],
  nb_etablissements: ["nb etablissements"],
  resultat_exercice: ["resultat de l exercice eur", "resultat de l exercice"],
  effectif:          ["effectif moyen etp", "effectif moyen"],
  criteres:          ["critere s rempli s", "criteres remplis", "critere rempli"],
  dirigeant:         ["prenom et nom dirigeant", "dirigeant"],
  attribue_code:     ["attribution"],
  date_prevue:       ["date"],
  age:               ["age"],
}

const aplati = s => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

/** Associe chaque colonne attendue à son indice dans l'en-tête lu. */
export function reconnaitreColonnes(entetes) {
  const plats = entetes.map(aplati)
  const idx = {}
  for (const [cle, variantes] of Object.entries(COLONNES)) {
    let i = -1
    for (const v of variantes) {
      i = plats.indexOf(aplati(v))
      if (i < 0) i = plats.findIndex(p => p.startsWith(aplati(v)))
      if (i >= 0) break
    }
    if (i >= 0) idx[cle] = i
  }
  return idx
}

/**
 * NORMALISATION DU TÉLÉPHONE — c'est la clé de rapprochement avec les appels.
 * `appels.numero_e164` est au format international ; un numéro écrit
 * « 04/2785355 » ou « 0493 06 54 76 » ne s'y rapprocherait jamais.
 * On ne devine pas : si on ne sait pas reconnaître la forme, on rend null
 * plutôt qu'un numéro inventé — un faux numéro appelle un inconnu.
 */
export function enE164(brut) {
  if (!brut) return null
  const d = String(brut).replace(/[^\d+]/g, '')
  if (!d) return null
  if (d.startsWith('+')) return d.length >= 9 ? d : null
  if (d.startsWith('00')) return '+' + d.slice(2)
  if (d.startsWith('0')) return '+32' + d.slice(1)
  if (d.startsWith('32')) return '+' + d
  return null
}

/**
 * LA CLÉ DE DÉDOUBLONNAGE, et ses limites — qu'il faut connaître.
 *
 * Le numéro d'entreprise serait parfait : il est unique et il ne change
 * jamais. Mais 51 des 435 leads du premier fichier n'en ont pas — ce sont
 * les indépendants en nouvelle constitution, pas encore inscrits.
 *
 * ⚠️ LES DEUX REPLIS SONT FAILLIBLES, ET IL FAUT LE DIRE PLUTÔT QUE DE
 * FAIRE COMME SI. Le téléphone change, et deux personnes d'un même ménage
 * peuvent partager un fixe. Le couple nom + code postal change aussi, à la
 * moindre correction d'orthographe — et une clé qui bouge crée un doublon
 * au lieu de retrouver la ligne existante.
 *
 * C'est pour ça que l'écran montre le compte des nouvelles lignes AVANT
 * d'écrire : un bond inattendu de ce nombre est le signe que la clé a
 * glissé, et c'est la seule occasion de s'en apercevoir.
 */
export function cleImport({ bce, telephone_e164, denomination, code_postal }) {
  const b = String(bce ?? '').replace(/\D/g, '')
  if (b) return 'B:' + b
  if (telephone_e164) return 'T:' + telephone_e164
  return 'N:' + aplati(denomination).toUpperCase() + '|' + String(code_postal ?? '').trim()
}

const texte = v => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}
const nombre = v => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
/** Les dates arrivent en nombre Excel, en Date, ou en texte selon l'export. */
const dateISO = v => {
  if (!v && v !== 0) return null
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Sérial Excel : jours depuis le 30/12/1899.
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return isNaN(d) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(s)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

/**
 * Transforme les lignes brutes du classeur en leads, et rend le compte rendu.
 * @param {Array<Array>} matrice  la feuille, en-tête compris
 * @param {Set<string>}  codesConnus  les trigrammes de `collaborateurs`
 */
export function preparerLeads(matrice, codesConnus = new Set(), lot = null) {
  const probleme = (m) => ({ ok: false, message: m, lignes: [], rapport: null })
  if (!Array.isArray(matrice) || matrice.length < 2) return probleme('Le fichier est vide.')

  const entetes = (matrice[0] || []).map(x => String(x ?? ''))
  const idx = reconnaitreColonnes(entetes)
  const obligatoires = ['denomination', 'attribue_code', 'date_prevue']
  const manquantes = obligatoires.filter(c => idx[c] === undefined)
  if (manquantes.length) {
    // ON REFUSE PLUTÔT QUE DE DEVINER. Sans la date ou l'attribution, un
    // lead n'est dans la file de personne et à aucune date : l'importer
    // reviendrait à le perdre en silence.
    return probleme(`Colonnes introuvables : ${manquantes.join(', ')}. En-têtes lus : ${entetes.filter(Boolean).join(' · ')}`)
  }

  const lire = (r, c) => idx[c] === undefined ? null : r[idx[c]]
  const lignes = []
  const rapport = {
    lues: 0, retenues: 0, sansTelephone: 0, sansDate: 0,
    attributionInconnue: 0, codesInconnus: new Set(), clesEnDouble: 0, parCode: {},
  }
  const vues = new Set()

  for (const r of matrice.slice(1)) {
    if (!r || !r.some(v => v !== null && v !== undefined && String(v).trim())) continue
    rapport.lues++

    const denomination = texte(lire(r, 'denomination'))
    const date_prevue = dateISO(lire(r, 'date_prevue'))
    const attribue_code = (texte(lire(r, 'attribue_code')) || '').toUpperCase()
    if (!denomination) continue
    if (!date_prevue) { rapport.sansDate++; continue }

    const telephone = texte(lire(r, 'telephone'))
    const telephone_e164 = enE164(telephone)
    if (!telephone_e164) rapport.sansTelephone++

    const bce = texte(lire(r, 'bce'))
    const code_postal = texte(lire(r, 'code_postal'))
    const cle_import = cleImport({ bce, telephone_e164, denomination, code_postal })

    // Deux lignes du même fichier qui tombent sur la même clé ET la même
    // date : la seconde écraserait la première sans rien dire.
    const empreinte = cle_import + '|' + date_prevue
    if (vues.has(empreinte)) { rapport.clesEnDouble++; continue }
    vues.add(empreinte)

    if (!codesConnus.has(attribue_code)) {
      rapport.attributionInconnue++
      if (attribue_code) rapport.codesInconnus.add(attribue_code)
    }
    rapport.parCode[attribue_code || '(vide)'] = (rapport.parCode[attribue_code || '(vide)'] || 0) + 1

    lignes.push({
      bce, denomination,
      forme_legale: texte(lire(r, 'forme_legale')),
      date_constitution: dateISO(lire(r, 'date_constitution')),
      nace: texte(lire(r, 'nace')),
      rue: texte(lire(r, 'rue')),
      numero_rue: texte(lire(r, 'numero_rue')),
      code_postal, commune: texte(lire(r, 'commune')),
      telephone, telephone_e164,
      email: texte(lire(r, 'email')),
      dirigeant: texte(lire(r, 'dirigeant')),
      est_client: (texte(lire(r, 'client')) || '').toUpperCase() === 'OUI',
      dossier_brio: texte(lire(r, 'dossier_brio')),
      relation_brio: texte(lire(r, 'relation_brio')),
      nb_etablissements: nombre(lire(r, 'nb_etablissements')),
      resultat_exercice: nombre(lire(r, 'resultat_exercice')),
      effectif: nombre(lire(r, 'effectif')),
      criteres: texte(lire(r, 'criteres')),
      age: texte(lire(r, 'age')),
      attribue_code, date_prevue, cle_import,
      lot: lot || new Date().toISOString().slice(0, 10),
    })
  }

  rapport.retenues = lignes.length
  rapport.codesInconnus = [...rapport.codesInconnus]
  return { ok: true, message: '', lignes, rapport }
}
