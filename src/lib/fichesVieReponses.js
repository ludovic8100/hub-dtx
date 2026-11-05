// Pré-remplissage des fiches d'intermédiation Vie, et calcul du profil.
//
// LE SENS DU RAISONNEMENT A ÉTÉ INVERSÉ, ET C'EST LE POINT IMPORTANT.
//
// L'ancien code choisissait d'abord un profil à partir de la composition des
// fonds, fabriquait des réponses, puis les RETOUCHAIT EN BOUCLE jusqu'à ce
// que le score retombe dans la fourchette du profil visé :
//
//     while (score < lo) { answers[q] = 'b'; score += 1 }
//
// Le document concluait donc ce qu'on avait décidé qu'il conclurait. Ici, les
// réponses sont déduites de ce que le contrat dit réellement — durée, montant,
// composition, type de produit — et le profil est calculé À PARTIR d'elles.
// Mêmes données en entrée, mais le raisonnement va dans le bon sens, et une
// réponse corrigée à la main change le profil au lieu d'être écrasée.
//
// Ce pré-remplissage reste une PROPOSITION. Rien n'oblige le conseiller à la
// garder : chaque réponse est modifiable à l'écran avant de produire la fiche.

import { FICHES } from './fichesVie'

/** Le niveau de risque, de 0 (capital garanti) à 100 (actions pures). */
export function profilDepuisScoreRisque(score) {
  if (score < 10) return 'Défensif'
  if (score < 30) return 'Conservateur'
  if (score < 55) return 'Neutre / Équilibré'
  if (score < 75) return 'Dynamique'
  return 'Offensif'
}

/** Index d'option (0 = le plus prudent) selon le niveau de risque. */
function rang(scoreRisque, nbOptions) {
  const p = Math.max(0, Math.min(100, scoreRisque)) / 100
  return Math.min(nbOptions - 1, Math.round(p * (nbOptions - 1)))
}

function trancheHorizon(annees) {
  if (annees == null) return null
  if (annees <= 3) return 'De 0 à 3 ans'
  if (annees <= 8) return 'De 4 à 8 ans'
  if (annees <= 16) return 'De 9 à 16 ans'
  return '17 ans ou plus'
}

/**
 * Déduit une proposition de réponses à partir de ce que le contrat dit.
 * Tout ce qui n'est pas déductible reste VIDE : une case non cochée se voit,
 * une case cochée au hasard ne se voit pas.
 */
