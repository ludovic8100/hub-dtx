import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'

import Login              from './pages/Login'
import AuthCallback       from './pages/AuthCallback'
import AccessDenied       from './pages/AccessDenied'
import AdminUsers         from './pages/AdminUsers'
import SyncCenter         from './pages/admin/SyncCenter'
import RdvCategories      from './pages/admin/RdvCategories'
import LiensCasses       from './pages/admin/LiensCasses'
import AdminNotesFrais    from './pages/admin/AdminNotesFrais'

import DashboardGroupe    from './pages/groupe/DashboardGroupe'

import DashboardDynassur   from './pages/dynassur/DashboardDynassur'
import DynassurTaches      from './pages/dynassur/DynassurTaches'
import DtxTaches           from './pages/dtx/DtxTaches'
import LodeTaches          from './pages/lode/LodeTaches'
import HexagroupTaches     from './pages/hexagroup/HexagroupTaches'
import PriveTaches         from './pages/prive/PriveTaches'
import GroupeTaches        from './pages/groupe/GroupeTaches'
import DynassurClients     from './pages/dynassur/DynassurClients'
import DynassurProduction  from './pages/dynassur/DynassurProduction'
import DynassurBordereaux  from './pages/dynassur/DynassurBordereaux'
import DynassurChiffres    from './pages/dynassur/DynassurChiffres'
import DynassurObjectifs   from './pages/dynassur/DynassurObjectifs'
import DynassurCompagnies  from './pages/dynassur/DynassurCompagnies'
import DynassurSinistres   from './pages/dynassur/DynassurSinistres'
import DynassurBanque      from './pages/dynassur/DynassurBanque'
import DynassurComptabilite from './pages/dynassur/DynassurComptabilite'
import DynassurRentabilite from './pages/dynassur/DynassurRentabilite'
import DynassurRdv         from './pages/dynassur/DynassurRdv'
import DynassurAppels      from './pages/dynassur/DynassurAppels'

import DashboardDtx       from './pages/dtx/DashboardDtx'
import DtxImmobilier      from './pages/dtx/DtxImmobilier'
import DtxVehicules       from './pages/dtx/DtxVehicules'
import DtxTrading         from './pages/dtx/DtxTrading'
import DtxComptabilite    from './pages/dtx/DtxComptabilite'

import DashboardLode      from './pages/lode/DashboardLode'
import LodeClients        from './pages/lode/LodeClients'
import LodeBanque         from './pages/lode/LodeBanque'
import LodeComptabilite   from './pages/lode/LodeComptabilite'
import LodeDevisFactures  from './pages/lode/LodeDevisFactures'
import DtxDevisFactures   from './pages/dtx/DtxDevisFactures'
import DynDevisFactures   from './pages/dyn/DynDevisFactures'
import ConfigModule       from './pages/config/ConfigModule'
import LodeDevisAccept    from './pages/lode/LodeDevisAccept'

import DashboardHexagroup  from './pages/hexagroup/DashboardHexagroup'
import HexagroupBanque     from './pages/hexagroup/HexagroupBanque'
import HexagroupComptabilite from './pages/hexagroup/HexagroupComptabilite'

import DashboardPrive     from './pages/prive/DashboardPrive'
import PriveBanque        from './pages/prive/PriveBanque'
import PriveComptabilite  from './pages/prive/PriveComptabilite'
import DynassurNotesFrais  from './pages/dynassur/DynassurNotesFrais'
import DtxNotesFrais        from './pages/dtx/DtxNotesFrais'
import LodeNotesFrais       from './pages/lode/LodeNotesFrais'
import HexagroupNotesFrais  from './pages/hexagroup/HexagroupNotesFrais'
import PriveNotesFrais      from './pages/prive/PriveNotesFrais'
import GroupeNotesFrais     from './pages/groupe/GroupeNotesFrais'

