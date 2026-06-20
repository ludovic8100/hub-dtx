import Layout from '../../components/Layout'
import ObjectifsView from '../../components/ObjectifsView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurObjectifs() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Objectifs">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Objectifs commerciaux" subtitle="Dynassur SRL — objectifs par agent" />
        <ObjectifsView />
      </div>
    </Layout>
  )
}
