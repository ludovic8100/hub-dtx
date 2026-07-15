// Payload de virement SEPA au format EPC (QR "European Payments Council").
// Source unique utilisée par le PDF (notesFraisPdf.js) et l'affichage écran (NotesFraisView.jsx)
// pour garantir un QR strictement identique des deux côtés.

export const fmtIban = v => String(v || '').replace(/\s+/g, '').toUpperCase()
export const ibanValide = v => fmtIban(v).length >= 15
export const ibanEspace = v => fmtIban(v).replace(/(.{4})/g, '$1 ').trim()

export function epcPayload({ benefNom = '', iban = '', montant = 0, communication = '' }) {
  const ib = fmtIban(iban)
  if (ib.length < 15) return null
  return ['BCD', '002', '1', 'SCT', '', String(benefNom || ''), ib,
    'EUR' + (Number(montant) || 0).toFixed(2), '', '', String(communication || ''), ''].join('\n')
}
