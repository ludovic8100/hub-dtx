import { useState } from 'react'
import Layout from '../../components/Layout'
import CompagniesView from '../../components/CompagniesView'
import ProducteursView from '../../components/ProducteursView'
import { ENTITES } from '../../lib/entites'
import { StatBanner } from '../../components/ui/AccountableUI'
import { useAuth } from '../../lib/auth'

// Page recentrée le 01/11/2026 sur les compagnies seules : Réconciliation et
// Quittances reposaient sur les quittances Qlik, vidées. La production financière
// est reconstruite à partir des bordereaux (voir sql/releves_producteur.sql).
// Cette page est une référence consultable, notamment par les sous-agents, qui y
// trouvent un numéro de producteur et les coordonnées d'une compagnie.
export default function DynassurCompagnies() {
  const E = ENTITES.dynassur
  const { perms } = useAuth()
  const isAdmin = perms?.role === 'admin'
  const canComp = isAdmin || !!perms?.dyn_compagnies

  const [tab, setTab] = useState('compagnies')

  if (!canComp) return (
    <Layout currentPage="Compagnies">
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Accès non autorisé.</div>
    </Layout>
  )

  return (
    <Layout currentPage="Compagnies">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <StatBanner color={E.color} colorDark={E.colorDark} logoUrl={E.logo} title="Compagnies" subtitle="Dynassur SRL — coordonnées et numéros de producteur" />

        <div style={{ display: 'flex', gap: 8, margin: '0 0 16px', flexWrap: 'wrap' }}>
          {[['compagnies', 'Compagnies'], ['producteurs', 'Producteurs']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid ' + (tab === k ? E.color : '#e2e8f0'), background: tab === k ? E.color : '#fff', color: tab === k ? '#fff' : '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'compagnies' && <CompagniesView />}
        {tab === 'producteurs' && <ProducteursView />}
      </div>
    </Layout>
  )
}
