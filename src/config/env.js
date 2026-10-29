// Configuration par environnement — FRONT (Vite).
//
// Source unique de toutes les URL/clés externes du Hub. Plus aucune valeur codée en dur ailleurs.
// Les valeurs viennent des variables `VITE_*` (Vercel → Settings → Environment Variables,
// ou `.env.local` en développement ; voir `.env.example`).
//
// Règle de repli : sans variable, on utilise la PRODUCTION (déploiement inchangé).
// Exception : si VITE_APP_ENV=test et que l'URL/clé Supabase manquent, on BLOQUE le démarrage
// plutôt que de laisser une build de test écrire silencieusement dans la base de prod.

const E = (typeof import.meta !== 'undefined' && import.meta.env) || {}

const PROD = {
  SUPABASE_URL:      'https://tndwonqdbeszkcztkzqe.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_xBt6ZaZGh5trEloyMCNRuA_MN-jesVJ', // clé publishable (publique)
  N8N_URL:           'https://n8n.srv1082740.hstgr.cloud',
  SHAREPOINT_SITE:   'https://dynassur.sharepoint.com/sites/ADMINISTRATION',
  SHAREPOINT_ROOT:   'Documents partages',
  HUB_URL:           'https://hub-dtx.vercel.app',
}

export const APP_ENV = String(E.VITE_APP_ENV || 'production').toLowerCase()
export const IS_PROD = APP_ENV === 'production'
export const IS_TEST = !IS_PROD
export const ENV_LABEL = IS_PROD ? '' : APP_ENV.toUpperCase()

const sansSlashFinal = s => String(s).replace(/\/+$/, '')

function lire(nom, { obligatoireEnTest = false, defautTest } = {}) {
  const v = E['VITE_' + nom]
  if (v) return sansSlashFinal(v)
  if (IS_TEST) {
    if (obligatoireEnTest) {
      throw new Error(`[Hub] VITE_${nom} manquante alors que VITE_APP_ENV=${APP_ENV} : refus de retomber sur la production.`)
    }
    if (defautTest !== undefined) return defautTest
  }
  return PROD[nom]
}

// ── Supabase ──────────────────────────────────────────────────────────────────
export const SUPABASE_URL      = lire('SUPABASE_URL',      { obligatoireEnTest: true })
export const SUPABASE_ANON_KEY = lire('SUPABASE_ANON_KEY', { obligatoireEnTest: true })
export const SUPABASE_PROJECT_REF = (SUPABASE_URL.match(/^https?:\/\/([^.]+)\./) || [])[1] || ''
export const STORAGE_PUBLIC_URL = `${SUPABASE_URL}/storage/v1/object/public`
export const LOGOS_URL = `${STORAGE_PUBLIC_URL}/logos/`

// ── n8n ───────────────────────────────────────────────────────────────────────
export const N8N_URL = lire('N8N_URL')
export const N8N_WEBHOOK_URL = `${N8N_URL}/webhook`
/** URL complète d'un webhook n8n : n8nWebhook('iban-sync') */
export const n8nWebhook = chemin => `${N8N_WEBHOOK_URL}/${String(chemin).replace(/^\/+/, '')}`
/** URL de l'éditeur d'un workflow n8n */
export const n8nWorkflowUrl = id => `${N8N_URL}/workflow/${id}`

// ── SharePoint (source de vérité des documents) ──────────────────────────────
export const SHAREPOINT_SITE = lire('SHAREPOINT_SITE')
export const SHAREPOINT_ROOT = lire('SHAREPOINT_ROOT', { defautTest: 'Documents partages/_TEST' })
/** URL web d'un dossier/fichier sous la racine documentaire : sharepointUrl('COMPTA/FACTURES/_LODE') */
export const sharepointUrl = (chemin = '') => {
  const enc = s => s.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return [SHAREPOINT_SITE, enc(SHAREPOINT_ROOT), enc(chemin)].filter(Boolean).join('/')
}

// ── Hub ───────────────────────────────────────────────────────────────────────
export const HUB_URL = lire('HUB_URL', {
  defautTest: typeof window !== 'undefined' ? window.location.origin : PROD.HUB_URL,
})

// ── Dépôt GitHub (liens vers les Actions) ─────────────────────────────────────
export const GITHUB_REPO_URL = 'https://github.com/ludovic8100/hub-dtx'

export default {
  APP_ENV, IS_PROD, IS_TEST, ENV_LABEL,
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_PROJECT_REF, STORAGE_PUBLIC_URL, LOGOS_URL,
  N8N_URL, N8N_WEBHOOK_URL, n8nWebhook, n8nWorkflowUrl,
  SHAREPOINT_SITE, SHAREPOINT_ROOT, sharepointUrl,
  HUB_URL, GITHUB_REPO_URL,
}
