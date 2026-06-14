import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // session O365
  const [perms, setPerms] = useState(null)     // droits depuis user_permissions
  const [loading, setLoading] = useState(true)

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
    // Vérifier session existante au démarrage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const p = await loadPerms(session.user.email)
        setPerms(p)
      }
      setLoading(false)
    })

    // Écouter les changements de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          const p = await loadPerms(session.user.email)
          setPerms(p)
        } else {
          setUser(null)
          setPerms(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Connexion Microsoft / O365
  async function signInWithMicrosoft() {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    })
  }

  // Changer d'utilisateur — force le sélecteur de compte Microsoft
  async function switchUser() {
    await supabase.auth.signOut()
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email profile openid',
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        }
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setPerms(null)
  }

  const isAdmin = perms?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      user, perms, loading,
      isAdmin,
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
