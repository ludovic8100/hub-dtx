// Synchronisation horaire Entra ID (Azure AD) → collaborateurs.
// Remplace le workflow n8n "2026_HUB_DTX_USER_PERMISSION" : crée une fiche
// (accès Hub inactif) pour chaque nouvel employé Entra, et coupe
// compte_hub_actif pour les comptes désactivés/partis.
//
// Appelée par un job pg_cron (voir sql/sync_entra_cron.sql), authentifiée par
// un secret partagé (x-sync-secret) plutôt que par verify_jwt — ce secret vit
// dans config_secrets côté base et dans les secrets de la fonction côté
// Supabase, jamais dans le code.
//
// Secrets requis (Dashboard Supabase > Edge Functions > Secrets) :
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET — app registration Entra
//     avec la permission d'application "User.Read.All" (et "Mail.Send" pour
//     la notification, optionnelle) avec consentement admin.
//   SYNC_SHARED_SECRET — valeur partagée avec config_secrets.sync_entra_secret.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TENANT_ID = Deno.env.get('MS_TENANT_ID') ?? ''
const CLIENT_ID = Deno.env.get('MS_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET') ?? ''
const SYNC_SECRET = Deno.env.get('SYNC_SHARED_SECRET') ?? ''
const DOMAINES_INTERNES = ['dynassur.be', 'dtx-group.be']
const NOTIF_EMAIL = 'lde@dynassur.be'

type EntraUser = { o365_id: string; email: string; display_name: string; enabled: boolean }

async function getGraphToken(): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Token Entra ${res.status} : ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

async function getEntraUsers(token: string): Promise<EntraUser[]> {
  const users: any[] = []
  let url: string | undefined =
    'https://graph.microsoft.com/v1.0/users?$select=id,mail,displayName,accountEnabled&$top=999'
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Graph /users ${res.status} : ${await res.text()}`)
    const data = await res.json()
    users.push(...(data.value || []))
    url = data['@odata.nextLink']
  }
  return users
    .filter((u) => u.mail)
    .map((u) => ({ o365_id: u.id, email: String(u.mail).toLowerCase(), display_name: u.displayName, enabled: u.accountEnabled }))
}

async function notifier(token: string, toInsert: any[], toDeactivate: string[]) {
  let body = '<h2 style="color:#0D2F5E">Rapport sync utilisateurs O365 → Hub Dynassur</h2>'
  if (toInsert.length) {
    body += `<h3>🆕 Nouveaux comptes (${toInsert.length})</h3><ul>` +
      toInsert.map((u) => `<li><b>${u.nom_complet}</b> (${u.email}) — accès inactif, activation requise</li>`).join('') +
      '</ul>'
  }
  if (toDeactivate.length) {
    body += `<h3>🔴 Comptes désactivés (${toDeactivate.length})</h3><ul>` +
      toDeactivate.map((e) => `<li>${e} — accès Hub coupé automatiquement</li>`).join('') + '</ul>'
  }
  body += `<p><a href="https://hub-dtx.vercel.app/config" style="background:#0080BD;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">Gérer les droits dans le Hub</a></p>`
  await fetch(`https://graph.microsoft.com/v1.0/users/${NOTIF_EMAIL}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: `Hub Dynassur — ${toInsert.length + toDeactivate.length} changement(s) détecté(s)`,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: NOTIF_EMAIL } }],
      },
    }),
  })
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_SECRET || !SYNC_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const token = await getGraphToken()
    const o365Users = await getEntraUsers(token)

    const { data: dbUsers, error: dbErr } = await supabase
      .from('collaborateurs')
      .select('email, o365_object_id, compte_hub_actif')
    if (dbErr) throw dbErr

    const dbEmails = new Set((dbUsers || []).map((u) => (u.email || '').toLowerCase()))
    const o365ActiveEmails = new Set(o365Users.filter((u) => u.enabled).map((u) => u.email))

    const toInsert = o365Users
      .filter((u) => u.enabled && !dbEmails.has(u.email) && DOMAINES_INTERNES.includes(u.email.split('@')[1] || ''))
      .map((u) => ({
        email: u.email,
        nom_complet: u.display_name,
        type: 'physique',
        o365_object_id: u.o365_id,
        o365_display_name: u.display_name,
        compte_hub_actif: false,
      }))

    const toDeactivate = (dbUsers || [])
      .filter((u) => u.compte_hub_actif && u.email && !o365ActiveEmails.has(u.email.toLowerCase()))
      .map((u) => u.email as string)

    if (toInsert.length) {
      const { error } = await supabase.from('collaborateurs').insert(toInsert)
      if (error) throw error
    }
    if (toDeactivate.length) {
      const { error } = await supabase.from('collaborateurs').update({ compte_hub_actif: false }).in('email', toDeactivate)
      if (error) throw error
    }

    if (toInsert.length || toDeactivate.length) {
      try {
        await notifier(token, toInsert, toDeactivate)
      } catch (mailErr) {
        // Non bloquant : la synchro a réussi même si la notification échoue.
        console.error('Notification mail échouée :', mailErr)
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted: toInsert.length, deactivated: toDeactivate.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
