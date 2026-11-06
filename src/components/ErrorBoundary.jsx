import { Component } from 'react'
import { COUL } from '../lib/theme'

// Un déploiement renomme les fichiers de l'application. Un onglet resté ouvert
// réclame alors des fichiers qui n'existent plus, et l'import de la page
// échoue. Ce n'est pas une panne : c'est une version périmée. L'utilisateur n'a
// rien à lire et rien à décider — on recharge.
//
// Le message varie selon le navigateur, d'où la liste.
const SIGNES_CHUNK = [
  'dynamically imported module',
  'Failed to fetch dynamically imported',
  'error loading dynamically imported',
  'Importing a module script failed',
  'Unable to preload CSS',
  'ChunkLoadError',
]

const estChunkPerime = (err) => {
  const texte = `${err?.name || ''} ${err?.message || ''}`
  return SIGNES_CHUNK.some(signe => texte.toLowerCase().includes(signe.toLowerCase()))
}

// Au plus un rechargement toutes les dix secondes : si le serveur sert
// durablement une page périmée, on s'arrête et on affiche quelque chose plutôt
// que de boucler sans fin sous les yeux de l'utilisateur.
const CLE_RECHARGE = 'hub:derniere-recharge-chunk'

function rechargerUneFois() {
  let precedente = 0
  try { precedente = Number(sessionStorage.getItem(CLE_RECHARGE) || 0) } catch { /* mode privé */ }
  if (Date.now() - precedente < 10000) return false
  try { sessionStorage.setItem(CLE_RECHARGE, String(Date.now())) } catch { /* mode privé */ }
  window.location.reload()
  return true
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null, perime: false }
  }
  static getDerivedStateFromError(error) {
    return { error, perime: estChunkPerime(error) }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    if (estChunkPerime(error)) {
      console.warn('Version périmée détectée, rechargement :', error?.message)
      if (rechargerUneFois()) return
    }
    console.error('Page crash capturé par ErrorBoundary :', error, info)
  }
  componentDidUpdate(prevProps) {
    // Réinitialise l'erreur quand on change de page
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null, perime: false })
    }
  }
  render() {
    // Version périmée : on recharge, inutile d'alarmer. Si le rechargement a
    // déjà été tenté il y a moins de dix secondes, on le dit en une phrase et
    // on laisse le bouton, plutôt qu'une pile d'appels illisible.
    if (this.state.error && this.state.perime) {
      return (
        <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: 560, padding: 24, color: COUL.texteSombre }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>L'application vient d'être mise à jour</div>
          <div style={{ fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
            Cet onglet utilisait la version précédente. Rechargement en cours…
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E5799', color: COUL.blanc, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            Recharger maintenant
          </button>
        </div>
      )
    }

    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      const stack = this.state.info?.componentStack || this.state.error?.stack || ''
      return (
        <div style={{ fontFamily: "'Source Sans Pro', sans-serif", maxWidth: 900 }}>
          <div style={{ background: '#FDECEA', border: '1px solid #F5C6CB', borderRadius: 10, padding: 20, color: '#721C24' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>⚠️ Une erreur est survenue dans cette page</div>
            <div style={{ fontSize: 14, marginBottom: 12 }}>
              Le reste de l'application reste utilisable — le menu n'est pas affecté. Détail de l'erreur :
            </div>
            <pre style={{ background: COUL.blanc, border: '1px solid #F5C6CB', borderRadius: 6, padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: COUL.dangerFonce, maxHeight: 280, overflow: 'auto' }}>{msg}{stack ? '\n\n' + stack : ''}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E5799', color: COUL.blanc, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
