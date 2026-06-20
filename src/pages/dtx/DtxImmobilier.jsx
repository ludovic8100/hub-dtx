import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DtxImmobilier() {
  return <PageEnConstruction titre="Immobilier" icon="ti-home" color={ENTITES.dtx.color} colorDark={ENTITES.dtx.colorDark} logoUrl={ENTITES.dtx.logo} currentPage="Immobilier" />
}
