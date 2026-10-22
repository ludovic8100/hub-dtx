import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'
import Tesseract from 'tesseract.js'

// Configure pdf.js worker via Vite ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// ═══════════════════════════════════════════════════════════════════════
// FUND RISK DATABASE — ajouter les fonds par compagnie ici
// ═══════════════════════════════════════════════════════════════════════
const FUND_RISK = {
  // AG Insurance
  'pension life': 0, 'ag life stability': 10, 'ag life income': 15,
  'ag life balanced': 50, 'ag life growth': 75, 'ag life dynamic': 85,
  'ag life equities': 90, 'top rendement': 5, 'capital branch 21': 0,
  // Baloise
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
  // NN
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

// ═══════════════════════════════════════════════════════════════════════
// QUESTIONS (14 questions FSMA)
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

const SCORING = { a: 1, b: 2, c: 3 }

// ═══════════════════════════════════════════════════════════════════════
// MOTEUR DE PROFIL — basé sur les fonds d'investissement
// ═══════════════════════════════════════════════════════════════════════

function computeRiskScore(funds) {
  let totalPct = 0, weightedRisk = 0
  for (const [name, pct] of Object.entries(funds)) {
    const key = name.toLowerCase().trim()
    let risk = FUND_RISK[key]
    if (risk === undefined) {
      if (/branche\s*21|garanti|taux\s*garanti/i.test(key)) risk = 0
      else if (/equity|equities|action|growth|dynamic|technolog/i.test(key)) risk = 80
      else if (/balanced|mixte|multi\s*asset/i.test(key)) risk = 50
      else if (/bond|obligation|defensive|stability|income/i.test(key)) risk = 15
      else if (/infrastructure|real\s*estate|immobil/i.test(key)) risk = 55
      else if (/impact|sustainable|esg/i.test(key)) risk = 60
      else if (/megatrend|thematic/i.test(key)) risk = 75
      else if (/star\s*fund/i.test(key)) risk = 70
      else risk = 50
    }
    weightedRisk += risk * pct
    totalPct += pct
  }
  return totalPct > 0 ? weightedRisk / totalPct : 50
}

function riskToProfile(score) {
  if (score < 10) return 'Défensif'
  if (score < 30) return 'Conservateur'
  if (score < 55) return 'Neutre / Équilibré'
  if (score < 75) return 'Dynamique'
  return 'Offensif'
}

function generateAnswers(profile, riskScore, purpose) {
  const answers = {}
  const isDefensif = profile === 'Défensif'
  const isConservateur = profile === 'Conservateur'
  const isNeutre = profile === 'Neutre / Équilibré'
  const isDynamique = profile === 'Dynamique'
  const isOffensif = profile === 'Offensif'
  const isLowRisk = isDefensif || isConservateur
  const isHighRisk = isDynamique || isOffensif

  // Q1 Objectif
  if (isLowRisk) answers[1] = 'a'
  else if (isHighRisk) answers[1] = 'c'
  else answers[1] = 'b'

  // Q2 Horizon
  if (purpose === 'pension') answers[2] = 'c'
  else if (isLowRisk) answers[2] = 'a'
  else if (isHighRisk) answers[2] = 'c'
  else answers[2] = 'b'

  // Q3 Part patrimoine — immobilier toujours < 10%
  answers[3] = 'a'

  // Q4 Réaction baisse
  if (isLowRisk) answers[4] = 'a'
  else if (isHighRisk) answers[4] = 'c'
  else answers[4] = 'b'

  // Q5 Expérience
  if (isOffensif) answers[5] = 'c'
  else if (isDynamique) answers[5] = 'b'
  else answers[5] = 'a'

  // Q6 Niveau de risque
  if (isLowRisk) answers[6] = 'a'
  else if (isHighRisk) answers[6] = 'c'
  else answers[6] = 'b'

  // Q7 Source revenus
  answers[7] = 'b'

  // Q8 Situation financière
  if (isOffensif) answers[8] = 'c'
  else answers[8] = 'b'

  // Q9 Liquidité court terme
  if (purpose === 'pension') answers[9] = 'c'
  else if (isLowRisk) answers[9] = 'a'
  else if (isHighRisk) answers[9] = 'c'
  else answers[9] = 'b'

  // Q10 Réaction fluctuations
  if (isLowRisk) answers[10] = 'a'
  else if (isHighRisk) answers[10] = 'c'
  else answers[10] = 'b'

  // Q11 Connaissance
  if (isOffensif) answers[11] = 'c'
  else if (isDynamique) answers[11] = 'b'
  else answers[11] = 'a'

  // Q12 Objectif rendement
  if (isLowRisk) answers[12] = 'a'
  else if (isHighRisk) answers[12] = 'c'
  else answers[12] = 'b'

  // Q13 Tolérance perte
  if (isDefensif) answers[13] = 'a'
  else if (isConservateur) answers[13] = 'a'
  else if (isOffensif) answers[13] = 'c'
  else if (isDynamique) answers[13] = 'c'
  else answers[13] = 'b'

  // Q14 Diversification
  if (isHighRisk) answers[14] = 'c'
  else if (isNeutre) answers[14] = 'b'
  else answers[14] = 'a'

  // Ajuster pour cohérence score/profil (5 profils FSMA)
  let score = 0
  for (const v of Object.values(answers)) score += SCORING[v]

  const profileRanges = {
    'Défensif': [14, 19],
    'Conservateur': [20, 25],
    'Neutre / Équilibré': [26, 31],
    'Dynamique': [32, 37],
    'Offensif': [38, 42],
  }
  const [lo, hi] = profileRanges[profile]
  const hypotheticals = [5, 7, 8, 11, 14]
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

function calcScore(answers) {
  let s = 0
  for (let i = 1; i <= 14; i++) s += SCORING[answers[i]] || 0
  return s
}

function scoreToProfile(score) {
  if (score <= 19) return 'Défensif'
  if (score <= 25) return 'Conservateur'
  if (score <= 31) return 'Neutre / Équilibré'
  if (score <= 37) return 'Dynamique'
  return 'Offensif'
}

// ═══════════════════════════════════════════════════════════════════════
// PURPOSE helper from type_production
// ═══════════════════════════════════════════════════════════════════════
function purposeFromType(typeProd) {
  if (!typeProd) return 'investissement'
  const t = typeProd.toLowerCase()
  if (t.includes('pension') || t.includes('engagement') || t.includes('dirigeant') || t.includes('groupe')) return 'pension'
  if (t.includes('branche 21') && !t.includes('multiple')) return 'epargne'
  return 'investissement'
}

// ═══════════════════════════════════════════════════════════════════════
// PDF TEXT EXTRACTION — extract funds, dates from proposition PDF
// ═══════════════════════════════════════════════════════════════════════

async function extractTextFromPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += pageText + '\n'
  }

  // If pdfjs extracted meaningful text, return it
  if (fullText.trim().length > 50) {
    console.log('[PDF] Text extracted via pdfjs-dist:', fullText.length, 'chars')
    return fullText
  }

  // Fallback: OCR via Tesseract.js (for PDFs with text rendered as vector paths)
  console.log('[PDF] pdfjs-dist returned empty text — falling back to OCR...')
  if (onProgress) onProgress('OCR en cours... (peut prendre 30-60 secondes)')

  let ocrText = ''
  const scale = 2.0 // 2x resolution for better OCR
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(`OCR page ${i}/${pdf.numPages}...`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise

    const { data: { text } } = await Tesseract.recognize(canvas, 'fra', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(`OCR page ${i}/${pdf.numPages}... ${Math.round((m.progress || 0) * 100)}%`)
        }
      }
    })
    ocrText += text + '\n'
    console.log(`[OCR] Page ${i}:`, text.substring(0, 200))
  }

  console.log('[PDF] OCR total text:', ocrText.length, 'chars')
  return ocrText
}

