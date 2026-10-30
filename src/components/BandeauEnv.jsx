import { useEffect } from 'react'
import { IS_TEST, ENV_LABEL, SUPABASE_PROJECT_REF } from '../config/env'

// Bandeau affiché en permanence hors production (VITE_APP_ENV=test) pour qu'aucun
// utilisateur ne confonde l'environnement de test avec le Hub réel.
export default function BandeauEnv() {
  useEffect(() => {
    if (IS_TEST && typeof document !== 'undefined' && !document.title.startsWith('[')) {
      document.title = `[${ENV_LABEL}] ${document.title}`
    }
  }, [])

  if (!IS_TEST) return null
  return (
    <div role="status" style={{
      position: 'sticky', top: 0, zIndex: 10000,
      background: 'repeating-linear-gradient(135deg, #f59e0b 0 14px, #fbbf24 14px 28px)',
      color: '#1f1300', textAlign: 'center', fontSize: 12, fontWeight: 700,
      letterSpacing: 1, padding: '5px 10px', textTransform: 'uppercase',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
    }}>
      Environnement de {ENV_LABEL} — base {SUPABASE_PROJECT_REF || '?'} — aucune donnée réelle
    </div>
  )
}
