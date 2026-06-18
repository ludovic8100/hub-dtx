import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('Page crash capturé par ErrorBoundary :', error, info)
  }
  componentDidUpdate(prevProps) {
    // Réinitialise l'erreur quand on change de page
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, info: null })
    }
  }
  render() {
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
            <pre style={{ background: '#fff', border: '1px solid #F5C6CB', borderRadius: 6, padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#b91c1c', maxHeight: 280, overflow: 'auto' }}>{msg}{stack ? '\n\n' + stack : ''}</pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 12, padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E5799', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
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
