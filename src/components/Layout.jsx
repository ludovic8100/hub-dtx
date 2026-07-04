import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import ErrorBoundary from './ErrorBoundary'
import { useAuth } from '../lib/auth'
import { bootstrapConfigs } from '../lib/bootstrapConfigs'

// Préfixe d'URL → code entité
const PATH_TO_SOCIETE = [
  ['/dynassur', 'dynassur'],
  ['/dtx', 'dtx'],
  ['/lode', 'lode'],
  ['/hexagroup', 'hexagroup'],
  ['/prive', 'prive'],
  ['/groupe', 'groupe'],
]

export default function Layout({ children, currentPage }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 900)
  const [menuOuvert, setMenuOuvert] = useState(false)
  const location = useLocation()
  const { activeSociete, setActiveSociete } = useAuth()

  // Charge les coordonnées des sociétés depuis la base (une fois) pour les documents devis/factures
  useEffect(() => { bootstrapConfigs() }, [])

  // Synchronise l'entité active du menu avec l'URL courante
  useEffect(() => {
    const match = PATH_TO_SOCIETE.find(([prefix]) =>
      location.pathname === prefix || location.pathname.startsWith(prefix + '/'))
    if (match && match[1] !== activeSociete) setActiveSociete(match[1])
  }, [location.pathname, activeSociete, setActiveSociete])

  useEffect(() => {
    const onResize = () => {
      const m = window.innerWidth < 900
      setIsMobile(m)
      if (!m) setMenuOuvert(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { setMenuOuvert(false) }, [currentPage])

  const sidebarVisible = !isMobile || menuOuvert

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      fontFamily: "'Source Sans Pro', sans-serif"
    }}>
      <Header currentPage={currentPage} onToggleMenu={isMobile ? () => setMenuOuvert(o => !o) : null} menuOuvert={menuOuvert} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Overlay sombre derrière le menu sur mobile */}
        {isMobile && menuOuvert && (
          <div onClick={() => setMenuOuvert(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40
          }} />
        )}

        {/* Sidebar — modules uniquement, plus de SocieteSelector */}
        {sidebarVisible && (
          <aside style={{
            width: '220px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f172a',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            overflowY: 'auto',
            ...(isMobile ? {
              position: 'fixed',
              top: 0, bottom: 0, left: 0,
              zIndex: 50,
              boxShadow: '4px 0 20px rgba(0,0,0,0.3)'
            } : {})
          }}>
            <Sidebar />
          </aside>
        )}

        <main style={{
          flex: 1,
          width: '100%',
          minWidth: 0,
          overflowY: 'auto',
          background: '#f1f5f9',
          padding: isMobile ? '16px 14px' : '28px 32px'
        }}>
          <ErrorBoundary resetKey={currentPage}>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
