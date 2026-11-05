// Niveau de risque d'une composition de fonds.
//
// DEUX CORRECTIONS DE FOND PAR RAPPORT À L'ANCIEN CODE.
//
// 1. « BR 21 » n'était pas reconnu. Le motif cherchait `branche\s*21`, donc
//    « branche 21 » passait mais « BR 21 », « br21 » ou « tak 21 » tombaient
//    dans le cas par défaut. Et le cas par défaut valait 50.
//
// 2. Un fonds inconnu valait 50, c'est-à-dire « neutre ». Une saisie non
//    reconnue ressortait donc en profil équilibré, exactement comme un vrai
//    fonds mixte — sans rien à l'écran pour les distinguer. 100 % de BR 21
//    donnait « Neutre / Équilibré » et rien ne disait pourquoi.
//
//    Un fonds inconnu vaut désormais `null`. Le score se calcule sur la part
//    reconnue, et la part non reconnue est rendue à l'appelant pour être
//    affichée. Pas de valeur par défaut : une inconnue doit se voir.
//
// Le barème interne va de 0 (capital garanti) à 100 (actions pures). Ce n'est
// pas le SRI réglementaire (1 à 7, publié dans le DIC de chaque fonds). Quand
// la table des fonds par compagnie existera, c'est le SRI qu'il faudra
// stocker — il est produit par la compagnie, daté, et opposable.

/** Fonds connus, par compagnie. Clé = nom normalisé. */
export const FONDS_RISQUE = {
  // AG Insurance
  'pension life': 0, 'ag life stability': 10, 'ag life income': 15,
  'ag life balanced': 50, 'ag life growth': 75, 'ag life dynamic': 85,
  'ag life equities': 90, 'top rendement': 5, 'capital branch 21': 0,
  // Baloise
  'r-valor fund': 85, 'megatrends fund': 80, 'infrastructure fund': 55,
  'bgf world technology fund': 90, 'jpm global focus fund': 75,
  'c-quadrat arts balanced fund': 50,
  'bfi global equity select': 85, 'bfi megatrends select': 80,
  'bfi multi asset select': 45, 'bfi positive impact select': 65,
  'bfi real estate and infrastructure select': 55,
  'compte branche 21': 0, 'compte branche 21 - 0%': 0,
  'european bonds': 10, 'balanced': 50, 'growth': 75, 'equities': 90,
  'branche 21': 0, 'branche 26': 0, 'invest 1': 30, 'invest 2': 50,
  'invest 3': 70,
  // NN
  'nn life star fund': 70, 'nn life star fund - eur': 70,
  'fng sustainable impact': 60, 'fng patrimonial balanced': 45,
  'fng patrimonial defensive': 20, 'fng growth': 70,
  'nn life strategy defensive': 15, 'nn life strategy balanced': 45,
  'nn life strategy dynamic': 80, 'branche 21 nn': 0,
  // AXA
  'axa b pension stability': 10, 'axa b pension balanced': 45,
  'axa b pension dynamic': 80, 'crest 21': 0, 'crest 26': 5,
  'venture 1': 30, 'venture 2': 55, 'venture 3': 75,
  // Allianz
  'strategy balanced': 50, 'strategy dynamic': 80,
  'strategy defensive': 15, 'allianz branche 21': 0,
}

