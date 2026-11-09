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

  saison: '#5dafff', saisonDoux: 'rgba(74,153,237,.13)', saisonMotif: 'none',
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
    titre: "", sousTitre: "",
    label: 'Standard', symbole: '✦',
    clair: { saison: '#5dafff', saisonBandeauFond: "linear-gradient(100deg,#0d2f5e,#1e5f8f)", saisonDoux: 'rgba(74,153,237,.13)', saisonMotif: 'none', saisonLueur: 'rgba(30,128,236,.10)' },
    sombre: { saison: '#5daffF', saisonBandeauFond: "linear-gradient(100deg,#0d2f5e,#1e5f8f)", saisonDoux: 'rgba(74,153,237,.15)', saisonMotif: 'none', saisonLueur: 'rgba(30,128,236,.22)' },
  },
  noel: {
    couverture: '/ambiances/noel.webp',
    titre: "La douceur des fêtes", sousTitre: "Sapin naturel, lumières chaudes et esprit de fin d'année.",
    label: 'Noël', symbole: '❄',
    clair: {
      fond: '#eaf4ef', fondDoux: '#dbeae2', fondAlterne: '#f3faf6',
      saison: '#b8860b', saisonBandeauFond: "linear-gradient(100deg,#0b2d20,#7f1d1d 55%,#b8860b)", saisonDoux: 'rgba(245,202,120,.22)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%9D%84%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9D%85%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(245,182,84,.14)',
    },
    sombre: {
      fond: '#071927', fondDoux: '#061d2c', surface: '#102b3c', surfaceHaute: '#16354b',
      saison: '#f5ca78', saisonBandeauFond: "linear-gradient(100deg,#07241a,#6b1717 55%,#8a6417)", saisonDoux: 'rgba(245,202,120,.14)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%9D%84%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9D%85%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(245,182,84,.18)',
    },
  },
  'nouvel-an': {
    couverture: '/ambiances/nouvel-an.webp',
    titre: "Un nouveau chapitre ensemble", sousTitre: "Une nouvelle année, la même énergie pour vos projets.",
    label: 'Nouvel An', symbole: '✧',
    clair: {
      fond: '#f1eefb', fondDoux: '#e3def4', fondAlterne: '#f8f5ff',
      saison: '#a16207', saisonBandeauFond: "linear-gradient(100deg,#14213d,#a16207 60%,#eab308)", saisonDoux: 'rgba(245,197,107,.22)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%9C%A7%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%98%85%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(255,212,131,.14)',
    },
    sombre: {
      fond: '#0a1127', fondDoux: '#0b1630', surface: '#172541', surfaceHaute: '#1d3051',
      saison: '#f2c676', saisonBandeauFond: "linear-gradient(100deg,#0f192e,#7c4a06 60%,#b88a0c)", saisonDoux: 'rgba(245,197,107,.15)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%9C%A7%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%98%85%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(255,212,131,.18)',
    },
  },
  halloween: {
    couverture: '/ambiances/halloween.webp',
    titre: "L'automne s'invite au Hub", sousTitre: "Une lumière chaleureuse pour accompagner vos journées.",
    label: 'Halloween', symbole: '☾',
    clair: {
      fond: '#f4ecf7', fondDoux: '#e7dcee', fondAlterne: '#faf4fc',
      saison: '#c2410c', saisonBandeauFond: "linear-gradient(100deg,#1b1024,#6b21a8 45%,#ea580c)", saisonDoux: 'rgba(255,128,52,.16)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%98%BE%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%98%85%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(172,88,201,.12)',
    },
    sombre: {
      fond: '#120f26', fondDoux: '#151026', surface: '#231c39', surfaceHaute: '#2d2247',
      saison: '#ff9a51', saisonBandeauFond: "linear-gradient(100deg,#140b1b,#53177f 45%,#b8440a)", saisonDoux: 'rgba(255,128,52,.14)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%98%BE%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%98%85%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(172,88,201,.19)',
    },
  },
  vacances: {
    couverture: '/ambiances/vacances.webp',
    titre: "Un air de vacances", sousTitre: "Un peu de lumière et de sérénité dans votre quotidien.",
    label: 'Vacances', symbole: '☀',
    clair: {
      fond: '#e6f6f7', fondDoux: '#d2ecee', fondAlterne: '#f2fcfd',
      saison: '#0f766e', saisonBandeauFond: "linear-gradient(100deg,#083344,#0f766e 50%,#22d3ee)", saisonDoux: 'rgba(83,224,203,.20)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%98%80%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%89%88%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(40,203,210,.12)',
    },
    sombre: {
      fond: '#071d2b', fondDoux: '#082438', surface: '#0b3243', surfaceHaute: '#144358',
      saison: '#8ee8d3', saisonBandeauFond: "linear-gradient(100deg,#062632,#0b5a54 50%,#1aa3b8)", saisonDoux: 'rgba(83,224,203,.15)', saisonMotif: "url('data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20width%3D%2796%27%20height%3D%2796%27%20viewBox%3D%270%200%2096%2096%27%3E%3Ctext%20x%3D%2712%27%20y%3D%2730%27%20font-size%3D%2722%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.22%27%3E%E2%98%80%3C%2Ftext%3E%3Ctext%20x%3D%2760%27%20y%3D%2758%27%20font-size%3D%2715%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%89%88%3C%2Ftext%3E%3Ctext%20x%3D%2726%27%20y%3D%2784%27%20font-size%3D%2717%27%20fill%3D%27%2523ffffff%27%20fill-opacity%3D%270.16%27%3E%E2%9C%A6%3C%2Ftext%3E%3C%2Fsvg%3E')", saisonLueur: 'rgba(40,203,210,.18)',
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
  for (const amb of CLES_AMBIANCE) {
    regles.push(`html[data-ambiance="${amb}"]{--hub-bandeau:url('/ambiances/bandeaux/${amb}.webp')}`)
  }
  regles.push(`:root{--hub-couverture:url('${AMBIANCES.standard.couverture}')}`)

  // `color-scheme` fait suivre les éléments natifs — ascenseurs, cases à
  // cocher, sélecteurs de date. Sans lui, un thème sombre garde des
  // ascenseurs blancs, et ça se voit immédiatement.
  // ── Ce qui rend une saison VISIBLE ────────────────────────────────────
  //
  // Les jetons `saison*` existaient sans consommateur : seul le fond de page
  // changeait, de deux ou trois pour cent. Ludovic, 08/11 : « on ne voit rien
  // dans les saisons a part le fond qui change de couleur ». C'etait exact.
  //
  // Trois marques, toutes decoratives et toutes `pointer-events:none` : elles
  // ne doivent jamais attraper un clic ni gener un lecteur d'ecran.
  regles.push(
    // Une lueur en haut a droite de la zone de travail.
    `.hub-saison-zone{background-image:radial-gradient(ellipse 62% 38% at 95% 0%,var(${VAR('saisonLueur')}),transparent 72%)}`,
    // Un lavis dans l'en-tete, du cote droit. PAS de pseudo-element ici :
    // l'en-tete porte des menus deroulants, et l'`overflow:hidden` qu'un
    // ornement imposerait les couperait net.
    // L'en-tête portait un dégradé partant de 40 % : invisible sur un bandeau
    // de 56 px. Il part désormais de la gauche et porte le motif à droite.
    `.hub-saison-entete{background-image:var(${VAR('saisonMotif')}),linear-gradient(90deg,transparent 0%,var(${VAR('saisonDoux')}) 100%);background-repeat:repeat,no-repeat;background-size:96px 96px,100% 100%;background-position:right center,center}`,
    // Le symbole de la saison, en filigrane au bas du menu.
    // ⚠️ UN `::after` NE PEUT AFFICHER QU'UN SEUL SYMBOLE.
    //
    // Ludovic : « dans les templates Noël, Nouvel An, Vacances, tu étais censé
    // mettre de la décoration. Ici il n'y a rien à part le fond ». Mesuré sur
    // capture : un unique flocon, à 16 % d'opacité, à moitié coupé en bas du
    // menu. Ce n'était pas de la décoration, c'était une trace.
    //
    // Le motif est donc une TUILE SVG répétée, portée par le jeton
    // `saisonMotif` — trois symboles décalés pour que la répétition ne se
    // voie pas. En Standard il vaut `none` : pas d'ambiance, pas de motif.
    `.hub-saison-volet{position:relative;background-image:var(${VAR('saisonMotif')});background-repeat:repeat;background-size:96px 96px}`,
  )
  // ── LE BANDEAU DE SAISON ET LE FOND DE PAGE ──────────────────────────
  // Ludovic, 09/11, maquette à l'appui : une photo dit « Noël » en un
  // dixième de seconde, un flocon dessiné demande qu'on le regarde. La
  // saison reçoit donc une bande à elle sous l'en-tête, et le fond de page
  // porte la même photo très assombrie.
  //
  // `--hub-couverture` existait déjà pour la page de garde : on la réutilise
  // plutôt que d'ajouter douze fichiers. La bande montre le HAUT de l'image,
  // parce que le logo DTX y est incrusté au centre — le cadrer serait le
  // montrer deux fois.
  // ⚠️ LE BANDEAU NE PEUT PAS RÉUTILISER LA COUVERTURE.
  // Le logo DTX est incrusté AU CENTRE des images de garde : quel que soit le
  // cadrage, une bande de 118 px en attrape un morceau — vérifié sur capture.
  // Le bandeau attend donc sa propre photo dans /ambiances/bandeaux/<code>.webp.
  //
  // Deux couches : la photo d'abord, le dégradé de saison dessous. Une couche
  // dont le fichier manque ne peint rien et laisse voir la suivante — le
  // bandeau reste donc présentable avant même que les photos existent, au lieu
  // d'afficher un carré vide.
  regles.push(
    `.hub-saison-bandeau{background-image:var(--hub-bandeau),var(${VAR('saisonBandeauFond')});` +
      `background-size:cover,cover;background-position:center,center;background-repeat:no-repeat,no-repeat}`,
    `html[data-ambiance="standard"] .hub-saison-bandeau{display:none}`,
    // Un voile qui part du bas à gauche : le titre doit rester lisible quelle
    // que soit la photo, et une photo claire sous du texte blanc ne pardonne
    // pas. Le dégradé est opaque là où le texte se pose.
    `.hub-saison-bandeau::after{content:"";position:absolute;inset:0;` +
      `background:linear-gradient(100deg,rgba(8,20,36,.88) 0%,rgba(8,20,36,.62) 42%,rgba(8,20,36,.12) 78%,transparent 100%)}`,
    // Le fond de page. 8 % d'opacité : on doit sentir la saison sans jamais
    // gêner la lecture d'un tableau de chiffres.
    `.hub-saison-zone::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;` +
      `background-image:var(--hub-couverture);background-size:cover;background-position:center;opacity:.08}`,
    `html[data-ambiance="standard"] .hub-saison-zone::before{display:none}`,
    `.hub-saison-zone > *{position:relative;z-index:1}`,
  )
  regles.push('html[data-mode="sombre"]{color-scheme:dark}')
  regles.push('html[data-mode="clair"]{color-scheme:light}')
  // Le fond du document lui-même, sinon le sur-défilement montre du blanc.
  regles.push(`body{background:var(${VAR('fond')});transition:background .2s}`)
  regles.push('@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}')
  return regles.join('\n')
}

// ── Le réglage du groupe ────────────────────────────────────────────────────
//
// Règle donnée par Ludovic le 08/11 : « c'est un admin qui change pour tout
// le monde ». Il n'y a donc AUCUNE préférence par utilisateur, et le
// sélecteur a quitté l'en-tête. La seule source est la table
// `ref_ambiances`, réglée dans Paramètres → Ambiances.
//
// Ce que le navigateur garde n'est pas un choix : c'est un CACHE du réglage
// du groupe. Il sert à poser la bonne ambiance dès le premier pixel, avant
// toute requête — sinon chaque chargement afficherait Standard une
// demi-seconde puis basculerait.

const CLE_CACHE = 'hubdtx.ambiance.v2'

/** Le réglage de repli, identique au catalogue de la migration. Il ne sert
 *  qu'avant la première réponse de la base. Tout est éteint : tant que
 *  personne n'a touché à Paramètres, le Hub reste en Standard. */
export const REGLES_DEFAUT = [
  { code: 'standard',  actif: false, forcee: false, debut_mois: null, debut_jour: null, fin_mois: null, fin_jour: null },
  { code: 'noel',      actif: false, forcee: false, debut_mois: 12, debut_jour: 1,  fin_mois: 12, fin_jour: 26 },
  { code: 'nouvel-an', actif: false, forcee: false, debut_mois: 12, debut_jour: 27, fin_mois: 1,  fin_jour: 6 },
  { code: 'halloween', actif: false, forcee: false, debut_mois: 10, debut_jour: 24, fin_mois: 11, fin_jour: 2 },
  { code: 'vacances',  actif: false, forcee: false, debut_mois: 7,  debut_jour: 1,  fin_mois: 8,  fin_jour: 31 },
]

export function reglesLues() {
  try {
    const brut = localStorage.getItem(CLE_CACHE)
    if (!brut) return REGLES_DEFAUT
    const r = JSON.parse(brut)
    return Array.isArray(r) && r.length ? r : REGLES_DEFAUT
  } catch { return REGLES_DEFAUT }
}

export function reglesEcrites(regles) {
  try { localStorage.setItem(CLE_CACHE, JSON.stringify(regles || [])) } catch { /* sans effet */ }
}

/** Le jour `j/m` tombe-t-il dans la fenêtre d'une saison ?
 *
 *  Une fenêtre peut ENJAMBER LE NOUVEL AN (27/12 → 06/01). Comparer
 *  bêtement `debut <= jour <= fin` donnerait faux pour toutes celles-là —
 *  c'est le piège de ce calcul, et il ne se voit qu'une fois par an. */
export function dansLaFenetre(regle, mois, jour) {
  const { debut_mois: dm, debut_jour: dj, fin_mois: fm, fin_jour: fj } = regle || {}
  if (!dm || !dj || !fm || !fj) return false
  const v = mois * 100 + jour, d = dm * 100 + dj, f = fm * 100 + fj
  return d <= f ? (v >= d && v <= f) : (v >= d || v <= f)
}

/** L'ambiance que le groupe affiche aujourd'hui.
 *
 *  Deux façons de choisir, et une seule gagne :
 *    1. une ambiance IMPOSÉE par l'administrateur — les dates sont ignorées ;
 *    2. sinon le calendrier : la première saison active dont la fenêtre
 *       couvre aujourd'hui ;
 *    3. sinon Standard.
 *
 *  Deux saisons qui se chevauchent ne sont pas une erreur : l'ordre tranche,
 *  et l'écran de Paramètres le dit. */
export function ambianceEffective(date = new Date(), regles = reglesLues()) {
  const liste = regles || []
  const imposee = liste.find(r => r.forcee && CLES_AMBIANCE.includes(r.code))
  if (imposee) return imposee.code
  const m = date.getMonth() + 1, j = date.getDate()
  for (const r of liste) {
    if (r.actif && CLES_AMBIANCE.includes(r.code) && dansLaFenetre(r, m, j)) return r.code
  }
  return 'standard'
}

/** Pose l'ambiance sur <html>. C'est le seul geste qui change l'apparence :
 *  un attribut, et les 2 628 `var()` suivent.
 *
 *  Le mode reste `clair` : la bascule sombre a été retirée (décision du
 *  07/11), mais l'attribut est posé quand même pour que la feuille trouve
 *  toujours son bloc. */
export function appliquer(regles = reglesLues()) {
  if (typeof document === 'undefined') return
  const code = ambianceEffective(new Date(), regles)
  const r = document.documentElement
  r.setAttribute('data-ambiance', CLES_AMBIANCE.includes(code) ? code : 'standard')
  r.setAttribute('data-mode', 'clair')
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
