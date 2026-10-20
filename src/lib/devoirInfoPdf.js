// Génération du PDF « Devoir d'information — Fiche pour une assurance non-vie » (Dynassur).
// Reproduit le modèle Word « Devoir d'Information vierge - Hub - Dynassur ».
// Les constantes CABINET / TEXTES sont à adapter ici si le modèle évolue.
import { jsPDF } from 'jspdf'

export const CABINET = {
  nom: 'Dynassur SPRL',
  adresse: 'Chaussée de Tongres 489 - 4450 Juprelle',
  contact: '04/248.29.38 - info@dynassur.be',
  fsma: "N° d'inscription FSMA 116263 A en tant que courtier en assurances, numéro d'entreprise 0677519858",
}

const T = {
  loi: "Par le biais du présent document, notre bureau agit conformément à la version consolidée de la loi du 25 juin 1992 sur le contrat d'assurance terrestre, de la loi 27 mars 1995 relative à l'intermédiation en assurances et en réassurances et à la distribution d'assurances, à la loi du 4 avril 2014 relative aux assurances qui entre en vigueur le 1 novembre 2014 et à la loi du 2 août 2002 relative à la surveillance du secteur financier et aux services financiers ainsi que des arrêtés d'exécution y afférent.",
  email: "Vous confirmez votre choix de recevoir les informations légales, précontractuelles et contractuelles, par voie électronique ou de les consulter sur le site Web, sauf si celles-ci ne sont pas encore disponibles électroniquement.",
  analyse: [
    "Afin de pouvoir vous recommander un produit d'assurance répondant à votre demande, notre bureau analyse, d'une part, le risque à assurer et, d'autre part, vos exigences et besoins relatifs au contrat d'assurance à souscrire.",
    "Dans le cadre de cette analyse, diverses questions vous ont été posées, notamment en ce qui concerne le preneur d'assurance et les assurés, la description du risque, les garanties souhaitées, d'éventuels contrats d'assurance antérieurs, des antécédents et d'autres remarques et précisions d'ordre général. Afin de pouvoir vous proposer une couverture d'assurance optimale, nous attirons votre attention sur le risque de sous-assurance, de sur assurance, de double assurance et de couverture inadéquate.",
    "Vos réponses sont reprises dans la proposition d'assurance du produit que vous souhaitez souscrire et/ou se reflètent dans les descriptions de garanties reprises dans les conditions particulières du produit que vous souhaitez souscrire.",
    "Vous confirmez avoir déclaré exactement toutes les circonstances connues de vous qui doivent raisonnablement être considérées comme des données susceptibles d'influencer cette analyse.",
  ],
  nomAdresse: "Vous confirmez que vous avez été informé de votre droit de solliciter le nom et l'adresse de l'entreprise ou des entreprises d'assurances avec laquelle (lesquelles) notre bureau travaille ou peut travailler.",
  base: [
    "(1) de l'analyse effectuée ci-avant de vos exigences et besoins concernant une assurance non-vie,",
    "(2) d'une analyse impartiale d'un nombre suffisant d'assurances non-vie disponibles sur le marché répondant à vos exigences et besoins.",
  ],
  repond: "Ce produit répond en effet en termes de type d'assurance non-vie et de caractéristiques principales à vos exigences et besoins.",
  suit: "Vous suivez le conseil fourni par notre bureau et confirmez votre souhait de souscrire le produit d'assurance recommandé par nous.",
  suitPas: "Vous ne suivez pas le conseil fourni par notre bureau et confirmez expressément votre souhait de souscrire le produit d'assurance suivant :",
  confirmA: "Vous confirmez que notre bureau ne doit pas effectuer d'analyse de marché complémentaire pour le risque que vous souhaitez assurer par l'intermédiaire de notre bureau. Vous reconnaissez que le contenu du contrat d'assurance que vous avez choisi correspond à l'analyse de vos exigences et besoins et que vous avez été expressément informé de la portée et des limites de ce produit d'assurance.",
  sansConseil: "Aucun conseil n'a été fourni par notre bureau. Vous souhaitez souscrire le produit d'assurance suivant :",
  confirmB: "Vous confirmez que notre bureau ne doit pas effectuer d'analyse de marché pour le risque que vous souhaitez assurer par l'intermédiaire de notre bureau. Vous reconnaissez que le contenu du contrat d'assurance que vous avez choisi correspond à l'analyse de vos exigences et besoins et que vous avez été expressément informé de la portée et des limites de ce produit d'assurance.",
  info: "Notre bureau a parcouru avec vous et vous a fourni la fiche d'information pour autant que disponible et les conditions du contrat d'assurance choisi.",
  rgpd: [
    "Le traitement des données à caractère personnel susmentionnées est, conformément à l'article 5c) de la loi du 8 décembre 1992 relative à la protection de la vie privée à l'égard des traitements de données à caractère personnel, modifiée par la loi du 11 décembre 1998 (dénommée ci-après « la loi sur la protection de la vie privée »), nécessaire afin de satisfaire à l'obligation d'information prévue dans la loi du 27 mars 1995 relative à l'intermédiation en assurances et en réassurances et à la distribution d'assurances abrogée et remplacée à partir du 1er novembre 2014 par la loi du 4 avril 2014 relative aux assurances et à laquelle notre bureau est soumis en tant que responsable du traitement.",
    "Conformément à la loi sur la protection de la vie privée, vous disposez d'un droit d'accès aux données personnelles qui vous concernent et de rectification de ces données. Vous pouvez obtenir des informations complémentaires auprès de la Commission de la protection de la vie privée, à 1000 Bruxelles, Rue de la Presse, 35.",
  ],
  footer: [
    "Version 2014 – ASSURANCE NON-VIE",
    "POUR TOUTES VOS QUESTIONS OU PROBLEMES, VOUS POUVEZ VOUS ADRESSER EN PRIORITE A NOTRE BUREAU.",
    "Des plaintes peuvent également être déposées auprès du Service Ombudsman Assurances, à 1000 Bruxelles, square de Meeûs 35. Tél. : 02/547 58 71 – Fax : 02/547 59 75 - www.ombudsman.as.",
    "Le registre des intermédiaires d'assurances est tenu à jour par la FSMA, à 1000 Bruxelles, rue du Congrès 12-14, et peut être retrouvé sur www.fsma.be.",
  ],
}

