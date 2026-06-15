import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function PriveComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#134e4a', margin:'0 0 4px' }}>Comptabilité — Privé</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>
        <ComptabiliteView societeCodes={['PRIVE']} color="#0d9488" colorDark="#134e4a" titre="Privé" />
      </div>
    </Layout>
  )
}
