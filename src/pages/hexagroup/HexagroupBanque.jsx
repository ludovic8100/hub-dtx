import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function HexagroupBanque() {
  const E = ENTITES.hexagroup
  return (
    <Layout currentPage="Banque">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Banque" subtitle="Hexagroup ASBL — comptes et transactions" />
        <ComptabiliteView societeCodes={['HEXAGROUP']} color={E.color} colorDark={E.colorDark} titre="Hexagroup ASBL" />
      </div>
    </Layout>
  )
}
