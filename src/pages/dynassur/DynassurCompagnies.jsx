import Layout from '../../components/Layout'
import CompagniesView from '../../components/CompagniesView'

export default function DynassurCompagnies() {
  return (
    <Layout currentPage="Compagnies">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1100px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#0D2F5E', margin:'0 0 4px' }}>Compagnies & Producteurs — Dynassur SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Numéros de producteurs par compagnie — en rouge : non ouvert</p>
        </div>
        <CompagniesView color="#0080BD" colorDark="#0D2F5E" />
      </div>
    </Layout>
  )
}
