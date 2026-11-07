// Les cinq ambiances du Hub, et le mécanisme qui les applique.
//
// POURQUOI CE FICHIER, ET POURQUOI IL EST SI COURT
//
// Le Hub est en styles inline : il n'existe aucune feuille de style centrale.
// Changer de thème aurait donc dû vouloir dire toucher 119 fichiers.
//
// Il n'en est rien, grâce à une mesure faite avant d'écrire une ligne :
// `COUL` est employé 2 628 fois, et **jamais** manipulé comme une chaîne —
// pas une concaténation, pas un `.slice()`, pas un suffixe d'opacité. Ses
// valeurs ne sont que posées telles quelles dans des styles inline.
//
// Or un style inline accepte `var(--x)` exactement comme il accepte `#fff`.
// Il a donc suffi de remplacer les valeurs de `COUL` par des références de
// variables CSS pour que les 2 628 usages deviennent thématisables, sans
// toucher aux 73 fichiers qui les portent.
//
// CE QUI NE PASSE PAS PAR `var()`, ET POURQUOI `COUL_BRUT` EXISTE
//
// Trois consommateurs ne savent pas lire une variable CSS, et échouent en
// SILENCE — c'est ce qui les rend dangereux :
//
//   • `<canvas>` : `ctx.fillStyle = 'var(--x)'` est ignoré, la couleur
//     précédente reste. Signature du devoir d'information, questionnaire.
//   • la génération de QR : la bibliothèque attend du hexadécimal.
//   • jsPDF, pour la même raison.
//
// Ces trois-là lisent `COUL_BRUT`, qui porte les vraies valeurs de l'ambiance
// Standard. Un QR de note de frais reste donc noir sur blanc même en Halloween,
// et c'est voulu : un QR doit être lisible par un lecteur, pas joli.
//
// CE QUI CHANGE AVEC L'AMBIANCE, ET CE QUI N'EN A PAS LE DROIT
//
// Les couleurs d'identité des sociétés (`src/lib/entites.js`) ne sont pas ici
// et ne bougent jamais. Le orange de LODE n'est pas « la couleur d'accent »,
// c'est LODE. Le brief du package dit la même chose : « la marque de société
// doit rester clairement identifiable dans chaque saison. »

/** Les jetons de l'ambiance Standard en mode clair : l'état du Hub avant ce
 *  chantier, repris valeur pour valeur. C'est la base que les ambiances
 *  modifient par retouches. */
export const BASE_CLAIR = {
  texteFort: '#0f172a', texte: '#1e293b', texteSombre: '#334155',
  texteMoyen: '#475569', texteDoux: '#64748b', texteFaible: '#94a3b8',
  grisBleu: '#8c9cb0', grisBleuFonce: '#56677c',

  // `surface` est né du constat que `COUL.blanc` jouait DEUX rôles
  // incompatibles : 239 fois un fond de carte (qui doit s'assombrir), et
  // 160 fois du texte sur un fond coloré (qui doit rester blanc).
  surface: '#ffffff', surfaceHaute: '#ffffff',
  fond: '#f8fafc', fondDoux: '#f1f5f9', fondAlterne: '#fafafe',
  bord: '#e2e8f0', bordFort: '#cbd5e1',

  succes: '#16a34a', succesFonce: '#15803d', succesBord: '#bbf7d0',
  succesFond: '#dcfce7', succesFondDoux: '#f0fdf4',
  danger: '#dc2626', dangerFonce: '#b91c1c', dangerBord: '#fecaca',
  dangerFond: '#fee2e2', dangerFondDoux: '#fef2f2',
  alerte: '#b45309', alerteFonce: '#92400e', alerteVif: '#f59e0b',
  alerteFond: '#fef3c7', alerteFondDoux: '#fffbeb',
  info: '#2563eb', infoFond: '#eff6ff', infoFondDoux: '#f0f9ff',

  saison: '#5dafff', saisonDoux: 'rgba(74,153,237,.13)',
  saisonLueur: 'rgba(30,128,236,.10)', saisonSymbole: "'✦'",
}

/** Les jetons FIXES : identité du groupe et blanc vrai. Ils ne dépendent ni de
 *  l'ambiance ni du mode, et c'est le point entier. */
export const FIXES = {
  blanc: '#ffffff',
  bleu: '#0080bd', marine: '#0d2f5e', marineClair: '#1a3a6b',
  violet: '#7c3aed', violetFond: '#f5f3ff',
  teal: '#0d9488', tealFond: '#f0fdfa',
  orange: '#ea580c', orangeFond: '#fff7ed',
}

/** Le mode sombre : une retouche appliquée PAR-DESSUS l'ambiance.
 *  Les teintes de statut sont éclaircies, pas changées de famille — un
 *  danger reste rouge, sinon la couleur ne veut plus rien dire. */
