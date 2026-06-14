import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'

import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AccessDenied from './pages/AccessDenied'
import Dashboard from './pages/Dashboard'
import AdminUsers from './pages/AdminUsers'

// Route protégée — vérifie session + droits
function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, perms, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0D2F5E'
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: '3px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Pas connecté → login
  if (!user) return <Navigate to="/login" replace />

  // Connecté mais pas de droits actifs → accès refusé
  if (!perms) return <Navigate to="/access-denied" replace />

  // Route admin demandée mais pas admin
  if (requireAdmin && perms.role !== 'admin') return <Navigate to="/" replace />

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/access-denied" element={<AccessDenied />} />

      {/* Dynassur */}
      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />
      <Route path="/dynassur" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin/users" element={
        <ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>
      } />

      {/* Fallback */}
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
