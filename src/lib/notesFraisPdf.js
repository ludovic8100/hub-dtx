// Génération de la pièce PDF d'une note de frais validée (client, jsPDF).
// Design aligné sur la maquette validée : en-tête coloré + logo, tableau,
// totaux, encart remboursement avec QR de paiement SEPA (EPC), annexe justificatifs.
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { fmtIban, ibanEspace, epcPayload } from './epc'
import { ENTITES } from './entites'
import { supabase } from './supabase'

const W = 595.28, H = 841.89, MX = 44, RX = W - 44, CW = RX - MX
const GREY = [100, 116, 139], DGREY = [30, 41, 59], MGREY = [71, 85, 105]
const LINE = [226, 232, 240], GREEN = [22, 163, 74], WHITE = [255, 255, 255]
const CAT_KM = 'Kilométrique'

const hx = h => { h = String(h || '#000000').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
const tint = (rgb, k) => rgb.map(c => Math.round(c * k + 255 * (1 - k)))
const eur = n => (Number(n) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const fmtD = d => { try { return d ? new Date(d).toLocaleDateString('fr-BE') : '—' } catch { return '—' } }
const isKm = l => (l.categorie === CAT_KM)

// fetch (png/svg) -> blob URL local -> Image -> canvas -> PNG dataURL (+ dims), sans taint CORS
async function imgDataURL(url) {
  const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url)
  const blob = await r.blob(); const obj = URL.createObjectURL(blob)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = obj })
    const w = img.naturalWidth || 300, h = img.naturalHeight || 300
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    cv.getContext('2d').drawImage(img, 0, 0, w, h)
    return { dataURL: cv.toDataURL('image/png'), w, h }
  } finally { URL.revokeObjectURL(obj) }
}
const dims = dataURL => new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 }); i.onerror = () => res({ w: 1, h: 1 }); i.src = dataURL })

function drawContain(doc, dataURL, natW, natH, bx, by, bw, bh) {
  const r = Math.min(bw / natW, bh / natH), w = natW * r, h = natH * r
  doc.addImage(dataURL, 'PNG', bx + (bw - w) / 2, by + (bh - h) / 2, w, h, undefined, 'FAST')
}
function truncate(doc, txt, maxw) {
  txt = String(txt || ''); if (doc.getTextWidth(txt) <= maxw) return txt
  while (txt.length > 3 && doc.getTextWidth(txt + '…') > maxw) txt = txt.slice(0, -1)
  return txt + '…'
}

/**
 * @param {Object} o
 * @param {string} o.entiteKey  clé société ('dynassur'…)
 * @param {Object} o.note       { numero, titre, periode, total, validee_at, auteur_nom }
 * @param {Array}  o.lignes     lignes calculées (date, categorie, description, km_distance, km_taux, montant_ht, montant_tva, montant_ttc, justificatif_path, justificatif_nom)
 * @param {string} o.benefNom
 * @param {string} o.benefIban
 * @returns {Promise<Blob>}
 */
