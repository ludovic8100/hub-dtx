import Layout from '../components/Layout'
import TicketsView from '../components/TicketsView'

export default function Tickets() {
  return (
    <Layout currentPage="Tickets">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>🎫 Tickets</h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>Support interne — demandes, bugs, suivi jusqu'à la clôture</div>
        </div>
        <TicketsView />
      </div>
    </Layout>
  )
}
