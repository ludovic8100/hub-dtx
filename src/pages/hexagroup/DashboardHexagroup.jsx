import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import BlocComptes from '../../components/BlocComptes'

export default function DashboardHexagroup() {
  const { perms, user } = useAuth()
  const firstName = (perms?.nom || user?.user_metadata?.full_name || '').split(' ')[0]
  return (
    <Layout currentPage="Tableau de bord">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1200px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#7f1d1d', margin:'0 0 4px' }}>Bonjour {firstName} 👋</h1>
        <p style={{ fontSize:'14px', color:'#64748b', margin:'0 0 28px' }}>Hexagroup ASBL — tableau de bord</p>
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'48px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>
          Modules en cours de développement.
        </div>
      </div>
    </Layout>
  )
}