function ProtectedRoute({ children, requireAdmin = false, need = null }) {
  const { user, perms, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0D2F5E' }}>
      <div style={{ width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (!perms) return <Navigate to="/access-denied" replace />
  if (requireAdmin && perms.role !== 'admin') return <Navigate to="/" replace />
  if (need && perms.role !== 'admin' && !perms[need]) return <Navigate to="/access-denied" replace />
  return children
}

function RootRedirect() {
  const { activeSociete, loading } = useAuth()
  if (loading) return null
  const routes = { groupe:'/groupe', dynassur:'/dynassur', dtx:'/dtx', lode:'/lode', hexagroup:'/hexagroup', prive:'/prive' }
  return <Navigate to={routes[activeSociete] || '/dynassur'} replace />
}

const P = ({ children, need }) => <ProtectedRoute need={need}>{children}</ProtectedRoute>
const A = ({ children }) => <ProtectedRoute requireAdmin>{children}</ProtectedRoute>


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
          <Route path="/dynassur/taches"       element={<P need="dyn_taches"><DynassurTaches /></P>} />
          <Route path="/dtx/taches"           element={<P need="dtx_taches"><DtxTaches /></P>} />
          <Route path="/lode/taches"          element={<P need="lode_taches"><LodeTaches /></P>} />
          <Route path="/hexagroup/taches"     element={<P need="hex_taches"><HexagroupTaches /></P>} />
          <Route path="/prive/taches"         element={<P need="prive_taches"><PriveTaches /></P>} />
          <Route path="/groupe/taches"        element={<P need="grp_taches"><GroupeTaches /></P>} />
          <Route path="/dynassur/notes-frais"  element={<P need="dyn_notesfrais"><DynassurNotesFrais /></P>} />
          <Route path="/dtx/notes-frais"       element={<P need="dtx_notesfrais"><DtxNotesFrais /></P>} />
          <Route path="/lode/notes-frais"      element={<P need="lode_notesfrais"><LodeNotesFrais /></P>} />
          <Route path="/hexagroup/notes-frais" element={<P need="hex_notesfrais"><HexagroupNotesFrais /></P>} />
          <Route path="/prive/notes-frais"     element={<P need="prive_notesfrais"><PriveNotesFrais /></P>} />
          <Route path="/groupe/notes-frais"    element={<P need="grp_notesfrais"><GroupeNotesFrais /></P>} />
          <Route path="/dynassur/clients"      element={<P need="dyn_clients"><DynassurClients /></P>} />
          <Route path="/dynassur/production"   element={<P need="dyn_production"><DynassurProduction /></P>} />
          <Route path="/dynassur/bordereaux"   element={<P need="dyn_bordereaux"><DynassurBordereaux /></P>} />
          <Route path="/dynassur/chiffres"     element={<P need="dyn_chiffres"><DynassurChiffres /></P>} />
          <Route path="/dynassur/objectifs"    element={<P need="dyn_objectifs"><DynassurObjectifs /></P>} />
          <Route path="/dynassur/compagnies"   element={<P need="dyn_compagnies"><DynassurCompagnies /></P>} />
          <Route path="/dynassur/sinistres"    element={<P need="dyn_sinistres"><DynassurSinistres /></P>} />
          <Route path="/dynassur/rdv"          element={<P need="dyn_rdv"><DynassurRdv /></P>} />
          <Route path="/dynassur/appels"       element={<P need="dyn_appels"><DynassurAppels /></P>} />
          <Route path="/dynassur/banque"       element={<A><DynassurBanque /></A>} />
          <Route path="/dynassur/comptabilite" element={<P need="dyn_comptabilite"><DynassurComptabilite /></P>} />
          <Route path="/dynassur/rentabilite" element={<P need="dyn_rentabilite"><DynassurRentabilite /></P>} />

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
          <Route path="/dynassur/devis-factures" element={<P need="dyn_devis"><DynDevisFactures /></P>} />
          <Route path="/config" element={<A><ConfigModule /></A>} />
          <Route path="/lode/banque"        element={<A><LodeBanque /></A>} />
          <Route path="/lode/comptabilite"  element={<P need="lode_comptabilite"><LodeComptabilite /></P>} />

          {/* Hexagroup */}
          <Route path="/hexagroup"               element={<P need="hex_dashboard"><DashboardHexagroup /></P>} />
          <Route path="/hexagroup/banque"        element={<A><HexagroupBanque /></A>} />
          <Route path="/hexagroup/comptabilite"  element={<P need="hex_comptabilite"><HexagroupComptabilite /></P>} />

          {/* Privé */}
          <Route path="/prive"               element={<P need="prive_dashboard"><DashboardPrive /></P>} />
          <Route path="/prive/banque"        element={<A><PriveBanque /></A>} />
          <Route path="/prive/comptabilite"  element={<P need="prive_comptabilite"><PriveComptabilite /></P>} />

          {/* Admin */}
          <Route path="/admin/users" element={<A><AdminUsers /></A>} />
          <Route path="/admin/sync" element={<A><SyncCenter /></A>} />
          <Route path="/admin/rdv-categories" element={<A><RdvCategories /></A>} />
          <Route path="/admin/liens-casses" element={<A><LiensCasses /></A>} />
          <Route path="/admin/notes-frais" element={<A><AdminNotesFrais /></A>} />

          <Route path="/" element={<P><RootRedirect /></P>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
