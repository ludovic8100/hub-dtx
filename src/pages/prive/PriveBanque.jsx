import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function PriveBanque() {
  const E = ENTITES.prive
  return (
    <Layout currentPage="Banque">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Banque" subtitle="Privé — comptes et transactions" />
        <ComptabiliteView societeCodes={['PRIVE']} color={E.color} colorDark={E.colorDark} titre="Privé" />
      </div>
    </Layout>
  )
}
