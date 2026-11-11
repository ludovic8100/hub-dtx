import Layout from '../../components/Layout'
import EncaissementProducteurView from '../../components/EncaissementProducteurView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'

export default function DynassurEncaissements() {
  const E = ENTITES.dynassur
  return (
    <Layout currentPage="Encaissements">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo}
          title="Encaissements producteur"
          subtitle="Clients qui paient leur prime au courtier — compte courant, pas chiffre d'affaires" />
        <EncaissementProducteurView societeCodes={['DYNASSUR']} color={E.color} />
      </div>
    </Layout>
  )
}