const SOMBRE = {
  texteFort: '#f1f6fc', texte: '#e2ecf6', texteSombre: '#cbd9e8',
  texteMoyen: '#a9bed2', texteDoux: '#94adc4', texteFaible: '#6e8ba5',
  grisBleu: '#7e94ad', grisBleuFonce: '#9db2c8',
  surface: '#0f243b', surfaceHaute: '#142c45',
  fond: '#071425', fondDoux: '#0a1c32', fondAlterne: '#0d2136',
  bord: 'rgba(167,205,238,.14)', bordFort: 'rgba(167,205,238,.26)',

  succes: '#5bd3a1', succesFonce: '#76ddb3', succesBord: 'rgba(56,203,148,.34)',
  succesFond: 'rgba(56,203,148,.14)', succesFondDoux: 'rgba(56,203,148,.07)',
  danger: '#ff8780', dangerFonce: '#ffa39d', dangerBord: 'rgba(255,135,128,.36)',
  dangerFond: 'rgba(255,135,128,.15)', dangerFondDoux: 'rgba(255,135,128,.08)',
  alerte: '#f3ca7b', alerteFonce: '#ffd89a', alerteVif: '#ffbe4d',
  alerteFond: 'rgba(246,183,78,.15)', alerteFondDoux: 'rgba(246,183,78,.08)',
  info: '#89bdff', infoFond: 'rgba(104,159,251,.14)', infoFondDoux: 'rgba(104,159,251,.07)',
}

/** Les cinq ambiances. Chacune ne retouche que des SURFACES et un accent :
 *  aucune ne touche aux couleurs de statut ni aux couleurs de société.
 *
 *  `clair` et `sombre` sont deux retouches successives — l'ambiance d'abord,
 *  le mode ensuite — pour que Noël en clair et Noël en sombre restent
 *  reconnaissables comme le même Noël. */
export const AMBIANCES = {
  standard: {
    couverture: '/ambiances/standard.webp',
    label: 'Standard', symbole: '✦',
    clair: { saison: '#5dafff', saisonDoux: 'rgba(74,153,237,.13)', saisonLueur: 'rgba(30,128,236,.10)' },
    sombre: { saison: '#5daffF', saisonDoux: 'rgba(74,153,237,.15)', saisonLueur: 'rgba(30,128,236,.22)' },
  },
  noel: {
    couverture: '/ambiances/noel.webp',
    label: 'Noël', symbole: '❄',
    clair: {
      fond: '#f2f7f5', fondDoux: '#e9f2ee', fondAlterne: '#f7fbf9',
      saison: '#b8860b', saisonDoux: 'rgba(245,202,120,.22)', saisonLueur: 'rgba(245,182,84,.14)',
    },
    sombre: {
      fond: '#071927', fondDoux: '#061d2c', surface: '#102b3c', surfaceHaute: '#16354b',
      saison: '#f5ca78', saisonDoux: 'rgba(245,202,120,.14)', saisonLueur: 'rgba(245,182,84,.18)',
    },
  },
  'nouvel-an': {
    couverture: '/ambiances/nouvel-an.webp',
    label: 'Nouvel An', symbole: '✧',
    clair: {
      fond: '#f8f7fb', fondDoux: '#efedf7', fondAlterne: '#fbfaff',
      saison: '#a16207', saisonDoux: 'rgba(245,197,107,.22)', saisonLueur: 'rgba(255,212,131,.14)',
    },
    sombre: {
      fond: '#0a1127', fondDoux: '#0b1630', surface: '#172541', surfaceHaute: '#1d3051',
      saison: '#f2c676', saisonDoux: 'rgba(245,197,107,.15)', saisonLueur: 'rgba(255,212,131,.18)',
    },
  },
  halloween: {
    couverture: '/ambiances/halloween.webp',
    label: 'Halloween', symbole: '☾',
    clair: {
      fond: '#f8f5fa', fondDoux: '#efe9f3', fondAlterne: '#fcf9fd',
      saison: '#c2410c', saisonDoux: 'rgba(255,128,52,.16)', saisonLueur: 'rgba(172,88,201,.12)',
    },
    sombre: {
      fond: '#120f26', fondDoux: '#151026', surface: '#231c39', surfaceHaute: '#2d2247',
      saison: '#ff9a51', saisonDoux: 'rgba(255,128,52,.14)', saisonLueur: 'rgba(172,88,201,.19)',
    },
  },
  vacances: {
    couverture: '/ambiances/vacances.webp',
    label: 'Vacances', symbole: '☀',
    clair: {
      fond: '#f0f9fa', fondDoux: '#e2f2f3', fondAlterne: '#f7fdfd',
      saison: '#0f766e', saisonDoux: 'rgba(83,224,203,.20)', saisonLueur: 'rgba(40,203,210,.12)',
    },
    sombre: {
      fond: '#071d2b', fondDoux: '#082438', surface: '#0b3243', surfaceHaute: '#144358',
      saison: '#8ee8d3', saisonDoux: 'rgba(83,224,203,.15)', saisonLueur: 'rgba(40,203,210,.18)',
    },
  },
}

export const CLES_AMBIANCE = Object.keys(AMBIANCES)
export const MODES = ['clair', 'sombre']

