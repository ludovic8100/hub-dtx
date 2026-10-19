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
  // Baloise
  'european bonds': 10, 'balanced': 50, 'growth': 75, 'equities': 90,
  'branche 21': 0, 'branche 26': 0, 'invest 1': 30, 'invest 2': 50,
  'invest 3': 70,
  // NN
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
// PARSERS — un par compagnie
// ═══════════════════════════════════════════════════════════════════════

function parseAG(text) {
  const d = {}
  let m
  m = text.match(/Preneur\s*[:\-]?\s*(?:M\.\s*|Mme\s*)?([A-ZÀ-Ú\s]+?)\s+([\wéèêëàâäîïôöùûüç\s-]+?)(?:\n|Date)/i)
  if (m) { d.last_name = m[1].trim(); d.first_name = m[2].trim() }
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
  if (m) d.birth_date = m[1]
  m = text.match(/[Aa]dresse\s*[:\-]?\s*(.+?)(?:\n|$)/m)
  if (m) d.address = m[1].trim()
  if (!d.address) {
    m = text.match(/((?:Rue|Avenue|Chaussée|Boulevard|Place|Allée|Chemin|Chée)[^\n]+)/i)
    if (m) d.address = m[1].trim()
  }
  // Type de contrat
  const types = ['Engagement individuel de pension', 'EIP', 'Assurance groupe', 'PLCI',
    'Pension libre complémentaire', 'Épargne-pension', 'Branche 21', 'Branche 23']
  for (const t of types) {
    if (text.toLowerCase().includes(t.toLowerCase())) { d.contract_type = t; break }
  }
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
  d.company = 'AG Insurance'
  return d
}

// ═══════════════════════════════════════════════════════════════════════
// MOTEUR DE PROFIL
// ═══════════════════════════════════════════════════════════════════════

function computeRiskScore(funds) {
  let totalPct = 0, weightedRisk = 0
  for (const [name, pct] of Object.entries(funds)) {
    const key = name.toLowerCase().trim()
    const risk = FUND_RISK[key] ?? 50 // défaut modéré si fonds inconnu
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
  const TEAL = [26, 188, 156]

  // En-tête
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...DARK)
  doc.text('Dynassur', mL, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text('Rue Romaine 13  5310 Branchon', mL, y)
  y += 4
  doc.text('Tel : 081738458  |  E-mail : rde@dynassur.be  |  www.dynassur.be', mL, y)
  y += 8

  // Titre
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...DARK)
  doc.text('Questionnaire Profil Investisseur', w / 2, y, { align: 'center' })
  y += 6
  doc.setDrawColor(...TEAL)
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

  // Contrat source
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text('Contrat source', mL, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(85)
  const src = `${contract.company || ''}  •  ${contract.contract_type || ''}  •  n° ${contract.contract_number || ''}`
  doc.text(src, mL, y)
  y += 4
  const fundsStr = Object.entries(contract.funds || {}).map(([n, p]) => `${n}: ${p}%`).join('  |  ')
  doc.text(`Fonds : ${fundsStr}`, mL, y)
  y += 4
  doc.text(`Profil déduit : ${result.profile}  (score : ${result.score}/42)`, mL, y)
  y += 8

  doc.setDrawColor(...TEAL)
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
          doc.setFillColor(...TEAL)
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
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.7)
  doc.roundedRect(mL, y, cW, 28, 3, 3, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text(`Score total : ${result.score} / 42`, mL + 5, y + 8)
  doc.setFontSize(14)
  doc.setTextColor(...TEAL)
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
      // Détection compagnie (extensible)
      let parsed
      if (/ag\s*insurance/i.test(text) || /pension\s*life/i.test(text) || /ag\s*life/i.test(text)) {
        parsed = parseAG(text)
      } else {
        // Tenter AG par défaut pour l'instant
        parsed = parseAG(text)
        if (!parsed.contract_number && !Object.keys(parsed.funds).length) {
          throw new Error("Compagnie non reconnue. Seul AG Insurance est supporté pour l'instant. Baloise, NN, AXA et Allianz arrivent bientôt.")
        }
      }
      if (!Object.keys(parsed.funds || {}).length) {
        throw new Error("Aucun fonds détecté dans le PDF. Vérifiez que c'est bien un relevé de contrat Vie avec répartition des fonds.")
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
              Importez le relevé PDF du contrat Vie (consultation AG Insurance, relevé Baloise, etc.).
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
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>PDF de contrat Vie — AG Insurance (autres compagnies bientôt)</div>
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
          marginTop: 20, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 10, fontSize: 12, color: '#92400e', lineHeight: 1.5,
        }}>
          <strong>Compagnies supportées :</strong> AG Insurance.
          <br />En cours de développement : Baloise, NN, AXA, Allianz.
        </div>
      </div>
    </Layout>
  )
}
