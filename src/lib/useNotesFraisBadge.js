import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

// Compte les notes de frais soumises en attente de validation (visible admin uniquement).
export function useNotesFraisBadge(pollMs = 60000) {
  const { isAdmin } = useAuth()
  const [count, setCount] = useState(0)

  const compute = useCallback(async () => {
    if (!isAdmin) { setCount(0); return }
    try {
      const { count: c } = await supabase.from('notes_frais')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'soumise')
      setCount(c || 0)
    } catch (e) { /* silencieux */ }
  }, [isAdmin])

  useEffect(() => {
    compute()
    const iv = setInterval(compute, pollMs)
    return () => clearInterval(iv)
  }, [compute, pollMs])

  return count
}
