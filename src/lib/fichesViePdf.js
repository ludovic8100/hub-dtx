// Rendu PDF des fiches d'intermédiation Vie.
//
// Le document produit doit RESSEMBLER à la fiche papier, parce que c'est
// elle qui fait foi : mêmes parties, mêmes intitulés, mêmes cases, dans le
// même ordre. Tout est piloté par src/lib/fichesVie.js — ce fichier ne
// connaît aucune question, il sait seulement dessiner.
//
// CE QUI NE DOIT JAMAIS APPARAÎTRE ICI : le profil investisseur. C'est une
// conclusion interne de Dynassur, pas une rubrique de la fiche FSMA.
// L'écran l'affiche, la fiche client le conserve, le PDF l'ignore.

import jsPDF from 'jspdf'

const BLEU = [26, 58, 107]
const GRIS = [85, 85, 85]
const TRAIT = [195, 207, 219]

export function construireFichePDF(fiche, reponses, ctx = {}) {
  const { client = {}, contrat = null, logoB64 = null, mentionReconstitution = null } = ctx

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const L = 20, R = 20, LARGEUR = 210, UTILE = LARGEUR - L - R
  const BAS = 278
  let y = 0
  let page = 0

  const val = (id) => reponses?.[id]

  // ── primitives ────────────────────────────────────────────────────────
  function entete() {
    page += 1
    y = 14
    if (logoB64) { try { doc.addImage(logoB64, 'PNG', L, y - 2, 22, 22) } catch { /* logo absent */ } }
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
    doc.text(fiche.titre.toUpperCase(), L + 26, y + 3, { maxWidth: UTILE - 26 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    if (fiche.sousTitre) doc.text(fiche.sousTitre, L + 26, y + 7.5, { maxWidth: UTILE - 26 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5)
    doc.text(`N° FSMA : ${fiche.fsma}    |    N° BCE : ${fiche.bce}`, L + 26, y + 13)
    y += 20
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.6)
    doc.line(L, y, LARGEUR - R, y)
    y += 6
  }

  function pied() {
    doc.setDrawColor(...BLEU); doc.setLineWidth(0.5)
    doc.line(L, BAS + 2, LARGEUR - R, BAS + 2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
    doc.setTextColor(...BLEU)
    doc.text(`DYNASSUR - ${fiche.titreCourt} - FSMA ${fiche.fsma} - BCE ${fiche.bce}`, L, BAS + 6)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRIS)
    doc.text(`Page ${page}`, LARGEUR - R, BAS + 6, { align: 'right' })
  }

  function place(hauteur) {
    if (y + hauteur > BAS) { pied(); doc.addPage(); entete() }
  }

  function paragraphe(txt, { taille = 8.5, gras = false, couleur = [0, 0, 0], apres = 2.5, indent = 0 } = {}) {
    if (!txt) return
    doc.setFont('helvetica', gras ? 'bold' : 'normal')
    doc.setFontSize(taille); doc.setTextColor(...couleur)
    const lignes = doc.splitTextToSize(String(txt), UTILE - indent)
    place(lignes.length * (taille * 0.42) + apres)
    for (const l of lignes) {
      place(taille * 0.42)
      doc.text(l, L + indent, y)
      y += taille * 0.42
    }
    y += apres
  }

  function titrePartie(txt) {
    place(12)
    y += 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...BLEU)
    const lignes = doc.splitTextToSize(txt, UTILE)
    for (const l of lignes) { place(5); doc.text(l, L, y); y += 5 }
    y += 2
  }

  function titreSection(txt) {
    if (!txt) return
    place(8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLEU)
    doc.text(txt, L, y); y += 5
  }

  function sousTitre(txt) {
    if (!txt) return
    place(7)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BLEU)
    doc.text(txt, L, y); y += 4.5
  }

  /** Une case à cocher, cochée ou non, avec son libellé à côté. */
  function caseACocher(texte, cochee, indent = 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0)
    const lignes = doc.splitTextToSize(String(texte), UTILE - 8 - indent)
    place(Math.max(4.2, lignes.length * 3.4) + 1)
    const yCase = y - 2.6
    doc.setDrawColor(100); doc.setLineWidth(0.3)
    doc.rect(L + indent, yCase, 3.2, 3.2)
    if (cochee) {
      doc.setLineWidth(0.6); doc.setDrawColor(...BLEU)
      doc.line(L + indent + 0.6, yCase + 1.7, L + indent + 1.4, yCase + 2.5)
      doc.line(L + indent + 1.4, yCase + 2.5, L + indent + 2.7, yCase + 0.7)
    }
    for (let i = 0; i < lignes.length; i++) {
      if (i > 0) place(3.4)
      doc.text(lignes[i], L + indent + 5.5, y)
      y += 3.4
    }
    y += 0.8
  }

  /** Un champ « Libellé : valeur » avec un trait de remplissage. */
  function champ(libelle, valeur, largeurLibelle = 42) {
    place(6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0)
    doc.text(`${libelle} :`, L, y)
    const x = L + largeurLibelle
    const v = valeur == null || valeur === '' ? '' : String(valeur)
    if (v) { doc.setFont('helvetica', 'bold'); doc.text(v, x, y, { maxWidth: UTILE - largeurLibelle }) }
    doc.setDrawColor(...TRAIT); doc.setLineWidth(0.25)
    doc.line(x, y + 1.2, LARGEUR - R, y + 1.2)
    y += 6
  }

  /** Un bloc libre : le texte s'il existe, sinon des lignes vides. */
  function zone(libelle, valeur, lignes = 2) {
    if (libelle) { place(6); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0); doc.text(`${libelle} :`, L, y); y += 4.5 }
    const txt = valeur ? String(valeur) : ''
    if (txt) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0)
      const ls = doc.splitTextToSize(txt, UTILE - 4)
      place(ls.length * 3.6 + 3)
      doc.setDrawColor(...TRAIT); doc.setLineWidth(0.25)
      doc.rect(L, y - 3.2, UTILE, ls.length * 3.6 + 2)
      for (const l of ls) { doc.text(l, L + 2, y); y += 3.6 }
      y += 3
    } else {
      place(lignes * 6 + 2)
      doc.setDrawColor(...TRAIT); doc.setLineWidth(0.25)
      for (let i = 0; i < lignes; i++) { doc.rect(L, y - 3.2, UTILE, 6); y += 6 }
      y += 2
    }
  }

  function tableau(q) {
    const rep = val(q.id) || {}
    if (q.titreTable) { place(7); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...BLEU); doc.text(q.titreTable, L, y); y += 5 }
    const cols = q.colonnes || []
    const largeurLibelle = UTILE * 0.46
    const largeurCol = (UTILE - largeurLibelle) / cols.length

    place(10)
    doc.setFillColor(243, 247, 250)
    doc.rect(L, y - 3.4, UTILE, 8, 'F')
    doc.setDrawColor(...TRAIT); doc.setLineWidth(0.25)
    doc.rect(L, y - 3.4, UTILE, 8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(0)
    doc.text(q.enTeteLigne || 'Produit / catégorie', L + 1.5, y, { maxWidth: largeurLibelle - 3 })
    cols.forEach((c, i) => {
      doc.text(c, L + largeurLibelle + i * largeurCol + 1.5, y, { maxWidth: largeurCol - 3 })
    })
    y += 5.5

    const lignes = q.lignes || Array.from({ length: q.lignesLibres || 0 }, () => '')
    for (const ligne of lignes) {
      if (ligne && typeof ligne === 'object' && ligne.titre) {
        place(6)
        doc.setFillColor(248, 250, 252); doc.rect(L, y - 3.2, UTILE, 5.5, 'F')
        doc.setDrawColor(...TRAIT); doc.rect(L, y - 3.2, UTILE, 5.5)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(0)
        doc.text(ligne.titre, L + 1.5, y, { maxWidth: UTILE - 3 })
        y += 5.5
        continue
      }
      const libelle = String(ligne || '')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(0)
      const ls = doc.splitTextToSize(libelle || ' ', largeurLibelle - 3)
      const h = Math.max(6, ls.length * 2.9 + 2.5)
      place(h)
      doc.setDrawColor(...TRAIT); doc.setLineWidth(0.25)
      doc.rect(L, y - 3.2, UTILE, h)
      ls.forEach((l, i) => doc.text(l, L + 1.5, y + i * 2.9))
      const cochees = rep[libelle] || {}
      cols.forEach((c, i) => {
        const cx = L + largeurLibelle + i * largeurCol
        doc.line(cx, y - 3.2, cx, y - 3.2 + h)
        if (c.toLowerCase().startsWith('volume')) {
          const v = cochees[c]
          doc.setFont('helvetica', v ? 'bold' : 'normal'); doc.setFontSize(6.6)
          doc.text(v ? `${v} €` : '__________ €', cx + 1.5, y + 0.4)
          doc.setFont('helvetica', 'normal')
        } else {
          const bx = cx + largeurCol / 2 - 1.6
          doc.setDrawColor(100); doc.rect(bx, y - 2.4, 3.2, 3.2)
          if (cochees[c]) {
            doc.setLineWidth(0.5); doc.setDrawColor(...BLEU)
            doc.line(bx + 0.6, y - 0.7, bx + 1.4, y + 0.1)
            doc.line(bx + 1.4, y + 0.1, bx + 2.7, y - 1.7)
            doc.setLineWidth(0.25)
          }
          doc.setDrawColor(...TRAIT)
        }
      })
      y += h
    }
    y += 3
  }

  function question(q) {
    if (q.sousTitre) sousTitre(q.sousTitre)
    const v = val(q.id)

    switch (q.type) {
      case 'table':
        if (q.libelle) paragraphe(q.libelle, { apres: 2 })
        tableau(q)
        return
      case 'zone':
        zone(q.libelle, v, q.lignes || 2)
        return
      case 'texte':
        champ(q.libelle + (q.aide ? ` (${q.aide})` : ''), v)
        return
      case 'montant':
        place(6)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(0)
        doc.text(`${q.libelle} : ${v ? `${v} EUR` : '__________________ EUR'}`, L, y)
        y += 6
        return
      case 'pourcentage':
        place(6)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
        doc.text(`${q.libelle} : ${v != null && v !== '' ? `${v} %` : '______ %'}`, L, y)
        y += 5.5
        return
      case 'radio':
      case 'check': {
        if (q.libelle) paragraphe(q.libelle, { apres: 1.5 })
        const choisies = q.type === 'radio' ? (v != null ? [v] : []) : (Array.isArray(v) ? v : [])
        for (const opt of q.opts || []) {
          caseACocher(opt, choisies.includes(opt))
          if (q.precision && opt === q.precision && choisies.includes(opt) && reponses?.[`${q.id}__precision`]) {
            champ('    →', reponses[`${q.id}__precision`], 12)
          }
        }
        y += 1.5
        return
      }
      default:
        if (q.libelle) paragraphe(q.libelle)
    }
  }

  // ── le document ───────────────────────────────────────────────────────
  entete()

  if (mentionReconstitution) {
    place(14)
    doc.setFillColor(255, 250, 240)
    doc.setDrawColor(240, 196, 120); doc.setLineWidth(0.4)
    const ls = doc.splitTextToSize(mentionReconstitution, UTILE - 6)
    doc.rect(L, y - 3.5, UTILE, ls.length * 3.6 + 4, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(140, 80, 10)
    for (const l of ls) { doc.text(l, L + 3, y); y += 3.6 }
    y += 5
  }

  paragraphe(fiche.mentionLegale, { taille: 7.5, couleur: GRIS })
  paragraphe(fiche.mentionRegistre, { taille: 7.5, couleur: GRIS })
  if (fiche.mentionCourtier) paragraphe(fiche.mentionCourtier, { taille: 7.5, couleur: GRIS })

  // Coordonnées
  titreSection(fiche.coordonnees.titre)
  for (const c of fiche.coordonnees.champs) champ(c.libelle, val(c.id))
  y += 1

  // En-tête de fiche (bulletin antérieur, raison du contact, conseil…)
  for (const q of fiche.entete || []) question(q)

  // Contrat reconstitué : ce qu'on sait du dossier
  if (contrat) {
    y += 1
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIS)
    place(5)
    doc.text(
      `Dossier ${contrat.dossier || '—'}  |  ${contrat.compagnie || '—'}  |  Police ${contrat.police || '—'}`
      + (contrat.type_production ? `  |  ${contrat.type_production}` : ''), L, y)
    y += 6
  }

  // Les parties
  for (const partie of fiche.parties || []) {
    titrePartie(`${partie.titre}`)
    if (partie.avertissement) paragraphe(partie.avertissement, { taille: 7.5, gras: true, couleur: [140, 80, 10] })
    if (partie.intro) paragraphe(partie.intro, { taille: 8, couleur: GRIS })
    for (const note of partie.notes || []) paragraphe(note, { taille: 7.5, couleur: GRIS })
    for (const section of partie.sections || []) {
      titreSection(section.titre)
      if (section.intro) paragraphe(section.intro, { taille: 8, couleur: GRIS })
      for (const q of section.questions || []) question(q)
    }
    for (const p of partie.pied || []) paragraphe(p, { taille: 7.5, couleur: GRIS })
    for (const p of partie.rgpd || []) paragraphe(p, { taille: 6.8, couleur: GRIS })
  }

  // Signatures
  place(30)
  y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text(`Fait à : ${val('fait_a') || '______________________________'}    le ${val('fait_le') || '____ / ____ / ______'}`, L, y)
  y += 6
  doc.setDrawColor(...TRAIT); doc.setLineWidth(0.3)
  doc.rect(L, y, UTILE / 2, 22); doc.rect(L + UTILE / 2, y, UTILE / 2, 22)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Signature du client', L + 2, y + 5)
  doc.text('Signature du conseiller', L + UTILE / 2 + 2, y + 5)
  y += 26

  // Note explicative sur la durabilité (fiche après 2025)
  if (fiche.noteDurabilite) {
    pied(); doc.addPage(); entete()
    titrePartie(fiche.noteDurabilite.titre)
    paragraphe(fiche.noteDurabilite.intro, { taille: 8, couleur: GRIS })
    for (const bloc of fiche.noteDurabilite.blocs) {
      titreSection(bloc.titre)
      if (bloc.texte) paragraphe(bloc.texte, { taille: 7.8, couleur: GRIS })
      if (bloc.listeTitre) paragraphe(bloc.listeTitre, { taille: 7.8, couleur: GRIS, apres: 1 })
      for (const item of bloc.liste || []) paragraphe(`•  ${item}`, { taille: 7.8, couleur: GRIS, apres: 0.8, indent: 3 })
      if (bloc.apres) paragraphe(bloc.apres, { taille: 7.8, couleur: GRIS })
    }
  }

  pied()
  return doc
}
