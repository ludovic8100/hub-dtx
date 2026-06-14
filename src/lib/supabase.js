import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tndwonqdbeszkcztkzqe.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRuZHdvbnFkYmVzemtjenRrenFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDg1MTcsImV4cCI6MjA5NjI4NDUxN30.jRrq7nV2Y6KSW_JwHbyOSm4lvckTLmVcAAROhq6sSuw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
