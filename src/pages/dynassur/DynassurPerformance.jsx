import { useState } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../lib/auth'
import { ProductionContent } from './DynassurProduction'
import { ChiffresContent } from './DynassurChiffres'
import { RentabiliteContent } from './DynassurRentabilite'
import ObjectifsView from '../../components/ObjectifsView'
import ProspectionView from '../../components/ProspectionView'
import { COUL } from '../../lib/theme'

// Fusion du 01/11/2026 : Production, Chiffres et Rentabilité étaient trois entrées
// séparées dans le menu Dynassur ; elles deviennent trois onglets d'une seule page
// pour alléger la colonne de gauche. Chaque onglet garde son contenu et sa logique
// d'origine (ProductionContent / ChiffresContent / RentabiliteContent).
const ONGLETS = [
  ['production', 'Production', 'ti-chart-line', 'dyn_production'],
  ['chiffres', 'Chiffres', 'ti-report-analytics', 'dyn_chiffres'],
  ['rentabilite', 'Rentabilité', 'ti-coin', 'dyn_rentabilite'],
  ['objectifs', 'Objectifs', 'ti-target', 'dyn_objectifs'],
  // Prospection : ouvert aux commerciaux. Le droit dyn_production sert de
  // porte en attendant le chantier des droits — un onglet de plus ne
  // justifie pas une colonne de permission de plus aujourd'hui.
  ['prospection', 'Prospection', 'ti-phone-outgoing', 'dyn_production'],
]

export default function DynassurPerformance() {
  const { perms, isAdmin } = useAuth()
  const visibles = ONGLETS.filter(([, , , k]) => isAdmin || perms?.[k])
  const [onglet, setOnglet] = useState(visibles[0]?.[0] || 'production')
  const actif = visibles.some(([k]) => k === onglet) ? onglet : visibles[0]?.[0]

  return (
    <Layout currentPage="Performance">
      <div style={{ fontFamily: "'Source Sans Pro', sans-serif", width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
          {visibles.map(([k, label, icon]) => (
            <button key={k} onClick={() => setOnglet(k)} style={{
              border: 'none', background: 'none', padding: '10px 14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              color: actif === k ? '#0D2F5E' : COUL.texteFaible, borderBottom: actif === k ? '2px solid #0080BD' : '2px solid transparent', marginBottom: -2,
            }}>
              <i className={`ti ${icon}`} style={{ marginRight: 6 }} />{label}
            </button>
          ))}
        </div>

        {actif === 'production' && <ProductionContent />}
        {actif === 'chiffres' && <ChiffresContent />}
        {actif === 'rentabilite' && <RentabiliteContent />}
        {actif === 'objectifs' && <ObjectifsView />}
        {actif === 'prospection' && <ProspectionView />}
        {!actif && <div style={{ padding: 40, textAlign: 'center', color: COUL.texteFaible }}>Aucun accès à ces écrans.</div>}
      </div>
    </Layout>
  )
}
