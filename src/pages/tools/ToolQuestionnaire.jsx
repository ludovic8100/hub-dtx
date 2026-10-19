import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'

// Worker pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

// ═══════════════════════════════════════════════════════════════════════
// FUND RISK DATABASE — ajouter les fonds par compagnie ici
// ═══════════════════════════════════════════════════════════════════════
const FUND_RISK = {
  // AG Insurance
  'pension life': 0, 'ag life stability': 10, 'ag life income': 15,
  'ag life balanced': 50, 'ag life growth': 75, 'ag life dynamic': 85,
  'ag life equities': 90, 'top rendement': 5, 'capital branch 21': 0,
  // Baloise — fonds réels extraits des PDFs
  'r-valor fund': 85, 'megatrends fund': 80, 'infrastructure fund': 55,
  'bgf world technology fund': 90, 'jpm global focus fund': 75,
  'c-quadrat arts balanced fund': 50,
  'bfi global equity select': 85, 'bfi megatrends select': 80,
  'bfi multi asset select': 45, 'bfi positive impact select': 65,
  'bfi real estate and infrastructure select': 55,
  'compte branche 21': 0, 'compte branche 21 - 0%': 0,
  'european bonds': 10, 'balanced': 50, 'growth': 75, 'equities': 90,
  'branche 21': 0, 'branche 26': 0, 'invest 1': 30, 'invest 2': 50,
  'invest 3': 70,
  // NN — fonds réels extraits des PDFs
  'nn life star fund': 70, 'nn life star fund - eur': 70,
  'fng sustainable impact': 60, 'fng patrimonial balanced': 45,
  'fng patrimonial defensive': 20, 'fng growth': 70,
  'nn life strategy defensive': 15, 'nn life strategy balanced': 45,
  'nn life strategy dynamic': 80, 'branche 21 nn': 0,
  // AXA
  'axa b pension stability': 10, 'axa b pension balanced': 45,
  'axa b pension dynamic': 80, 'crest 21': 0, 'crest 26': 5,
  'venture 1': 30, 'venture 2': 55, 'venture 3': 75,
  // Allianz
  'strategy balanced': 50, 'strategy dynamic': 80,
  'strategy defensive': 15, 'allianz branche 21': 0,
}

const CONTRACT_PURPOSES = {
  'engagement individuel de pension': 'pension',
  'eip': 'pension', 'pension libre complémentaire': 'pension',
  'plci': 'pension', 'assurance groupe': 'pension',
  'épargne-pension': 'epargne', 'épargne long terme': 'epargne',
  'branche 21': 'epargne', 'branche 23': 'investissement',
  'unit linked': 'investissement',
}

