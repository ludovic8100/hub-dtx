/**
 * LA RÈGLE DE RAPPEL — un seul endroit, et des paramètres qui viennent de la base.
 *
 * Règle donnée par Ludovic le 14/11/2026 : après un « pas de réponse », on
 * rappelle à +1, puis +4, puis +7 jours ouvrables, et on s'arrête à quatre
 * essais.
 *
 * ⚠️ LE PLAFOND EST LA PARTIE QU'ON OUBLIE, ET C'EST LA PLUS IMPORTANTE.
 * Sans lui, un mauvais numéro revient chaque semaine jusqu'à la fin de
 * l'année. Au bout d'un mois la file est pleine de fantômes, le commercial
 * cesse de la regarder, et il rate les vrais leads au passage. Une file de
 * travail ne survit qu'à la condition que tout ce qui y entre finisse par en
 * sortir.
 *
 * Les délais et le plafond ne sont PAS écrits ici : ils viennent de
 * `lead_issues.delais_rappel` et `lead_issues.max_tentatives`. Une règle de
 * relance se règle, elle ne se redéploie pas — et le jour où une autre
 * société s'en sert, elle aura la sienne.
 */

/**
 * Ajoute n jours OUVRABLES à une date. Samedi et dimanche sautés.
 *
 * ⚠️ LES JOURS FÉRIÉS BELGES NE SONT PAS GÉRÉS. Un rappel peut donc tomber
 * le 1er novembre. C'est assumé plutôt que caché : gérer les fériés demande
 * un calendrier à tenir à jour chaque année, et un rappel décalé d'un jour
 * coûte moins cher qu'un calendrier qu'on oublie de mettre à jour. Le
 * commercial voit la date et peut la changer.
 */
export function ajouterJoursOuvrables(depart, n) {
  const d = new Date(depart)
  d.setHours(12, 0, 0, 0)          // midi : à l'abri des changements d'heure
  let reste = Math.max(0, n | 0)
  while (reste > 0) {
    d.setDate(d.getDate() + 1)
    const j = d.getDay()
    if (j !== 0 && j !== 6) reste--
  }
  // Si le point d'arrivée tombe un week-end (n valant 0), on pousse au lundi.
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Ce que devient un lead quand on enregistre une issue.
 *
 * @param {object} lead    la ligne courante (tentatives, rappeler_le…)
 * @param {object} issue   la ligne de `lead_issues` choisie
 * @param {string} dateSaisie  la date de rappel tapée par le commercial, si elle l'est
 * @returns {{ tentatives, rappeler_le, epuise, message }}
 */
export function calculerRappel(lead, issue, dateSaisie = null) {
  // Pas d'issue : on efface un éventuel rappel, le lead revient dans sa file
  // d'origine.
  if (!issue) return { tentatives: lead?.tentatives || 0, rappeler_le: null, epuise: false, message: '' }

  // Issue terminale : le lead est clos, aucun rappel.
  if (issue.termine) {
    return { tentatives: lead?.tentatives || 0, rappeler_le: null, epuise: false, message: '' }
  }

  // « À rappeler » : LA DATE VIENT DE CE QU'ON A ENTENDU, pas d'un calcul.
  // Aucune valeur automatique ne vaut « rappelez-moi mardi ».
  if (!Array.isArray(issue.delais_rappel) || !issue.delais_rappel.length) {
    return {
      tentatives: lead?.tentatives || 0,
      rappeler_le: dateSaisie || null,
      epuise: false,
      message: dateSaisie ? '' : 'Il faut une date de rappel.',
    }
  }

  // « Pas de réponse » : la tentative suivante, et son délai.
  const tentatives = (lead?.tentatives || 0) + 1
  const max = issue.max_tentatives || (issue.delais_rappel.length + 1)

  if (tentatives >= max) {
    return {
      tentatives,
      rappeler_le: null,          // plus de rappel : le lead sort de la file
      epuise: true,
      message: `${tentatives}ᵉ essai sans réponse — le lead sort de la file.`,
    }
  }

  // Le délai du rang courant ; au-delà de la liste, on garde le dernier.
  const delai = issue.delais_rappel[Math.min(tentatives - 1, issue.delais_rappel.length - 1)]
  const date = dateSaisie || ajouterJoursOuvrables(new Date(), delai)
  return {
    tentatives,
    rappeler_le: date,
    epuise: false,
    message: `Essai ${tentatives} sur ${max} — à rappeler le ${new Date(date).toLocaleDateString('fr-BE')}.`,
  }
}
