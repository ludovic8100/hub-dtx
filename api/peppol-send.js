// Envoi d'une facture de vente sur le réseau Peppol, via Billit.
//
// Remplace le workflow n8n « 2026 - LODE - Peppol Send (Billit) » (webhook
// lode-peppol-send). Deux appels à Billit, dans cet ordre :
//   1. POST /v1/orders                 → crée la facture et renvoie son OrderID
//   2. POST /v1/orders/commands/send   → la pousse sur Peppol
//
// La clé API et le partyID ne sont plus écrits dans un nœud n8n mais lus dans
// les variables Vercel (voir `billit()` dans api/_lib/env.js).
//
// Appel : POST /api/peppol-send  { entite, facture: { …, lignes: [] } }
//         En-tête Authorization: Bearer <jeton Supabase de l'utilisateur connecté>

import { SUPABASE_URL as SB_URL, SUPABASE_ANON_KEY as SB_KEY, billit, PEPPOL_AUTORISE, IS_TEST } from './_lib/env.js'

const BILLIT = 'https://api.billit.be/v1'

const nombre = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Construit le corps /v1/orders attendu par Billit à partir d'une facture du Hub. */
function versOrder(f) {
  const lignes = Array.isArray(f.lignes) ? f.lignes : []

  const OrderLines = lignes.map(l => {
    const ligne = {
      Quantity: nombre(l.quantite),
      UnitPriceExcl: nombre(l.prix_unitaire),
      Description: l.description || '',
      VATPercentage: nombre(l.tva_pct),
    }
    // Remise de ligne : remise commerciale Billit, exprimée en pourcentage.
    if (nombre(l.remise_pct) > 0) ligne.Discount = nombre(l.remise_pct)
    return ligne
  })

  const adresse = { AddressType: 'InvoiceAddress', Name: f.client_nom || '', CountryCode: 'BE' }
  if (f.client_adresse) adresse.Street = f.client_adresse
  if (f.client_cp)      adresse.Zipcode = f.client_cp
  if (f.client_ville)   adresse.City = f.client_ville

  const Customer = { Name: f.client_nom || '', PartyType: 'Customer', Addresses: [adresse] }
  // Le numéro de TVA est la clé de routage Peppol : sans lui, rien ne part.
  if (f.client_tva)        Customer.VATNumber = String(f.client_tva).replace(/\s/g, '')
  if (f.client_email)      Customer.Email = f.client_email
  if (f.client_telephone)  Customer.Phone = f.client_telephone
  if (f.langue)            Customer.Language = String(f.langue).toUpperCase()

  const order = {
    OrderType: 'Invoice',
    OrderDirection: 'Income',
    OrderNumber: f.numero,
    OrderDate: f.date_facture,
    ExpiryDate: f.date_echeance,
    Currency: 'EUR',
    Customer,
    OrderLines,
  }
  if (nombre(f.remise_pct) > 0) order.Discount = nombre(f.remise_pct)
  return order
}

/** Billit renvoie l'identifiant tantôt nu, tantôt enveloppé selon l'endpoint. */
function extraireOrderId(reponse) {
  if (typeof reponse === 'number') return reponse
  if (!reponse || typeof reponse !== 'object') return null
  return reponse.OrderID ?? reponse.id ?? (typeof reponse.data === 'number' ? reponse.data : null)
}

export default async function handler(req, res) {
  // Contrôle de configuration, en lecture seule, sans rien envoyer.
  //
  // Le contrôle de la configuration Billit se trouve volontairement APRÈS
  // l'authentification et la validation de la facture : on ne veut pas qu'un
  // appel anonyme puisse sonder quoi que ce soit. Mais cela rendait impossible
  // de répondre à la question « les clés sont-elles bien posées ? » autrement
  // qu'en envoyant une vraie facture à un vrai client.
  //
  // Ce GET répond par OUI ou NON, par entité. Jamais une valeur, jamais un
  // fragment de clé. Les noms de variables sont déjà dans le dépôt public :
  // savoir qu'une clé est configurée n'apprend rien à personne.
  if (req.method === 'GET' && 'config' in (req.query || {})) {
    const etat = {}
    for (const entite of ['lode', 'dtx', 'dyn']) {
      const { apiKey, partyId } = billit(entite)
      etat[entite] = { cle: Boolean(apiKey), partyId: Boolean(partyId) }
    }
    return res.status(200).json({ ok: true, envoi_autorise: PEPPOL_AUTORISE, entites: etat })
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  // Session Supabase obligatoire : cette fonction engage l'entreprise vis-à-vis d'un client.
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ ok: false, error: 'no token' })
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } })
    if (!u.ok) return res.status(401).json({ ok: false, error: 'invalid session' })
  } catch (e) { return res.status(401).json({ ok: false, error: 'auth failed' }) }

  if (!PEPPOL_AUTORISE) {
    return res.status(403).json({
      ok: false,
      error: "Envoi Peppol refusé hors production : une facture partie sur le réseau ne se rattrape pas. Pour l'autoriser sur cet environnement, poser BILLIT_AUTORISE_EN_TEST=1.",
    })
  }

  const { entite, facture } = req.body || {}
  if (!facture || !facture.numero) return res.status(400).json({ ok: false, error: 'facture manquante' })
  if (!facture.client_tva) {
    return res.status(400).json({ ok: false, error: 'Numéro de TVA du client manquant — Peppol route sur la TVA.' })
  }

  const { apiKey, partyId } = billit(entite)
  if (!apiKey || !partyId) {
    const suffixe = entite ? ` (ni BILLIT_${String(entite).toUpperCase()}_API_KEY, ni BILLIT_API_KEY)` : ''
    return res.status(500).json({ ok: false, error: `Billit non configuré pour « ${entite || 'défaut'} »${suffixe}` })
  }

  const entetes = { apikey: apiKey, partyID: String(partyId), 'Content-Type': 'application/json' }

  try {
    // 1. Création de la facture chez Billit
    const creation = await fetch(`${BILLIT}/orders`, {
      method: 'POST', headers: entetes, body: JSON.stringify(versOrder(facture)),
    })
    const brut = await creation.text()
    if (!creation.ok) {
      return res.status(502).json({ ok: false, etape: 'creation', error: `Billit ${creation.status}`, detail: brut.slice(0, 400) })
    }

    let corps = null
    try { corps = JSON.parse(brut) } catch { corps = brut.trim() === '' ? null : Number(brut) }
    const orderID = extraireOrderId(corps)
    if (!orderID) {
      return res.status(502).json({ ok: false, etape: 'creation', error: 'Billit n\'a pas renvoyé d\'OrderID', detail: brut.slice(0, 400) })
    }

    // 2. Envoi sur Peppol. La facture existe déjà chez Billit : si cette étape
    //    échoue, on renvoie l'OrderID pour pouvoir la retrouver et la renvoyer
    //    depuis Billit sans en créer un doublon.
    const envoi = await fetch(`${BILLIT}/orders/commands/send`, {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ Transporttype: 'Peppol', OrderIDs: [orderID] }),
    })
    if (!envoi.ok) {
      const detail = await envoi.text()
      return res.status(502).json({ ok: false, etape: 'envoi', orderID, error: `Billit ${envoi.status}`, detail: detail.slice(0, 400) })
    }

    return res.status(200).json({ ok: true, orderID, test: IS_TEST || undefined })
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e).slice(0, 300) })
  }
}
