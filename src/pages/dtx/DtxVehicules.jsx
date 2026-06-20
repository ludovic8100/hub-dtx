import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DtxVehicules() {
  return <PageEnConstruction titre="Véhicules" icon="ti-car" color={ENTITES.dtx.color} colorDark={ENTITES.dtx.colorDark} logoUrl={ENTITES.dtx.logo} currentPage="Véhicules" />
}
