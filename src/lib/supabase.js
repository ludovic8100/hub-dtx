import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env'

// Client Supabase unique du front. URL/clé proviennent de src/config/env.js (variables VITE_*).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
