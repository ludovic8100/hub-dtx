import { useState } from 'react'
import Layout from '../../components/Layout'
import CompagniesView from '../../components/CompagniesView'
import ProducteursView from '../../components/ProducteursView'
import BordereauxView from '../../components/BordereauxView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { useAuth } from '../../lib/auth'

const BORD_VIEWS = ['matrice', 'reconciliation', 'quittances', 'alertes']

export default function DynassurCompagnies() {
  const E = ENTITES.dynassur
  const { perms } = useAuth()
  const isAdmin = perms?.role === 'admin'
  const canComp = isAdmin || !!perms?.dyn_compagnies
  const canBord = isAdmin || !!perms?.dyn_bordereaux

  const tabs = [
    ...(canComp ? [['compagnies', 'Compagnies'], ['producteurs', 'Producteurs']] : []),
    ...(canBord ? [['matrice', 'Matrice BQT/RCP'], ['reconciliation', 'Réconciliation'], ['quittances', 'Quittances'], ['alertes', 'Alertes']] : []),
  ]
  const [tab, setTab] = useState(tabs[0] ? tabs[0][0] : 'compagnies')

  return (
    <Layout currentPage="Compagnies & Bordereaux">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Compagnies & Bordereaux" subtitle="Dynassur SRL" />

        <div style={{ display: 'flex', gap: 8, margin: '0 0 16px', flexWrap: 'wrap' }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (tab === k ? E.color : '#e2e8f0'), background: tab === k ? E.color : '#fff', color: tab === k ? '#fff' : '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        {canComp && tab === 'compagnies' && <CompagniesView />}
        {canComp && tab === 'producteurs' && <ProducteursView />}
        {canBord && BORD_VIEWS.includes(tab) && <BordereauxView embedded view={tab} />}
      </div>
    </Layout>
  )
}
