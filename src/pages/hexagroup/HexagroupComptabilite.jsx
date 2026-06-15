import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'

export default function HexagroupComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily:"'Source Sans Pro', sans-serif", maxWidth:'1300px' }}>
        <div style={{ marginBottom:'24px' }}>
          <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#7f1d1d', margin:'0 0 4px' }}>Comptabilité — Hexagroup ASBL</h1>
          <p style={{ fontSize:'14px', color:'#64748b', margin:0 }}>Comptes bancaires synchronisés via Ponto</p>
        </div>
        <ComptabiliteView societeCodes={['HEXAGROUP']} color="#dc2626" colorDark="#7f1d1d" titre="Hexagroup ASBL" />
      </div>
    </Layout>
  )
}
