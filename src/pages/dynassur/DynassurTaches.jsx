import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DynassurTaches() {
  return <PageEnConstruction titre="Tâches" icon="ti-checkbox" color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo} currentPage="Tâches" />
}
