import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurComptabilite() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Comptabilité" subtitle="Dynassur SRL — comptes synchronisés via Ponto" />
        <ComptabiliteView societeCodes={['DYNASSUR']} color={E.color} colorDark={E.colorDark} titre="Dynassur SRL" />
      </div>
    </Layout>
  )
}
