import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// Compte les tickets où l'utilisateur est concerné (assigné/créateur/participant)
// et qui ont au moins un message non lu par lui.
export function useTicketsBadge(pollMs = 60000) {
  const { perms } = useAuth()
  const myCode = (perms?.collab_code || perms?.code || (perms?.user_email || '').split('@')[0] || '').toUpperCase()
  const [count, setCount] = useState(0)

  const compute = useCallback(async () => {
    if (!myCode) { setCount(0); return }
    try {
      // Tickets où je suis concerné
      let tks = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('taches')
          .select('id,gestionnaire,cree_par,participants')
          .eq('is_ticket', true).neq('ticket_statut', 'cloture').range(from, from + 999)
        if (error || !data) break
        tks = tks.concat(data); if (data.length < 1000) break
      }
      const mine = tks.filter(t => {
        const parts = Array.isArray(t.participants) ? t.participants.map(x => (x || '').toUpperCase()) : []
        return (t.gestionnaire || '').toUpperCase() === myCode || (t.cree_par || '').toUpperCase() === myCode || parts.includes(myCode)
      })
      if (!mine.length) { setCount(0); return }
      const ids = mine.map(t => t.id)
      // Messages de ces tickets, non écrits par moi
      let msgs = []
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200)
        const { data } = await supabase.from('tickets_messages')
          .select('tache_id,auteur_code,lu_par').in('tache_id', chunk)
        if (data) msgs = msgs.concat(data)
      }
      const nonLus = new Set()
      msgs.forEach(m => {
        const auteur = (m.auteur_code || '').toUpperCase()
        if (auteur === myCode) return
        const lu = (Array.isArray(m.lu_par) ? m.lu_par : []).map(x => (x || '').toUpperCase())
        if (!lu.includes(myCode)) nonLus.add(m.tache_id)
      })
      setCount(nonLus.size)
    } catch (e) { /* silencieux */ }
  }, [myCode])

  useEffect(() => {
    compute()
    const iv = setInterval(compute, pollMs)
    return () => clearInterval(iv)
  }, [compute, pollMs])

  return count
}
