import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DynassurChiffres() {
  return <PageEnConstruction titre="Chiffres" icon="ti-report-analytics" color={ENTITES.dynassur.color} colorDark={ENTITES.dynassur.colorDark} logoUrl={ENTITES.dynassur.logo} currentPage="Chiffres" />
}
