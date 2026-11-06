// Les couleurs du Hub, à un seul endroit.
//
// POURQUOI CE FICHIER EXISTE
//
// Mesuré le 04/11, revérifié le 06/11 : 3 357 couleurs écrites en dur dans
// 76 fichiers. Le Hub est en styles inline — c'est un choix d'origine, pas un
// accident — donc il n'existait aucune feuille de style centrale, et donc
// aucun endroit où changer le thème. La seule nuance de gris #94a3b8
// apparaissait 456 fois.
//
// Tant que c'était ainsi, « appliquer une charte » voulait dire toucher
// 76 fichiers. Maintenant, cela veut dire toucher celui-ci.
//
// CE QUI EST UN JETON, ET CE QUI N'EN EST PAS
//
// Un jeton décrit un RÔLE dans l'interface : du texte faible, une bordure,
// un fond d'alerte. Il ne décrit pas une marque.
//
// Les couleurs d'identité des six sociétés (`src/lib/entites.js`) ne sont
// donc PAS ici : le orange de LODE n'est pas « la couleur d'accent », c'est
// LODE. Changer le thème ne doit pas repeindre les sociétés.
//
// LA RAMPE
//
// Ces valeurs viennent de la palette Tailwind (slate, red, green, amber,
// violet, teal, orange), qui était déjà employée de fait partout dans le
// code. On ne les a pas réinventées : on leur a donné leur nom.

export const COUL = {
  // ── Texte, du plus fort au plus effacé ────────────────────────────────
  texteFort:   '#0f172a',   // titres, chiffres qui comptent
  texte:       '#1e293b',   // corps
  texteSombre: '#334155',
  texteMoyen:  '#475569',
  texteDoux:   '#64748b',   // libellés, texte secondaire
  texteFaible: '#94a3b8',   // mentions, « — », placeholders

  // Une seconde rampe de gris, plus bleutée, employée par les écrans
  // récents (anomalies compta, fiches Vie, questionnaire). Conservée
  // telle quelle : la fondre dans la rampe slate changerait leur rendu.
  grisBleu:      '#8c9cb0',
  grisBleuFonce: '#56677c',

  // ── Surfaces ──────────────────────────────────────────────────────────
  blanc:       '#fff',
  fond:        '#f8fafc',   // fond des en-têtes de tableau
  fondDoux:    '#f1f5f9',   // séparateurs, lignes de tableau
  fondAlterne: '#fafafe',   // une ligne sur deux

  // ── Bordures ──────────────────────────────────────────────────────────
  bord:     '#e2e8f0',
  bordFort: '#cbd5e1',

  // ── Marque ────────────────────────────────────────────────────────────
  bleu:        '#0080bd',   // le bleu Dynassur
  marine:      '#0d2f5e',
  marineClair: '#1a3a6b',

  // ── États ─────────────────────────────────────────────────────────────
  succes:        '#16a34a',
  succesFonce:   '#15803d',
  succesBord:    '#bbf7d0',
  succesFond:    '#dcfce7',
  succesFondDoux:'#f0fdf4',

  danger:         '#dc2626',
  dangerFonce:    '#b91c1c',
  dangerBord:     '#fecaca',
  dangerFond:     '#fee2e2',
  dangerFondDoux: '#fef2f2',

  alerte:         '#b45309',
  alerteFonce:    '#92400e',
  alerteVif:      '#f59e0b',
  alerteFond:     '#fef3c7',
  alerteFondDoux: '#fffbeb',

  info:         '#2563eb',
  infoFond:     '#eff6ff',
  infoFondDoux: '#f0f9ff',

  // ── Accents ───────────────────────────────────────────────────────────
  violet:     '#7c3aed',
  violetFond: '#f5f3ff',
  teal:       '#0d9488',
  tealFond:   '#f0fdfa',
  orange:     '#ea580c',
  orangeFond: '#fff7ed',
}

export default COUL
