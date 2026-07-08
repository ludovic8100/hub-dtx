import Layout from '../../components/Layout'
import ComptabiliteView from '../../components/ComptabiliteView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { SyncButtonsRow } from '../../components/SyncCards'

export default function HexagroupComptabilite() {
  const E = ENTITES.hexagroup
  return (
    <Layout currentPage="Comptabilité">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Comptabilité" action={<SyncButtonsRow only={['iban','rapprochement']} onDark compact />} />
        <ComptabiliteView societeCodes={['HEXAGROUP']} color={E.color} colorDark={E.colorDark} titre="Hexagroup ASBL" />
      </div>
    </Layout>
  )
}
