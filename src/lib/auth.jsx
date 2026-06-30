import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export const SOCIETES_CONFIG = {
  groupe: {
    key: 'groupe', label: 'Tableau de bord général', short: 'GRP',
    color: '#7c3aed', colorDark: '#3b1f6e', colorLight: '#f5f3ff', colorAccent: '#a78bfa',
    acc_key: 'acc_holding',
  },
  dynassur: {
    key: 'dynassur', label: 'Dynassur SRL', short: 'DYN',
    color: '#0080BD', colorDark: '#0D2F5E', colorLight: '#e0f2fe', colorAccent: '#5DC3E8',
    acc_key: 'acc_dynassur',
  },
  dtx: {
    key: 'dtx', label: 'DTX SRL', short: 'DTX',
    color: '#94a3b8', colorDark: '#334155', colorLight: '#f8fafc', colorAccent: '#cbd5e1',
    acc_key: 'acc_dtx',
  },
  lode: {
    key: 'lode', label: 'LODE SRL', short: 'LODE',
    color: '#ea580c', colorDark: '#7c2d12', colorLight: '#fff7ed', colorAccent: '#fb923c',
    acc_key: 'acc_lode',
  },
  hexagroup: {
    key: 'hexagroup', label: 'Hexagroup ASBL', short: 'HEX',
    color: '#dc2626', colorDark: '#7f1d1d', colorLight: '#fef2f2', colorAccent: '#f87171',
    acc_key: 'acc_hexagroup',
  },
  prive: {
    key: 'prive', label: 'Privé', short: 'PRV',
    color: '#0d9488', colorDark: '#134e4a', colorLight: '#f0fdfa', colorAccent: '#2dd4bf',
    acc_key: 'acc_prive',
  },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perms, setPerms] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSociete, setActiveSociete] = useState(null)

  async function loadPerms(email) {
    const { data, error } = await supabase
      .from('user_permissions').select('*')
      .eq('user_email', email).eq('actif', true).single()
    if (error || !data) return null
    return data
  }

  // Suivi de connexion — additif, ne bloque jamais le login (fire-and-forget)
  async function trackConnexion(email) {
    try {
      const now = new Date().toISOString()
      await supabase.from('connexions_log').insert({ user_email: email })
      const { data: up } = await supabase.from('user_permissions').select('premiere_connexion').eq('user_email', email).single()
      if (up && !up.premiere_connexion) {
        await supabase.from('user_permissions').update({ premiere_connexion: now, derniere_connexion: now }).eq('user_email', email)
        await supabase.from('taches').update({ statut: 'terminee', date_cloture: now }).eq('user_email', email).eq('source', 'acces').neq('statut', 'terminee')
      } else {
        await supabase.from('user_permissions').update({ derniere_connexion: now }).eq('user_email', email)
      }
    } catch (e) { /* silencieux : ne jamais bloquer la connexion */ }
  }

  function getDefaultSociete(p, admin) {
    if (!p) return null
    if (admin || p.acc_holding) return 'groupe'
    return Object.values(SOCIETES_CONFIG)
      .filter(s => s.key !== 'groupe')
      .find(s => p[s.acc_key])?.key || null
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const p = await loadPerms(session.user.email)
        setPerms(p)
        setActiveSociete(getDefaultSociete(p, p?.role === 'admin'))
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const p = await loadPerms(session.user.email)
        setPerms(p)
        setActiveSociete(getDefaultSociete(p, p?.role === 'admin'))
        if (event === 'SIGNED_IN') trackConnexion(session.user.email)
      } else { setUser(null); setPerms(null); setActiveSociete(null) }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signInWithMicrosoft() {
    await supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email profile openid', redirectTo: `${window.location.origin}/auth/callback` } })
  }
  async function switchUser() {
    await supabase.auth.signOut()
    await supabase.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email profile openid', redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: 'select_account' } } })
  }
  async function signOut() { await supabase.auth.signOut(); setUser(null); setPerms(null); setActiveSociete(null) }

  const isAdmin = perms?.role === 'admin'

  const societesDispo = perms ? [
    (isAdmin || perms.acc_holding)   && SOCIETES_CONFIG.groupe,
    perms.acc_dynassur               && SOCIETES_CONFIG.dynassur,
    perms.acc_dtx                    && SOCIETES_CONFIG.dtx,
    perms.acc_lode                   && SOCIETES_CONFIG.lode,
    perms.acc_hexagroup              && SOCIETES_CONFIG.hexagroup,
    perms.acc_prive                  && SOCIETES_CONFIG.prive,
  ].filter(Boolean) : []

  const societeActive = activeSociete ? SOCIETES_CONFIG[activeSociete] : null

  return (
    <AuthContext.Provider value={{ user, perms, loading, isAdmin, activeSociete, setActiveSociete, societesDispo, societeActive, signInWithMicrosoft, switchUser, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
