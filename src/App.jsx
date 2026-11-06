import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { OUTILS } from './lib/outils'

// Chargées immédiatement (chemin non-authentifié, très légères)
import Login              from './pages/Login'
import AuthCallback       from './pages/AuthCallback'
import AccessDenied       from './pages/AccessDenied'
import BandeauEnv         from './components/BandeauEnv'
import ErrorBoundary      from './components/ErrorBoundary'
import { COUL } from './lib/theme'

// Tout le reste : code-splitting — chaque page devient un chunk chargé à la demande
const AdminNotesFrais     = lazy(() => import('./pages/admin/AdminNotesFrais'))

const DashboardGroupe     = lazy(() => import('./pages/groupe/DashboardGroupe'))

const DashboardDynassur   = lazy(() => import('./pages/dynassur/DashboardDynassur'))
const Tickets             = lazy(() => import('./pages/Tickets'))
const ToolsHome           = lazy(() => import('./pages/tools/ToolsHome'))
// Les outils eux-mêmes sont déclarés dans src/lib/outils.js (registre OUTILS) :
// leur import différé et leur route en découlent, plus rien à câbler ici.
const DynassurClients     = lazy(() => import('./pages/dynassur/DynassurClients'))
const DynassurPerformance = lazy(() => import('./pages/dynassur/DynassurPerformance'))
const DynassurCompagnies  = lazy(() => import('./pages/dynassur/DynassurCompagnies'))
const DynassurSinistres   = lazy(() => import('./pages/dynassur/DynassurSinistres'))
const DynassurBanque      = lazy(() => import('./pages/dynassur/DynassurBanque'))
const DynassurComptabilite= lazy(() => import('./pages/dynassur/DynassurComptabilite'))
const DynassurCredits     = lazy(() => import('./pages/dynassur/DynassurCredits'))
const DynassurAppels      = lazy(() => import('./pages/dynassur/DynassurAppels'))

const DashboardDtx        = lazy(() => import('./pages/dtx/DashboardDtx'))
const DtxImmobilier       = lazy(() => import('./pages/dtx/DtxImmobilier'))
const DtxVehicules        = lazy(() => import('./pages/dtx/DtxVehicules'))
const DtxTrading          = lazy(() => import('./pages/dtx/DtxTrading'))
const DtxComptabilite     = lazy(() => import('./pages/dtx/DtxComptabilite'))

const DashboardLode       = lazy(() => import('./pages/lode/DashboardLode'))
const LodeClients         = lazy(() => import('./pages/lode/LodeClients'))
const LodeBanque          = lazy(() => import('./pages/lode/LodeBanque'))
const LodeComptabilite    = lazy(() => import('./pages/lode/LodeComptabilite'))
const LodeRentabilite     = lazy(() => import('./pages/lode/LodeRentabilite'))
const LodeDevisFactures   = lazy(() => import('./pages/lode/LodeDevisFactures'))
const DtxDevisFactures    = lazy(() => import('./pages/dtx/DtxDevisFactures'))
const ConfigModule        = lazy(() => import('./pages/config/ConfigModule'))
const LodeDevisAccept     = lazy(() => import('./pages/lode/LodeDevisAccept'))

const DashboardHexagroup  = lazy(() => import('./pages/hexagroup/DashboardHexagroup'))
const HexagroupBanque     = lazy(() => import('./pages/hexagroup/HexagroupBanque'))
const HexagroupComptabilite = lazy(() => import('./pages/hexagroup/HexagroupComptabilite'))
const HexagroupCotisations = lazy(() => import('./pages/hexagroup/HexagroupCotisations'))
const HexagroupMembres = lazy(() => import('./pages/hexagroup/HexagroupMembres'))

