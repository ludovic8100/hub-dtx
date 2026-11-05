import { useState, useRef, useEffect, useCallback } from 'react'
import OutilPage from '../../components/OutilPage'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'
import Tesseract from 'tesseract.js'
import FicheVieFormulaire from '../../components/FicheVieFormulaire'
import { formaterDateSaisie } from '../../components/FicheVieFormulaire'
import { FICHES, versionPourDate, SEUIL_VERSION } from '../../lib/fichesVie'
import { construireFichePDF } from '../../lib/fichesViePdf'
import { proposerReponses, profilDepuisReponses, profilDepuisScoreRisque } from '../../lib/fichesVieReponses'
import { risqueFonds, lectureComposition, profilDepuisScore, chargerFonds,
         chargerCompagniesSansFonds, compagnieSansFonds, enregistrerFonds } from '../../lib/fondsRisque'

// Configure pdf.js worker via Vite ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Logo Dynassur, partage par l'ancien rendu et par le nouveau moteur de
// fiches (src/lib/fichesViePdf.js).
const LOGO_DYNASSUR = 'data:image/png;base64,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'

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

async function ocrPdfPages(pdf, onProgress) {
  let ocrText = ''
  const scale = 3.0 // 3x resolution for better OCR accuracy
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress(`OCR page ${i}/${pdf.numPages}...`)
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    // White background (improves OCR on transparent PDFs)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise

    const { data: { text } } = await Tesseract.recognize(canvas, 'eng+fra', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(`OCR page ${i}/${pdf.numPages}... ${Math.round((m.progress || 0) * 100)}%`)
        }
      }
    })
    ocrText += text + '\n'
    console.log(`[OCR] Page ${i} (${canvas.width}x${canvas.height}):`, text.substring(0, 300))
  }
  console.log('[OCR] Total text:', ocrText.length, 'chars')
  return ocrText
}

