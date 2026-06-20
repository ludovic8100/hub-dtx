import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DynassurSinistres() {
  return <PageEnConstruction titre="Sinistres" icon="ti-alert-triangle" color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo} currentPage="Sinistres" />
}
