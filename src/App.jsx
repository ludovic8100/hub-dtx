import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'

// Public
import Login          from './pages/Login'
import AuthCallback   from './pages/AuthCallback'
import AccessDenied   from './pages/AccessDenied'

// Admin
import AdminUsers     from './pages/AdminUsers'

// Groupe
import DashboardGroupe from './pages/groupe/DashboardGroupe'

// Dynassur
import DashboardDynassur    from './pages/dynassur/DashboardDynassur'
import DynassurTaches        from './pages/dynassur/DynassurTaches'
import DynassurClients       from './pages/dynassur/DynassurClients'
import DynassurProduction    from './pages/dynassur/DynassurProduction'
import DynassurBordereaux    from './pages/dynassur/DynassurBordereaux'
import DynassurChiffres      from './pages/dynassur/DynassurChiffres'
import DynassurObjectifs     from './pages/dynassur/DynassurObjectifs'
import DynassurCompagnies    from './pages/dynassur/DynassurCompagnies'
import DynassurSinistres     from './pages/dynassur/DynassurSinistres'
import DynassurBanque        from './pages/dynassur/DynassurBanque'
import DynassurComptabilite  from './pages/dynassur/DynassurComptabilite'

// DTX
import DashboardDtx    from './pages/dtx/DashboardDtx'
import DtxImmobilier   from './pages/dtx/DtxImmobilier'
import DtxVehicules    from './pages/dtx/DtxVehicules'
import DtxTrading      from './pages/dtx/DtxTrading'
import DtxComptabilite from './pages/dtx/DtxComptabilite'

// LODE
import DashboardLode     from './pages/lode/DashboardLode'
import LodeClients       from './pages/lode/LodeClients'
import LodeBanque        from './pages/lode/LodeBanque'
import LodeComptabilite  from './pages/lode/LodeComptabilite'

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, perms, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D2F5E' }}>
      <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
  const routes = { groupe: '/groupe', dynassur: '/dynassur', dtx: '/dtx', lode: '/lode' }
  return <Navigate to={routes[activeSociete] || '/dynassur'} replace />
}

const P = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>
const A = ({ children }) => <ProtectedRoute requireAdmin>{children}</ProtectedRoute>

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"         element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Groupe */}
          <Route path="/groupe" element={<P><DashboardGroupe /></P>} />

          {/* Dynassur */}
          <Route path="/dynassur"              element={<P><DashboardDynassur /></P>} />
          <Route path="/dynassur/taches"        element={<P><DynassurTaches /></P>} />
          <Route path="/dynassur/clients"       element={<P><DynassurClients /></P>} />
          <Route path="/dynassur/production"    element={<P><DynassurProduction /></P>} />
          <Route path="/dynassur/bordereaux"    element={<P><DynassurBordereaux /></P>} />
          <Route path="/dynassur/chiffres"      element={<P><DynassurChiffres /></P>} />
          <Route path="/dynassur/objectifs"     element={<P><DynassurObjectifs /></P>} />
          <Route path="/dynassur/compagnies"    element={<P><DynassurCompagnies /></P>} />
          <Route path="/dynassur/sinistres"     element={<P><DynassurSinistres /></P>} />
          <Route path="/dynassur/banque"        element={<P><DynassurBanque /></P>} />
          <Route path="/dynassur/comptabilite"  element={<P><DynassurComptabilite /></P>} />

          {/* DTX */}
          <Route path="/dtx"               element={<P><DashboardDtx /></P>} />
          <Route path="/dtx/immobilier"    element={<P><DtxImmobilier /></P>} />
          <Route path="/dtx/vehicules"     element={<P><DtxVehicules /></P>} />
          <Route path="/dtx/trading"       element={<P><DtxTrading /></P>} />
          <Route path="/dtx/comptabilite"  element={<P><DtxComptabilite /></P>} />

          {/* LODE */}
          <Route path="/lode"               element={<P><DashboardLode /></P>} />
          <Route path="/lode/clients"       element={<P><LodeClients /></P>} />
          <Route path="/lode/banque"        element={<P><LodeBanque /></P>} />
          <Route path="/lode/comptabilite"  element={<P><LodeComptabilite /></P>} />

          {/* Admin */}
          <Route path="/admin/users" element={<A><AdminUsers /></A>} />

          {/* Racine → redirect auto */}
          <Route path="/" element={<P><RootRedirect /></P>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
