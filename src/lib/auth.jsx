import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

// Couleurs officielles par société
export const SOCIETES_CONFIG = {
  dynassur: {
    key: 'dynassur',
    label: 'Dynassur SRL',
    short: 'DYN',
    color: '#0080BD',
    colorDark: '#0D2F5E',
    colorLight: '#e0f2fe',
    colorAccent: '#5DC3E8',
    acc_key: 'acc_dynassur',
  },
  dtx: {
    key: 'dtx',
    label: 'DTX SRL',
    short: 'DTX',
    color: '#475569',
    colorDark: '#1e293b',
    colorLight: '#f1f5f9',
    colorAccent: '#94a3b8',
    acc_key: 'acc_dtx',
  },
  lode: {
    key: 'lode',
    label: 'LODE SRL',
    short: 'LODE',
    color: '#ea580c',
    colorDark: '#9a3412',
    colorLight: '#fff7ed',
    colorAccent: '#fb923c',
    acc_key: 'acc_lode',
  },
  holding: {
    key: 'holding',
    label: 'Holding',
    short: 'HOL',
    color: '#7c3aed',
    colorDark: '#4c1d95',
    colorLight: '#f5f3ff',
    colorAccent: '#a78bfa',
    acc_key: 'acc_holding',
  },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perms, setPerms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSociete, setActiveSociete] = useState(null)

  async function loadPerms(email) {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_email', email)
      .eq('actif', true)
      .single()
    if (error || !data) return null
    return data
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const p = await loadPerms(session.user.email)
        setPerms(p)
        // Auto-select première société accessible
        if (p) {
          const first = Object.values(SOCIETES_CONFIG).find(s => p[s.acc_key])
          if (first) setActiveSociete(first.key)
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          const p = await loadPerms(session.user.email)
          setPerms(p)
          if (p) {
            const first = Object.values(SOCIETES_CONFIG).find(s => p[s.acc_key])
            if (first) setActiveSociete(first.key)
          }
        } else {
          setUser(null)
          setPerms(null)
          setActiveSociete(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithMicrosoft() {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    })
  }

  async function switchUser() {
    await supabase.auth.signOut()
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setPerms(null)
    setActiveSociete(null)
  }

  const isAdmin = perms?.role === 'admin'

  // Sociétés accessibles à cet utilisateur
  const societesDispo = perms
    ? Object.values(SOCIETES_CONFIG).filter(s => isAdmin || perms[s.acc_key])
    : []

  // Config de la société active
  const societeActive = activeSociete ? SOCIETES_CONFIG[activeSociete] : null

  return (
    <AuthContext.Provider value={{
      user, perms, loading,
      isAdmin,
      activeSociete, setActiveSociete,
      societesDispo,
      societeActive,
      signInWithMicrosoft,
      switchUser,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