export function proposerReponses(fiche, ctx = {}) {
  const {
    scoreRisque = 50, horizonYears = null, montant = null,
    client = {}, contrat = null, funds = {},
  } = ctx

  const r = {}
  const brancheGarantie = Object.keys(funds || {}).some(f => /branche\s*21|garanti/i.test(f))
  const brancheFonds = Object.keys(funds || {}).some(f => !/branche\s*21|garanti/i.test(f))
  const pension = /pension|engagement|dirigeant|groupe/i.test(contrat?.type_production || '')

  // ── Coordonnées : ce que le Hub connaît déjà du client ────────────────
  r.nom = client.nom || ''
  r.prenom = client.prenom || ''
  r.adresse = [client.rue].filter(Boolean).join(' ')
  r.numero_rue = [client.num_maison, client.boite].filter(Boolean).join(' ')
  r.code_postal = client.cp || ''
  r.localite = client.localite || ''
  r.date_naissance = client.date_naissance || ''
  r.registre_national = client.registre_national || ''

  // ── Le produit proposé : lu dans le contrat ───────────────────────────
  r.prop_entreprise = contrat?.compagnie || ''
  r.prop_produit = contrat?.type_production || ''
  r.prop_prime = montant != null ? `${montant} EUR` : ''

  if (fiche.cle === 'APRES_2025') {
    // Partie I — exigences et besoins
    r.i_objectif = pension ? ['Un complément à mon revenu futur (par exemple une pension complémentaire).']
                           : ["D'une manière générale, faire fructifier un capital."]
    r.i_fiscal = pension ? 'Oui' : null
    if (montant != null) r.i_montant = montant
    const t = trancheHorizon(horizonYears)
    if (t) r.i_blocage = t

    // Partie II C — objectifs d'investissement (mêmes intitulés que I)
    r.c_objectif = r.i_objectif[0]
    if (t) r.c_delai = t

    // Partie II D — comportement face au risque, déduit de la composition
    const qD = fiche.parties.find(p => p.id === 'II').sections.find(s => s.id === 'D').questions
    const prefs = qD.find(q => q.id === 'd_preference')
    r.d_preference = prefs.opts[rang(scoreRisque, prefs.opts.length)]
    // Les trois autres questions D portent sur un comportement qu'aucune donnée
    // du contrat ne révèle. On ne les invente pas : le conseiller les remplit.

    // Partie II A — connaissance des produits réellement souscrits
    const table = fiche.parties.find(p => p.id === 'II').sections.find(s => s.id === 'A')
      .questions.find(q => q.id === 'a_produits')
    const lignes = {}
    const marque = (motif) => {
      const l = table.lignes.find(x => typeof x === 'string' && motif.test(x))
      if (l) lignes[l] = { 'Connaissances constatées': true, 'Une fois': true }
    }
    if (brancheGarantie) marque(/branche 21\)/i)
    if (brancheFonds) marque(/relevant de la branche 23\)/i)
    if (Object.keys(lignes).length) r.a_produits = lignes

    // Type de produit proposé
    if (brancheGarantie && brancheFonds) r.prop_type = 'Combinaison'
    else if (brancheFonds) r.prop_type = 'Branche 23'
    else if (brancheGarantie) r.prop_type = 'Branche 21'
  }

  if (fiche.cle === 'AVANT_2025') {
    r.b_prestation = null
    const qD = fiche.parties.find(p => p.id === 'I').sections.find(s => s.id === 'D').questions
    const prefs = qD.find(q => q.id === 'd_preference')
    r.d_preference = prefs.opts[rang(scoreRisque, prefs.opts.length)]
    // Le blocage jusqu'à l'âge légal : vrai pour une épargne-pension.
    if (pension) r.c_blocage = 'Oui'
    r.prop_entreprise = contrat?.compagnie || ''
    r.prop_type = brancheGarantie && brancheFonds ? 'Combinaison branche 21 / branche 23'
                : brancheFonds ? 'Branche 23' : brancheGarantie ? 'Branche 21' : ''

    const table = fiche.parties.find(p => p.id === 'I').sections.find(s => s.id === 'E')
      .questions.find(q => q.id === 'e_connaissances')
    const lignes = {}
    if (brancheFonds) {
      const l = table.lignes.find(x => typeof x === 'string' && /branche 23\)/i.test(x))
      if (l) lignes[l] = { 'Connaissances constatées': true, 'Une fois': true }
    }
    if (Object.keys(lignes).length) r.e_connaissances = lignes
  }

  return r
}

/**
 * Le profil, calculé À PARTIR des réponses — pas l'inverse.
 *
 * On ne retient que ce qui parle vraiment de tolérance au risque : la section
 * « comportement face au risque », et l'horizon. Les réponses laissées vides
 * ne comptent pas, et le profil le dit (`complet: false`) plutôt que de faire
 * comme si.
 */
export function profilDepuisReponses(fiche, reponses) {
  const partieRisque = fiche.cle === 'APRES_2025' ? 'II' : 'I'
  const section = fiche.parties.find(p => p.id === partieRisque)?.sections.find(s => s.id === 'D')
  if (!section) return { profil: null, score: null, repondues: 0, total: 0, complet: false }

  let somme = 0, max = 0, repondues = 0
  for (const q of section.questions) {
    if (q.type !== 'radio' || !q.opts?.length) continue
    max += q.opts.length - 1
    const v = reponses?.[q.id]
    if (v == null) continue
    const i = q.opts.indexOf(v)
    if (i < 0) continue
    somme += i
    repondues += 1
  }
  const total = section.questions.filter(q => q.type === 'radio' && q.opts?.length).length
  if (repondues === 0) return { profil: null, score: null, repondues: 0, total, complet: false }

  // Normalisé sur les seules questions répondues : un dossier à moitié rempli
  // ne doit pas paraître plus prudent qu'il n'est.
  const maxRepondues = section.questions
    .filter(q => q.type === 'radio' && q.opts?.length && reponses?.[q.id] != null)
    .reduce((s, q) => s + q.opts.length - 1, 0)
  const pct = maxRepondues > 0 ? (somme / maxRepondues) * 100 : 0

  return {
    profil: profilDepuisScoreRisque(pct),
    score: Math.round(pct),
    repondues, total,
    complet: repondues === total,
  }
}

export { FICHES }