// ═══════════════════════════════════════════════════════════════════════
// QUESTIONS
// ═══════════════════════════════════════════════════════════════════════
const QUESTIONS = [
  { n: 1, text: "Quel est votre objectif principal pour cet investissement ?", opts: { a: "Préserver mon capital", b: "Obtenir un revenu régulier", c: "Faire croître mon capital sur le long terme" } },
  { n: 2, text: "Quel est votre horizon de placement ?", opts: { a: "Moins de 3 ans", b: "Entre 3 et 7 ans", c: "Plus de 7 ans" } },
  { n: 3, text: "Quelle part de votre patrimoine total êtes-vous prêt à investir ?", opts: { a: "Moins de 10%", b: "Entre 10% et 30%", c: "Plus de 30%" } },
  { n: 4, text: "Comment réagiriez-vous si la valeur de votre investissement baissait de 20% en un an ?", opts: { a: "Je vendrais immédiatement pour éviter de perdre plus", b: "Je resterais calme et attendrais une reprise", c: "J'en profiterais pour acheter davantage" } },
  { n: 5, text: "Quelle est votre expérience en matière d'investissements financiers ?", opts: { a: "Aucune ou très limitée", b: "Moyenne, j'ai déjà investi dans des placements simples", c: "Avancée, je connais bien les marchés financiers" } },
  { n: 6, text: "Quel niveau de risque êtes-vous prêt à accepter ?", opts: { a: "Faible (peu de fluctuations, mais rendement limité)", b: "Modéré (fluctuations moyennes pour un rendement potentiel supérieur)", c: "Élevé (fortes fluctuations, mais potentiel de rendement élevé)" } },
  { n: 7, text: "Quelle est votre principale source de revenus ?", opts: { a: "Revenus fixes (salaires, pensions)", b: "Revenus variables (commissions, dividendes)", c: "Revenus importants et fluctuants (entrepreneur, investissements)" } },
  { n: 8, text: "Quelle est votre situation financière globale ?", opts: { a: "Endetté ou avec peu d'épargne", b: "Situation stable avec une épargne modérée", c: "Situation confortable avec une épargne importante" } },
  { n: 9, text: "Avez-vous des besoins de liquidité à court terme ?", opts: { a: "Oui, j'aurai besoin d'accéder à mon argent rapidement", b: "Peut-être, mais pas certain", c: "Non, je peux immobiliser mon argent à long terme" } },
  { n: 10, text: "Quelle est votre réaction face aux fluctuations du marché ?", opts: { a: "Je suis très inquiet et préfère éviter les pertes", b: "J'accepte les fluctuations modérées", c: "Je considère les fluctuations comme des opportunités" } },
  { n: 11, text: "Quel est votre niveau de connaissance des produits financiers ?", opts: { a: "Faible (je connais peu ou pas)", b: "Moyen (j'ai des notions de base)", c: "Élevé (je comprends bien les différents produits)" } },
  { n: 12, text: "Quel est votre objectif en termes de rendement ?", opts: { a: "Sécurité avant tout, rendement faible acceptable", b: "Bon équilibre entre rendement et sécurité", c: "Maximiser le rendement, même avec des risques élevés" } },
  { n: 13, text: "Quelle est votre tolérance à la perte en capital ?", opts: { a: "Très faible, je ne veux pas perdre d'argent", b: "Moyenne, je peux accepter une perte temporaire", c: "Élevée, je peux accepter des pertes importantes pour plus de gains" } },
  { n: 14, text: "Comment diversifiez-vous actuellement vos investissements ?", opts: { a: "Peu diversifié, principalement en liquidités ou comptes épargne", b: "Moyennement diversifié (actions, obligations, immobilier)", c: "Très diversifié, avec une large gamme d'actifs" } },
]

// ═══════════════════════════════════════════════════════════════════════
// DÉTECTION DE COMPAGNIE
// ═══════════════════════════════════════════════════════════════════════

function detectCompany(text) {
  if (/baloise/i.test(text) || /bfi\s+(global|megatrends|multi|positive|real)/i.test(text)) return 'baloise'
  if (/\bnn\b\s*(insurance|belgium|strategy|life)/i.test(text) || /www\.nn\.be/i.test(text)) return 'nn'
  if (/ag\s*insurance/i.test(text) || /aginsurance\.be/i.test(text) || /\bag\s*life\b/i.test(text) || /pension\s*life/i.test(text)) return 'ag'
  if (/\baxa\b/i.test(text)) return 'axa'
  if (/\ballianz\b/i.test(text)) return 'allianz'
  return null
}

// ═══════════════════════════════════════════════════════════════════════
// PARSERS — un par compagnie
// ═══════════════════════════════════════════════════════════════════════