/** Les jetons effectifs d'une (ambiance, mode) : base, puis retouche
 *  d'ambiance, puis retouche de mode, puis retouche d'ambiance-en-mode. */
export function jetons(ambiance, mode) {
  const a = AMBIANCES[ambiance] || AMBIANCES.standard
  const sombre = mode === 'sombre'
  return {
    ...BASE_CLAIR,
    ...(a.clair || {}),
    ...(sombre ? SOMBRE : {}),
    ...(sombre ? (a.sombre || {}) : {}),
    saisonSymbole: `'${a.symbole}'`,
    ...FIXES,
  }
}

const VAR = (cle) => `--hub-${cle}`

/** La feuille de style complète : un bloc par couple (ambiance, mode).
 *  Dix blocs, générés — pas écrits à la main, pour qu'un jeton ajouté plus
 *  tard ne puisse pas être oublié dans neuf d'entre eux. */
export function cssDesAmbiances() {
  const bloc = (selecteur, vals) =>
    `${selecteur}{${Object.entries(vals).map(([k, v]) => `${VAR(k)}:${v}`).join(';')}}`

  const regles = [bloc(':root', jetons('standard', 'clair'))]
  for (const amb of CLES_AMBIANCE) {
    for (const mode of MODES) {
      regles.push(bloc(`html[data-ambiance="${amb}"][data-mode="${mode}"]`, jetons(amb, mode)))
    }
  }
  // La couverture de la page de garde ne dépend pas du mode : la même image
  // sert en clair et en sombre. Elle sort donc dans sa propre règle, une par
  // ambiance, au lieu d'être dupliquée dans les dix blocs.
  for (const amb of CLES_AMBIANCE) {
    regles.push(`html[data-ambiance="${amb}"]{--hub-couverture:url('${AMBIANCES[amb].couverture}')}`)
  }
  regles.push(`:root{--hub-couverture:url('${AMBIANCES.standard.couverture}')}`)

  // `color-scheme` fait suivre les éléments natifs — ascenseurs, cases à
  // cocher, sélecteurs de date. Sans lui, un thème sombre garde des
  // ascenseurs blancs, et ça se voit immédiatement.
  regles.push('html[data-mode="sombre"]{color-scheme:dark}')
  regles.push('html[data-mode="clair"]{color-scheme:light}')
  // Le fond du document lui-même, sinon le sur-défilement montre du blanc.
  regles.push(`body{background:var(${VAR('fond')});transition:background .2s}`)
  regles.push('@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}')
  return regles.join('\n')
}

const CLE_STOCKAGE = 'hubdtx.ambiance.v1'

/** Le choix mémorisé, ou Standard/clair. Toute lecture de stockage est
 *  protégée : en navigation privée elle peut lever. */
export function preferenceLue() {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE)
    if (!brut) return { ambiance: 'standard', mode: 'clair', auto: false }
    const p = JSON.parse(brut)
    return {
      ambiance: CLES_AMBIANCE.includes(p.ambiance) ? p.ambiance : 'standard',
      mode: MODES.includes(p.mode) ? p.mode : 'clair',
      auto: p.auto === true,
    }
  } catch { return { ambiance: 'standard', mode: 'clair', auto: false } }
}

export function preferenceEcrite(p) {
  try { localStorage.setItem(CLE_STOCKAGE, JSON.stringify(p)) } catch { /* sans effet */ }
}

/** L'ambiance que le calendrier propose — JAMAIS imposée.
 *  Dates volontairement larges côté Noël (le Hub sert du 1er décembre au
 *  Nouvel An) et étroites côté Halloween. Heure belge : on lit la date
 *  locale du navigateur, qui l'est pour tout le monde ici. */
export function ambianceDuCalendrier(date = new Date()) {
  const m = date.getMonth() + 1, j = date.getDate()
  if (m === 12 && j >= 1 && j <= 26) return 'noel'
  if ((m === 12 && j >= 27) || (m === 1 && j <= 6)) return 'nouvel-an'
  if (m === 10 && j >= 24) return 'halloween'
  if (m === 11 && j <= 2) return 'halloween'
  if (m === 7 || m === 8) return 'vacances'
  return 'standard'
}

/** Pose l'ambiance sur <html>. C'est le seul geste qui change l'apparence :
 *  deux attributs, et les 2 628 `var()` suivent. */
export function appliquer({ ambiance, mode }) {
  if (typeof document === 'undefined') return
  const r = document.documentElement
  r.setAttribute('data-ambiance', CLES_AMBIANCE.includes(ambiance) ? ambiance : 'standard')
  r.setAttribute('data-mode', MODES.includes(mode) ? mode : 'clair')
}

/** Injecte la feuille une seule fois. Le Hub n'a aucune feuille de style
 *  centrale — c'est la première, et elle ne contient que des variables. */
export function injecterFeuille() {
  if (typeof document === 'undefined') return
  const ID = 'hub-ambiances'
  if (document.getElementById(ID)) return
  const el = document.createElement('style')
  el.id = ID
  el.textContent = cssDesAmbiances()
  document.head.appendChild(el)
}
