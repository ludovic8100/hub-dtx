import Layout from '../../components/Layout'
import BordereauxView from '../../components/BordereauxView'

export default function DynassurBordereaux() {
  return (
    <Layout currentPage="Bordereaux">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#0D2F5E', margin:'0 0 4px' }}>Bordereaux — Dynassur SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>BQT (primes appelées) et RCP (commissions encaissées)</p>
        </div>
        <BordereauxView color="#0080BD" colorDark="#0D2F5E" titre="Dynassur SRL" />
      </div>
    </Layout>
  )
}
