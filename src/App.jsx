import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'

import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AccessDenied from './pages/AccessDenied'
import AdminUsers from './pages/AdminUsers'

import DashboardGroupe   from './pages/groupe/DashboardGroupe'
import DashboardDynassur from './pages/dynassur/DashboardDynassur'
import DashboardDtx      from './pages/dtx/DashboardDtx'
import DashboardLode     from './pages/lode/DashboardLode'

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

// Redirige vers le bon dashboard selon la société active
function RootRedirect() {
  const { activeSociete, loading } = useAuth()
  if (loading) return null
  const routes = { groupe: '/groupe', dynassur: '/dynassur', dtx: '/dtx', lode: '/lode' }
  return <Navigate to={routes[activeSociete] || '/dynassur'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"          element={<Login />} />
      <Route path="/auth/callback"  element={<AuthCallback />} />
      <Route path="/access-denied"  element={<AccessDenied />} />

      {/* Dashboards par société */}
      <Route path="/groupe"   element={<ProtectedRoute><DashboardGroupe /></ProtectedRoute>} />
      <Route path="/dynassur" element={<ProtectedRoute><DashboardDynassur /></ProtectedRoute>} />
      <Route path="/dtx"      element={<ProtectedRoute><DashboardDtx /></ProtectedRoute>} />
      <Route path="/lode"     element={<ProtectedRoute><DashboardLode /></ProtectedRoute>} />

      {/* Sous-modules Dynassur — placeholder pour éviter 404 */}
      <Route path="/dynassur/*" element={<ProtectedRoute><DashboardDynassur /></ProtectedRoute>} />
      <Route path="/dtx/*"      element={<ProtectedRoute><DashboardDtx /></ProtectedRoute>} />
      <Route path="/lode/*"     element={<ProtectedRoute><DashboardLode /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />

      {/* Racine → redirect automatique vers la bonne société */}
      <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
