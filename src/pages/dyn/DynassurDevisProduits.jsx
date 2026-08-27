import Layout from '../../components/Layout'
import DevisProduitsView from '../../components/DevisProduitsView'

export default function DynassurDevisProduits() {
  return (
    <Layout currentPage="Devis">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#ea580c', margin: 0 }}>Devis</h1>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>Import PDF fournisseur → devis client avec photos</div>
        </div>
        <DevisProduitsView entiteKey="dynassur" />
      </div>
    </Layout>
  )
}