/**
 * Parse funds from AG Insurance PDF format.
 * Looks for "REPARTITION ACTUELLE DES PARTICIPATIONS BENEFICIAIRES"
 * then lines like "Pension Life 50,00" / "AG Life Balanced 50,00"
 */
function parseFundsAG(text) {
  const funds = {}

  // AG pattern: fund name followed by percentage (with comma decimal)
  // Look after REPARTITION section
  const repartitionIdx = text.search(/REPARTITION\s*(ACTUELLE)?\s*(DES)?\s*PARTICIPATIONS/i)
  const searchText = repartitionIdx >= 0 ? text.substring(repartitionIdx) : text

  // Match patterns like "Pension Life 50,00" or "AG Life Balanced 50,00"
  // Also handles "Fonds Pourcentage" table format
  const fundPattern = /([A-Z][A-Za-zÀ-ÿ\s\-'.()]+?)\s+(\d{1,3}[.,]\d{2})\s*%?\s/g
  let match
  while ((match = fundPattern.exec(searchText)) !== null) {
    let name = match[1].trim()
    const pct = parseFloat(match[2].replace(',', '.'))

    // Skip headers and non-fund lines
    if (/^(Fonds|Pourcentage|Total|Nom|Date|Prime|Montant|Répartition|REPARTITION)/i.test(name)) continue
    if (pct <= 0 || pct > 100) continue
    if (name.length < 3) continue

    funds[name] = pct
  }

  return funds
}

/**
 * Parse funds from Baloise PDF format.
 * Baloise PDFs often concatenate words: "Stratégied'investissement"
 * Funds appear as "Compte Branche 21-0% 100,00%" or "BFI Positive Impact Select 100,00%"
 */
function parseFundsBaloise(text) {
  const funds = {}

  // Look for investment strategy section (handles concatenated text)
  const stratIdx = text.search(/Strat[ée]gie\s*d['']?\s*investissement/i)
  const partIdx = text.search(/Participation\s*aux\s*b[ée]n[ée]fices/i)

  // Search in both sections
  const sections = []
  if (stratIdx >= 0) sections.push(text.substring(stratIdx, stratIdx + 2000))
  if (partIdx >= 0) sections.push(text.substring(partIdx, partIdx + 2000))
  if (sections.length === 0) sections.push(text)

  for (const section of sections) {
    // Match fund name + percentage pattern (handles OCR spacing)
    const fundPattern = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-'.()0-9&]+?)\s+(\d{1,3}[.,]\d{2})\s*%/g
    let match
    while ((match = fundPattern.exec(section)) !== null) {
      let name = match[1].trim()
      const pct = parseFloat(match[2].replace(',', '.'))

      // Clean up Baloise concatenation artifacts and OCR noise
      name = name.replace(/^\s*[-–—]\s*/, '')
      name = name.replace(/\s+/g, ' ').trim()

      // Skip headers and non-fund lines
      if (/^(Fonds|Total|Nom|Date|Prime|Montant|Strat|Participation|Forme|Garantie|Constitution|Taxe)/i.test(name)) continue
      if (pct <= 0 || pct > 100) continue
      if (name.length < 3) continue

      funds[name] = pct
    }
  }

  return funds
}

/**
 * Generic fund parser — tries both AG and Baloise patterns
 */
function parseFundsGeneric(text) {
  const agFunds = parseFundsAG(text)
  const baloiseFunds = parseFundsBaloise(text)

  // Merge — prefer whichever found more funds
  if (Object.keys(agFunds).length >= Object.keys(baloiseFunds).length && Object.keys(agFunds).length > 0) {
    return agFunds
  }
  if (Object.keys(baloiseFunds).length > 0) {
    return baloiseFunds
  }

  // Fallback: try very generic pattern — any "word(s) NUMBER%"
  const funds = {}
  const genericPattern = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-'.()]+?)\s+(\d{1,3}[.,]\d{2})\s*%/g
  let match
  while ((match = genericPattern.exec(text)) !== null) {
    const name = match[1].trim()
    const pct = parseFloat(match[2].replace(',', '.'))
    if (pct > 0 && pct <= 100 && name.length >= 3 && !/^(Total|Date|Prime|Montant|Nom)/i.test(name)) {
      funds[name] = pct
    }
  }
  return funds
}

/**
 * Extract dates from PDF text
 * AG: "Date Début 01/03/2020", "Date Fin 01/02/2043"
 * Baloise: "Date prise d'effet 01/06/2021", "Date terme 01/02/2045"
 * Generic: DD/MM/YYYY patterns
 */
function extractDates(text) {
  let dateDebut = null
  let dateFin = null

  // AG format
  const agDebut = text.match(/Date\s*D[ée]but\s*[:.]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
  const agFin = text.match(/Date\s*Fin\s*[:.]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
  if (agDebut) dateDebut = agDebut[1]
  if (agFin) dateFin = agFin[1]

  // Baloise format (also handles OCR variations)
  if (!dateDebut) {
    const balDebut = text.match(/Date\s*(?:de\s*)?prise\s*d[''’]?\s*effet\s*[:.;]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    if (balDebut) dateDebut = balDebut[1]
  }
  if (!dateFin) {
    const balFin = text.match(/Date\s*(?:du?\s*)?terme\s*[:.;]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    if (balFin) dateFin = balFin[1]
  }
  // Baloise "Echéance principale" format
  if (!dateFin) {
    const balEch = text.match(/[ÉéEe]ch[ée]ance\s*principale\s*[:.;]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    if (balEch) dateFin = balEch[1]
  }

  // Generic: "date d'effet" / "date d'échéance" / "échéance"
  if (!dateDebut) {
    const genDebut = text.match(/(?:date\s*d['']?\s*effet|date\s*effet|prise\s*d['']?\s*effet)\s*[:.]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    if (genDebut) dateDebut = genDebut[1]
  }
  if (!dateFin) {
    const genFin = text.match(/(?:date\s*d['']?\s*[ée]ch[ée]ance|[ée]ch[ée]ance|date\s*fin|terme)\s*[:.]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})/i)
    if (genFin) dateFin = genFin[1]
  }

  return { dateDebut, dateFin }
}

/**
 * Parse a DD/MM/YYYY date string to a Date object
 */
function parseDateDMY(str) {
  if (!str) return null
  const parts = str.split(/[/.-]/)
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const year = parseInt(parts[2], 10)
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  return new Date(year, month, day)
}

/**
 * Calculate horizon in years between two dates
 */
function calcHorizonYears(dateDebut, dateFin) {
  const d1 = parseDateDMY(dateDebut)
  const d2 = parseDateDMY(dateFin)
  if (!d1 || !d2) return null
  const diffMs = d2 - d1
  return Math.round(diffMs / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10
}

/**
 * Horizon category for Q2 auto-answer
 */
function horizonCategory(years) {
  if (years === null) return null
  if (years < 3) return 'short'    // < 3 ans
  if (years <= 7) return 'medium'  // 3-7 ans
  return 'long'                     // > 7 ans
}


// ═══════════════════════════════════════════════════════════════════════
// GÉNÉRATION PDF
// ═══════════════════════════════════════════════════════════════════════

function buildPDF(clientInfo, contrat, answers, score, profile, funds, pdfDates, horizonYears) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = 210, mL = 25, mR = 25, cW = w - mL - mR
  let y = 18

  const DARK = [44, 62, 80]
  const BLUE = [26, 58, 107]

  // Logo Dynassur (base64 PNG)
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

  const address = [clientInfo.rue, clientInfo.num_maison, clientInfo.boite].filter(Boolean).join(' ')
  const codePostal = [clientInfo.cp, clientInfo.localite].filter(Boolean).join(' ')
  const fullAddress = [address, codePostal].filter(Boolean).join(', ')

  const infoFields = [
    ['Nom', clientInfo.nom || ''],
    ['Prénom', clientInfo.prenom || ''],
    ['Date de naissance', clientInfo.date_naissance || ''],
    ['Adresse', fullAddress],
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

  // Contrat info + dates + horizon
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(85)
  if (contrat) {
    doc.text(`Compagnie : ${contrat.compagnie || '—'}  |  Type : ${contrat.type_production || '—'}  |  Police : ${contrat.police || '—'}`, mL, y)
    y += 4
  }
  if (pdfDates?.dateDebut || pdfDates?.dateFin) {
    const dateStr = `Date d'effet : ${pdfDates.dateDebut || '—'}  |  Date de fin : ${pdfDates.dateFin || '—'}`
    doc.text(dateStr, mL, y)
    y += 4
  }
  if (horizonYears !== null && horizonYears !== undefined) {
    doc.text(`Horizon de placement : ${horizonYears} ans`, mL, y)
    y += 4
  }
  if (funds && Object.keys(funds).length > 0) {
    const fundsStr = Object.entries(funds).map(([n, p]) => `${n}: ${p}%`).join('  |  ')
    const fundsLines = doc.splitTextToSize(`Fonds : ${fundsStr}`, cW)
    doc.text(fundsLines, mL, y)
    y += fundsLines.length * 3.5
    y += 1
  }
  doc.text(`Profil : ${profile}  (score : ${score}/42)`, mL, y)
  y += 8

  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.line(mL, y, w - mR, y)
  y += 6

  // Questions
  const drawQuestions = (startIdx, endIdx) => {
    for (let i = startIdx; i <= endIdx; i++) {
      const q = QUESTIONS[i]
      const selected = answers[q.n] || ''
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
  doc.text(`Score total : ${score} / 42`, mL + 5, y + 8)
  doc.setFontSize(14)
  doc.setTextColor(...BLUE)
  doc.text(`Profil : ${profile}`, mL + 5, y + 17)
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
  doc.text(`Nom et prénom : ${clientInfo.nom || ''} ${clientInfo.prenom || ''}`, mL, y)
  y += 6
  doc.text('Date : ____________________', mL, y)
  y += 6
  doc.text('Signature : ____________________', mL, y)

  // Pied de page
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(170)
  doc.text('Document généré automatiquement — à valider par le client', w / 2, 287, { align: 'center' })

  return doc
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSANT REACT — ARCHITECTURE DB + PDF HYBRIDE
// Steps: search → select → upload → questionnaire → done
// ═══════════════════════════════════════════════════════════════════════

export default function ToolQuestionnaire() {
  const [step, setStep] = useState('search')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [contrats, setContrats] = useState([])
  const [selectedContrat, setSelectedContrat] = useState(null)
  const [loadingContrats, setLoadingContrats] = useState(false)

  // PDF extraction state
  const [pdfFile, setPdfFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [extractionWarning, setExtractionWarning] = useState(null)
  const [pdfDates, setPdfDates] = useState({ dateDebut: null, dateFin: null })
  const [horizonYears, setHorizonYears] = useState(null)

  // Manual fund entry state (fallback for scanned PDFs)
  const [manualMode, setManualMode] = useState(false)
  const [manualFunds, setManualFunds] = useState([{ name: '', pct: '' }])

  // Questionnaire state
  const [answers, setAnswers] = useState({})
  const [funds, setFunds] = useState({})
  const [pdfBlob, setPdfBlob] = useState(null)
  const [error, setError] = useState(null)
  const searchTimeout = useRef(null)

  // Computed score & profile
  const score = calcScore(answers)
  const profile = scoreToProfile(score)

  // ─── Search clients ───
  const searchClients = useCallback(async (term) => {
    if (term.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const { data, error: err } = await supabase
        .from('clients')
        .select('id,dossier,nom,prenom,date_naissance,rue,num_maison,boite,cp,localite,email,gsm')
        .or(`nom.ilike.%${term}%,prenom.ilike.%${term}%,dossier.ilike.%${term}%`)
        .not('dossier', 'is', null)
        .order('nom')
        .limit(15)
      if (err) throw err
      setSearchResults(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchClients(searchTerm), 300)
    return () => clearTimeout(searchTimeout.current)
  }, [searchTerm, searchClients])

  // ─── Load contrats for selected client ───
  async function selectClient(client) {
    setSelectedClient(client)
    setSelectedContrat(null)
    setFunds({})
    setPdfFile(null)
    setExtractedText('')
    setExtractionWarning(null)
    setPdfDates({ dateDebut: null, dateFin: null })
    setHorizonYears(null)
    setManualMode(false)
    setAnswers({})
    setError(null)
    setLoadingContrats(true)
    try {
      const { data, error: err } = await supabase
        .from('contrats')
        .select('id,police,compagnie,type_production,domaine,situation,date_creation,garantie_valeur,version')
        .eq('dossier', client.dossier)
        .in('domaine', ['Vie et placements', 'Vie'])
        .order('date_creation', { ascending: false })
      if (err) throw err
      setContrats(data || [])
      if ((data || []).length === 0) {
        setError('Aucun contrat Vie trouvé pour ce client.')
      }
      setStep('select')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingContrats(false)
    }
  }

  // ─── Select contrat → go to upload step ───
  function selectContrat(contrat) {
    // Vérifier que le contrat appartient au client sélectionné
    if (selectedClient && contrat.dossier && contrat.dossier !== selectedClient.dossier) {
      setError(`Ce contrat (dossier ${contrat.dossier}) n'appartient pas au client ${selectedClient.nom} ${selectedClient.prenom} (dossier ${selectedClient.dossier}).`)
      return
    }
    setSelectedContrat(contrat)
    setError(null)
    setPdfFile(null)
    setExtractedText('')
    setExtractionWarning(null)
    setManualMode(false)
    setManualFunds([{ name: '', pct: '' }])
    setFunds({})
    setPdfDates({ dateDebut: null, dateFin: null })
    setHorizonYears(null)
    setStep('upload')
  }

  // ─── Handle PDF upload and extraction ───
  async function handlePdfUpload(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Veuillez sélectionner un fichier PDF.')
      return
    }
    setPdfFile(file)
    setExtracting(true)
    setError(null)
    setExtractionWarning(null)

    try {
      setExtractionProgress('Extraction du texte...')
      const text = await extractTextFromPDF(file, setExtractionProgress)
      setExtractionProgress('')
      console.log('=== PDF RAW TEXT ===')
      console.log(text)
      setExtractedText(text)

      if (text.trim().length < 50) {
        // Scanned PDF — no usable text
        setExtractionWarning('Ce PDF semble être un document scanné (image). Le texte n\'a pas pu être extrait automatiquement. Veuillez encoder les fonds manuellement ci-dessous.')
        setManualMode(true)
        setExtracting(false)
        return
      }

      // Extract funds
      const extractedFunds = parseFundsGeneric(text)
      console.log('=== EXTRACTED FUNDS ===', extractedFunds)

      if (Object.keys(extractedFunds).length === 0) {
        // Text found but no funds detected — could be pure Branche 21
        const isBr21 = /branche\s*21|taux\s*garanti|rendement\s*garanti/i.test(text)
        if (isBr21) {
          setFunds({ 'Branche 21 (taux garanti)': 100 })
          setExtractionWarning('Document Branche 21 détecté — aucun fonds d\'investissement. Profil défensif par défaut.')
        } else {
          setExtractionWarning('Aucun fonds d\'investissement détecté dans le PDF. Vous pouvez encoder les fonds manuellement.')
          setManualMode(true)
        }
      } else {
        setFunds(extractedFunds)
      }

      // Extract dates
      const dates = extractDates(text)
      console.log('=== EXTRACTED DATES ===', dates)
      setPdfDates(dates)

      // Calculate horizon
      if (dates.dateDebut && dates.dateFin) {
        const horizon = calcHorizonYears(dates.dateDebut, dates.dateFin)
        setHorizonYears(horizon)
      }
    } catch (e) {
      setError(`Erreur lors de l'extraction du PDF : ${e.message}`)
      setManualMode(true)
    } finally {
      setExtracting(false)
    }
  }

  // ─── Apply manual funds ───
  function applyManualFunds() {
    const parsed = {}
    for (const f of manualFunds) {
      const name = f.name.trim()
      const pct = parseFloat(f.pct)
      if (name && !isNaN(pct) && pct > 0) {
        parsed[name] = pct
      }
    }
    if (Object.keys(parsed).length === 0) {
      setError('Veuillez ajouter au moins un fonds avec un pourcentage valide.')
      return
    }
    setFunds(parsed)
    setManualMode(false)
    setError(null)
  }

  // ─── Proceed from upload to questionnaire ───
  function proceedToQuestionnaire() {
    // Vérification de cohérence client ↔ contrat
    if (selectedClient && selectedContrat && selectedContrat.dossier && selectedContrat.dossier !== selectedClient.dossier) {
      setError(`Incohérence : le contrat sélectionné (dossier ${selectedContrat.dossier}) ne correspond pas au client ${selectedClient.nom} (dossier ${selectedClient.dossier}). Veuillez recommencer.`)
      return
    }
    if (Object.keys(funds).length === 0 && !manualMode) {
      setError('Veuillez d\'abord uploader un PDF ou encoder les fonds manuellement.')
      return
    }

    // Compute risk profile from actual funds
    const riskScore = computeRiskScore(funds)
    const autoProfile = riskToProfile(riskScore)
    const purpose = purposeFromType(selectedContrat?.type_production)

    // Generate answers — use horizon from PDF if available
    const result = generateAnswers(autoProfile, riskScore, purpose)

    // Override Q2 (horizon) based on actual dates from PDF
    if (horizonYears !== null) {
      const hCat = horizonCategory(horizonYears)
      if (hCat === 'short') result.answers[2] = 'a'
      else if (hCat === 'medium') result.answers[2] = 'b'
      else result.answers[2] = 'c'
    }

    setAnswers(result.answers)
    setError(null)
    setStep('questionnaire')
  }

  // ─── Answer change handler ───
  function handleAnswerChange(qn, letter) {
    setAnswers(prev => ({ ...prev, [qn]: letter }))
  }

  // ─── Generate PDF ───
  function handleGenerate() {
    const doc = buildPDF(selectedClient, selectedContrat, answers, score, profile, funds, pdfDates, horizonYears)
    const blob = doc.output('blob')
    setPdfBlob(blob)
    setStep('done')
  }

  function handleDownload() {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Questionnaire_${selectedClient?.nom || 'Client'}_${selectedClient?.prenom || ''}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    setStep('search')
    setSearchTerm('')
    setSearchResults([])
    setSelectedClient(null)
    setContrats([])
    setSelectedContrat(null)
    setPdfFile(null)
    setExtractedText('')
    setExtractionWarning(null)
    setManualMode(false)
    setManualFunds([{ name: '', pct: '' }])
    setAnswers({})
    setFunds({})
    setPdfDates({ dateDebut: null, dateFin: null })
    setHorizonYears(null)
    setPdfBlob(null)
    setError(null)
  }

  // ─── Styles ───
  const cardStyle = {
    border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px',
    background: '#fff', marginBottom: 14,
  }
  const btnPrimary = {
    background: '#1A3A6B', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  }
  const btnSecondary = {
    background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  }
  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 14, border: '1px solid #cbd5e1',
    borderRadius: 8, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <Layout currentPage="Questionnaire Profil">
      <div style={{ fontFamily: "'Segoe UI', sans-serif", width: '100%', maxWidth: 760 }}>
        <div style={{ marginBottom: 6 }}>
          <Link to="/tools" style={{ fontSize: 12.5, color: '#64748b', textDecoration: 'none' }}>← Outils</Link>
        </div>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>Questionnaire Profil Investisseur</h1>
          <div style={{ fontSize: 14, color: '#8A9BBE', marginTop: 2 }}>Recherchez un client, sélectionnez un contrat Vie, uploadez la proposition, remplissez le questionnaire</div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 14, color: '#991b1b', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* ═══ STEP 1: Search client ═══ */}
        {step === 'search' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
              1. Rechercher un client
            </div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
              Tapez le nom, prénom ou n° de dossier
            </div>
            <input
              style={inputStyle}
              placeholder="Ex : Dupont, Jean, 12345..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            {searching && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Recherche...</div>}

            {searchResults.length > 0 && (
              <div style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto' }}>
                {searchResults.map(c => (
                  <div
                    key={c.id}
                    onClick={() => selectClient(c)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid #e2e8f0', marginBottom: 6,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                      {c.nom} {c.prenom}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      Dossier : {c.dossier}
                      {c.date_naissance ? ` — Né(e) le ${c.date_naissance}` : ''}
                      {c.localite ? ` — ${c.localite}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 10 }}>Aucun client trouvé</div>
            )}
          </div>
        )}

        {/* ═══ STEP 2: Select contrat ═══ */}
        {step === 'select' && selectedClient && (
          <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  Client sélectionné
                </div>
                <button style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }} onClick={handleReset}>
                  Changer
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 13 }}>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Nom :</span> {selectedClient.nom}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Prénom :</span> {selectedClient.prenom || '—'}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Dossier :</span> {selectedClient.dossier}</div>
                <div><span style={{ color: '#94a3b8', fontWeight: 600 }}>Naissance :</span> {selectedClient.date_naissance || '—'}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Adresse :</span>{' '}
                  {[selectedClient.rue, selectedClient.num_maison, selectedClient.boite].filter(Boolean).join(' ')}
                  {selectedClient.cp ? `, ${selectedClient.cp}` : ''} {selectedClient.localite || ''}
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                2. Sélectionner un contrat Vie
              </div>
              {loadingContrats && <div style={{ fontSize: 13, color: '#94a3b8' }}>Chargement...</div>}
              {contrats.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {contrats.map(ct => (
                    <div
                      key={ct.id}
                      onClick={() => selectContrat(ct)}
                      style={{
                        padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                        border: '1px solid #e2e8f0', marginBottom: 6,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#93c5fd' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {ct.compagnie || '—'} — Police {ct.police || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {ct.type_production || '—'} — {ct.situation || '—'}
                        {ct.date_creation ? ` — ${ct.date_creation}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ STEP 3: Upload PDF proposition ═══ */}
        {step === 'upload' && selectedClient && selectedContrat && (
          <>
            {/* Client + contrat summary */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                    {selectedClient.nom} {selectedClient.prenom}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {selectedContrat.compagnie} — {selectedContrat.type_production}
                    {selectedContrat.police ? ` — N° ${selectedContrat.police}` : ''}
                  </div>
                </div>
                <button style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }} onClick={() => setStep('select')}>
                  Changer de contrat
                </button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
                3. Uploader la proposition / le contrat PDF
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>
                Le PDF sera analysé pour extraire les fonds d'investissement, les dates d'effet et de fin, et calculer automatiquement le profil de risque et l'horizon de placement.
              </div>

              {/* File input */}
              <div style={{
                border: '2px dashed #cbd5e1', borderRadius: 10, padding: '24px 20px',
                textAlign: 'center', background: '#f8fafc', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
                onClick={() => document.getElementById('pdf-input').click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#eff6ff' }}
                onDragLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc' }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; if (e.dataTransfer.files[0]) handlePdfUpload(e.dataTransfer.files[0]) }}
              >
                <input
                  id="pdf-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) handlePdfUpload(e.target.files[0]) }}
                />
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                  <i className="ti ti-file-upload" style={{ color: '#94a3b8' }} />
                </div>
                {pdfFile ? (
                  <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                    {pdfFile.name}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Cliquez ou glissez un PDF ici
                  </div>
                )}
              </div>

              {extracting && (
                <div style={{ fontSize: 13, color: '#1A3A6B', marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid #1A3A6B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {extractionProgress || 'Extraction en cours...'}
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
              )}

              {/* Warning message */}
              {extractionWarning && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: 8,
                  padding: '10px 14px', marginTop: 12, fontSize: 12.5, color: '#92400e',
                }}>
                  {extractionWarning}
                </div>
              )}

              {/* Extracted funds display */}
              {Object.keys(funds).length > 0 && !manualMode && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                    Fonds extraits :
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(funds).map(([name, pct]) => {
                      // Compute the effective risk for this fund (same logic as computeRiskScore)
                      const key = name.toLowerCase().trim()
                      let riskVal = FUND_RISK[key]
                      if (riskVal === undefined) {
                        if (/branche\s*21|garanti|taux\s*garanti/i.test(key)) riskVal = 0
                        else if (/equity|equities|action|growth|dynamic|technolog/i.test(key)) riskVal = 80
                        else if (/balanced|mixte|multi\s*asset/i.test(key)) riskVal = 50
                        else if (/bond|obligation|defensive|stability|income/i.test(key)) riskVal = 15
                        else if (/infrastructure|real\s*estate|immobil/i.test(key)) riskVal = 55
                        else if (/impact|sustainable|esg/i.test(key)) riskVal = 60
                        else if (/megatrend|thematic/i.test(key)) riskVal = 75
                        else if (/star\s*fund/i.test(key)) riskVal = 70
                        else riskVal = 50
                      }
                      const fundProfile = riskToProfile(riskVal)
                      const classColors = {
                        'Défensif': '#16a34a', 'Conservateur': '#22c55e',
                        'Neutre / Équilibré': '#f59e0b', 'Dynamique': '#ea580c', 'Offensif': '#dc2626',
                      }
                      return (
                        <div key={name} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 12.5,
                        }}>
                          <span style={{ color: '#334155', fontWeight: 500 }}>{name}</span>
                          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ color: '#1A3A6B', fontWeight: 700 }}>{pct}%</span>
                            <span style={{
                              color: classColors[fundProfile] || '#64748b', fontSize: 11, fontWeight: 600,
                              padding: '1px 6px', borderRadius: 4,
                              background: `${classColors[fundProfile] || '#64748b'}15`,
                            }}>
                              {fundProfile} ({riskVal})
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Computed profile from funds */}
                  {(() => {
                    const rs = computeRiskScore(funds)
                    const pr = riskToProfile(rs)
                    const profileColors = {
                      'Défensif': '#16a34a',
                      'Conservateur': '#22c55e',
                      'Neutre / Équilibré': '#f59e0b',
                      'Dynamique': '#ea580c',
                      'Offensif': '#dc2626',
                    }
                    return (
                      <div style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
                        border: '1px solid #93c5fd',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: profileColors[pr] || '#475569' }}>
                          Profil calculé : {pr}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Score de risque pondéré : {Math.round(rs * 10) / 10} / 100
                        </div>
                      </div>
                    )
                  })()}

                  {/* Dates & horizon */}
                  {(pdfDates.dateDebut || pdfDates.dateFin) && (
                    <div style={{
                      marginTop: 8, padding: '8px 14px', borderRadius: 8,
                      background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12.5,
                    }}>
                      <div style={{ color: '#334155' }}>
                        <strong>Date d'effet :</strong> {pdfDates.dateDebut || '—'}
                        {' — '}
                        <strong>Date de fin :</strong> {pdfDates.dateFin || '—'}
                      </div>
                      {horizonYears !== null && (
                        <div style={{ color: '#1A3A6B', fontWeight: 600, marginTop: 2 }}>
                          Horizon de placement : {horizonYears} ans
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Manual fund entry */}
              {manualMode && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                    Encodage manuel des fonds :
                  </div>
                  {manualFunds.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <input
                        style={{ ...inputStyle, flex: 3 }}
                        placeholder="Nom du fonds (ex: AG Life Balanced)"
                        value={f.name}
                        onChange={e => {
                          const updated = [...manualFunds]
                          updated[idx] = { ...updated[idx], name: e.target.value }
                          setManualFunds(updated)
                        }}
                      />
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        placeholder="%"
                        type="number"
                        min="0"
                        max="100"
                        value={f.pct}
                        onChange={e => {
                          const updated = [...manualFunds]
                          updated[idx] = { ...updated[idx], pct: e.target.value }
                          setManualFunds(updated)
                        }}
                      />
                      {manualFunds.length > 1 && (
                        <button
                          style={{ ...btnSecondary, padding: '6px 10px', fontSize: 12 }}
                          onClick={() => setManualFunds(manualFunds.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }}
                      onClick={() => setManualFunds([...manualFunds, { name: '', pct: '' }])}
                    >
                      + Ajouter un fonds
                    </button>
                    <button
                      style={{ ...btnPrimary, padding: '6px 14px', fontSize: 12 }}
                      onClick={applyManualFunds}
                    >
                      Valider les fonds
                    </button>
                  </div>

                  {/* Manual date entry */}
                  <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                    Dates du contrat (optionnel) :
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Date d'effet (JJ/MM/AAAA)</div>
                      <input
                        style={inputStyle}
                        placeholder="01/01/2020"
                        value={pdfDates.dateDebut || ''}
                        onChange={e => {
                          const newDates = { ...pdfDates, dateDebut: e.target.value || null }
                          setPdfDates(newDates)
                          if (newDates.dateDebut && newDates.dateFin) {
                            setHorizonYears(calcHorizonYears(newDates.dateDebut, newDates.dateFin))
                          }
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Date de fin (JJ/MM/AAAA)</div>
                      <input
                        style={inputStyle}
                        placeholder="01/01/2045"
                        value={pdfDates.dateFin || ''}
                        onChange={e => {
                          const newDates = { ...pdfDates, dateFin: e.target.value || null }
                          setPdfDates(newDates)
                          if (newDates.dateDebut && newDates.dateFin) {
                            setHorizonYears(calcHorizonYears(newDates.dateDebut, newDates.dateFin))
                          }
                        }}
                      />
                    </div>
                  </div>
                  {horizonYears !== null && (
                    <div style={{ fontSize: 12.5, color: '#1A3A6B', fontWeight: 600, marginTop: 6 }}>
                      Horizon calculé : {horizonYears} ans
                    </div>
                  )}
                </div>
              )}

              {/* Proceed button */}
              {Object.keys(funds).length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                  <button style={btnPrimary} onClick={proceedToQuestionnaire}>
                    Continuer vers le questionnaire
                  </button>
                  <button style={btnSecondary} onClick={handleReset}>
                    Recommencer
                  </button>
                </div>
              )}

              {/* Skip to manual if no PDF needed */}
              {Object.keys(funds).length === 0 && !manualMode && !extracting && (
                <div style={{ marginTop: 12 }}>
                  <button
                    style={{ ...btnSecondary, fontSize: 12 }}
                    onClick={() => setManualMode(true)}
                  >
                    Encoder les fonds manuellement (sans PDF)
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ STEP 4: Questionnaire éditable ═══ */}
        {step === 'questionnaire' && selectedClient && selectedContrat && (
          <>
            {/* Client + contrat + funds summary */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                    {selectedClient.nom} {selectedClient.prenom}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {selectedContrat.compagnie} — {selectedContrat.type_production}
                    {selectedContrat.police ? ` — N° ${selectedContrat.police}` : ''}
                  </div>
                  {Object.keys(funds).length > 0 && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Fonds : {Object.entries(funds).map(([n, p]) => `${n} (${p}%)`).join(', ')}
                    </div>
                  )}
                  {horizonYears !== null && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      Horizon : {horizonYears} ans
                      {pdfDates.dateDebut ? ` — du ${pdfDates.dateDebut}` : ''}
                      {pdfDates.dateFin ? ` au ${pdfDates.dateFin}` : ''}
                    </div>
                  )}
                </div>
                <button style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12 }} onClick={handleReset}>
                  Recommencer
                </button>
              </div>
            </div>

            {/* Live score bar */}
            <div style={{
              ...cardStyle,
              border: '2px solid #1A3A6B',
              background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
              position: 'sticky', top: 0, zIndex: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', background: '#1A3A6B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 16,
                }}>
                  {score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{profile}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Score {score}/42 — modifiez les réponses ci-dessous pour ajuster</div>
                </div>
                <button style={btnPrimary} onClick={handleGenerate}>
                  Générer le PDF
                </button>
              </div>
            </div>

            {/* Questions */}
            <div style={cardStyle}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 14 }}>
                4. Questionnaire (14 questions)
              </div>
              {QUESTIONS.map(q => {
                const sel = answers[q.n]
                return (
                  <div key={q.n} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                      {q.n}. {q.text}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {Object.entries(q.opts).map(([letter, text]) => {
                        const isSel = letter === sel
                        return (
                          <label
                            key={letter}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                              background: isSel ? '#eff6ff' : 'transparent',
                              border: isSel ? '1px solid #93c5fd' : '1px solid transparent',
                              fontSize: 12.5, color: isSel ? '#1e40af' : '#475569',
                              fontWeight: isSel ? 600 : 400,
                              transition: 'all 0.15s',
                            }}
                          >
                            <input
                              type="radio"
                              name={`q${q.n}`}
                              checked={isSel}
                              onChange={() => handleAnswerChange(q.n, letter)}
                              style={{ accentColor: '#1A3A6B' }}
                            />
                            {letter}) {text}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom generate button */}
            <div style={{ display: 'flex', gap: 10, marginTop: 4, marginBottom: 20 }}>
              <button style={btnPrimary} onClick={handleGenerate}>
                Générer le PDF
              </button>
              <button style={btnSecondary} onClick={handleReset}>
                Recommencer
              </button>
            </div>
          </>
        )}

        {/* ═══ STEP 5: Done ═══ */}
        {step === 'done' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
              PDF généré avec succès
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Questionnaire pour <strong>{selectedClient?.nom} {selectedClient?.prenom}</strong> — Profil : <strong>{profile}</strong> ({score}/42)
              {horizonYears !== null && <> — Horizon : <strong>{horizonYears} ans</strong></>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={btnPrimary} onClick={handleDownload}>
                Télécharger le PDF
              </button>
              <button style={btnSecondary} onClick={() => setStep('questionnaire')}>
                Modifier les réponses
              </button>
              <button style={btnSecondary} onClick={handleReset}>
                Nouveau client
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
