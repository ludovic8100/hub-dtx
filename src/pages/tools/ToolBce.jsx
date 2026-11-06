import { useState } from 'react'
import OutilPage from '../../components/OutilPage'
import BceSearch from '../../components/BceSearch'
import { COUL } from '../../lib/theme'

// Outil autonome : recherche entreprise BCE/KBO. Réutilise le composant BceSearch.
export default function ToolBce() {
  const [c, setC] = useState(null)

  const a = c?.address || {}
  const rue = [a.street, a.street_fr, a.street_nl].find(Boolean) || ''
  const num = a.house_number || a.number || ''
  const ligneRue = [rue, num].filter(Boolean).join(' ')
  const lieu = [a.post_code, a.city].filter(Boolean).join(' ')
  const nom = c && (c.denomination_with_legal_form || c.denomination || '(sans dénomination)')
  const bce = c && (c.cbe_number_formatted || c.cbe_number || '')
  const forme = c && (c.legal_form || c.juridical_form || c.legal_form_fr || '')
  const statut = c && (c.status || c.juridical_situation || '')

  const Row = ({ label, value }) => value ? (
    <div style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
      <div style={{ width: 150, flexShrink: 0, color: COUL.texteFaible, fontWeight: 600 }}>{label}</div>
      <div style={{ color: COUL.texte }}>{value}</div>
    </div>
  ) : null

  return (
    <OutilPage titre="Recherche BCE" sousTitre="Entreprise belge — par dénomination ou n° BCE (10 chiffres)" largeurMax={680}>
        <BceSearch onSelect={setC} />

        {c && (
          <div style={{ marginTop: 14, border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', background: COUL.blanc }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COUL.texte, marginBottom: 10 }}>{nom}</div>
            <Row label="N° BCE" value={bce} />
            <Row label="Forme juridique" value={forme} />
            <Row label="Statut" value={statut} />
            <Row label="Adresse" value={ligneRue} />
            <Row label="Localité" value={lieu} />
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 12, color: COUL.texteDoux, cursor: 'pointer' }}>Voir toutes les données brutes</summary>
              <pre style={{ marginTop: 8, fontSize: 11, background: COUL.fond, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, overflowX: 'auto', color: COUL.texteSombre }}>{JSON.stringify(c, null, 2)}</pre>
            </details>
          </div>
        )}
    </OutilPage>
  )
}
