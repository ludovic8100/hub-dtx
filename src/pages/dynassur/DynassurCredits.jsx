import Layout from '../../components/Layout'
import CreditsView from '../../components/CreditsView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurCredits() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Crédits">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Crédits" subtitle="Dynassur SRL — analyse refinancement PH / PAT" />
        <CreditsView />
      </div>
    </Layout>
  )
}