const DashboardPrive      = lazy(() => import('./pages/prive/DashboardPrive'))
const PriveBanque         = lazy(() => import('./pages/prive/PriveBanque'))
const PriveComptabilite   = lazy(() => import('./pages/prive/PriveComptabilite'))
const DynassurNotesFrais  = lazy(() => import('./pages/dynassur/DynassurNotesFrais'))
const DtxNotesFrais       = lazy(() => import('./pages/dtx/DtxNotesFrais'))
const LodeNotesFrais      = lazy(() => import('./pages/lode/LodeNotesFrais'))
const HexagroupNotesFrais = lazy(() => import('./pages/hexagroup/HexagroupNotesFrais'))
const PriveNotesFrais     = lazy(() => import('./pages/prive/PriveNotesFrais'))
const GroupeNotesFrais    = lazy(() => import('./pages/groupe/GroupeNotesFrais'))
const GroupeComptabilite  = lazy(() => import('./pages/groupe/GroupeComptabilite'))

function ProtectedRoute({ children, requireAdmin = false, need = null }) {
  const { user, perms, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:COUL.marine }}>
      <div style={{ width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:COUL.blanc, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!perms) return <Navigate to="/access-denied" replace />
  if (requireAdmin && !perms.est_admin) return <Navigate to="/" replace />
  if (need && !perms.est_admin) {
    const ACC = { dyn:'acc_dynassur', dtx:'acc_dtx', lode:'acc_lode', hex:'acc_hexagroup', prive:'acc_prive', grp:'acc_holding' }
    const needs = Array.isArray(need) ? need : [need]
    const ok = needs.some(n => {
      const accCol = n.startsWith('acc_') ? n : ACC[n.split('_')[0]]
      return (!accCol || perms[accCol]) && perms[n]
    })
    if (!ok) return <Navigate to="/access-denied" replace />
  }
  return children
}

function RootRedirect() {
  const { activeSociete, loading } = useAuth()
  if (loading) return null
  const routes = { groupe:'/groupe', dynassur:'/dynassur', dtx:'/dtx', lode:'/lode', hexagroup:'/hexagroup', prive:'/prive' }
  return <Navigate to={routes[activeSociete] || '/dynassur'} replace />
}