/** Minuscules, sans accent, espaces normalisés. */
export function normaliser(nom) {
  return String(nom || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim()
}

// « br 21 », « br21 », « br.21 », « branche 21 », « branch 21 », « tak 21 »
// (néerlandais), « b21 » — et les mêmes en 26 (capitalisation, également à
// capital garanti). Volontairement fermé sur 21 et 26 : « BR 23 » ne doit
// surtout pas passer ici.
const MOTIF_GARANTI = /\b(?:br(?:anche?)?\.?|tak|b)\s*\.?\s*2[16]\b|garanti|capital\s*protege/i

// « BR 23 » saisi seul n'est pas un fonds : c'est une famille. Le risque va
// d'un fonds obligataire défensif à 100 % actions. Le dire « inconnu » comme
// une faute de frappe serait faux — il y a bien un risque de marché, on
// ignore lequel. Il faut le nom du fonds.
const MOTIF_BR23 = /^\s*(?:br(?:anche?)?\.?|tak|b)\s*\.?\s*23\s*$/i

const MOTIFS = [
  [MOTIF_GARANTI, 0],
  [/equity|equities|action|growth|dynamic|technolog/i, 80],
  [/balanced|mixte|multi\s*asset|patrimonial/i, 50],
  [/bond|obligation|defensive|stability|income/i, 15],
  [/infrastructure|real\s*estate|immobil/i, 55],
  [/impact|sustainable|esg|durable/i, 60],
  [/megatrend|thematic|thematique/i, 75],
  [/star\s*fund/i, 70],
]

/**
 * Risque d'un fonds.
 * @returns {{risque: number|null, source: 'table'|'motif'|'inconnu', garanti: boolean}}
 */
export function risqueFonds(nom, table = null) {
  const cle = normaliser(nom)
  if (!cle) return { risque: null, source: 'inconnu', garanti: false }

  const garanti = MOTIF_GARANTI.test(cle)
  if (MOTIF_BR23.test(cle)) return { risque: null, source: 'branche23', garanti: false }

  // La table de `fonds_investissement` prime : c'est elle qui se corrige sans
  // deploiement. La liste ci-dessous n'est qu'un filet si la base ne repond pas.
  const deBase = table?.[cle]
  if (deBase) {
    return {
      risque: deBase.risque ?? null,
      sri: deBase.sri ?? null,
      source: 'base',
      garanti: deBase.categorie === 'garanti' || garanti,
    }
  }

  const deTable = FONDS_RISQUE[cle]
  if (deTable !== undefined) return { risque: deTable, source: 'table', garanti: garanti || deTable === 0 }

  for (const [motif, risque] of MOTIFS) {
    if (motif.test(cle)) return { risque, source: 'motif', garanti }
  }
  // Pas de valeur par défaut : l'inconnu reste inconnu.
  return { risque: null, source: 'inconnu', garanti: false }
}

/**
 * Risque d'une composition `{ nom: pourcentage }`.
 *
 * `score` ne porte que sur la part reconnue. `inconnus` liste ce qui n'a pas
 * été reconnu, pour l'afficher. `fiable` est faux dès qu'il manque quelque
 * chose — c'est à l'écran de le dire, pas au calcul de le masquer.
 */
export function compositionRisque(funds = {}, table = null) {
  let totalPct = 0, reconnuPct = 0, pondere = 0, garantiPct = 0
  const inconnus = []
  const aPreciser = []

  for (const [nom, pctBrut] of Object.entries(funds || {})) {
    const pct = Number(pctBrut)
    if (!Number.isFinite(pct) || pct <= 0) continue
    totalPct += pct
    const { risque, garanti, source } = risqueFonds(nom, table)
    if (source === 'branche23') { aPreciser.push(nom); continue }
    if (risque == null) { inconnus.push(nom); continue }
    reconnuPct += pct
    pondere += risque * pct
    if (garanti || risque === 0) garantiPct += pct
  }

  return {
    score: reconnuPct > 0 ? pondere / reconnuPct : null,
    totalPct,
    reconnuPct,
    garantiPct,
    inconnus,
    aPreciser,
    fiable: inconnus.length === 0 && aPreciser.length === 0 && totalPct > 0,
  }
}

/** Le niveau de risque, de 0 (capital garanti) à 100 (actions pures). */
export function profilDepuisScore(score) {
  if (score == null) return null
  if (score < 10) return 'Défensif'
  if (score < 30) return 'Conservateur'
  if (score < 55) return 'Neutre / Équilibré'
  if (score < 75) return 'Dynamique'
  return 'Offensif'
}

/**
 * Ce que la composition permet de dire — y compris « rien ».
 *
 * `motif` vaut :
 *  - 'capital_garanti' : 100 % à capital garanti. Pas de risque de marché,
 *    donc pas de profil de risque à établir. C'est le bureau qui tranche si
 *    un bulletin financier est malgré tout requis ; l'outil se contente de
 *    ne pas inventer un profil là où il n'y a pas de risque.
 *  - 'inconnu' : rien de reconnu, aucun profil possible.
 *  - 'partiel' : une partie seulement est reconnue.
 */
export function lectureComposition(funds = {}, table = null) {
  const c = compositionRisque(funds, table)
  if (c.totalPct === 0) return { ...c, profil: null, motif: 'inconnu' }
  if (c.aPreciser.length) return { ...c, profil: null, motif: 'branche23_a_preciser' }
  if (c.reconnuPct === 0) return { ...c, profil: null, motif: 'inconnu' }
  if (c.garantiPct >= c.totalPct - 0.01) {
    return { ...c, profil: null, motif: 'capital_garanti' }
  }
  return {
    ...c,
    profil: profilDepuisScore(c.score),
    motif: c.inconnus.length ? 'partiel' : null,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Lecture et alimentation de la table `fonds_investissement`
// ─────────────────────────────────────────────────────────────────────────

/**
 * Charge les fonds actifs en un objet indexe par nom normalise.
 *
 * La normalisation est faite ici, en JavaScript, avec la meme regle que
 * `normaliser_nom_fonds()` en SQL. Les deux doivent rester d'accord : sinon
 * l'ecran ne retrouve pas ce que la base contient.
 */
export async function chargerFonds(supabase) {
  const { data, error } = await supabase
    .from('fonds_investissement')
    .select('compagnie, nom, nom_normalise, sri, risque, categorie, source')
    .eq('actif', true)
  if (error) throw error
  const table = {}
  for (const f of data || []) {
    table[f.nom_normalise || normaliser(f.nom)] = f
  }
  return table
}

/** Enregistre un fonds rencontre dans un dossier. */
export async function enregistrerFonds(supabase, { compagnie, nom, sri, categorie = 'fonds', commentaire }) {
  const { data, error } = await supabase
    .from('fonds_investissement')
    .insert({
      compagnie: compagnie || 'INCONNUE',
      nom,
      nom_normalise: normaliser(nom),
      sri: sri ?? null,
      categorie,
      source: 'saisie',
      commentaire: commentaire || null,
    })
    .select('compagnie, nom, nom_normalise, sri, risque, categorie, source')
    .single()
  if (error) throw error
  return data
}

/**
 * Les compagnies qui ne proposent pas de fonds. Sur leurs contrats, il n'y a
 * pas de risque de marche, donc pas d'analyse de risque a mener.
 * `propose_branche_23` est renseigne a la main : c'est une connaissance
 * metier, pas une donnee synchronisee depuis Qlik.
 */
export async function chargerCompagniesSansFonds(supabase) {
  const { data, error } = await supabase
    .from('compagnies')
    .select('code, nom, nom_court, propose_branche_23')
    .eq('propose_branche_23', false)
  if (error) throw error
  return data || []
}

/** La compagnie d'un contrat propose-t-elle des fonds ? null = non tranche. */
export function compagnieSansFonds(nomCompagnie, liste = []) {
  const c = normaliser(nomCompagnie)
  if (!c) return null
  return liste.find(x =>
    c.includes(normaliser(x.nom_court)) || c.includes(normaliser(x.nom)) || c.includes(normaliser(x.code))
  ) || null
}
