import { supabase } from './supabase'

// Bucket public des logos (identique à CompagniesView / entites.js)
export const STORAGE_BASE = 'https://tndwonqdbeszkcztkzqe.supabase.co/storage/v1/object/public/logos/'

// URL d'un logo à partir d'un logo_url (nom de fichier du bucket OU URL complète)
export function logoUrlOf(logo_url) {
  if (!logo_url) return null
  return logo_url.startsWith('http') ? logo_url : STORAGE_BASE + encodeURIComponent(logo_url)
}

// Mots vides à ignorer pour rapprocher un nom brut (objets_risque) d'une fiche compagnie
const STOP = new Set(['sa','nv','srl','be','group','groupe','holding',
  'belgium','belgie','belgique','assurances','assurance','assurantien','verzekeringen',
  'verzekering','insurance','insurances','rechtsbijstand','protection','juridique','the'])

// Radical normalisé : minuscules, sans accents, sans ponctuation ni mots vides
export function normCie(nom) {
  if (!nom) return ''
  const base = nom.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim()
  const toks = base.split(' ').filter(t => t && !STOP.has(t))
  return toks.join(' ')
}

// Monogramme de repli quand aucune fiche compagnie ne correspond
function monogram(nom) {
  const toks = normCie(nom).split(' ').filter(Boolean)
  if (toks.length === 0) return (nom || '?').slice(0, 3).toUpperCase()
  if (toks.length === 1) return toks[0].slice(0, 5).toUpperCase()
  return toks.slice(0, 3).map(t => t[0]).join('').toUpperCase()
}

// Rapproche un nom brut d'une fiche `compagnies`. Renvoie {court, couleur, logoUrl, fiche}.
export function resolveCie(nomBrut, cies) {
  const fallback = { court: monogram(nomBrut), couleur: '#64748b', logoUrl: null, fiche: null }
  if (!nomBrut || !Array.isArray(cies) || !cies.length) return fallback
  const key = normCie(nomBrut)
  if (!key) return fallback
  const firstTok = key.split(' ')[0]
  let best = null
  for (const c of cies) {
    const cands = [normCie(c.nom), normCie(c.nom_court), normCie(c.code)].filter(Boolean)
    for (const cand of cands) {
      let score = 0
      if (cand === key) score = 3
      else if (cand.split(' ')[0] === firstTok && firstTok.length >= 2) score = 2
      else if ((cand.length >= 3 && key.startsWith(cand)) || (key.length >= 3 && cand.startsWith(key))) score = 1
      if (score && (!best || score > best.score)) best = { c, score }
    }
  }
  if (!best) return fallback
  const c = best.c
  return {
    court: (c.nom_court && c.nom_court.trim()) || monogram(c.nom || nomBrut),
    couleur: c.couleur || '#64748b',
    logoUrl: logoUrlOf(c.logo_url),
    fiche: c,
  }
}

// Chargement mémoïsé de la table compagnies (une seule requête par session)
let _cache = null, _p = null
export function getCompagnies() {
  if (_cache) return Promise.resolve(_cache)
  if (!_p) {
    _p = supabase.from('compagnies').select('code,nom,nom_court,couleur,logo_url')
      .then(({ data }) => { _cache = data || []; return _cache })
      .catch(() => { _cache = []; return _cache })
  }
  return _p
}
