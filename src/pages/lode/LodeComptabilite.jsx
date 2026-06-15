import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function LodeComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#7c2d12', margin:'0 0 4px' }}>Comptabilité — LODE SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>
        <ComptabiliteView societeCodes={['LODE']} color="#ea580c" colorDark="#7c2d12" titre="LODE SRL" />
      </div>
    </Layout>
  )
}
