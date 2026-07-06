import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import { LODE } from '../../lib/lodeConfig'
import { StatBanner } from '../../components/ui/AccountableUI'
import { SyncButtonsRow } from '../../components/SyncCards'

export default function LodeComptabilite() {
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner
          color={LODE.couleur} colorDark="#7c2d12" logoUrl={LODE.logo_url}
          title="Comptabilité" subtitle="LODE SRL — comptes synchronisés via Ponto"
          footer={<SyncButtonsRow only={['rapprochement','iban','bordereaux']} onDark compact />}
        />
        <ComptabiliteView societeCodes={['LODE']} color="#ea580c" colorDark="#7c2d12" titre="LODE SRL" />
      </div>
    </Layout>
  )
}
