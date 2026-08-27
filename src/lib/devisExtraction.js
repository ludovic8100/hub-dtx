// Extraction des devis fournisseurs (SDA, Marquise) depuis un PDF
// Utilise pdfjs-dist pour lire le texte, puis parse selon le fournisseur détecté.
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

// Lit tout le texte d'un fichier PDF
export async function lirePdfTexte(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let full = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Reconstituer les lignes en groupant par position verticale
    const items = content.items
    let lastY = null, ligne = '', lignes = []
    for (const it of items) {
      const y = Math.round(it.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 3) { lignes.push(ligne.trim()); ligne = '' }
      ligne += it.str + ' '
      lastY = y
    }
    if (ligne.trim()) lignes.push(ligne.trim())
    full += lignes.join('\n') + '\n'
  }
  return full
}

// Nettoie un nombre "1 704,00" ou "1,704.00" -> 1704.00
function num(s) {
  if (s == null) return 0
  let t = String(s).replace(/\s/g, '').trim()
  // format FR "1.234,56" -> enlever points milliers, virgule -> point
  if (/,\d{2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  // format US "1,704.00" -> enlever virgules milliers
  else t = t.replace(/,/g, '')
  const n = parseFloat(t)
  return isNaN(n) ? 0 : n
}

// Détecte le fournisseur d'après le contenu
export function detecterFournisseur(texte) {
  const t = texte.toUpperCase()
  if (t.includes('MARQUISES') || t.includes('STORES-MARQUISES') || /DV\d{6,}/.test(texte)) return 'Marquise'
  if (t.includes('SDA') || t.includes('PETIT QUINQUIN') || t.includes('FRETIN')) return 'SDA'
  return 'Inconnu'
}

// ── Extraction MARQUISE ──
function extraireMarquise(texte) {
  const d = { fournisseur: 'Marquise', lignes: [], meta: {} }
  let m = texte.match(/(DV\d+)\s+du\s+(\d{2}\/\d{2}\/\d{4})/)
  if (m) { d.meta.numero_fournisseur = m[1]; d.meta.date = m[2] }
  m = texte.match(/Ref Client:\s*(.+?)(?:\n|Cde|$)/)
  if (m) d.meta.ref_client = m[1].trim()

  // Ligne article : Repère Article PrixPublic Remise% PrixUnit Qté UM TotalHT
  const reLigne = /(A\d+)\s+(\d+)\s+([\d\s.,]+?)\s+([\d,]+)%\s+([\d\s.,]+?)\s+([\d,]+)\s+(PC|\w{1,3})\s+([\d\s.,]+)/g
  let ml
  while ((ml = reLigne.exec(texte)) !== null) {
    const prixPublic = num(ml[3]), remise = num(ml[4]), qte = num(ml[6]) || 1
    const prixAchat = num(ml[5]) // prix unit = ce que LODE paie (public - remise fournisseur)
    // désignation = ligne "MODELE : ..." si présente
    let designation = ml[1] + ' - ' + ml[2]
    const mod = texte.match(/MODELE\s*:\s*([^\n:]+)/)
    if (mod) designation = mod[1].trim()
    // description = toutes les lignes commençant par "-"
    const desc = (texte.match(/^-\s*(.+)$/gm) || []).map(x => x.replace(/^-\s*/, '')).join(' · ')
    d.lignes.push({
      fournisseur: 'Marquise', designation, description: desc,
      prix_public: prixPublic, remise_pct: remise, quantite: qte,
      prix_achat: prixAchat, taux_tva: 21,
    })
  }
  // totaux
  m = texte.match(/Total HT\s+([\d\s.,]+)\s*EUR/); if (m) d.meta.total_ht = num(m[1])
  m = texte.match(/Montant TTC\s+([\d\s.,]+)\s*EUR/); if (m) d.meta.total_ttc = num(m[1])
  return d
}

// ── Extraction SDA ──
function extraireSDA(texte) {
  const d = { fournisseur: 'SDA', lignes: [], meta: {} }
  let m = texte.match(/Devis N°(\d+)/)
  if (m) d.meta.numero_fournisseur = m[1]
  m = texte.match(/Référence:\s*(.+)/)
  if (m) d.meta.ref_client = m[1].trim()
  m = texte.match(/Date du devis\s+(\d{2}\/\d{2}\/\d{4})/)
  if (m) d.meta.date = m[1]

  // Lignes : "désignation ... PRIX€ QTE PRIX€"
  const reLigne = /([A-Za-zÀ-ÿ][^\n]*?)\s+([\d.,]+)€\s+(\d+)\s+([\d.,]+)€/g
  let ml
  while ((ml = reLigne.exec(texte)) !== null) {
    const desc = ml[1].trim()
    // ignorer les lignes de total
    if (/total|prix public|remise/i.test(desc)) continue
    const prixUnit = num(ml[2]), qte = num(ml[3]) || 1, total = num(ml[4])
    d.lignes.push({
      fournisseur: 'SDA', designation: desc, description: '',
      prix_public: prixUnit, remise_pct: 0, quantite: qte,
      prix_achat: total, taux_tva: 21,
    })
  }
  // remise globale SDA (en bas)
  m = texte.match(/Remise\s+([\d.,]+)\s*%/); if (m) d.meta.remise_globale = num(m[1])
  m = texte.match(/Prix Public total HT\s+([\d.,]+)/); if (m) d.meta.prix_public_total = num(m[1])
  m = texte.match(/Prix total HT\s+([\d.,]+)/); if (m) d.meta.prix_net_total = num(m[1])
  return d
}

// Point d'entrée : lit un fichier PDF et retourne les données extraites
export async function extraireDevis(file) {
  const texte = await lirePdfTexte(file)
  const fournisseur = detecterFournisseur(texte)
  let data
  if (fournisseur === 'Marquise') data = extraireMarquise(texte)
  else if (fournisseur === 'SDA') data = extraireSDA(texte)
  else data = { fournisseur: 'Inconnu', lignes: [], meta: {}, texte_brut: texte }
  data.nom_fichier = file.name
  return data
}
