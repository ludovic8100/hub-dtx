import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function DtxComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#334155', margin:'0 0 4px' }}>Comptabilité — DTX SRL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>
        <ComptabiliteView societeCodes={['DTX']} color="#94a3b8" colorDark="#334155" titre="DTX SRL" />
      </div>
    </Layout>
  )
}
