import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import LegendeFactures from '../../components/LegendeFactures'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'
import { COUL } from '../../lib/theme'

export default function LodeComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={LODE.couleur} colorDark="#7c2d12" logoUrl={LODE.logo_url}
          title="Comptabilité" action={<LegendeFactures />}
        />
        <ComptabiliteView societeCodes={['LODE']} color={COUL.orange} colorDark="#7c2d12" titre="LODE SRL" />
      </div>
    </Layout>
  )
}