export function buildDevoirInfoPdf(d) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, mL = 18, mR = 18, cw = W - mL - mR, bottom = 262
  let y = 0

  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(13, 47, 94)
    doc.text(CABINET.nom, W / 2, 16, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40)
    doc.text(CABINET.adresse, W / 2, 21.5, { align: 'center' })
    doc.text(CABINET.contact, W / 2, 26, { align: 'center' })
    doc.setDrawColor(13, 47, 94); doc.setLineWidth(0.4); doc.line(mL, 29, W - mR, 29)
    y = 35
  }
  const footer = (n) => {
    doc.setFillColor(235, 235, 235); doc.rect(mL, 268, cw, 22, 'F')
    doc.setTextColor(30); doc.setFontSize(6.8)
    doc.setFont('helvetica', 'bold'); doc.text(T.footer[0], mL + 2, 272)
    doc.text(T.footer[1], mL + 2, 275.5)
    doc.setFont('helvetica', 'normal')
    let fy = 279
    for (const l of [T.footer[2], T.footer[3]]) {
      for (const s of doc.splitTextToSize(l, cw - 4)) { doc.text(s, mL + 2, fy); fy += 3 }
    }
    doc.setFontSize(8); doc.text(String(n), W - mR, 294, { align: 'right' })
  }
  const space = (h) => { if (y + h > bottom) { doc.addPage(); header() } }
  const para = (txt, { size = 9.5, bold = false, indent = 0, gap = 2.2 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(25)
    const lines = doc.splitTextToSize(txt || '', cw - indent)
    const lh = size * 0.42
    for (const l of lines) { space(lh); doc.text(l, mL + indent, y); y += lh }
    y += gap
  }
  const titre = (txt) => {
    space(10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(13, 47, 94)
    doc.text(txt, mL, y); y += 1.6
    doc.setDrawColor(13, 47, 94); doc.setLineWidth(0.3); doc.line(mL, y, W - mR, y); y += 5
  }
  const box = (x, yy, checked) => {
    doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(x, yy - 3, 3.2, 3.2)
    if (checked) { doc.setLineWidth(0.4); doc.line(x + 0.5, yy - 2.5, x + 2.7, yy - 0.3); doc.line(x + 2.7, yy - 2.5, x + 0.5, yy - 0.3) }
  }
  const coche = (checked, txt, indent = 0) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
    const lines = doc.splitTextToSize(txt, cw - indent - 6)
    space(lines.length * 4 + 1)
    box(mL + indent, y, checked)
    for (const l of lines) { doc.setTextColor(25); doc.text(l, mL + indent + 5.5, y); y += 4 }
    y += 1.5
  }
  const liste = (items, indent = 6) => items.forEach(i => para(`- ${i}`, { indent, gap: 0.6 }))

  // ── Page 1
  header()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(40)
  doc.text(doc.splitTextToSize(CABINET.fsma, cw), W / 2, y, { align: 'center' }); y += 6
  para(T.loi, { size: 8, bold: true, gap: 3 })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(13, 47, 94)
  doc.text('Fiche pour une assurance non-vie', W / 2, y, { align: 'center' }); y += 8

  titre("Renseignements relatifs au client (= preneur d'assurance)")
  const c = d.client || {}
  const rows = [
    ['Nom', c.nom, 'Prénom', c.prenom],
    ['Adresse', c.rue, 'N° / Boîte', [c.num_maison, c.boite].filter(Boolean).join(' / ')],
    ['Code postal', c.cp, 'Localité', c.localite],
    ['Date de naissance', c.date_naissance ? new Date(c.date_naissance).toLocaleDateString('fr-BE') : '', 'N° de dossier', c.dossier],
  ]
  if (d.numeroEntreprise) rows.push(["Numéro d'entreprise", d.numeroEntreprise, '', ''])
  doc.setFontSize(9.5)
  for (const r of rows) {
    space(6)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.text(`${r[0]} :`, mL, y)
    doc.setTextColor(15); doc.setFont('helvetica', 'bold'); doc.text(String(r[1] || ''), mL + 34, y)
    if (r[2]) { doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.text(`${r[2]} :`, mL + 92, y); doc.setTextColor(15); doc.setFont('helvetica', 'bold'); doc.text(String(r[3] || ''), mL + 116, y) }
    y += 5.5
  }
  y += 2
  coche(!!d.consentEmail, T.email)
  para(`Votre adresse e-mail : ${d.consentEmail ? (c.email || '') : ''}`, { gap: 4 })

  titre('Partie I. Vos exigences et besoins pour une assurance non-vie')
  para('1. Vous demandez d\'assurer le risque suivant :', { bold: true, gap: 1 })
  para(d.risque || '', { indent: 5, gap: 3 })
  para('2. Exigences spécifiques :', { bold: true, gap: 1.5 })
  para(`Le client souhaite les garanties : ${(d.souscrites || []).join(', ') || '—'}`, { indent: 5, gap: 1.5 })
  para(`Le client refuse les garanties proposées : ${(d.refusees || []).join(', ') || '—'}`, { indent: 5, gap: 4 })
  T.analyse.forEach(p => para(p, { size: 9 }))

  // ── Partie II
  doc.addPage(); header()
  titre('Partie II. Conseil')
  const A = d.conseil === 'A'
  para('Partie II. A  Notre bureau fournit un conseil', { bold: true, gap: 2 })
  coche(A, `Nous vous recommandons le produit d'assurance ${A ? d.produit : '______________________'} sur la base :`)
  liste(T.base, 11)
  y += 1.5
  para(T.nomAdresse, { indent: 5, size: 9 })
  para(T.repond, { size: 9 })
  space(14)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(25)
  doc.text('Motivation :', mL, y); y += 4.5
  const motivLines = doc.splitTextToSize(A ? (d.motivation || '') : '', cw - 4)
  const mh = Math.max(16, motivLines.length * 4 + 4)
  space(mh)
  doc.setDrawColor(40); doc.setLineWidth(0.3); doc.rect(mL, y - 3.5, cw, mh)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  motivLines.forEach((l, i) => doc.text(l, mL + 2, y + i * 4))
  y += mh + 2
  coche(A && d.suitConseil !== false, T.suit)
  coche(A && d.suitConseil === false, `${T.suitPas} ${A && d.suitConseil === false ? (d.produitAlternatif || '') : '______________________'}`)
  para(T.confirmA, { size: 9, gap: 5 })

  para('Partie II. B  Notre bureau ne fournit pas de conseil', { bold: true, gap: 2 })
  coche(!A, `${T.sansConseil} ${!A ? d.produit : '______________________'}`)
  para(T.confirmB, { size: 9, gap: 5 })

  titre('Partie III. Information')
  para(T.info, { size: 9 })
  coche((d.documents || []).length > 0, "Vous avez aussi reçu l'information complémentaire suivante :")
  liste(['Fiche produit', 'Conditions générales', 'Conditions particulières'].map(x => `${(d.documents || []).includes(x) ? '[X]' : '[  ]'} ${x}`), 8)
  y += 1.5
  coche(!!d.ficheClient, 'Vous confirmez que nous avons parcouru la fiche client avec vous.')
  para('Fait en deux exemplaires, dont un est remis au client.', { gap: 3 })
  const dt = new Date(d.date || Date.now())
  para(`A ${d.lieu || ''}    Le : ${dt.toLocaleDateString('fr-BE')} à ${dt.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })}`, { gap: 3 })

  // Signatures
  space(40)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text('Signatures :', mL, y); y += 4
  const sw = (cw - 10) / 2
  const sig = (img, label, x) => {
    doc.setDrawColor(150); doc.rect(x, y, sw, 26)
    if (img) { try { doc.addImage(img, 'PNG', x + 2, y + 1, sw - 4, 22) } catch { /* image invalide */ } }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70); doc.text(label, x, y + 30)
  }
  sig(d.sigClient, `Le client : ${[c.prenom, c.nom].filter(Boolean).join(' ')}`, mL)
  sig(d.sigGestionnaire, `Pour Dynassur : ${d.gestionnaire || ''}`, mL + sw + 10)
  y += 36
  T.rgpd.forEach(p => para(p, { size: 7, gap: 1.2 }))

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) { doc.setPage(i); footer(i) }
  return doc
}

