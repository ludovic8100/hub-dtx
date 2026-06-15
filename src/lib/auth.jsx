import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perms, setPerms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSociete, setActiveSociete] = useState(null) // 'dynassur' | 'dtx' | 'lode' | null (= all)

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
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          const p = await loadPerms(session.user.email)
          setPerms(p)
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
  const societesDispo = perms ? [
    perms.acc_dynassur && { key: 'dynassur', label: 'Dynassur', short: 'DYN', color: '#0080BD' },
    perms.acc_dtx      && { key: 'dtx',      label: 'DTX SRL',  short: 'DTX', color: '#0D2F5E' },
    perms.acc_lode     && { key: 'lode',      label: 'LODE SRL', short: 'LODE', color: '#1B5C8A' },
  ].filter(Boolean) : []

  return (
    <AuthContext.Provider value={{
      user, perms, loading,
      isAdmin,
      activeSociete, setActiveSociete,
      societesDispo,
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
