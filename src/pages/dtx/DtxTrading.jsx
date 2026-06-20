import PageEnConstruction from '../../components/PageEnConstruction'
import { ENTITES } from '../../lib/entites'

export default function DtxTrading() {
  return <PageEnConstruction titre="Trading" icon="ti-trending-up" color={ENTITES.dtx.color} colorDark={ENTITES.dtx.colorDark} logoUrl={ENTITES.dtx.logo} currentPage="Trading" />
}