export async function genererPdfNote({ entiteKey = 'dynassur', note = {}, lignes = [], benefNom = '', benefIban = '', sigImage = '', sigNom = '', sigAt = null, valideParNom = '', valideAt = null }) {
  const ent = ENTITES[entiteKey] || ENTITES.dynassur
  const COL = hx(ent.color), DARK = hx(ent.colorDark || ent.color)
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  doc.setProperties({ title: `Note de frais ${note.numero || ''} — ${ent.label}` })

  const rows = lignes.map(l => {
    const km = isKm(l)
    let desc = l.description || (km ? 'Indemnité kilométrique' : '')
    if (km) {
      const d = Number(l.km_distance) || 0, t = Number(l.km_taux) || 0
      desc = (desc ? desc + '  ' : '') + `(${(''+d).replace('.', ',')} km × ${(''+t).replace('.', ',')} €)`
    }
    return {
      date: l.date ? fmtD(l.date) : '—', cat: km ? CAT_KM : (l.categorie || '—'), desc,
      ht: Number(l.montant_ht) || 0, tva: Number(l.montant_tva) || 0, ttc: Number(l.montant_ttc) || 0,
      km, justificatif_path: l.justificatif_path, justificatif_nom: l.justificatif_nom,
    }
  })
  const tHT = rows.reduce((s, r) => s + r.ht, 0)
  const tTVA = rows.reduce((s, r) => s + r.tva, 0)
  const tTTC = Number(note.total != null ? note.total : rows.reduce((s, r) => s + r.ttc, 0))

  // logo (ou monogramme)
  let logo = null
  if (ent.logo) { try { logo = await imgDataURL(ent.logo) } catch { logo = null } }
  const mono = entiteKey === 'hexagroup' ? 'H' : entiteKey === 'groupe' ? 'G' : (ent.label || '?')[0]

  // QR EPC (si IBAN valide)
  const ibanRaw = fmtIban(benefIban)
  const hasIban = ibanRaw.length >= 15
  let qr = null
  if (hasIban) {
    const payload = epcPayload({ benefNom, iban: ibanRaw, montant: tTTC, communication: note.numero })
    try { qr = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 240, color: { dark: '#0f172a', light: '#ffffff' } }) } catch { qr = null }
  }

  // ───────── EN-TÊTE ─────────
  const BH = 96
  doc.setFillColor(...COL); doc.rect(0, 0, W, BH, 'F')
  doc.setFillColor(...DARK); doc.rect(0, 0, 7, BH, 'F')
  const ls = 66, lx = MX, ly = (BH - ls) / 2
  doc.setFillColor(...WHITE); doc.setDrawColor(...tint(COL, .25)); doc.setLineWidth(0.8)
  doc.roundedRect(lx, ly, ls, ls, 10, 10, 'FD')
  if (logo) { drawContain(doc, logo.dataURL, logo.w, logo.h, lx + 9, ly + 9, ls - 18, ls - 18) }
  else { doc.setTextColor(...COL); doc.setFont('helvetica', 'bold'); doc.setFontSize(ls * 0.5); doc.text(mono, lx + ls / 2, ly + ls / 2 + ls * 0.17, { align: 'center' }) }
  const tx = MX + ls + 20
  doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.text('NOTE DE FRAIS', tx, 45)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.text('Pièce justificative de remboursement', tx, 64)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(ent.label || '', RX, 44, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(235, 240, 245); doc.text('Hub DTX', RX, 60, { align: 'right' })

  // ───────── INFOS ─────────
  const lbl = (x, y, t) => { doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(String(t).toUpperCase(), x, y) }
  const val = (x, y, t, col = DGREY, sz = 10.5) => { doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.text(String(t || '—'), x, y) }
  const c1 = MX, c2 = MX + 205, c3 = MX + 375
  lbl(c1, 126, 'Émetteur'); val(c1, 140, ent.label)
  lbl(c1, 158, 'Collaborateur'); val(c1, 172, benefNom || note.auteur_nom || '—')
  lbl(c2, 126, 'N° de note'); val(c2, 140, note.numero || '—')
  lbl(c2, 158, 'Période'); val(c2, 172, note.periode || '—')
  lbl(c3, 126, 'Statut'); doc.setTextColor(...GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text('VALIDÉE', c3, 140)
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('le ' + fmtD(note.validee_at), c3, 154)

  // ───────── TITRE ─────────
  doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(note.titre || 'Note de frais', MX, 196)
  doc.setFillColor(...COL); doc.rect(MX, 201, 44, 3, 'F')

  // ───────── TABLEAU ─────────
  const cols = [['Date', 60, 'l'], ['Catégorie', 92, 'l'], ['Description', 200, 'l'], ['HT', 52, 'r'], ['TVA', 47, 'r'], ['TTC', 56, 'r']]
  const xs = [MX]; cols.forEach(c => xs.push(xs[xs.length - 1] + c[1]))
  const drawTableHeader = top => {
    doc.setFillColor(...COL); doc.rect(MX, top, CW, 21, 'F')
    doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    cols.forEach((c, i) => { c[2] === 'l' ? doc.text(c[0], xs[i] + 7, top + 14) : doc.text(c[0], xs[i + 1] - 7, top + 14, { align: 'right' }) })
    return top + 21
  }
  let cy = drawTableHeader(214)
  const rowH = 24, ROWLIMIT = H - 60
  rows.forEach((r, i) => {
    if (cy + rowH > ROWLIMIT) { // saut de page tableau
      doc.setFillColor(...LINE); doc.rect(0, H - 40, W, 0.8, 'F'); doc.addPage()
      doc.setFillColor(...COL); doc.rect(0, 0, W, 40, 'F'); doc.setFillColor(...DARK); doc.rect(0, 0, 7, 40, 'F')
      doc.setTextColor(...WHITE); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('NOTE DE FRAIS (suite)', MX, 26)
      cy = drawTableHeader(56)
    }
    if (i % 2 === 1) { doc.setFillColor(...tint(COL, .05)); doc.rect(MX, cy, CW, rowH, 'F') }
    doc.setTextColor(...DGREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text(r.date, xs[0] + 7, cy + 16)
    doc.text(truncate(doc, r.cat, cols[1][1] - 12), xs[1] + 7, cy + 16)
    doc.text(truncate(doc, r.desc, cols[2][1] - 12), xs[2] + 7, cy + 16)
    doc.text(eur(r.ht), xs[4] - 7, cy + 16, { align: 'right' })
    doc.text(r.km ? '—' : eur(r.tva), xs[5] - 7, cy + 16, { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.text(eur(r.ttc), xs[6] - 7, cy + 16, { align: 'right' })
    cy += rowH
  })
  doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.line(MX, cy, RX, cy)

  // place-t-on totaux + encart sur cette page ?
  const NEED = 60 + 122 + 30
  if (cy + NEED > H - 40) { doc.setFillColor(...LINE); doc.rect(0, H - 40, W, 0.8, 'F'); doc.addPage(); cy = 56 }

  // ───────── TOTAUX ─────────
  const tw = 236, tx0 = RX - tw, ty = cy + 12
  const totline = (yy, label, value, big) => {
    doc.setTextColor(...(big ? DARK : MGREY)); doc.setFont('helvetica', big ? 'bold' : 'normal'); doc.setFontSize(big ? 11 : 9.5); doc.text(label, tx0 + 12, yy)
    doc.setTextColor(...(big ? COL : DGREY)); doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 15 : 10); doc.text(eur(value), RX - 12, yy, { align: 'right' })
  }
  totline(ty + 14, 'Total HT', tHT)
  totline(ty + 31, 'Total TVA', tTVA)
  doc.setDrawColor(...tint(COL, .4)); doc.setLineWidth(1); doc.line(tx0 + 12, ty + 40, RX - 12, ty + 40)
  doc.setFillColor(...tint(COL, .07)); doc.roundedRect(tx0, ty + 46, tw, 24, 5, 5, 'F')
  totline(ty + 62, 'TOTAL À REMBOURSER', tTTC, true)

  // ───────── ENCART REMBOURSEMENT ─────────
  const eh = 122, ey = ty + 88
  doc.setFillColor(...tint(COL, .06)); doc.setDrawColor(...COL); doc.setLineWidth(1.2)
  doc.roundedRect(MX, ey, CW, eh, 8, 8, 'FD')
  doc.setTextColor(...COL); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('REMBOURSEMENT', MX + 16, ey + 22)
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text(hasIban ? 'Virement SEPA — scannez le QR avec votre application bancaire'
                   : 'IBAN du bénéficiaire non renseigné — QR de paiement indisponible', MX + 16, ey + 36)
  const rk = (yy, k, v) => { doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(String(k).toUpperCase(), MX + 16, yy); doc.setTextColor(...DGREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(String(v || '—'), MX + 16, yy + 13) }
  rk(ey + 54, 'Bénéficiaire', benefNom || note.auteur_nom || '—')
  rk(ey + 82, 'IBAN', hasIban ? ibanEspace(ibanRaw) : 'À renseigner')
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('COMMUNICATION', MX + 250, ey + 54)
  doc.setTextColor(...DGREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(note.numero || '—', MX + 250, ey + 67)
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('MONTANT', MX + 250, ey + 82)
  doc.setTextColor(...COL); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(eur(tTTC), MX + 250, ey + 102)
  if (qr) {
    const qs = 88, qx = RX - 16 - qs, qy = ey + (eh - qs) / 2 - 4
    doc.setFillColor(...WHITE); doc.setDrawColor(...tint(COL, .3)); doc.setLineWidth(0.8)
    doc.roundedRect(qx - 6, qy - 6, qs + 12, qs + 24, 6, 6, 'FD')
    doc.addImage(qr, 'PNG', qx, qy, qs, qs)
    doc.setTextColor(...MGREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text('Scannez pour payer', qx + qs / 2, qy + qs + 12, { align: 'center' })
  }

  const nj = rows.filter(r => !r.km).length
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
  doc.text(`${nj} justificatif(s) annexé(s) — voir ci-après. Ligne(s) kilométrique(s) : indemnité sans justificatif.`, MX, ey + eh + 18)

  // ───────── SIGNATURES ─────────
  let sy = ey + eh + 36
  const sigBlkH = 96, halfW = (CW - 16) / 2
  if (sy + sigBlkH > H - 50) { footer(doc, note.numero); doc.addPage(); sy = 64 }
  const sigBox = (bx, title) => {
    doc.setFillColor(252, 252, 253); doc.setDrawColor(...LINE); doc.setLineWidth(1)
    doc.roundedRect(bx, sy, halfW, sigBlkH, 6, 6, 'FD')
    doc.setTextColor(...GREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(title, bx + 12, sy + 16)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(bx + 12, sy + 70, bx + halfW - 12, sy + 70)
  }
  sigBox(MX, 'COLLABORATEUR')
  sigBox(MX + halfW + 16, 'VISA — ADMINISTRATEUR')
  if (sigImage) { try { const d = await dims(sigImage); drawContain(doc, sigImage, d.w, d.h, MX + 12, sy + 22, halfW - 24, 44) } catch { /* ignore */ } }
  doc.setTextColor(...DGREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(truncate(doc, sigNom || note.auteur_nom || '—', halfW - 24), MX + 12, sy + 84)
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Signé le ' + fmtD(sigAt), MX + halfW - 12, sy + 84, { align: 'right' })
  const vx = MX + halfW + 16
  doc.setTextColor(...GREEN); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Bon pour accord', vx + 12, sy + 44)
  doc.setTextColor(...DGREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text(truncate(doc, valideParNom || '—', halfW - 24), vx + 12, sy + 84)
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('Approuvé le ' + fmtD(valideAt), vx + halfW - 12, sy + 84, { align: 'right' })

  footer(doc, note.numero)

  // ───────── ANNEXE JUSTIFICATIFS ─────────
  const justifs = rows.filter(r => !r.km && r.justificatif_path)
  if (justifs.length) {
    doc.addPage(); annexeHeader(doc, ent, COL, DARK, note.numero)
    let ay = 58 + 26
    for (const j of justifs) {
      const isImg = /\.(png|jpe?g|webp|gif|bmp)$/i.test(j.justificatif_nom || '') || /image\//i.test(j.justificatif_nom || '')
      let embed = null
      if (isImg) { try { const su = await supabase.storage.from('notes-frais').createSignedUrl(j.justificatif_path, 3600); if (su?.data?.signedUrl) { const d = await imgDataURL(su.data.signedUrl); embed = d } } catch { embed = null } }
      const bh = embed ? 300 : 96
      if (ay + bh + 16 > H - 50) { footer(doc, note.numero); doc.addPage(); annexeHeader(doc, ent, COL, DARK, note.numero, true); ay = 58 + 26 }
      doc.setFillColor(248, 250, 252); doc.setDrawColor(...LINE); doc.setLineWidth(1); doc.roundedRect(MX, ay, CW, bh, 6, 6, 'FD')
      doc.setFillColor(...COL); doc.rect(MX, ay, CW, 3, 'F')
      doc.setTextColor(...DGREY); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(`${j.cat} — ${eur(j.ttc)}`, MX + 14, ay + 22)
      doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(truncate(doc, j.justificatif_nom || 'Justificatif', CW - 28), MX + 14, ay + 38)
      if (embed) { const dd = await dims(embed.dataURL); drawContain(doc, embed.dataURL, dd.w, dd.h, MX + 14, ay + 46, CW - 28, bh - 58) }
      else { doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.text('Justificatif PDF joint (consultable depuis la ligne de la note).', MX + 14, ay + 62) }
      ay += bh + 16
    }
    footer(doc, note.numero)
  }

  return doc.output('blob')
}

function footer(doc, numero) {
  doc.setFillColor(...LINE); doc.rect(0, H - 40, W, 0.8, 'F')
  doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('Pièce générée par Hub DTX — document interne à joindre en comptabilité.', MX, H - 26)
  doc.text(String(numero || ''), RX, H - 26, { align: 'right' })
}
function annexeHeader(doc, ent, COL, DARK, numero, suite) {
  const BH = 58
  doc.setFillColor(...COL); doc.rect(0, 0, W, BH, 'F'); doc.setFillColor(...DARK); doc.rect(0, 0, 7, BH, 'F')
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text('ANNEXE — JUSTIFICATIFS' + (suite ? ' (suite)' : ''), MX, 37)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`${ent.label} · ${numero || ''}`, RX, 37, { align: 'right' })
}
