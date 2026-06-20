import Layout from '../../components/Layout'
import CompagniesView from '../../components/CompagniesView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurCompagnies() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Compagnies">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Compagnies & Producteurs" subtitle="Dynassur SRL — chiffres par compagnie" />
        <CompagniesView />
      </div>
    </Layout>
  )
}
