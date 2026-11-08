import { parsePhoneNumberFromString, AsYouType } from 'libphonenumber-js/min'

// Normalisation des numéros de téléphone.
//
// LE PROBLÈME, DIT PAR LUDOVIC
//
// « Lorsqu'on tape le GSM du client, il doit être paramétré pour avoir tout
// le temps le même encodage. Le format doit être fait correctement et il doit
// détecter le format belge ou autre en rapport avec l'indicatif du pays. »
//
// Et c'est mesuré : l'export des comptes Microsoft du groupe contient
// « +32472048070 », « +32 479 280 120 » et « +32 488 09 06 25 » — trois
// orthographes du même format, dans le même fichier.
//
// POURQUOI UNE BIBLIOTHÈQUE ET PAS TROIS EXPRESSIONS RÉGULIÈRES
//
// Règle du Hub : construire ce qui est spécifique au groupe, acheter ce qui
// est standard dans un métier. Les plans de numérotation changent (nouveaux
// préfixes mobiles, découpages différents par pays), et un formatage écrit à
// la main devient faux sans que personne ne s'en aperçoive. libphonenumber
// est la table de référence de Google, tenue à jour.
//
// CE QU'ON STOCKE ET CE QU'ON MONTRE
//
// En base : le format E.164 — « +32479280120 », sans espace. C'est la seule
// forme comparable (deux saisies différentes du même numéro donnent la même
// chaîne), et c'est ce qu'attendent les API d'envoi de SMS.
// À l'écran : le format international — « +32 479 28 01 20 ».
//
// ⚠️ Un numéro NON RECONNU n'est jamais jeté. On garde la saisie telle
// quelle et on le signale : perdre le numéro d'un client parce qu'il est mal
// tapé serait pire que de l'afficher mal.

const PAYS_DEFAUT = 'BE'

export function analyserTelephone(saisie, paysDefaut = PAYS_DEFAUT) {
  const brut = (saisie || '').trim()
  if (!brut) return { vide: true, valide: false, e164: null, affichage: '', pays: null, brut }

  const n = parsePhoneNumberFromString(brut, paysDefaut)
  if (!n || !n.isValid()) {
    return { vide: false, valide: false, e164: null, affichage: brut, pays: null, brut }
  }
  return {
    vide: false,
    valide: true,
    e164: n.number,                    // +32479280120 — ce qu'on stocke
    affichage: n.formatInternational(), // +32 479 28 01 20 — ce qu'on montre
    national: n.formatNational(),       // 0479 28 01 20
    pays: n.country || null,
    brut,
  }
}

// Ce qu'on écrit en base : E.164 si on a su lire, sinon la saisie telle
// quelle — jamais null quand la personne a tapé quelque chose.
export function telephonePourBase(saisie, paysDefaut = PAYS_DEFAUT) {
  const a = analyserTelephone(saisie, paysDefaut)
  if (a.vide) return null
  return a.valide ? a.e164 : a.brut
}

// Ce qu'on affiche. Tolère les numéros déjà en base dans n'importe quel
// format, y compris les trois orthographes de l'export Microsoft.
export function telephoneAffiche(valeur, paysDefaut = PAYS_DEFAUT) {
  const a = analyserTelephone(valeur, paysDefaut)
  return a.vide ? '' : a.affichage
}

// Mise en forme pendant la frappe, sans gêner : on n'ajoute que ce que la
// bibliothèque sait déjà, et on laisse la personne finir son numéro.
export function telephoneEnFrappe(saisie, paysDefaut = PAYS_DEFAUT) {
  const brut = (saisie || '')
  if (!brut.trim()) return ''
  return new AsYouType(brut.trim().startsWith('+') ? undefined : paysDefaut).input(brut)
}
