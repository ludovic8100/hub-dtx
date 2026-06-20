import Layout from '../../components/Layout'
import BlocComptes from '../../components/BlocComptes'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function LodeBanque() {
  return (
    <Layout currentPage="Banque">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={LODE.couleur} colorDark="#7c2d12" logoUrl={LODE.logo_url}
          title="Banque" subtitle="LODE SRL — comptes bancaires"
        />
        <BlocComptes societeCode="LODE" color={LODE.couleur} />
      </div>
    </Layout>
  )
}
