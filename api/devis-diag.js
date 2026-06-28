// DIAGNOSTIC TEMPORAIRE — à supprimer après usage.
// Ne renvoie QUE des booléens + message d'erreur Microsoft (aucune valeur de secret).
export default async function handler(req, res) {
  const env = {
    AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  }
  let graph = { ok: false, error: null }
  try {
    const tr = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID || '', client_secret: process.env.AZURE_CLIENT_SECRET || '',
        scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
      }),
    })
    const tj = await tr.json()
    graph.ok = !!tj.access_token
    if (!tj.access_token) graph.error = String(tj.error_description || tj.error || 'inconnu').slice(0, 180)
  } catch (e) { graph.error = String(e).slice(0, 180) }

  // Joignabilité Supabase (URL + anon corrects ?) — on attend un statut 401/403 (= atteignable)
  let supa = { status: null, reachable: false, error: null }
  try {
    const sr = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: process.env.SUPABASE_ANON_KEY || '', Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY || ''}` },
    })
    supa.status = sr.status
    supa.reachable = [200, 401, 403].includes(sr.status)
  } catch (e) { supa.error = String(e).slice(0, 180) }

  res.status(200).json({ env, graph, supa })
}
