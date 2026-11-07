// Les couleurs du Hub, à un seul endroit.
//
// POURQUOI CE FICHIER EXISTE
//
// Mesuré le 04/11, revérifié le 07/11 : le Hub est en styles inline — un
// choix d'origine, pas un accident — donc il n'existe aucune feuille de
// style centrale, et donc aucun endroit où changer le thème. 3 357 couleurs
// étaient écrites en dur dans 76 fichiers.
//
// CE QUI A CHANGÉ LE 07/11 : LES VALEURS SONT DEVENUES DES VARIABLES
//
// `COUL` ne porte plus de valeurs hexadécimales mais des références
// `var(--hub-…)`. Un style inline lit `var()` exactement comme il lisait
// `#fff`, donc les 2 628 usages de `COUL` à travers 73 fichiers sont
// devenus thématisables **sans qu'aucun de ces fichiers ne change**.
//
// Ce n'était possible qu'à une condition, vérifiée avant d'y toucher :
// `COUL` n'est JAMAIS manipulé comme une chaîne — pas une concaténation,
// pas un `.slice()`, pas un suffixe d'opacité. Si une seule ligne avait
// écrit `COUL.bord + '80'`, cette bascule l'aurait cassée en silence.
//
// LES VALEURS, ELLES, SONT DANS `themes.js`
//
// Un jeton décrit un RÔLE dans l'interface : du texte faible, une bordure,
// un fond d'alerte. Il ne décrit pas une marque. Les couleurs d'identité des
// six sociétés (`src/lib/entites.js`) ne sont donc pas ici : le orange de
// LODE n'est pas « la couleur d'accent », c'est LODE.
//
// ⚠️ TROIS ENDROITS NE SAVENT PAS LIRE `var()`, ET ÉCHOUENT EN SILENCE :
// un `<canvas>` (`ctx.fillStyle`), la génération de QR, et jsPDF. Ceux-là
// doivent importer `COUL_BRUT`, qui porte de vraies valeurs hexadécimales.

import { BASE_CLAIR, FIXES } from './themes'

const TOUTES_LES_CLES = [...Object.keys(BASE_CLAIR), ...Object.keys(FIXES)]

/** Les jetons, en références de variables CSS. C'est ce qu'emploient tous
 *  les styles inline du Hub. */
export const COUL = Object.fromEntries(
  TOUTES_LES_CLES.map(cle => [cle, `var(--hub-${cle})`])
)

/** Les mêmes jetons, en valeurs réelles de l'ambiance Standard claire.
 *  Réservé à ce qui ne sait pas lire une variable CSS : canvas, QR, PDF.
 *  Ne pas l'employer dans un style inline — ça marcherait, et ça ignorerait
 *  le thème sans rien signaler. */
export const COUL_BRUT = { ...BASE_CLAIR, ...FIXES }

export default COUL