async function extractTextFromPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Step 1: Try pdfjs-dist text extraction
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(item => item.str).join(' ')
    fullText += pageText + '\n'
  }
  console.log('[PDF] pdfjs-dist extracted:', fullText.trim().length, 'chars')
  console.log('[PDF] pdfjs sample:', fullText.substring(0, 500))

  // Step 2: Check if pdfjs text is usable (contains recognizable patterns)
  const hasUsableText = fullText.trim().length > 100 &&
    (/\d{2}[/.-]\d{2}[/.-]\d{4}/.test(fullText) || // contains a date
     /\d{1,3}[.,]\d{2}\s*%/.test(fullText) ||        // contains a percentage
     /BFI|Branche|Select|Fund|Equity|pension|invest/i.test(fullText)) // contains fund keywords

  if (hasUsableText) {
    console.log('[PDF] pdfjs text is usable — using it directly')
    return fullText
  }

  // Step 3: Fallback to OCR (text empty, garbled, or no recognizable patterns)
  console.log('[PDF] pdfjs text not usable — falling back to OCR...')
  if (onProgress) onProgress('OCR en cours... (peut prendre 30-60 secondes)')

  const ocrText = await ocrPdfPages(pdf, onProgress)

  // Return whichever has more usable content
  if (ocrText.trim().length > fullText.trim().length) {
    return ocrText
  }
  // If OCR also failed, return pdfjs text (handlePdfUpload will handle the no-data case)
  console.log('[PDF] OCR also returned little text, returning pdfjs text as fallback')
  return fullText.trim().length > ocrText.trim().length ? fullText : ocrText
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

  // Look for investment strategy section (handles concatenated text and OCR noise)
  const stratIdx = text.search(/Strat[ée]gi[ec]\s*d[''’]?\s*investissement/i)
  const partIdx = text.search(/Participation\s*aux\s*b[ée]n[ée]fices/i)
  const bfiIdx = text.search(/BFI\s/i)

  // Search in relevant sections
  const sections = []
  if (stratIdx >= 0) sections.push(text.substring(stratIdx, stratIdx + 3000))
  if (partIdx >= 0) sections.push(text.substring(partIdx, partIdx + 3000))
  if (bfiIdx >= 0 && stratIdx < 0) sections.push(text.substring(Math.max(0, bfiIdx - 200), bfiIdx + 2000))
  if (sections.length === 0) sections.push(text)

  for (const section of sections) {
    // Pattern 1: fund name + percentage (standard)
    const fundPattern = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\-'.()0-9&]+?)\s+(\d{1,3}[.,]\d{2})\s*%/g
    let match
    while ((match = fundPattern.exec(section)) !== null) {
      let name = match[1].trim()
      const pct = parseFloat(match[2].replace(',', '.'))
      name = name.replace(/^\s*[-–—]\s*/, '')
      name = name.replace(/\s+/g, ' ').trim()
      if (/^(Fonds|Total|Nom|Date|Prime|Montant|Strat|Participation|Forme|Garantie|Constitution|Taxe|Versement|Page|Brut)/i.test(name)) continue
      if (pct <= 0 || pct > 100) continue
      if (name.length < 3) continue
      funds[name] = pct
    }

    // Pattern 2: OCR sometimes puts percentage on next line or with spaces
    // Look specifically for known BFI fund patterns
    const bfiPattern = /BFI\s+([A-Za-z\s\-&]+?)(?:Select|Fund)?\s*[\n\r:]*\s*(\d{1,3}[.,]\d{2})\s*%/gi
    while ((match = bfiPattern.exec(section)) !== null) {
      let name = 'BFI ' + match[1].trim()
      if (!name.toLowerCase().includes('select')) name += ' Select'
      name = name.replace(/\s+/g, ' ').trim()
      const pct = parseFloat(match[2].replace(',', '.'))
      if (pct > 0 && pct <= 100) funds[name] = pct
    }

    // Pattern 3: "Compte Branche 21" patterns
    const br21Pattern = /Compte\s+Branche\s*21[^%]*?(\d{1,3}[.,]\d{2})\s*%/gi
    while ((match = br21Pattern.exec(section)) !== null) {
      const pct = parseFloat(match[1].replace(',', '.'))
      if (pct > 0 && pct <= 100) funds['Compte Branche 21'] = pct
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

// ═══════════════════════════════════════════════════════════════════════
// COMPOSANT REACT — ARCHITECTURE DB + PDF HYBRIDE
// Steps: search → select → upload → questionnaire → done
// ═══════════════════════════════════════════════════════════════════════

export default function ToolQuestionnaire() {
  const [step, setStep] = useState('search')
  // Fiche sans epargne existante : un nouveau client, ou un client du
  // portefeuille qui n'a encore aucun contrat Vie. Il n'y a alors ni contrat
  // ni fonds a lire — et c'est le cas NORMAL, pas une degradation : les
  // reponses sont recueillies aupres du client, pas reconstituees.
  const [sansEpargne, setSansEpargne] = useState(false)
  // Un prospect n'existe pas encore dans `clients`. On saisit son nom.
  const [clientLibre, setClientLibre] = useState(null)
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
  // La table des fonds vient de la base, plus du code : elle se corrige sans
  // deploiement. `null` tant qu'elle n'est pas chargee — on ne bloque pas
  // l'ecran si la base ne repond pas, on retombe sur la liste de secours.
  const [tableFonds, setTableFonds] = useState(null)
  const [sansFonds, setSansFonds] = useState([])
  const [ajoutFonds, setAjoutFonds] = useState(null)

  // Quelle fiche d'intermediation ? Avant ou apres 2025 — c'est la date
  // d'effet qui tranche, et le choix manuel reste possible avec une alerte.
  const [versionChoisie, setVersionChoisie] = useState(null)
  const [proposees, setProposees] = useState({})

  // Questionnaire state
  const [answers, setAnswers] = useState({})
  const [funds, setFunds] = useState({})
  const [pdfBlob, setPdfBlob] = useState(null)
  const [error, setError] = useState(null)
  const searchTimeout = useRef(null)

  // ─── Right panel state ───
  const [savedProfiles, setSavedProfiles] = useState([])
  const [pendingContrats, setPendingContrats] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [savingToDB, setSavingToDB] = useState(false)
  const [savedToDBMsg, setSavedToDBMsg] = useState(null)
  // Upload pre-filled questionnaire
  const [uploadQFile, setUploadQFile] = useState(null)
  const [uploadQExtracting, setUploadQExtracting] = useState(false)
  const [uploadQProgress, setUploadQProgress] = useState('')
  const [uploadQResult, setUploadQResult] = useState(null) // { answers, score, profile }
  const [uploadQError, setUploadQError] = useState(null)

  // ─── Version de la fiche, et profil deduit des reponses ───
  //
  // La date d'effet vient du PDF de proposition quand il a pu etre lu, sinon
  // de la date de creation du contrat. Quand aucune des deux n'existe, on ne
  // devine pas : on demande.
  // Le client du dossier, ou le prospect saisi a la main.
  const clientActif = selectedClient || clientLibre

  const dateEffet = (() => {
    // Sans epargne : la fiche applicable est celle d'aujourd'hui.
    if (sansEpargne) return { date: new Date(), source: 'nouveau' }
    const duPdf = pdfDates?.dateDebut ? parseDateDMY(pdfDates.dateDebut) : null
    if (duPdf) return { date: duPdf, source: 'pdf' }
    if (selectedContrat?.date_creation) return { date: new Date(selectedContrat.date_creation), source: 'contrat' }
    return { date: null, source: null }
  })()
  const versionDetectee = versionPourDate(dateEffet.date)
  const versionActive = versionChoisie || versionDetectee
  const fiche = versionActive ? FICHES[versionActive] : null
  const desaccordVersion = !!(versionDetectee && versionChoisie && versionChoisie !== versionDetectee)

  const calculProfil = fiche ? profilDepuisReponses(fiche, answers) : { profil: null, score: null, repondues: 0, total: 0, complet: false }
  const score = calculProfil.score
  const profile = calculProfil.profil

  // ─── Load saved profiles for selected client ───
  const loadProfiles = useCallback(async (dossier) => {
    if (!dossier) return
    setLoadingProfiles(true)
    try {
      const { data } = await supabase
        .from('profils_investisseur')
        .select('*')
        .eq('dossier', dossier)
        .order('created_at', { ascending: false })
      setSavedProfiles(data || [])
    } catch (e) { console.error('loadProfiles error', e) }
    setLoadingProfiles(false)
  }, [])

  // ─── Load pending Vie contracts (no profile yet) for selected client ───
  const loadPendingContrats = useCallback(async (dossier) => {
    if (!dossier) return
    try {
      // Get all Vie contracts
      const { data: vieContrats } = await supabase
        .from('contrats')
        .select('*')
        .eq('dossier', dossier)
        // La valeur en base est « Vie et placements ». « Vie » seul ne
        // correspondait a aucune ligne : cette liste etait toujours vide.
        .in('domaine', ['Vie et placements', 'Vie'])
      // Get contracts that already have a profile
      const { data: profiles } = await supabase
        .from('profils_investisseur')
        .select('contrat_id')
        .eq('dossier', dossier)
      const profiledIds = new Set((profiles || []).map(p => p.contrat_id).filter(Boolean))
      setPendingContrats((vieContrats || []).filter(c => !profiledIds.has(c.id)))
    } catch (e) { console.error('loadPendingContrats error', e) }
  }, [])

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
    let vivant = true
    Promise.all([chargerFonds(supabase), chargerCompagniesSansFonds(supabase)])
      .then(([table, cies]) => { if (vivant) { setTableFonds(table); setSansFonds(cies) } })
      .catch(e => console.error('chargement fonds', e))
    return () => { vivant = false }
  }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchClients(searchTerm), 300)
    return () => clearTimeout(searchTimeout.current)
  }, [searchTerm, searchClients])

  // ─── Load contrats for selected client ───
  async function selectClient(client) {
    setSelectedClient(client)
    // Choisir un client du portefeuille annule le mode « sans epargne » et le
    // nom saisi a la main : c'est le client choisi qui fait foi.
    setSansEpargne(false)
    setClientLibre(null)
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
      // Load right-panel data
      loadProfiles(client.dossier)
      loadPendingContrats(client.dossier)
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
    // Sans epargne, il n'y a aucun fonds a lire : c'est le cas normal.
    if (!sansEpargne && Object.keys(funds).length === 0 && !manualMode) {
      setError('Veuillez d\'abord uploader un PDF ou encoder les fonds manuellement.')
      return
    }

    if (!versionActive) {
      setError("Impossible de determiner si l'epargne est anterieure ou posterieure a 2025. "
        + 'Choisissez la version de la fiche ci-dessus avant de continuer.')
      return
    }

    // Le niveau de risque vient de la composition reelle des fonds. Il sert a
    // PROPOSER des reponses — plus a forcer un profil decide d'avance.
    const lecture = lectureComposition(funds, tableFonds)
    const riskScore = lecture.score ?? 50
    const montant = Object.keys(funds).length ? null : null

    const propo = proposerReponses(FICHES[versionActive], {
      scoreRisque: riskScore,
      horizonYears,
      montant,
      client: clientActif || {},
      contrat: selectedContrat || null,
      funds,
    })

    setProposees(propo)
    setAnswers(propo)
    setError(null)
    setStep('questionnaire')
  }

  // ─── Ce client existe-t-il deja ? ───
  //
  // Taper « Dupont » comme nouveau client alors qu'il est au portefeuille
  // cree un doublon, et un profil rattache a personne. On cherche donc
  // pendant la frappe.
  //
  // LA DATE DE NAISSANCE DEPARTAGE, MAIS AVEC UNE RESERVE : 1 209 clients
  // portent 1900-01-01, un bouche-trou qui veut dire « inconnue ». La
  // traiter comme une vraie date ferait correspondre n'importe qui avec
  // n'importe qui. Elle est donc ignoree.
  const DATE_BOUCHE_TROU = '1900-01-01'

  const [doublons, setDoublons] = useState([])

  const chercherDoublon = useCallback(async (nom, prenom, naissance) => {
    const n = (nom || '').trim()
    if (n.length < 2) { setDoublons([]); return }
    try {
      const { data } = await supabase
        .from('clients')
        .select('id,dossier,nom,prenom,date_naissance,rue,num_maison,boite,cp,localite')
        .ilike('nom', `%${n}%`)
        .not('dossier', 'is', null)
        .order('nom')
        .limit(40)

      // On classe : meme date de naissance d'abord, puis meme prenom.
      const iso = (() => {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(naissance || '')
        return m ? `${m[3]}-${m[2]}-${m[1]}` : null
      })()
      const p = (prenom || '').trim().toLowerCase()

      const note = (c) => {
        let pts = 0
        if (iso && c.date_naissance === iso && iso !== DATE_BOUCHE_TROU) pts += 10
        if (p && (c.prenom || '').toLowerCase().includes(p)) pts += 3
        return pts
      }
      const liste = (data || [])
        .map(c => ({ ...c, pts: note(c) }))
        .sort((a, b) => b.pts - a.pts)
        .slice(0, 5)
      setDoublons(liste)
    } catch { setDoublons([]) }
  }, [])

  useEffect(() => {
    if (!clientLibre?.nom) { setDoublons([]); return }
    const t = setTimeout(() => chercherDoublon(
      clientLibre.nom, clientLibre.prenom, clientLibre.date_naissance), 350)
    return () => clearTimeout(t)
  }, [clientLibre?.nom, clientLibre?.prenom, clientLibre?.date_naissance, chercherDoublon])

  // ─── Fiche sans epargne existante ───
  //
  // Un nouveau client, ou un client du portefeuille sans contrat Vie. Il n'y
  // a ni contrat ni fonds, et c'est normal.
  //
  // CE QUI EST PRE-REMPLI, ET CE QUI NE L'EST PAS. On reprend l'identite du
  // client, parce que c'est un fait qu'on connait. On ne pre-remplit RIEN
  // d'autre : sans contrat, un objectif d'investissement ou une preference de
  // risque proposee serait une reponse inventee, affichee avec un badge
  // « propose » qui lui donnerait l'air d'etre deduite de quelque chose.
  // C'est exactement ce qu'on a retire de cet outil.
  const CHAMPS_IDENTITE = ['nom', 'prenom', 'adresse', 'numero_rue', 'code_postal',
                           'localite', 'date_naissance', 'registre_national']

  function demarrerSansEpargne(client) {
    const version = versionChoisie || versionPourDate(new Date())
    if (!version) { setError("Impossible de determiner la version de la fiche."); return }

    const propo = proposerReponses(FICHES[version], { client: client || {}, funds: {} })
    const identite = {}
    for (const c of CHAMPS_IDENTITE) if (propo[c]) identite[c] = propo[c]

    setSansEpargne(true)
    setSelectedContrat(null)
    setFunds({})
    setManualMode(false)
    setProposees(identite)
    setAnswers(identite)
    setError(null)
    setStep('questionnaire')
  }

  // ─── Answer change handler ───
  function handleAnswerChange(id, valeur) {
    setAnswers(prev => ({ ...prev, [id]: valeur }))
  }

  // ─── Generate PDF ───
  async function handleGenerate() {
    if (!fiche) { setError('Choisissez la version de la fiche avant de generer.'); return }

    // LE PROFIL NE FIGURE PAS SUR LA FICHE. C'est une conclusion interne de
    // Dynassur, pas une rubrique du document FSMA. Il va a l'ecran et dans la
    // fiche du client, jamais dans le PDF remis.
    const doc = construireFichePDF(fiche, answers, {
      client: clientActif || {},
      contrat: selectedContrat || null,
      logoB64: LOGO_DYNASSUR,
      // Sans epargne existante, les reponses sont recueillies aupres du
      // client, maintenant. Porter la mention de reconstitution reviendrait a
      // ecrire sur le document une chose fausse.
      mentionReconstitution: sansEpargne ? null :
        'Document reconstitue a partir des elements du contrat. Les reponses proposees '
        + 'automatiquement ont ete reprises et validees par le conseiller ; elles n ont pas '
        + 'ete recueillies aupres du client a la date d effet.',
    })
    const blob = doc.output('blob')
    setPdfBlob(blob)
    setStep('done')
    await saveProfileToDB(answers, calculProfil.score, calculProfil.profil, 'generated')
  }

  // ─── Save profile to Supabase ───
  async function saveProfileToDB(ans, sc, prof, source) {
    setSavingToDB(true)
    setSavedToDBMsg(null)
    try {
      const row = {
        client_id: selectedClient?.id || null,
        contrat_id: selectedContrat?.id || null,
        dossier: selectedClient?.dossier || null,
        nom_client: [clientActif?.nom, clientActif?.prenom].filter(Boolean).join(' '),
        profil: prof,
        score: sc,
        answers: ans,
        funds: funds,
        horizon_years: horizonYears,
        purpose: purposeFromType(selectedContrat?.type_production),
        // `source` dit COMMENT le document a ete produit, et la colonne est
        // bornee a generated / uploaded. « Sans epargne » est une autre
        // dimension : elle a sa propre colonne.
        source,
        sans_epargne: sansEpargne,
        version_fiche: versionActive || null,
        date_effet: dateEffet.date ? dateEffet.date.toISOString().slice(0, 10) : null,
        source_date: versionChoisie ? 'manuel' : (dateEffet.source || null),
      }
      const { error: err } = await supabase.from('profils_investisseur').insert(row)
      if (err) throw err
      setSavedToDBMsg('Profil sauvegardé en base de données.')
      // Refresh right panel
      if (selectedClient?.dossier) {
        loadProfiles(selectedClient.dossier)
        loadPendingContrats(selectedClient.dossier)
      }
    } catch (e) {
      setSavedToDBMsg(`Erreur sauvegarde : ${e.message}`)
    } finally {
      setSavingToDB(false)
    }
  }

  // ─── Upload pre-filled questionnaire PDF — extract 14 answers via OCR ───
  async function handleUploadedQuestionnaire(file) {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadQError('Veuillez sélectionner un fichier PDF.')
      return
    }
    setUploadQFile(file)
    setUploadQExtracting(true)
    setUploadQError(null)
    setUploadQResult(null)

    try {
      setUploadQProgress('Extraction du texte du questionnaire...')
      const text = await extractTextFromPDF(file, setUploadQProgress)
      console.log('=== UPLOADED QUESTIONNAIRE TEXT ===', text)

      if (text.trim().length < 30) {
        setUploadQError('Le PDF semble être une image scannée — extraction impossible. Veuillez encoder les réponses manuellement.')
        setUploadQExtracting(false)
        return
      }

      // HORS SERVICE, ET C'EST VOLONTAIRE.
      //
      // Cette relecture cherchait les quatorze questions inventees de
      // l'ancien outil (« a) Preserver mon capital »). Elles ne figurent sur
      // AUCUNE fiche d'intermediation reelle : sur un vrai document, elle ne
      // trouve rien et rend un profil fabrique a partir de rien.
      //
      // Relire une vraie fiche demande de lire la POSITION des cases cochees
      // sur onze pages, pas de chercher des mots. C'est un autre chantier.
      setUploadQError(
        "La relecture automatique d'une fiche deja remplie est hors service : elle cherchait "
        + "les anciennes questions, qui ne figurent sur aucune fiche reelle. Reconstitue la fiche "
        + "en partant du contrat, puis corrige les reponses a l'ecran."
      )
      setUploadQExtracting(false)
      return
    } catch (e) {
      setUploadQError(`Erreur : ${e.message}`)
    } finally {
      setUploadQExtracting(false)
      setUploadQProgress('')
    }
  }

  function handleDownload() {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Questionnaire_${clientActif?.nom || 'Client'}_${clientActif?.prenom || ''}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleReset() {
    setStep('search')
    // Sans ca, le mode « sans epargne » et le nom saisi a la main survivent
    // au dossier suivant : la fiche d'un client se remplirait avec le nom du
    // precedent.
    setSansEpargne(false)
    setClientLibre(null)
    setVersionChoisie(null)
    setProposees({})
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
    setSavedProfiles([])
    setPendingContrats([])
    setSavedToDBMsg(null)
    setUploadQFile(null)
    setUploadQResult(null)
    setUploadQError(null)
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

  // ─── Right panel style ───
  const panelCardStyle = {
    border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px',
    background: '#fff', marginBottom: 12,
  }
  const profileColors = {
    'Défensif': '#16a34a', 'Conservateur': '#22c55e',
    'Neutre / Équilibré': '#f59e0b', 'Dynamique': '#ea580c', 'Offensif': '#dc2626',
  }

  return (
    <OutilPage
      titre="Questionnaire Profil Investisseur"
      sousTitre="Recherchez un client, sélectionnez un contrat Vie, uploadez la proposition, remplissez le questionnaire"
      erreur={error}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* ═══ LEFT COLUMN — main workflow ═══ */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 760 }}>

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

            {/* Un prospect n'est pas encore dans le portefeuille, et un client
                du portefeuille peut n'avoir aucune epargne. Dans les deux cas
                la fiche se fait quand meme : elle ne depend pas d'un contrat. */}
            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                Nouveau client, pas encore d'épargne
              </div>
              <div style={{ fontSize: 12, color: '#64748b', margin: '3px 0 9px', lineHeight: 1.5 }}>
                La fiche se remplit avec le client. Aucun contrat ni fonds n'est nécessaire —
                c'est la version {SEUIL_VERSION ? 'en vigueur aujourd\u2019hui' : 'courante'} qui s'applique.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                  Nom<br />
                  <input value={clientLibre?.nom || ''} placeholder="Dupont"
                    onChange={e => setClientLibre({ ...(clientLibre || {}), nom: e.target.value })}
                    style={{ ...inputStyle, width: 170, marginTop: 3 }} />
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                  Prénom<br />
                  <input value={clientLibre?.prenom || ''} placeholder="Jean"
                    onChange={e => setClientLibre({ ...(clientLibre || {}), prenom: e.target.value })}
                    style={{ ...inputStyle, width: 150, marginTop: 3 }} />
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                  Date de naissance<br />
                  <input value={clientLibre?.date_naissance || ''} placeholder="JJ/MM/AAAA" inputMode="numeric"
                    onChange={e => setClientLibre({ ...(clientLibre || {}), date_naissance: formaterDateSaisie(e.target.value) })}
                    style={{ ...inputStyle, width: 130, marginTop: 3 }} />
                </label>
                <button
                  disabled={!clientLibre?.nom}
                  onClick={() => demarrerSansEpargne(clientLibre)}
                  style={{
                    ...btnPrimary, padding: '9px 16px', fontSize: 13,
                    opacity: clientLibre?.nom ? 1 : 0.5,
                    cursor: clientLibre?.nom ? 'pointer' : 'not-allowed',
                  }}>
                  Commencer la fiche
                </button>
              </div>

              {/* Ce client est peut-etre deja au portefeuille. Le creer une
                  seconde fois donnerait un profil rattache a personne : pas de
                  client_id, pas de dossier, invisible depuis sa fiche. */}
              {doublons.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  background: '#fffaf0', border: '1px solid #f0c478',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', marginBottom: 2 }}>
                    {doublons.some(d => d.pts >= 10)
                      ? 'Ce client est déjà au portefeuille'
                      : 'Des clients portent un nom proche'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#92400e', marginBottom: 7, lineHeight: 1.5 }}>
                    Si c'est lui, pars de sa fiche : le profil sera rattaché à son dossier.
                    Sinon, continue — tu crées bien un nouveau client.
                  </div>
                  {doublons.map(d => (
                    <div key={d.id}
                      onClick={() => { setClientLibre(null); setDoublons([]); selectClient(d) }}
                      style={{
                        padding: '7px 10px', borderRadius: 6, cursor: 'pointer', background: '#fff',
                        border: d.pts >= 10 ? '1px solid #f0c478' : '1px solid #e2e8f0', marginBottom: 5,
                      }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                        {d.nom} {d.prenom}
                        {d.pts >= 10 && (
                          <span style={{
                            marginLeft: 7, fontSize: 9.5, fontWeight: 700, color: '#b45309',
                            background: '#fdf0d8', border: '1px solid #f0c478',
                            borderRadius: 4, padding: '1px 5px',
                          }}>même date de naissance</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                        Dossier {d.dossier}
                        {d.date_naissance && d.date_naissance !== '1900-01-01'
                          ? ` — né(e) le ${d.date_naissance.split('-').reverse().join('/')}`
                          : ' — date de naissance inconnue'}
                        {d.localite ? ` — ${d.localite}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

              {!loadingContrats && contrats.length === 0 && (
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                  Aucun contrat Vie pour ce client.
                </div>
              )}

              {/* Un client du portefeuille peut n'avoir aucune epargne — ou en
                  ouvrir une dont le contrat n'existe pas encore. La fiche ne
                  depend pas d'un contrat. */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 8, lineHeight: 1.5 }}>
                  Pas d'épargne existante, ou un contrat qui n'est pas encore créé ?
                  La fiche se remplit avec le client, sans contrat ni fonds.
                </div>
                <button onClick={() => demarrerSansEpargne(selectedClient)}
                  style={{ ...btnSecondary, padding: '8px 15px', fontSize: 12.5 }}>
                  Faire une fiche sans épargne
                </button>
              </div>
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
                    {clientActif.nom} {clientActif.prenom}
                  </div>
                  {selectedContrat ? (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selectedContrat.compagnie} — {selectedContrat.type_production}
                      {selectedContrat.police ? ` — N° ${selectedContrat.police}` : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#15803d', marginTop: 2, fontWeight: 600 }}>
                      Sans épargne existante — les réponses sont recueillies auprès du client
                    </div>
                  )}
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

              {/* La compagnie ne propose pas de fonds : rien a analyser */}
              {(() => {
                const cie = compagnieSansFonds(selectedContrat?.compagnie, sansFonds)
                if (!cie) return null
                return (
                  <div style={{
                    marginTop: 12, padding: '11px 14px', borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #86efac',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                      {cie.nom} ne propose pas de produits à fonds
                    </div>
                    <div style={{ fontSize: 11.5, color: '#3f6212', marginTop: 3, lineHeight: 1.5 }}>
                      Aucune analyse de risque investisseur à mener sur ce contrat : il n'y a pas
                      de risque de marché. L'analyse des exigences et besoins reste requise.
                    </div>
                  </div>
                )
              })()}

              {/* Extracted funds display */}
              {Object.keys(funds).length > 0 && !manualMode && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                    Fonds extraits :
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {Object.entries(funds).map(([name, pct]) => {
                      // Le risque vient de src/lib/fondsRisque.js — un seul
                      // endroit de verite, partage avec le calcul du profil.
                      const { risque: riskVal, source } = risqueFonds(name, tableFonds)
                      const fundProfile = source === 'branche23' ? 'Fonds a preciser'
                        : riskVal == null ? 'Fonds non reconnu'
                        : profilDepuisScore(riskVal)
                      const classColors = {
                        'Défensif': '#16a34a', 'Conservateur': '#22c55e',
                        'Neutre / Équilibré': '#f59e0b', 'Dynamique': '#ea580c', 'Offensif': '#dc2626',
                        'Fonds a preciser': '#b45309', 'Fonds non reconnu': '#b45309',
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
                              {fundProfile}{riskVal != null ? ` (${riskVal})` : ''}
                            </span>
                            {source === 'inconnu' && (
                              <button onClick={() => setAjoutFonds({ nom: name, sri: '' })}
                                style={{
                                  border: '1px solid #f0c478', background: '#fffaf0', color: '#b45309',
                                  borderRadius: 5, padding: '2px 8px', fontSize: 10.5, fontWeight: 700,
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                enregistrer
                              </button>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Enregistrer un fonds rencontre : la table se remplit par
                      l'usage, pas par un catalogue importe puis perime. */}
                  {ajoutFonds && (
                    <div style={{
                      marginTop: 10, padding: '12px 14px', borderRadius: 8,
                      background: '#fff', border: '1px solid #f0c478',
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                        Enregistrer « {ajoutFonds.nom} »
                      </div>
                      <div style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.5, marginBottom: 8 }}>
                        Le SRI (1 à 7) figure dans le document d'informations clés du fonds.
                        C'est l'indicateur publié par la compagnie — à préférer à une estimation.
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                          Compagnie<br />
                          <input value={ajoutFonds.compagnie ?? (selectedContrat?.compagnie || '')}
                            onChange={e => setAjoutFonds({ ...ajoutFonds, compagnie: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dce4ec',
                                     fontSize: 12, fontFamily: 'inherit', width: 210 }} />
                        </label>
                        <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                          SRI (1-7)<br />
                          <input type="number" min={1} max={7} value={ajoutFonds.sri}
                            onChange={e => setAjoutFonds({ ...ajoutFonds, sri: e.target.value })}
                            style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dce4ec',
                                     fontSize: 12, fontFamily: 'inherit', width: 80 }} />
                        </label>
                        <button
                          disabled={!ajoutFonds.sri}
                          onClick={async () => {
                            try {
                              await enregistrerFonds(supabase, {
                                compagnie: ajoutFonds.compagnie ?? (selectedContrat?.compagnie || ''),
                                nom: ajoutFonds.nom,
                                sri: parseInt(ajoutFonds.sri, 10),
                              })
                              setTableFonds(await chargerFonds(supabase))
                              setAjoutFonds(null)
                            } catch (e) { setError(`Enregistrement du fonds impossible : ${e.message}`) }
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none', background: '#1A3A6B',
                            color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                            cursor: ajoutFonds.sri ? 'pointer' : 'not-allowed',
                            opacity: ajoutFonds.sri ? 1 : 0.5,
                          }}>
                          Enregistrer
                        </button>
                        <button onClick={() => setAjoutFonds(null)}
                          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #dce4ec',
                                   background: '#fff', color: '#64748b', fontSize: 12,
                                   fontFamily: 'inherit', cursor: 'pointer' }}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ce que la composition permet de dire — y compris « rien » */}
                  {(() => {
                    const l = lectureComposition(funds, tableFonds)
                    const couleurs = {
                      'Défensif': '#16a34a', 'Conservateur': '#22c55e',
                      'Neutre / Équilibré': '#f59e0b', 'Dynamique': '#ea580c', 'Offensif': '#dc2626',
                    }
                    // 100 % a capital garanti : il n'y a pas de risque de
                    // marche, donc pas de profil de risque a etablir. Mieux
                    // vaut le dire que d'afficher « Neutre » par defaut.
                    if (l.motif === 'capital_garanti') {
                      return (
                        <div style={{
                          marginTop: 10, padding: '10px 14px', borderRadius: 8,
                          background: '#f0fdf4', border: '1px solid #86efac',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
                            Capital garanti à 100 % — pas de profil de risque à établir
                          </div>
                          <div style={{ fontSize: 11.5, color: '#3f6212', marginTop: 3, lineHeight: 1.5 }}>
                            La valeur du contrat n'est pas exposée aux fluctuations des marchés.
                            Le bulletin financier (connaissances, situation financière, tolérance
                            au risque) ne s'applique pas. L'analyse des exigences et besoins,
                            elle, reste requise.
                          </div>
                        </div>
                      )
                    }
                    if (l.motif === 'branche23_a_preciser') {
                      return (
                        <div style={{
                          marginTop: 10, padding: '10px 14px', borderRadius: 8,
                          background: '#fffaf0', border: '1px solid #f0c478',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>
                            Quel fonds ? « {l.aPreciser.join(' , ')} » ne suffit pas
                          </div>
                          <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 3, lineHeight: 1.5 }}>
                            La branche 23 est une famille, pas un fonds : le risque va d'un fonds
                            obligataire défensif à 100 % actions. Indiquez le nom du fonds pour
                            que le profil veuille dire quelque chose.
                          </div>
                        </div>
                      )
                    }
                    if (l.profil == null) {
                      return (
                        <div style={{
                          marginTop: 10, padding: '10px 14px', borderRadius: 8,
                          background: '#fffaf0', border: '1px solid #f0c478',
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>
                            Aucun fonds reconnu — pas de profil calculable
                          </div>
                          <div style={{ fontSize: 11.5, color: '#92400e', marginTop: 3, lineHeight: 1.5 }}>
                            {l.inconnus.length ? `Non reconnu : ${l.inconnus.join(' , ')}.` : ''} Le
                            profil se construit à partir des réponses du client, pas d'une valeur
                            par défaut.
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div style={{
                        marginTop: 10, padding: '10px 14px', borderRadius: 8,
                        background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
                        border: '1px solid #93c5fd',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: couleurs[l.profil] || '#475569' }}>
                          Orientation de la composition : {l.profil}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Score de risque pondéré : {Math.round(l.score * 10) / 10} / 100
                          {l.reconnuPct < l.totalPct && ` — sur ${Math.round(l.reconnuPct)} % de la composition seulement`}
                        </div>
                        {l.inconnus.length > 0 && (
                          <div style={{ fontSize: 11.5, color: '#b45309', marginTop: 4, lineHeight: 1.5 }}>
                            Non reconnu, donc exclu du calcul : {l.inconnus.join(' , ')}.
                          </div>
                        )}
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
        {step === 'questionnaire' && clientActif && (selectedContrat || sansEpargne) && (
          <>
            {/* Client + contrat + funds summary */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                    {clientActif.nom} {clientActif.prenom}
                  </div>
                  {selectedContrat ? (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selectedContrat.compagnie} — {selectedContrat.type_production}
                      {selectedContrat.police ? ` — N° ${selectedContrat.police}` : ''}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#15803d', marginTop: 2, fontWeight: 600 }}>
                      Sans épargne existante — les réponses sont recueillies auprès du client
                    </div>
                  )}
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
                  {score != null ? score : '—'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                    {profile || 'Profil non déterminé'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {calculProfil.repondues}/{calculProfil.total} questions de risque répondues
                    {score != null ? ` — indice ${score}/100` : ''}
                    {!calculProfil.complet && ' — le profil se précisera en complétant la section « Comportement face au risque »'}
                  </div>
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 3, fontWeight: 600 }}>
                    Le profil n'apparaît pas sur la fiche imprimée : il est conservé dans la fiche du client.
                  </div>
                </div>
                <button style={btnPrimary} onClick={handleGenerate}>
                  Générer le PDF
                </button>
              </div>
            </div>

            {/* Choix de la version — la date d'effet tranche */}
            <div style={{
              ...cardStyle,
              border: desaccordVersion ? '2px solid #b91c1c' : '1px solid #dce4ec',
              background: desaccordVersion ? '#fef2f2' : '#fff',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                4. Version de la fiche d'intermédiation
              </div>

              <div style={{ fontSize: 12.5, color: '#56677c', lineHeight: 1.5, marginBottom: 10 }}>
                {dateEffet.date
                  ? <>Date d'effet retenue : <b>{dateEffet.date.toLocaleDateString('fr-BE')}</b>
                      {' '}({dateEffet.source === 'pdf' ? 'lue dans la proposition' : 'date de création du contrat'})
                      {' → '}<b>{versionDetectee === 'AVANT_2025' ? 'fiche avant 2025' : 'fiche après 2025'}</b>.</>
                  : <>Aucune date d'effet n'a pu être lue, ni dans la proposition ni sur le contrat.
                      <b> Choisis la version toi-même.</b></>}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['AVANT_2025', `Épargne constituée AVANT ${SEUIL_VERSION.slice(0, 4)}`],
                  ['APRES_2025', `Épargne constituée À PARTIR DE ${SEUIL_VERSION.slice(0, 4)}`]].map(([cle, lib]) => {
                  const actif = versionActive === cle
                  return (
                    <button key={cle} onClick={() => setVersionChoisie(cle)} style={{
                      flex: '1 1 220px', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      border: actif ? '2px solid #1A3A6B' : '1px solid #c3cfdb',
                      background: actif ? '#eff6ff' : '#fff', fontFamily: 'inherit',
                      fontSize: 12.5, fontWeight: actif ? 700 : 500,
                      color: actif ? '#1A3A6B' : '#56677c', textAlign: 'left',
                    }}>
                      {lib}
                      <div style={{ fontSize: 10.5, fontWeight: 400, color: '#8c9cb0', marginTop: 2 }}>
                        {FICHES[cle].titreCourt}
                      </div>
                    </button>
                  )
                })}
              </div>

              {desaccordVersion && (
                <div style={{
                  marginTop: 12, padding: '11px 13px', borderRadius: 8,
                  background: '#fff', border: '2px solid #b91c1c',
                }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#b91c1c', marginBottom: 4 }}>
                    ⚠ Attention — vous ne serez pas en ordre
                  </div>
                  <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>
                    Le contrat prend effet le <b>{dateEffet.date?.toLocaleDateString('fr-BE')}</b>, donc la fiche
                    applicable est <b>{versionDetectee === 'AVANT_2025' ? 'celle d\'avant 2025' : 'celle d\'après 2025'}</b>.
                    Vous avez choisi l'autre. Le document produit n'aura jamais pu exister à cette date.
                    {' '}
                    <button onClick={() => setVersionChoisie(null)} style={{
                      border: 'none', background: 'none', padding: 0, font: 'inherit',
                      color: '#b91c1c', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer',
                    }}>Revenir à la version détectée</button>
                  </div>
                </div>
              )}
            </div>

            {/* La fiche elle-même */}
            {fiche
              ? <FicheVieFormulaire fiche={fiche} reponses={answers} onChange={handleAnswerChange} proposees={proposees} />
              : <div style={{ ...cardStyle, fontSize: 13, color: '#8c9cb0' }}>
                  Choisis une version de fiche ci-dessus pour afficher le questionnaire.
                </div>}

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
            {savingToDB && (
              <div style={{ fontSize: 12, color: '#1A3A6B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, border: '2px solid #1A3A6B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Sauvegarde en base de données...
              </div>
            )}
            {savedToDBMsg && (
              <div style={{ fontSize: 12, color: savedToDBMsg.startsWith('Erreur') ? '#dc2626' : '#16a34a', marginBottom: 6, fontWeight: 600 }}>
                {savedToDBMsg}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
              Questionnaire pour <strong>{clientActif?.nom} {clientActif?.prenom}</strong> — Profil :{' '}
              <strong>{profile || 'non établi'}</strong>{score != null ? ` (score ${score}/100)` : ''}
              {horizonYears !== null && <> — Horizon : <strong>{horizonYears} ans</strong></>}
              {/* Un profil calcule sur deux questions repondues sur quatre a
                  exactement la meme tete qu'un profil complet. Il faut le dire :
                  c'est une conclusion qu'on porte dans la fiche du client. */}
              {profile && !calculProfil.complet && (
                <div style={{ color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                  Profil établi sur {calculProfil.repondues} question
                  {calculProfil.repondues > 1 ? 's' : ''} sur {calculProfil.total} —
                  complétez la section « comportement face au risque » pour qu'il soit fiable.
                </div>
              )}
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
      {/* ═══ END LEFT COLUMN ═══ */}

      {/* ═══ RIGHT PANEL ═══ */}
      <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 12, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>

        {/* ── Saved profiles ── */}
        <div style={panelCardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-user-check" style={{ color: '#1A3A6B' }} />
            Profils enregistrés
          </div>
          {!selectedClient ? (
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sélectionnez un client pour voir ses profils</div>
          ) : loadingProfiles ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Chargement...</div>
          ) : savedProfiles.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Aucun profil enregistré</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {savedProfiles.map(p => (
                <div key={p.id} style={{
                  padding: '8px 10px', borderRadius: 6, background: '#f8fafc',
                  border: '1px solid #e2e8f0', fontSize: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: profileColors[p.profil] || '#475569' }}>{p.profil}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>{p.score}/42</span>
                  </div>
                  <div style={{ color: '#64748b', marginTop: 2 }}>
                    {p.nom_client}
                    {p.source === 'uploaded' && <span style={{ marginLeft: 6, color: '#8b5cf6', fontSize: 10, fontWeight: 600 }}>PDF importé</span>}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                    {new Date(p.created_at).toLocaleDateString('fr-BE')}
                    {p.horizon_years ? ` — ${p.horizon_years} ans` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pending Vie contracts ── */}
        <div style={panelCardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-alert-circle" style={{ color: '#f59e0b' }} />
            Contrats Vie sans profil
          </div>
          {!selectedClient ? (
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Sélectionnez un client</div>
          ) : pendingContrats.length === 0 ? (
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Tous les contrats ont un profil</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {pendingContrats.map(ct => (
                <div
                  key={ct.id}
                  onClick={() => { selectContrat(ct); }}
                  style={{
                    padding: '6px 10px', borderRadius: 6, background: '#fffbeb',
                    border: '1px solid #fed7aa', fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fffbeb' }}
                >
                  <div style={{ fontWeight: 600, color: '#92400e' }}>
                    {ct.compagnie || '—'} — {ct.police || '—'}
                  </div>
                  <div style={{ color: '#b45309', fontSize: 11, marginTop: 1 }}>
                    {ct.type_production || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Upload pre-filled questionnaire ── */}
        <div style={panelCardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-file-import" style={{ color: '#8b5cf6' }} />
            Importer questionnaire rempli
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
            Uploadez un questionnaire FSMA déjà rempli — les réponses seront extraites automatiquement.
          </div>

          <div
            style={{
              border: '2px dashed #c4b5fd', borderRadius: 8, padding: '14px 10px',
              textAlign: 'center', background: '#faf5ff', cursor: 'pointer',
              transition: 'all 0.15s', fontSize: 12,
            }}
            onClick={() => document.getElementById('upload-q-input').click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#8b5cf6' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#c4b5fd' }}
            onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c4b5fd'; if (e.dataTransfer.files[0]) handleUploadedQuestionnaire(e.dataTransfer.files[0]) }}
          >
            <input
              id="upload-q-input"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleUploadedQuestionnaire(e.target.files[0]) }}
            />
            {uploadQFile ? (
              <span style={{ color: '#6d28d9', fontWeight: 600 }}>{uploadQFile.name}</span>
            ) : (
              <span style={{ color: '#7c3aed' }}>Glissez ou cliquez — PDF questionnaire</span>
            )}
          </div>

          {uploadQExtracting && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              {uploadQProgress || 'Extraction...'}
            </div>
          )}

          {uploadQError && (
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 8, background: '#fef2f2', padding: '6px 8px', borderRadius: 6 }}>
              {uploadQError}
            </div>
          )}

          {uploadQResult && (
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#f5f3ff', border: '1px solid #c4b5fd' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: profileColors[uploadQResult.profile] || '#475569' }}>
                {uploadQResult.profile}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Score : {uploadQResult.score}/42 — {uploadQResult.answeredCount}/14 réponses détectées
              </div>
              {selectedClient && selectedContrat && (
                <div style={{ fontSize: 10, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                  Sauvegardé pour {selectedClient.nom} {selectedClient.prenom}
                </div>
              )}
              {(!selectedClient || !selectedContrat) && (
                <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
                  Sélectionnez un client + contrat pour sauvegarder
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* ═══ END RIGHT PANEL ═══ */}

      </div>{/* end flex container */}
    </OutilPage>
  )
}
