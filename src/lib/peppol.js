// Lien Peppol / Billit coupé volontairement.
// Tant que PEPPOL_ACTIF = false : les boutons « 📨 Peppol » sont masqués et
// toute tentative d'envoi est bloquée. Aucune facture ne part sur le réseau.
// Repasser à true le moment venu (après avoir mis la clé API Billit prod dans n8n).
export const PEPPOL_ACTIF = true
