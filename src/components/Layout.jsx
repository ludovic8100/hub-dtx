import Header from './Header'
import Sidebar from './Sidebar'
import SocieteSelector from './SocieteSelector'

export default function Layout({ children, currentPage }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      fontFamily: "'Source Sans Pro', sans-serif"
    }}>
      <Header currentPage={currentPage} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar avec sélecteur société intégré en haut */}
        <aside style={{
          width: '232px',
          minWidth: '232px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          overflowY: 'auto'
        }}>
          <SocieteSelector />
          <Sidebar />
        </aside>
        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: '#f1f5f9',
          padding: '28px 32px'
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
