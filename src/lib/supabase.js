import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tndwonqdbeszkcztkzqe.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_xBt6ZaZGh5trEloyMCNRuA_MN-jesVJ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
