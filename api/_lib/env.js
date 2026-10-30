// Configuration par environnement — FONCTIONS SERVERLESS VERCEL (api/).
//
// Pendant de `src/config/env.js` pour le serveur. Lit `process.env` (variables Vercel du projet,
// par cible Production / Preview). Le dossier `api/_lib/` commence par `_` : Vercel ne l'expose
// pas comme route.
//
// Même règle de repli que le front : sans variable → production ; si APP_ENV=test et que
// l'URL/clé Supabase manquent → erreur explicite, jamais de repli silencieux sur la prod.

const PROD = {
  SUPABASE_URL:      'https://tndwonqdbeszkcztkzqe.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_xBt6ZaZGh5trEloyMCNRuA_MN-jesVJ', // clé publishable (publique)
  N8N_URL:           'https://n8n.srv1082740.hstgr.cloud',
  SHAREPOINT_SITE:   'https://dynassur.sharepoint.com/sites/ADMINISTRATION',
  SHAREPOINT_ROOT:   'Documents partages',
  HUB_URL:           'https://hub-dtx.vercel.app',
}

const env = process.env

export const APP_ENV = String(env.APP_ENV || env.VITE_APP_ENV || 'production').toLowerCase()
export const IS_PROD = APP_ENV === 'production'
export const IS_TEST = !IS_PROD

const sansSlashFinal = s => String(s).replace(/\/+$/, '')

function lire(nom, { obligatoireEnTest = false, defautTest } = {}) {
  // Accepte le nom serveur (SUPABASE_URL) ou, à défaut, la variable front (VITE_SUPABASE_URL)
  const v = env[nom] || env['VITE_' + nom]
  if (v) return sansSlashFinal(v)
  if (IS_TEST) {
    if (obligatoireEnTest) {
      throw new Error(`[Hub api] ${nom} manquante alors que APP_ENV=${APP_ENV} : refus de retomber sur la production.`)
    }
    if (defautTest !== undefined) return defautTest
  }
  return PROD[nom]
}

// ── Supabase ──────────────────────────────────────────────────────────────────
export const SUPABASE_URL      = lire('SUPABASE_URL',      { obligatoireEnTest: true })
export const SUPABASE_ANON_KEY = lire('SUPABASE_ANON_KEY', { obligatoireEnTest: true })
/** Clé service_role : jamais de valeur par défaut, jamais envoyée au navigateur. */
export const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY || ''

// ── n8n / SharePoint / Hub ────────────────────────────────────────────────────
export const N8N_URL = lire('N8N_URL')
/** Hors production, les webhooks n8n reçoivent un suffixe (-test) : jamais de workflow prod déclenché depuis le test. */
export const N8N_TEST_SUFFIX = IS_TEST ? (env.N8N_TEST_SUFFIX ?? '-test') : ''
export const n8nWebhook = chemin => `${N8N_URL}/webhook/${String(chemin).replace(/^\/+/, '')}${N8N_TEST_SUFFIX}`
export const SHAREPOINT_SITE = lire('SHAREPOINT_SITE')
export const SHAREPOINT_ROOT = lire('SHAREPOINT_ROOT', { defautTest: 'Documents partages/_TEST' })
export const HUB_URL = lire('HUB_URL')

// ── Microsoft Graph (envoi de mails, SharePoint) ──────────────────────────────
export const AZURE = {
  tenantId:     env.AZURE_TENANT_ID || '',
  clientId:     env.AZURE_CLIENT_ID || '',
  clientSecret: env.AZURE_CLIENT_SECRET || '',
}
/** En TEST : si renseignée, TOUT mail sortant est redirigé vers cette adresse (préfixe [TEST]). */
export const MAIL_REDIRECT_TO = IS_TEST ? (env.MAIL_REDIRECT_TO || '') : ''

// ── GitHub (relance des Actions de synchronisation) ───────────────────────────
export const GITHUB_DISPATCH_TOKEN = env.GITHUB_DISPATCH_TOKEN || ''
export const GITHUB_REPO = env.GITHUB_REPO || 'ludovic8100/hub-dtx'
/** Branche sur laquelle lancer les workflows : main en prod, staging en test. */
export const GITHUB_SYNC_REF = env.GITHUB_SYNC_REF || (IS_TEST ? 'staging' : 'main')

export default {
  APP_ENV, IS_PROD, IS_TEST,
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
  N8N_URL, N8N_TEST_SUFFIX, n8nWebhook, SHAREPOINT_SITE, SHAREPOINT_ROOT, HUB_URL,
  AZURE, MAIL_REDIRECT_TO,
  GITHUB_DISPATCH_TOKEN, GITHUB_REPO, GITHUB_SYNC_REF,
}
