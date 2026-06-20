// Traductions des libellés et CGV pour les devis/factures LODE
// Langues : FR (défaut), NL, DE, EN

export const LANGUES = [
  { code: 'fr', label: 'Français' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
]

export const I18N = {
  fr: {
    devis: 'DEVIS', facture: 'FACTURE',
    date: 'Date', validite: 'Validité', echeance: 'Échéance',
    client: 'CLIENT', objet: 'Objet',
    description: 'Description', qte: 'Qté', pu: 'P.U.', remise: 'Rem.', tva: 'TVA', totalHT: 'Total HT',
    remiseGlobale: 'Remise globale', totalTVA: 'TVA', totalTTC: 'Total TTC',
    paiement: 'Paiement par virement', communication: 'Communication',
    cgvTitre: 'Conditions générales de vente',
    merci: 'Merci de votre confiance.',
  },
  nl: {
    devis: 'OFFERTE', facture: 'FACTUUR',
    date: 'Datum', validite: 'Geldig tot', echeance: 'Vervaldatum',
    client: 'KLANT', objet: 'Betreft',
    description: 'Omschrijving', qte: 'Aant.', pu: 'Eenh.pr.', remise: 'Kort.', tva: 'btw', totalHT: 'Totaal excl.',
    remiseGlobale: 'Globale korting', totalTVA: 'btw', totalTTC: 'Totaal incl.',
    paiement: 'Betaling per overschrijving', communication: 'Mededeling',
    cgvTitre: 'Algemene verkoopvoorwaarden',
    merci: 'Bedankt voor uw vertrouwen.',
  },
  de: {
    devis: 'ANGEBOT', facture: 'RECHNUNG',
    date: 'Datum', validite: 'Gültig bis', echeance: 'Fälligkeit',
    client: 'KUNDE', objet: 'Betreff',
    description: 'Beschreibung', qte: 'Menge', pu: 'Einzelpr.', remise: 'Rabatt', tva: 'MwSt', totalHT: 'Netto',
    remiseGlobale: 'Gesamtrabatt', totalTVA: 'MwSt', totalTTC: 'Gesamt (Brutto)',
    paiement: 'Zahlung per Überweisung', communication: 'Verwendungszweck',
    cgvTitre: 'Allgemeine Geschäftsbedingungen',
    merci: 'Vielen Dank für Ihr Vertrauen.',
  },
  en: {
    devis: 'QUOTE', facture: 'INVOICE',
    date: 'Date', validite: 'Valid until', echeance: 'Due date',
    client: 'CLIENT', objet: 'Subject',
    description: 'Description', qte: 'Qty', pu: 'Unit price', remise: 'Disc.', tva: 'VAT', totalHT: 'Subtotal',
    remiseGlobale: 'Global discount', totalTVA: 'VAT', totalTTC: 'Total incl. VAT',
    paiement: 'Payment by bank transfer', communication: 'Reference',
    cgvTitre: 'General terms and conditions of sale',
    merci: 'Thank you for your business.',
  },
}

// CGV standard par langue (modèle belge, modifiable)
const IBAN_LODE = 'BE40 3632 4445 2063'
export const CGV_I18N = {
  fr: [
    "1. Validité — Le présent devis est valable jusqu'à la date de validité mentionnée. Passé ce délai, les prix et conditions sont susceptibles de révision.",
    "2. Commande & acompte — Toute commande implique l'acceptation des présentes conditions. Un acompte de 30 % est demandé à la commande, le solde étant payable à la livraison/fin des travaux.",
    "3. Délais — Les délais de livraison et d'installation sont donnés à titre indicatif. Un retard ne peut donner lieu à annulation de commande, dommages-intérêts ou indemnité.",
    `4. Paiement — Nos factures sont payables au comptant, au plus tard à la date d'échéance indiquée. Tout paiement par virement au compte ${IBAN_LODE}.`,
    "5. Retard de paiement — À défaut de paiement à l'échéance, les sommes dues porteront de plein droit et sans mise en demeure un intérêt de retard de 10 % l'an, majoré d'une indemnité forfaitaire de 10 % avec un minimum de 50 €.",
    "6. Réserve de propriété — Les biens livrés restent la propriété de LODE SRL jusqu'au paiement intégral du prix.",
    "7. Garantie — Les produits bénéficient de la garantie légale. Les interventions consécutives à un usage anormal, un défaut d'entretien ou une intervention de tiers ne sont pas couvertes.",
    "8. Réclamations — Toute réclamation doit être formulée par écrit dans les 8 jours suivant la livraison ou la facturation.",
    "9. Litiges — Tout litige relève de la compétence exclusive des tribunaux de l'arrondissement du siège de LODE SRL, le droit belge étant seul applicable.",
  ],
  nl: [
    "1. Geldigheid — Deze offerte is geldig tot de vermelde vervaldatum. Nadien kunnen prijzen en voorwaarden worden herzien.",
    "2. Bestelling & voorschot — Elke bestelling impliceert de aanvaarding van deze voorwaarden. Bij bestelling wordt een voorschot van 30 % gevraagd, het saldo is betaalbaar bij levering/voltooiing van de werken.",
    "3. Termijnen — Lever- en installatietermijnen worden bij benadering opgegeven. Vertraging kan geen aanleiding geven tot annulering van de bestelling, schadevergoeding of compensatie.",
    `4. Betaling — Onze facturen zijn contant betaalbaar, uiterlijk op de vermelde vervaldatum. Betaling per overschrijving op rekening ${IBAN_LODE}.`,
    "5. Betalingsachterstand — Bij niet-betaling op de vervaldag is van rechtswege en zonder ingebrekestelling een verwijlintrest van 10 % per jaar verschuldigd, verhoogd met een forfaitaire schadevergoeding van 10 % met een minimum van 50 €.",
    "6. Eigendomsvoorbehoud — De geleverde goederen blijven eigendom van LODE BV tot de volledige betaling van de prijs.",
    "7. Waarborg — De producten genieten de wettelijke garantie. Interventies ten gevolge van abnormaal gebruik, gebrek aan onderhoud of tussenkomst van derden zijn niet gedekt.",
    "8. Klachten — Elke klacht dient schriftelijk te worden ingediend binnen 8 dagen na levering of facturatie.",
    "9. Geschillen — Elk geschil valt onder de uitsluitende bevoegdheid van de rechtbanken van het arrondissement van de zetel van LODE BV, met toepassing van het Belgisch recht.",
  ],
  de: [
    "1. Gültigkeit — Dieses Angebot ist bis zum angegebenen Gültigkeitsdatum gültig. Danach können Preise und Bedingungen angepasst werden.",
    "2. Bestellung & Anzahlung — Jede Bestellung beinhaltet die Annahme dieser Bedingungen. Bei Bestellung wird eine Anzahlung von 30 % verlangt, der Restbetrag ist bei Lieferung/Fertigstellung der Arbeiten fällig.",
    "3. Fristen — Liefer- und Montagefristen sind unverbindlich. Eine Verzögerung berechtigt nicht zur Stornierung der Bestellung, zu Schadenersatz oder Entschädigung.",
    `4. Zahlung — Unsere Rechnungen sind sofort fällig, spätestens zum angegebenen Fälligkeitsdatum. Zahlung per Überweisung auf das Konto ${IBAN_LODE}.`,
    "5. Zahlungsverzug — Bei Nichtzahlung am Fälligkeitstag werden von Rechts wegen und ohne Mahnung Verzugszinsen von 10 % pro Jahr fällig, zuzüglich einer pauschalen Entschädigung von 10 % mit einem Mindestbetrag von 50 €.",
    "6. Eigentumsvorbehalt — Die gelieferten Waren bleiben bis zur vollständigen Bezahlung Eigentum der LODE GmbH.",
    "7. Garantie — Die Produkte genießen die gesetzliche Gewährleistung. Eingriffe infolge unsachgemäßer Nutzung, mangelnder Wartung oder Eingriffen Dritter sind nicht gedeckt.",
    "8. Reklamationen — Jede Reklamation ist innerhalb von 8 Tagen nach Lieferung oder Rechnungsstellung schriftlich einzureichen.",
    "9. Streitigkeiten — Für alle Streitigkeiten sind ausschließlich die Gerichte des Bezirks des Sitzes der LODE GmbH zuständig; es gilt ausschließlich belgisches Recht.",
  ],
  en: [
    "1. Validity — This quote is valid until the validity date stated. After this date, prices and conditions are subject to review.",
    "2. Order & deposit — Any order implies acceptance of these terms. A 30% deposit is required upon order, with the balance payable on delivery/completion of the works.",
    "3. Deadlines — Delivery and installation times are indicative. A delay cannot give rise to order cancellation, damages or compensation.",
    `4. Payment — Our invoices are payable immediately, no later than the due date stated. Payment by bank transfer to account ${IBAN_LODE}.`,
    "5. Late payment — Failing payment by the due date, the amounts due shall automatically and without notice bear late-payment interest of 10% per year, plus a fixed indemnity of 10% with a minimum of €50.",
    "6. Retention of title — The goods delivered remain the property of LODE SRL until full payment of the price.",
    "7. Warranty — The products are covered by the legal warranty. Interventions resulting from abnormal use, lack of maintenance or third-party intervention are not covered.",
    "8. Claims — Any claim must be made in writing within 8 days of delivery or invoicing.",
    "9. Disputes — Any dispute falls under the exclusive jurisdiction of the courts of the district of LODE SRL's registered office, Belgian law being solely applicable.",
  ],
}