function parseAG(text) {
  const d = {}
  let m
  // Nom / prénom — format standard "Preneur : M. NOM Prénom"
  m = text.match(/Preneur\s*[:\-]?\s*(?:M\.\s*|Mme\s*)?([A-ZÀ-Ú\s]+?)\s+([\wéèêëàâäîïôöùûüç\s-]+?)(?:\n|Date)/i)
  if (m) { d.last_name = m[1].trim(); d.first_name = m[2].trim() }
  // Format INAMI — "candidate-affiliée : Madame NOM Prénom"
  if (!d.last_name) {
    m = text.match(/(?:candidat[e]?[\s-]*affiliée?)\s*[:\-]?\s*(?:Madame|Monsieur|M\.|Mme)\s+([A-ZÀ-Ú]{2,})\s+([\wéèêëàâäîïôöùûüç-]+)/i)
    if (m) { d.last_name = m[1].trim(); d.first_name = m[2].trim() }
  }
  if (!d.last_name) {
    m = text.match(/(?:Affilié|Nom)\s*[:\-]?\s*([A-ZÀ-Ú\s]+?)\s*(?:\n|Prénom)/i)
    if (m) d.last_name = m[1].trim()
  }
  if (!d.first_name) {
    m = text.match(/Prénom\s*[:\-]?\s*([\wéèêëàâäîïôöùûüç\s-]+?)(?:\n|$)/im)
    if (m) d.first_name = m[1].trim()
  }
  m = text.match(/[Nn]°?\s*(?:de\s*contrat)?\s*:?\s*([\d/]+)/)
  if (m) d.contract_number = m[1]
  m = text.match(/[Dd]ate\s*de\s*naissance\s*[:\-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/)
  if (!m) m = text.match(/née?\s*le\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
  if (m) d.birth_date = m[1]
  // Adresse du preneur — chercher après la section "Preneur", pas la première adresse du PDF
  m = text.match(/[Aa]dresse\s*[:\-]?\s*(.+?)(?:\n|$)/m)
  if (m) d.address = m[1].trim()
  if (!d.address) {
    // Chercher l'adresse dans la zone autour du preneur (après "Preneur" et avant la section suivante)
    const preneurIdx = text.search(/preneur/i)
    const searchZone = preneurIdx >= 0 ? text.slice(preneurIdx, preneurIdx + 600) : text
    m = searchZone.match(/((?:Rue|Avenue|Chaussée|Boulevard|Place|Allée|Chemin|Chée)[^\n]+)/i)
    if (m) d.address = m[1].trim()
  }
  // Type de contrat
  const types = ['Engagement individuel de pension', 'EIP', 'Assurance groupe', 'PLCI',
    'Pension libre complémentaire', 'Épargne-pension', 'Branche 21', 'Branche 23']
  for (const t of types) {
    if (text.toLowerCase().includes(t.toLowerCase())) { d.contract_type = t; break }
  }
  // INAMI / convention de pension
  if (!d.contract_type && /inami|convention\s*de\s*pension/i.test(text)) d.contract_type = 'Convention de pension INAMI'
  if (!d.contract_type) d.contract_type = 'Vie'
  // Fonds
  d.funds = {}
  const fundPat = /(\d{1,3}(?:[.,]\d+)?)\s*%\s*[-–]?\s*([A-Za-zÀ-ÿ\s]+?)(?=\d{1,3}(?:[.,]\d+)?\s*%|\n|$)/g
  let fm
  while ((fm = fundPat.exec(text)) !== null) {
    const pct = parseFloat(fm[1].replace(',', '.'))
    const name = fm[2].trim()
    if (pct > 0 && pct <= 100 && name.length > 2) d.funds[name] = pct
  }
  // Fallback : "Fund Name : XX%"
  if (Object.keys(d.funds).length === 0) {
    const fp2 = /([A-Za-zÀ-ÿ\s]+?)\s*[:\-]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    while ((fm = fp2.exec(text)) !== null) {
      const name = fm[1].trim()
      const pct = parseFloat(fm[2].replace(',', '.'))
      if (pct > 0 && pct <= 100 && name.length > 2) d.funds[name] = pct
    }
  }
  // Pure Branche 21 (INAMI) — si aucun fonds trouvé mais texte INAMI
  if (Object.keys(d.funds).length === 0 && /inami|convention\s*de\s*pension|taux\s*garanti/i.test(text)) {
    d.funds['Branche 21 (taux garanti)'] = 100
  }
  d.company = 'AG Insurance'
  return d
}

function parseBaloise(text) {
  const d = {}
  let m
  // Nom / prénom — section PRENEUR
  m = text.match(/(?:Preneur|PRENEUR)[^\n]*\n[^\n]*?([A-ZÀ-Ú]{2,})\s+([A-ZÀ-Úa-zà-ÿ]+)/i)
  if (!m) m = text.match(/(?:Preneur|Titulaire)\s*[:\-]?\s*(?:M\.\s*|Mme\s*)?([A-ZÀ-Ú]{2,})\s+([\wéèêëàâäîïôöùûüç-]+)/i)
  if (m) { d.last_name = m[1].trim(); d.first_name = m[2].trim() }
  // N° client
  m = text.match(/[Nn]°?\s*(?:client|contrat|police)\s*[:\-]?\s*([\d/.]+)/i)
  if (m) d.contract_number = m[1]
  // Date de naissance
  m = text.match(/[Dd]ate\s*de\s*naissance\s*[:\-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/)
  if (!m) m = text.match(/née?\s*le\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
  if (m) d.birth_date = m[1]
  // Adresse du preneur — chercher près de la section Preneur, pas la première adresse
  const bPreneurIdx = text.search(/preneur/i)
  const bZone = bPreneurIdx >= 0 ? text.slice(bPreneurIdx, bPreneurIdx + 600) : text
  m = bZone.match(/((?:Rue|Avenue|Chaussée|Boulevard|Place|Allée|Chemin|Chée)[^\n]+)/i)
  if (m) d.address = m[1].trim()
  // Type de contrat
  if (/engagement\s*individuel\s*de\s*pension|eip/i.test(text)) d.contract_type = 'EIP'
  else if (/plci|pension\s*libre\s*compl/i.test(text)) d.contract_type = 'PLCI'
  else if (/[ée]pargne[\s-]*pension/i.test(text)) d.contract_type = 'Épargne-pension'
  else if (/[ée]pargne[\s-]*long\s*terme/i.test(text)) d.contract_type = 'Épargne long terme'
  else if (/save\s*plan/i.test(text)) d.contract_type = 'Save Plan'
  else d.contract_type = 'Vie'
  // Fonds — pattern Baloise : "Nom du fonds    XX,XX %"
  d.funds = {}
  const fundPat = /([\wÀ-ÿ][\wÀ-ÿ\s&'°/-]*?)\s+(\d{1,3}[.,]\d{2})\s*%/g
  while ((m = fundPat.exec(text)) !== null) {
    let name = m[1].trim()
    const pct = parseFloat(m[2].replace(',', '.'))
    // Filtrer les faux positifs
    if (/^(page|frais|taxe|prime|total|montant|date|taux)/i.test(name)) continue
    if (pct <= 0 || pct > 100) continue
    if (name.length < 3) continue
    // Compte Branche 21 - 0% → risque 0
    if (/compte\s*branche\s*21/i.test(name)) name = 'Compte Branche 21'
    d.funds[name] = pct
  }
  // Fallback si pas de fonds trouvés via pattern principal
  if (Object.keys(d.funds).length === 0) {
    const fp2 = /([A-Za-zÀ-ÿ][\w\sÀ-ÿ&'°/-]+?)\s*[:\-]\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g
    while ((m = fp2.exec(text)) !== null) {
      const name = m[1].trim()
      const pct = parseFloat(m[2].replace(',', '.'))
      if (pct > 0 && pct <= 100 && name.length > 2 && !/^(page|frais|taxe|prime|total)/i.test(name)) {
        d.funds[name] = pct
      }
    }
  }
  d.company = 'Baloise'
  return d
}

function parseNN(text) {
  const d = {}
  let m
  // Nom — "Nom    Monsieur Denis DEMARET"
  m = text.match(/Nom\s+(?:Monsieur|Madame|M\.|Mme)\s+([\wéèêëàâäîïôöùûüç-]+)\s+([A-ZÀ-Ú]{2,})/i)
  if (m) { d.first_name = m[1].trim(); d.last_name = m[2].trim() }
  if (!d.last_name) {
    m = text.match(/(?:Preneur|Titulaire|Affilié)\s*[:\-]?\s*(?:M\.\s*|Mme\s*)?([A-ZÀ-Ú]{2,})\s+([\wéèêëàâäîïôöùûüç-]+)/i)
    if (m) { d.last_name = m[1].trim(); d.first_name = m[2].trim() }
  }
  // N° contrat
  m = text.match(/[Nn]°?\s*(?:de\s*)?(?:contrat|police)\s*[:\-]?\s*([\d/.]+)/i)
  if (m) d.contract_number = m[1]
  // Date de naissance
  m = text.match(/[Dd]ate\s*de\s*naissance\s*[:\-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/)
  if (m) d.birth_date = m[1]
  // Adresse du preneur — chercher près de la section Nom/Preneur
  const nPreneurIdx = text.search(/(?:preneur|titulaire|affilié|Nom\s+(?:Monsieur|Madame))/i)
  const nZone = nPreneurIdx >= 0 ? text.slice(nPreneurIdx, nPreneurIdx + 600) : text
  m = nZone.match(/((?:Rue|Avenue|Chaussée|Boulevard|Place|Allée|Chemin|Chée)[^\n]+)/i)
  if (m) d.address = m[1].trim()
  // Type de produit — "Nom du produit" field
  if (/[ée]pargne[\s-]*pension/i.test(text)) d.contract_type = 'Épargne-pension'
  else if (/eip|engagement\s*individuel/i.test(text)) d.contract_type = 'EIP'
  else if (/plci|pension\s*libre/i.test(text)) d.contract_type = 'PLCI'
  else if (/branche\s*23/i.test(text)) d.contract_type = 'Branche 23'
  else d.contract_type = 'Vie'
  // Fonds — "NN Life Star fund - EUR: 100,00 %"  ou  "Fund Name    XX,XX %"
  d.funds = {}
  const fundPat = /([\wÀ-ÿ][\wÀ-ÿ\s&'°/-]*?(?:\s*-\s*[A-Z]{3})?)\s*[:\-]?\s*(\d{1,3}[.,]\d{2})\s*%/g
  while ((m = fundPat.exec(text)) !== null) {
    let name = m[1].trim()
    const pct = parseFloat(m[2].replace(',', '.'))
    if (/^(page|frais|taxe|prime|total|nom\s*du\s*fonds)/i.test(name)) continue
    if (pct <= 0 || pct > 100) continue
    if (name.length < 3) continue
    d.funds[name] = pct
  }
  d.company = 'NN Insurance'
  return d
}

// ═══════════════════════════════════════════════════════════════════════
// MOTEUR DE PROFIL
// ═══════════════════════════════════════════════════════════════════════

function computeRiskScore(funds) {
  let totalPct = 0, weightedRisk = 0
  for (const [name, pct] of Object.entries(funds)) {
    const key = name.toLowerCase().trim()
    let risk = FUND_RISK[key]
    // Heuristique par mots-clés si fonds inconnu
    if (risk === undefined) {
      if (/branche\s*21|garanti|taux\s*garanti/i.test(key)) risk = 0
      else if (/equity|equities|action|growth|dynamic|technolog/i.test(key)) risk = 80
      else if (/balanced|mixte|multi\s*asset/i.test(key)) risk = 50
      else if (/bond|obligation|defensive|stability|income/i.test(key)) risk = 15
      else if (/infrastructure|real\s*estate|immobil/i.test(key)) risk = 55
      else if (/impact|sustainable|esg/i.test(key)) risk = 60
      else if (/megatrend|thematic/i.test(key)) risk = 75
      else if (/star\s*fund/i.test(key)) risk = 70
      else risk = 50 // défaut modéré
    }
    weightedRisk += risk * pct
    totalPct += pct
  }
  return totalPct > 0 ? weightedRisk / totalPct : 50
}

function riskToProfile(score) {
  if (score < 15) return 'Conservateur'
  if (score < 60) return 'Équilibré / Modéré'
  return 'Dynamique / Risqué'
}

function generateAnswers(contract) {
  const riskScore = computeRiskScore(contract.funds || {})
  const profile = riskToProfile(riskScore)
  const purpose = CONTRACT_PURPOSES[(contract.contract_type || '').toLowerCase()] || 'investissement'
  const answers = {}
  const scoring = { a: 1, b: 2, c: 3 }

  // Q1 Objectif
  if (profile === 'Conservateur') answers[1] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[1] = 'c'
  else answers[1] = purpose === 'pension' ? 'b' : 'b'

  // Q2 Horizon
  if (purpose === 'pension') answers[2] = 'c'
  else if (profile === 'Conservateur') answers[2] = 'a'
  else answers[2] = 'b'

  // Q3 Part patrimoine
  if (profile === 'Conservateur') answers[3] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[3] = 'c'
  else answers[3] = 'b'

  // Q4 Réaction baisse
  if (profile === 'Conservateur') answers[4] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[4] = 'c'
  else answers[4] = 'b'

  // Q5 Expérience (défaut conservateur)
  answers[5] = 'a'

  // Q6 Niveau de risque
  if (profile === 'Conservateur') answers[6] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[6] = 'c'
  else answers[6] = 'b'

  // Q7 Source revenus
  if (contract.professional_status === 'Indépendant') answers[7] = 'c'
  else if (contract.professional_status === 'Salarié') answers[7] = 'a'
  else answers[7] = 'b'

  // Q8 Situation financière (défaut modéré)
  answers[8] = 'b'

  // Q9 Liquidité court terme
  if (purpose === 'pension') answers[9] = 'c'
  else if (profile === 'Conservateur') answers[9] = 'a'
  else answers[9] = 'b'

  // Q10 Réaction fluctuations
  if (profile === 'Conservateur') answers[10] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[10] = 'c'
  else answers[10] = 'b'

  // Q11 Connaissance (défaut faible)
  answers[11] = 'a'

  // Q12 Objectif rendement
  if (profile === 'Conservateur') answers[12] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[12] = 'c'
  else answers[12] = 'b'

  // Q13 Tolérance perte
  if (profile === 'Conservateur') answers[13] = 'a'
  else if (profile === 'Dynamique / Risqué') answers[13] = 'c'
  else answers[13] = 'b'

  // Q14 Diversification (défaut faible)
  answers[14] = 'a'

  // Score
  let score = 0
  for (const [, v] of Object.entries(answers)) score += scoring[v]

  // Cohérence : ajuster si le score tombe hors de la fourchette du profil
  const profileRanges = {
    'Conservateur': [14, 23],
    'Équilibré / Modéré': [24, 33],
    'Dynamique / Risqué': [34, 42],
  }
  const [lo, hi] = profileRanges[profile]
  const hypotheticals = [5, 8, 11, 14]
  let attempts = 0
  while (score < lo && attempts < 10) {
    for (const q of hypotheticals) {
      if (score >= lo) break
      if (answers[q] === 'a') { answers[q] = 'b'; score += 1 }
      else if (answers[q] === 'b') { answers[q] = 'c'; score += 1 }
    }
    attempts++
  }
  while (score > hi && attempts < 20) {
    for (const q of [...hypotheticals].reverse()) {
      if (score <= hi) break
      if (answers[q] === 'c') { answers[q] = 'b'; score -= 1 }
      else if (answers[q] === 'b') { answers[q] = 'a'; score -= 1 }
    }
    attempts++
  }

  return { answers, score, profile, riskScore }
}

// ═══════════════════════════════════════════════════════════════════════
// GÉNÉRATION PDF
// ═══════════════════════════════════════════════════════════════════════

function buildPDF(contract, result) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = 210, mL = 25, mR = 25, cW = w - mL - mR
  let y = 18

  const DARK = [44, 62, 80]
  const BLUE = [26, 58, 107]

  // Logo Dynassur (base64 PNG 77x80)
  const LOGO_B64 = 'data:image/png;base64,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'

  // En-tête avec logo
  try { doc.addImage(LOGO_B64, 'PNG', mL, y - 4, 12, 12.5) } catch(e) {}
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text('Dynassur', mL + 15, y + 2)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text('Chaussée de Tongres 489  4450 Juprelle', mL, y)
  y += 4
  doc.text('Tel : 04/278.15.50  |  E-mail : info@dynassur.be  |  www.dynassur.be', mL, y)
  y += 8

  // Titre
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...DARK)
  doc.text('Questionnaire Profil Investisseur', w / 2, y, { align: 'center' })
  y += 6
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.7)
  doc.line(mL, y, w - mR, y)
  y += 7

  // Informations personnelles
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Informations personnelles', mL, y)
  y += 7

  const infoFields = [
    ['Nom', contract.last_name || ''],
    ['Prénom', contract.first_name || ''],
    ['Date de naissance', contract.birth_date || ''],
    ['Adresse', contract.address || ''],
  ]
  for (const [label, value] of infoFields) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text(`${label} :`, mL, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, mL + 40, y)
    y += 5.5
  }
  y += 3

  // Fonds & profil (sans n° contrat ni compagnie)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(85)
  const fundsStr = Object.entries(contract.funds || {}).map(([n, p]) => `${n}: ${p}%`).join('  |  ')
  if (fundsStr) { doc.text(`Fonds : ${fundsStr}`, mL, y); y += 4 }
  doc.text(`Profil déduit : ${result.profile}  (score : ${result.score}/42)`, mL, y)
  y += 8

  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.line(mL, y, w - mR, y)
  y += 6

  // Questions
  const drawQuestions = (startIdx, endIdx) => {
    for (let i = startIdx; i <= endIdx; i++) {
      const q = QUESTIONS[i]
      const selected = result.answers[q.n] || ''

      // Vérifier saut de page
      if (y > 265) { doc.addPage(); y = 18 }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...DARK)
      doc.text(`${q.n}. ${q.text}`, mL, y)
      y += 6

      for (const [letter, text] of Object.entries(q.opts)) {
        const isSel = letter === selected
        const boxX = mL + 3, boxY = y - 3, boxS = 3.5

        if (isSel) {
          doc.setFillColor(...BLUE)
          doc.rect(boxX, boxY, boxS, boxS, 'F')
          doc.setDrawColor(255, 255, 255)
          doc.setLineWidth(0.5)
          doc.line(boxX + 0.8, boxY + 1.8, boxX + 1.5, boxY + 2.7)
          doc.line(boxX + 1.5, boxY + 2.7, boxX + 2.8, boxY + 0.8)
        } else {
          doc.setDrawColor(200)
          doc.setLineWidth(0.3)
          doc.rect(boxX, boxY, boxS, boxS, 'S')
        }

        doc.setFont('helvetica', isSel ? 'bold' : 'normal')
        doc.setFontSize(9)
        doc.setTextColor(isSel ? 0 : 85)
        doc.text(`${letter}) ${text}`, mL + 10, y)
        y += 4.5
      }
      y += 3
    }
  }

  drawQuestions(0, 6)
  doc.addPage()
  y = 18
  drawQuestions(7, 13)

  y += 8

  // Encadré score
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.7)
  doc.roundedRect(mL, y, cW, 28, 3, 3, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text(`Score total : ${result.score} / 42`, mL + 5, y + 8)
  doc.setFontSize(14)
  doc.setTextColor(...BLUE)
  doc.text(`Profil : ${result.profile}`, mL + 5, y + 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(136)
  doc.text('14-23 : Conservateur  |  24-33 : Équilibré / Modéré  |  34-42 : Dynamique / Risqué', mL + 5, y + 24)

  y += 36

  // Mention légale
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(153)
  const legal = "Ce questionnaire a été conçu conformément aux exigences de la FSMA (Autorité des services et marchés financiers) en Belgique pour l'évaluation du profil investisseur. Il vise à mieux comprendre votre tolérance au risque, vos objectifs et votre expérience afin de vous proposer des conseils d'investissement adaptés. Les informations recueillies seront traitées dans le respect de la réglementation en vigueur sur la protection des données (RGPD)."
  const lines = doc.splitTextToSize(legal, cW)
  doc.text(lines, mL, y)
  y += lines.length * 3.5 + 8

  // Signature
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.text('Signature du client', mL, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(`Nom et prénom : ${contract.last_name || ''} ${contract.first_name || ''}`, mL, y)
  y += 6
  doc.text('Date : ____________________', mL, y)
  y += 6
  doc.text('Signature : ____________________', mL, y)

  // Pied de page
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(170)
  doc.text('Document généré automatiquement à partir des données contractuelles — à valider par le client', w / 2, 287, { align: 'center' })

  return doc
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSANT REACT
// ═══════════════════════════════════════════════════════════════════════

export default function ToolQuestionnaire() {
  const [step, setStep] = useState('upload') // upload | review | done
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [contract, setContract] = useState(null)
  const [result, setResult] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)
  const fileRef = useRef()

  async function extractText(file) {
    const buf = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(it => it.str).join(' ') + '\n'
    }
    return text
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const text = await extractText(file)
      const company = detectCompany(text)
      let parsed
      switch (company) {
        case 'baloise': parsed = parseBaloise(text); break
        case 'nn': parsed = parseNN(text); break
        case 'ag': parsed = parseAG(text); break
        default:
          // Tenter AG par défaut, si rien ne matche
          parsed = parseAG(text)
          if (!parsed.contract_number && !Object.keys(parsed.funds).length) {
            throw new Error("Compagnie non reconnue. Compagnies supportées : AG Insurance, Baloise, NN Insurance. Vérifiez que le PDF est bien un contrat Vie avec répartition des fonds.")
          }
      }
      if (!Object.keys(parsed.funds || {}).length) {
        throw new Error("Aucun fonds détecté dans le PDF. Vérifiez que c'est bien un relevé de contrat Vie avec répartition des fonds (pas une assurance solde restant dû, décès, ou hospitalisation).")
      }
      setContract(parsed)
      const res = generateAnswers(parsed)
      setResult(res)
      setStep('review')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleGenerate() {
    const doc = buildPDF(contract, result)
    const blob = doc.output('blob')
    setPdfBlob(blob)
    setStep('done')
  }

  function handleDownload() {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Questionnaire_${contract.last_name || 'Client'}_${contract.first_name || ''}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    setStep('upload')
    setContract(null)
    setResult(null)
    setPdfBlob(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const cardStyle = {
    border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px',
    background: '#fff', marginBottom: 14,
  }
  const btnPrimary = {
    background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
  const btnSecondary = {
    background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }

  return (
    <Layout currentPage="Questionnaire Profil">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%', maxWidth: 720 }}>
        <div style={{ marginBottom: 6 }}>
          <Link to="/tools" style={{ fontSize: 12.5, color: '#64748b', textDecoration: 'none' }}>← Outils</Link>
        </div>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>Questionnaire Profil Investisseur</h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>Reconstitution automatique du profil à partir d'un contrat Vie</div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ÉTAPE 1 : Upload */}
        {step === 'upload' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              1. Importer le PDF du contrat
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 1.5 }}>
              Importez le relevé PDF du contrat Vie (AG Insurance, Baloise, NN Insurance).
              Le système analyse les fonds, déduit le profil de risque et remplit automatiquement les 14 questions.
            </div>
            <div style={{
              border: '2px dashed #cbd5e1', borderRadius: 10, padding: '30px 20px', textAlign: 'center',
              background: '#f8fafc', cursor: loading ? 'wait' : 'pointer',
            }}
              onClick={() => !loading && fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
              {loading ? (
                <div style={{ color: '#64748b', fontSize: 14 }}>Analyse en cours...</div>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>
                    <i className="ti ti-file-upload" style={{ color: '#94a3b8' }} />
                  </div>
                  <div style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Cliquez ou glissez un PDF ici</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>AG Insurance • Baloise • NN Insurance</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Review */}
        {step === 'review' && contract && result && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                2. Données extraites
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 13, color: '#334155' }}>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Compagnie :</span> {contract.company}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Contrat :</span> {contract.contract_number}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Nom :</span> {contract.last_name}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Prénom :</span> {contract.first_name}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Type :</span> {contract.contract_type}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Naissance :</span> {contract.birth_date || '—'}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Fonds :</span>{' '}
                {Object.entries(contract.funds).map(([n, p]) => `${n} (${p}%)`).join(', ')}
              </div>
            </div>

            <div style={{
              ...cardStyle,
              border: '2px solid #1abc9c', background: 'linear-gradient(135deg, #f0fdfa 0%, #fff 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#1abc9c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16,
                }}>
                  {result.score}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{result.profile}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Score {result.score}/42 — Risk score fonds : {result.riskScore.toFixed(0)}/100</div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                3. Réponses générées (14 questions)
              </div>
              {QUESTIONS.map((q, i) => {
                const sel = result.answers[q.n]
                return (
                  <div key={q.n} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Q{q.n}. {q.text}</div>
                    <div style={{ fontSize: 12, color: '#1abc9c', fontWeight: 600, marginTop: 2 }}>
                      → {sel}) {q.opts[sel]}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button style={btnPrimary} onClick={handleGenerate}>
                Générer le PDF
              </button>
              <button style={btnSecondary} onClick={handleReset}>
                Recommencer
              </button>
            </div>
          </>
        )}

        {/* ÉTAPE 3 : Done */}
        {step === 'done' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
              PDF généré avec succès
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Le questionnaire pré-rempli est prêt. Téléchargez-le et faites-le signer par le client.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btnPrimary} onClick={handleDownload}>
                Télécharger le PDF
              </button>
              <button style={btnSecondary} onClick={handleReset}>
                Nouveau contrat
              </button>
            </div>
          </div>
        )}

        {/* Info compagnies */}
        <div style={{
          marginTop: 20, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, fontSize: 12, color: '#166534', lineHeight: 1.5,
        }}>
          <strong>Compagnies supportées :</strong> AG Insurance, Baloise, NN Insurance.
          <br />Les fonds inconnus sont classés automatiquement par mots-clés (equity, balanced, defensive, etc.).
          <br /><span style={{ color: '#92400e' }}>En cours : AXA, Allianz.</span>
        </div>
      </div>
    </Layout>
  )
}
