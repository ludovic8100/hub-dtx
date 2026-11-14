// LE FILET QUI MANQUAIT — ajouté le 14/11/2026, après une page cassée en
// production.
//
// `docId is not defined` a mis hors service toute la page Devis & Factures de
// LODE. La variable était locale à la fonction d'enregistrement et employée
// dans le JSX, où elle n'existe pas.
//
// ⚠️ LE PIÈGE : `npm run build` PASSE. Une variable absente de la portée est
// une erreur d'EXÉCUTION, pas de compilation ; Vite ne la voit pas, et rien
// dans le projet ne la voyait non plus — il n'y avait aucune configuration
// ESLint. La règle du dépôt « npm run build doit passer avant tout push »
// était donc un filet à larges mailles.
//
// Le scan posé ici a immédiatement trouvé une SECONDE bombe du même genre,
// pas encore explosée : `setTab` dans HexagroupCotisations, vestige d'un
// onglet supprimé, qui aurait planté la page à la création d'une cotisation.
//
// Volontairement limité à `no-undef`. Un linteur bavard sur un projet de
// 155 fichiers écrits sans lui rendrait des centaines d'avertissements, et un
// contrôle que personne ne lit ne protège de rien. Une règle, zéro faux
// positif toléré, et `npm run lint` passe ou ne passe pas.
//
// Les globaux sont listés à la main plutôt que tirés du paquet `globals` :
// une dépendance de plus pour une liste de noms, et surtout — mesuré le même
// jour — quand l'import échoue, ESLint plante et un `grep` sur sa sortie rend
// « 0 erreur ». Un contrôle qui ne contrôle rien rassure sans protéger.
const NAVIGATEUR = [
  'window', 'document', 'console', 'navigator', 'fetch', 'localStorage',
  'sessionStorage', 'alert', 'confirm', 'prompt', 'location', 'history',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
  'Blob', 'File', 'FileReader', 'FormData', 'URL', 'URLSearchParams',
  'Image', 'Event', 'CustomEvent', 'HTMLElement', 'Node', 'DOMParser',
  'atob', 'btoa', 'crypto', 'performance', 'matchMedia', 'getComputedStyle',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver',
  'AbortController', 'TextEncoder', 'TextDecoder', 'structuredClone',
  'XMLHttpRequest', 'WebSocket', 'Worker', 'Notification', 'screen',
]
const SERVEUR = ['process', 'Buffer', '__dirname', '__filename', 'require', 'global']

const lecture = (noms) => Object.fromEntries(noms.map(n => [n, 'readonly']))

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.js'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    // La règle react-hooks étant déclarée à vide, ses commentaires de
    // désactivation n'ont rien à désactiver. Les signaler ferait du bruit
    // sans rien apprendre.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...lecture(NAVIGATEUR), ...lecture(SERVEUR),
        module: 'writable', exports: 'writable',
      },
    },
    // Le projet porte des commentaires `eslint-disable-next-line
    // react-hooks/exhaustive-deps`, écrits pour documenter une intention. Le
    // plugin react-hooks n'est pas installé, et ESLint signale alors une règle
    // inconnue. On la déclare à vide : les commentaires restent lisibles, et
    // on n'ajoute pas une dépendance pour trois lignes.
    plugins: { 'react-hooks': { rules: { 'exhaustive-deps': { create: () => ({}) } } } },
    rules: { 'no-undef': 'error' },
  },
]
