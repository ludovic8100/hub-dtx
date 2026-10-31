// Synchronisation quotidienne des comptes bancaires Ponto → Supabase.
// Remplace le workflow n8n "2026 - IBAN SYNC" : soldes (comptes_bancaires) et
// transactions, pour les 13 comptes du groupe.
//
// Trouvé en marge de ce remplacement (31/10/2026) : le workflow n8n utilisait
// une clé Supabase invalide depuis ~11 jours (même clé publiée, supprimée,
// que celle qui a cassé le login) — la synchro bancaire tournait dans le vide
// silencieusement depuis le 20/10. Cette fonction utilise la clé service_role
// (secret de fonction), qui contourne le RLS comme il se doit pour un script
// serveur, au lieu d'une clé publique.
//
// Secrets requis (Dashboard Supabase > Edge Functions > Secrets) :
//   PONTO_CLIENT_ID, PONTO_CLIENT_SECRET — intégration Ponto existante
//     (portail Ponto/Isabel, "Ponto Connect"), nouveau secret à générer.
//   SYNC_SHARED_SECRET — déjà utilisée par sync-entra-collaborateurs,
//     même valeur, mêmes principes (voir docs/DROITS-ACCES.md).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CLIENT_ID = Deno.env.get('PONTO_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('PONTO_CLIENT_SECRET') ?? ''
const SYNC_SECRET = Deno.env.get('SYNC_SHARED_SECRET') ?? ''
const CUTOFF_DATE = '2025-01-01'

// IBAN Ponto → id du compte dans comptes_bancaires (repris tel quel du workflow n8n).
const IBAN_VERS_COMPTE: Record<string, string> = {
  'BE97063686470449': 'b413f2f0-b25b-4761-a3d1-2574108bfed5',
  'BE84068907001759': 'd176f437-4899-4215-a4a4-25ca1b9a461f',
  'BE26732062950829': '2a698073-f8ed-4075-993f-e94db7366c32',
  'BE18732063323065': 'bdddd436-d967-4424-9a39-86689c1b42ce',
  'BE10732072764704': 'c3a4003f-772f-4156-80d5-8cddca4d7210',
  'BE32363256871602': '9d866a0b-b0c4-41d4-bfee-e3f76dd2f91f',
  'BE83363174927315': 'eeb333f7-8554-4085-8440-004bb76fcbff',
  'BE40363244452063': '21f7d9b2-ed00-4001-b548-137a895fe1d7',
  'BE45377008667389': '2353e657-72b6-4529-ade7-749c7a675056',
  'BE64903007770052': '13dd8cdf-42d7-406f-ad45-ae9dbfa3272c',
  'BE38650066071272': 'b23e92a1-9f8e-4f93-b9da-9ad435d854ca',
  'BE30068954944011': '7064d91d-a136-4d38-a3eb-d33b4255d8f6',
  'BE90652853769632': '877f9a05-7f7f-48a7-b058-87d5af52c191',
}

async function getPontoToken(): Promise<string> {
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
  const res = await fetch('https://api.myponto.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Token Ponto ${res.status} : ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

async function getComptes(token: string) {
  const res = await fetch('https://api.myponto.com/accounts?page[limit]=100', {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Ponto /accounts ${res.status} : ${await res.text()}`)
  const data = await res.json()
  return (data.data || [])
    .map((a: any) => {
      const iban = (a.attributes?.reference || '').replace(/\s/g, '')
      const compteId = IBAN_VERS_COMPTE[iban]
      if (!compteId) return null
      const attr = a.attributes || {}
      return {
        pontoAccountId: a.id as string,
        compteId,
        solde: attr.availableBalance ?? attr.currentBalance ?? null,
      }
    })
    .filter(Boolean) as { pontoAccountId: string; compteId: string; solde: number | null }[]
}

async function getTransactions(token: string, pontoAccountId: string, compteId: string) {
  const res = await fetch(`https://api.myponto.com/accounts/${pontoAccountId}/transactions?page[limit]=100`, {
    headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Ponto /transactions ${res.status} : ${await res.text()}`)
  const data = await res.json()
  return (data.data || [])
    .filter((tx: any) => {
      const date = tx.attributes?.valueDate || tx.attributes?.executionDate || ''
      return date.slice(0, 10) >= CUTOFF_DATE
    })
    .map((tx: any) => {
      const attr = tx.attributes || {}
      return {
        compte_id: compteId,
        date_valeur: attr.valueDate ? attr.valueDate.slice(0, 10) : '1970-01-01',
        date_execution: attr.executionDate ? attr.executionDate.slice(0, 10) : '1970-01-01',
        montant: attr.amount !== undefined ? parseFloat(attr.amount) : 0,
        devise: attr.currency || 'EUR',
        information_paiement: (attr.remittanceInformationUnstructured || attr.remittanceInformation || '').slice(0, 500),
        description: attr.description || '',
        contrepartie_iban: attr.counterpartReference || '',
        contrepartie_nom: attr.counterpartName || '',
        type_transaction: attr.bankTransactionCode || '',
        ponto_transaction_id: tx.id,
      }
    })
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_SECRET || !SYNC_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const token = await getPontoToken()
    const comptes = await getComptes(token)

    let soldesMaj = 0, transactionsMaj = 0
    const erreurs: string[] = []

    for (const c of comptes) {
      try {
        if (c.solde != null) {
          const { error } = await supabase.rpc('maj_solde_compte', { p_id: c.compteId, p_solde: c.solde })
          if (error) throw error
          soldesMaj++
        }
        const transactions = await getTransactions(token, c.pontoAccountId, c.compteId)
        if (transactions.length) {
          const { error } = await supabase.from('transactions').upsert(transactions, { onConflict: 'ponto_transaction_id' })
          if (error) throw error
          transactionsMaj += transactions.length
        }
      } catch (e) {
        erreurs.push(`${c.compteId}: ${String(e)}`)
      }
    }

    return new Response(JSON.stringify({ ok: erreurs.length === 0, comptes: comptes.length, soldesMaj, transactionsMaj, erreurs }), {
      status: erreurs.length ? 207 : 200,
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