// Fallback affiché pendant le chargement d'un chunk de page
function PageLoader() {
  return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'34px', height:'34px', border:'3px solid rgba(13,47,94,0.15)', borderTopColor:COUL.marine, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const P = ({ children, need }) => <ProtectedRoute need={need}>{children}</ProtectedRoute>
const A = ({ children }) => <ProtectedRoute requireAdmin>{children}</ProtectedRoute>


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BandeauEnv />
        {/* Au-dessus du Suspense : l'ErrorBoundary de Layout est rendu PAR la page,
            donc il ne voit jamais l'échec de chargement de cette page. */}
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"         element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          {/* Page publique d'acceptation d'un devis (sans login, sécurisée par token) */}
          <Route path="/devis/:token"  element={<LodeDevisAccept />} />

          {/* Groupe */}
          <Route path="/groupe" element={<P need="acc_holding"><DashboardGroupe /></P>} />

          {/* Dynassur */}
          <Route path="/dynassur"             element={<P need="dyn_dashboard"><DashboardDynassur /></P>} />
          <Route path="/dynassur/notes-frais"  element={<P need="dyn_notesfrais"><DynassurNotesFrais /></P>} />
          <Route path="/dtx/notes-frais"       element={<P need="dtx_notesfrais"><DtxNotesFrais /></P>} />
          <Route path="/lode/notes-frais"      element={<P need="lode_notesfrais"><LodeNotesFrais /></P>} />
          <Route path="/hexagroup/notes-frais" element={<P need="hex_notesfrais"><HexagroupNotesFrais /></P>} />
          <Route path="/prive/notes-frais"     element={<P need="prive_notesfrais"><PriveNotesFrais /></P>} />
          <Route path="/groupe/notes-frais"    element={<P need="grp_notesfrais"><GroupeNotesFrais /></P>} />
          <Route path="/groupe/comptabilite"   element={<P need="acc_holding"><GroupeComptabilite /></P>} />
          <Route path="/dynassur/clients"      element={<P need="dyn_clients"><DynassurClients /></P>} />
          <Route path="/dynassur/production"   element={<P need={["dyn_production","dyn_chiffres","dyn_rentabilite","dyn_objectifs"]}><DynassurPerformance /></P>} />
          <Route path="/dynassur/chiffres"     element={<Navigate to="/dynassur/production" replace />} />
          <Route path="/dynassur/rentabilite"  element={<Navigate to="/dynassur/production" replace />} />
          <Route path="/dynassur/bordereaux"   element={<Navigate to="/dynassur/compagnies" replace />} />
          <Route path="/dynassur/credits"      element={<P need="dyn_credits"><DynassurCredits /></P>} />
          <Route path="/dynassur/objectifs"    element={<Navigate to="/dynassur/production" replace />} />
          <Route path="/dynassur/compagnies"   element={<P need="dyn_compagnies"><DynassurCompagnies /></P>} />
          <Route path="/dynassur/sinistres"    element={<P need="dyn_sinistres"><DynassurSinistres /></P>} />
          <Route path="/dynassur/appels"       element={<P need="dyn_appels"><DynassurAppels /></P>} />
          <Route path="/dynassur/banque"       element={<A><DynassurBanque /></A>} />
          <Route path="/dynassur/comptabilite" element={<P need="dyn_comptabilite"><DynassurComptabilite /></P>} />

          {/* DTX */}
          <Route path="/dtx"              element={<P need="dtx_dashboard"><DashboardDtx /></P>} />
          <Route path="/dtx/immobilier"   element={<P need="dtx_immobilier"><DtxImmobilier /></P>} />
          <Route path="/dtx/vehicules"    element={<P need="dtx_vehicules"><DtxVehicules /></P>} />
          <Route path="/dtx/trading"      element={<P need="dtx_trading"><DtxTrading /></P>} />
          <Route path="/dtx/comptabilite" element={<P need="dtx_comptabilite"><DtxComptabilite /></P>} />

          {/* LODE */}
          <Route path="/lode"               element={<P need="lode_dashboard"><DashboardLode /></P>} />
          <Route path="/lode/clients"       element={<P need="lode_clients"><LodeClients /></P>} />
          <Route path="/lode/devis-factures" element={<P need="lode_devis"><LodeDevisFactures /></P>} />
          <Route path="/dtx/devis-factures"  element={<P need="dtx_devis"><DtxDevisFactures /></P>} />
          <Route path="/config" element={<A><ConfigModule /></A>} />
          <Route path="/lode/banque"        element={<A><LodeBanque /></A>} />
          <Route path="/lode/comptabilite"  element={<P need="lode_comptabilite"><LodeComptabilite /></P>} />
          <Route path="/lode/rentabilite"   element={<P need="lode_rentabilite"><LodeRentabilite /></P>} />

          {/* Hexagroup */}
          <Route path="/hexagroup"               element={<P need="hex_dashboard"><DashboardHexagroup /></P>} />
          <Route path="/hexagroup/banque"        element={<A><HexagroupBanque /></A>} />
          <Route path="/hexagroup/comptabilite"  element={<P need="hex_comptabilite"><HexagroupComptabilite /></P>} />
          <Route path="/hexagroup/membres"       element={<P need="hex_membres"><HexagroupMembres /></P>} />
          <Route path="/hexagroup/cotisations"   element={<P need="hex_cotisations"><HexagroupCotisations /></P>} />

          {/* Privé */}
          <Route path="/prive"               element={<P need="prive_dashboard"><DashboardPrive /></P>} />
          <Route path="/prive/banque"        element={<A><PriveBanque /></A>} />
          <Route path="/prive/comptabilite"  element={<P need="prive_comptabilite"><PriveComptabilite /></P>} />

          {/* Admin */}
          <Route path="/tickets" element={<P><Tickets /></P>} />
          <Route path="/tools"     element={<P need="acc_tools"><ToolsHome /></P>} />
          {OUTILS.filter(o => o.composant).map(o => {
            const Outil = o.composant
            return <Route key={o.cle} path={o.chemin} element={<P need={o.permission}><Outil /></P>} />
          })}
          <Route path="/admin/notes-frais" element={<A><AdminNotesFrais /></A>} />

          <Route path="/" element={<P><RootRedirect /></P>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