// Texte de conseil généré à partir des garanties (modifiable ensuite par le gestionnaire).
export function genererMotivation({ produit, compagnie, domaine, risque, souscrites = [], refusees = [], raison }) {
  const p = []
  const cie = compagnie ? ` de ${compagnie}` : ''
  p.push(`Nous vous recommandons le produit ${produit || '…'}${cie}${domaine ? ` (${domaine.toLowerCase()})` : ''}${risque ? ` pour le risque suivant : ${risque}` : ''}.`)
  if (souscrites.length) p.push(`Il couvre les garanties que vous avez demandées : ${souscrites.join(', ')}.`)
  p.push(raison && raison.trim()
    ? `Nous avons comparé ce produit à d'autres offres du marché répondant à votre demande. Nous l'avons retenu pour la raison suivante : ${raison.trim().replace(/\.$/, '')}.`
    : "Nous avons comparé ce produit à d'autres offres du marché répondant à votre demande ; il offre le meilleur équilibre entre l'étendue de ces garanties et la prime.")
  if (refusees.length) {
    p.push(`Vous avez choisi de ne pas souscrire ${refusees.length > 1 ? 'les garanties suivantes' : 'la garantie suivante'} : ${refusees.join(', ')}. Nous attirons votre attention sur le fait que les sinistres relevant de ${refusees.length > 1 ? 'ces garanties' : 'cette garantie'} ne seront pas couverts par le contrat.`)
  }
  return p.join(' ')
}
