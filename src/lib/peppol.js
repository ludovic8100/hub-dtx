// Lien Peppol / Billit coupé volontairement.
// Tant que PEPPOL_ACTIF = false : les boutons « 📨 Peppol » sont masqués et
// toute tentative d'envoi est bloquée. Aucune facture ne part sur le réseau.
// Repasser à true le moment venu (après avoir mis BILLIT_API_KEY / BILLIT_PARTY_ID
// dans les variables Vercel — voir api/peppol-send.js).
export const PEPPOL_ACTIF = true
