import Header from './Header'
import Sidebar from './Sidebar'

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
        <Sidebar />
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
