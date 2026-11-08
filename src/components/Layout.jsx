import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import ErrorBoundary from './ErrorBoundary'
import { useAuth } from '../lib/auth'
import { bootstrapConfigs } from '../lib/bootstrapConfigs'
import { supabase } from '../lib/supabase'
import { reglesEcrites, appliquer } from '../lib/themes'
import { COUL } from '../lib/theme'

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

  // L'ambiance est un réglage de GROUPE, posé par un administrateur dans
  // Paramètres. On le relit à chaque entrée dans le Hub et on le met en cache.
  //
  // POURQUOI UN CACHE ET PAS UNE SIMPLE REQUÊTE : la feuille de style est
  // posée AVANT le premier rendu (main.jsx), donc avant toute requête. Sans
  // cache, chaque chargement montrerait Standard une demi-seconde puis
  // basculerait. Le cache sert le prochain chargement ; celui-ci se corrige
  // ici, une fois, sans que personne le voie.
  useEffect(() => {
    let annule = false
    ;(async () => {
      const { data, error } = await supabase
        .from('ref_ambiances')
        .select('code,actif,forcee,debut_mois,debut_jour,fin_mois,fin_jour')
        .order('ordre')
      // Table absente ou illisible : on garde le cache précédent plutôt que
      // de repeindre le Hub en Standard sur une erreur réseau.
      if (annule || error || !data) return
      reglesEcrites(data)
      appliquer(data)
    })()
    return () => { annule = true }
  }, [])

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
          <aside className="hub-saison-volet" style={{
            width: '220px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            background: COUL.texteFort,
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

        <main className="hub-saison-zone" style={{
          flex: 1,
          width: '100%',
          minWidth: 0,
          overflowY: 'auto',
          background: COUL.fondDoux,
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
