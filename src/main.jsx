import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { injecterFeuille, appliquer, preferenceLue } from './lib/themes'

// L'ambiance est posée AVANT le premier rendu, pas dans un effet React.
// Sinon la page s'affiche en clair puis bascule — un éclair blanc d'une
// demi-seconde à chaque chargement, que l'on ne rattrape plus ensuite.
injecterFeuille()
appliquer(preferenceLue())

// Un déploiement renomme les fichiers de l'application. Un onglet laissé ouvert
// garde l'ancienne page d'accueil, qui réclame des morceaux de code effacés
// depuis : le clic sur une entrée de menu ne fait alors plus rien, sans erreur
// visible — la page est chargée « à la demande » et la demande échoue.
//
// Vite signale ce cas précis. On recharge une fois, pas davantage : si le
// rechargement ne suffit pas, l'ErrorBoundary d'App prend le relais et dit
// quelque chose plutôt que de laisser un écran mort.
const CLE_RECHARGE = 'hub:derniere-recharge-chunk'
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  let precedente = 0
  try { precedente = Number(sessionStorage.getItem(CLE_RECHARGE) || 0) } catch { /* mode privé */ }
  if (Date.now() - precedente < 10000) return
  try { sessionStorage.setItem(CLE_RECHARGE, String(Date.now())) } catch { /* mode privé */ }
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
