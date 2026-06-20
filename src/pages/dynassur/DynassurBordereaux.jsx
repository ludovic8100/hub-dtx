import Layout from '../../components/Layout'
import BordereauxView from '../../components/BordereauxView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurBordereaux() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Bordereaux">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Bordereaux" subtitle="Dynassur SRL — quittances & commissions" />
        <BordereauxView />
      </div>
    </Layout>
  )
}
