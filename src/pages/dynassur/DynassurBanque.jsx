import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DynassurBanque() {
  return <PageEnConstruction titre="Banque" icon="ti-credit-card" color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo} currentPage="Banque" />
}
