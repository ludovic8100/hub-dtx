import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'

import Login              from './pages/Login'
import AuthCallback       from './pages/AuthCallback'
import AccessDenied       from './pages/AccessDenied'
import AdminUsers         from './pages/AdminUsers'
import SyncCenter         from './pages/admin/SyncCenter'
import RdvCategories      from './pages/admin/RdvCategories'

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

function ProtectedRoute({ children, requireAdmin = false }) {
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
  return children
}

function RootRedirect() {
  const { activeSociete, loading } = useAuth()
  if (loading) return null
  const routes = { groupe:'/groupe', dynassur:'/dynassur', dtx:'/dtx', lode:'/lode', hexagroup:'/hexagroup', prive:'/prive' }
  return <Navigate to={routes[activeSociete] || '/dynassur'} replace />
}

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>
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
          <Route path="/groupe" element={<P><DashboardGroupe /></P>} />

          {/* Dynassur */}
          <Route path="/dynassur"             element={<P><DashboardDynassur /></P>} />
          <Route path="/dynassur/taches"       element={<P><DynassurTaches /></P>} />
          <Route path="/dtx/taches"           element={<P><DtxTaches /></P>} />
          <Route path="/lode/taches"          element={<P><LodeTaches /></P>} />
          <Route path="/hexagroup/taches"     element={<P><HexagroupTaches /></P>} />
          <Route path="/prive/taches"         element={<P><PriveTaches /></P>} />
          <Route path="/groupe/taches"        element={<P><GroupeTaches /></P>} />
          <Route path="/dynassur/clients"      element={<P><DynassurClients /></P>} />
          <Route path="/dynassur/production"   element={<P><DynassurProduction /></P>} />
          <Route path="/dynassur/bordereaux"   element={<P><DynassurBordereaux /></P>} />
          <Route path="/dynassur/chiffres"     element={<P><DynassurChiffres /></P>} />
          <Route path="/dynassur/objectifs"    element={<P><DynassurObjectifs /></P>} />
          <Route path="/dynassur/compagnies"   element={<P><DynassurCompagnies /></P>} />
          <Route path="/dynassur/sinistres"    element={<P><DynassurSinistres /></P>} />
          <Route path="/dynassur/rdv"          element={<P><DynassurRdv /></P>} />
          <Route path="/dynassur/banque"       element={<P><DynassurBanque /></P>} />
          <Route path="/dynassur/comptabilite" element={<P><DynassurComptabilite /></P>} />
          <Route path="/dynassur/rentabilite" element={<P><DynassurRentabilite /></P>} />

          {/* DTX */}
          <Route path="/dtx"              element={<P><DashboardDtx /></P>} />
          <Route path="/dtx/immobilier"   element={<P><DtxImmobilier /></P>} />
          <Route path="/dtx/vehicules"    element={<P><DtxVehicules /></P>} />
          <Route path="/dtx/trading"      element={<P><DtxTrading /></P>} />
          <Route path="/dtx/comptabilite" element={<P><DtxComptabilite /></P>} />

          {/* LODE */}
          <Route path="/lode"               element={<P><DashboardLode /></P>} />
          <Route path="/lode/clients"       element={<P><LodeClients /></P>} />
          <Route path="/lode/devis-factures" element={<P><LodeDevisFactures /></P>} />
          <Route path="/dtx/devis-factures"  element={<P><DtxDevisFactures /></P>} />
          <Route path="/dynassur/devis-factures" element={<P><DynDevisFactures /></P>} />
          <Route path="/config" element={<P><ConfigModule /></P>} />
          <Route path="/lode/banque"        element={<P><LodeBanque /></P>} />
          <Route path="/lode/comptabilite"  element={<P><LodeComptabilite /></P>} />

          {/* Hexagroup */}
          <Route path="/hexagroup"               element={<P><DashboardHexagroup /></P>} />
          <Route path="/hexagroup/banque"        element={<P><HexagroupBanque /></P>} />
          <Route path="/hexagroup/comptabilite"  element={<P><HexagroupComptabilite /></P>} />

          {/* Privé */}
          <Route path="/prive"               element={<P><DashboardPrive /></P>} />
          <Route path="/prive/banque"        element={<P><PriveBanque /></P>} />
          <Route path="/prive/comptabilite"  element={<P><PriveComptabilite /></P>} />

          {/* Admin */}
          <Route path="/admin/users" element={<A><AdminUsers /></A>} />
          <Route path="/admin/sync" element={<A><SyncCenter /></A>} />
          <Route path="/admin/rdv-categories" element={<A><RdvCategories /></A>} />

          <Route path="/" element={<P><RootRedirect /></P>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
