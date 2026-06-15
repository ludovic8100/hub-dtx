import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function DynassurComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#0D2F5E', margin:'0 0 4px' }}>Comptabilité — Dynassur SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>
        <ComptabiliteView societeCodes={['DYNASSUR']} color="#0080BD" colorDark="#0D2F5E" titre="Dynassur SRL" />
      </div>
    </Layout>
  )
}
