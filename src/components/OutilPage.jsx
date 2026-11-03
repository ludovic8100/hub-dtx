import { Link } from 'react-router-dom'
import Layout from './Layout'

// ─── Coquille commune des outils ───────────────────────────────────────────
//
// Tout ce qu'un outil ne devrait pas avoir à réécrire : le retour vers la
// liste, le titre, le sous-titre, le voyant de chargement et le bandeau
// d'erreur. L'auteur d'un outil n'écrit plus que ce qui lui est propre.
//
//   <OutilPage titre="…" sousTitre="…" chargement={x === null} erreur={err}>
//     …
//   </OutilPage>
//
// Props :
//   titre       obligatoire — sert aussi de libellé dans l'en-tête du Hub
//   sousTitre   une ligne sous le titre
//   actions     bouton(s) alignés à droite du titre (Rafraîchir, Exporter…)
//   chargement  true → voyant au lieu du contenu
//   erreur      string | Error | { message } — bandeau rouge au-dessus du contenu
//   largeurMax  largeur du contenu en px (défaut : pleine largeur)
//   pleinePage  l'outil gère lui-même sa mise en page : ni titre ni cadre,
//               seulement le retour vers la liste
//
// Le cas d'erreur non rattrapé (exception React) est déjà couvert par
// l'ErrorBoundary de Layout : ici on traite l'erreur *attendue* — un appel
// Supabase qui échoue, un PDF illisible — que l'outil met dans son état.

const NAVY = '#1A3A6B'

const texteErreur = e => {
  if (!e) return null
  if (typeof e === 'string') return e
  return e.message || e.error_description || e.details || String(e)
}

function RetourOutils() {
  return (
    <Link to="/tools" style={{ fontSize: 12.5, color: '#64748b', textDecoration: 'none' }}>← Outils</Link>
  )
}

export function BandeauErreur({ erreur }) {
  const txt = texteErreur(erreur)
  if (!txt) return null
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 13, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
      <i className="ti ti-alert-circle" style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }} />
      <div>{txt}</div>
    </div>
  )
}

export function Chargement({ texte = 'Chargement…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 13, padding: '28px 0' }}>
      <div style={{ width: 18, height: 18, border: '2px solid rgba(13,47,94,0.15)', borderTopColor: NAVY, borderRadius: '50%', animation: 'spinOutil 0.8s linear infinite' }} />
      {texte}
      <style>{'@keyframes spinOutil { to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}

export default function OutilPage({
  titre, sousTitre, actions, chargement = false, erreur = null,
  largeurMax, pleinePage = false, children,
}) {
  if (pleinePage) {
    return (
      <Layout currentPage={titre}>
        <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%' }}>
          <div style={{ marginBottom: 8 }}><RetourOutils /></div>
          <BandeauErreur erreur={erreur} />
          {chargement ? <Chargement /> : children}
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage={titre}>
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%', ...(largeurMax ? { maxWidth: largeurMax } : null) }}>

        <div style={{ marginBottom: 6 }}><RetourOutils /></div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>{titre}</h1>
            {sousTitre && <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>{sousTitre}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
        </div>

        <BandeauErreur erreur={erreur} />

        {chargement ? <Chargement /> : children}
      </div>
    </Layout>
  )
}
