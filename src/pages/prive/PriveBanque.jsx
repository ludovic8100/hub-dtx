import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function PriveBanque() {
  return (
    <Layout currentPage="Banque">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#134e4a', margin:'0 0 4px' }}>Banque — Privé</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes et transactions</p>
        </div>
        <ComptabiliteView societeCodes={['PRIVE']} color="#0d9488" colorDark="#134e4a" titre="Privé" />
      </div>
    </Layout>
  )
}
