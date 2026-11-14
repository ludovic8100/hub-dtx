import { supabase } from './supabase'

// Les collaborateurs proposés dans un écran de société.
//
// ⚠️ Le filtre s'appuie sur les colonnes `acc_<societe>`, qui disent « a le
// droit de VOIR cette partie du Hub ». Ce n'est pas tout à fait la même chose
// que « travaille pour cette société » — mesuré le 09/11 : le commercial de
// LODE a `acc_lode = false` et aucun compte Hub du tout. Tant que les deux
// notions n'en font qu'une en base, on garde TOUJOURS le code déjà enregistré
// sur le document, même s'il ne passe pas le filtre : sinon un chantier déjà
// attribué afficherait un commercial absent de sa propre liste.
export const COLONNE_ACCES = {
  LODE: 'acc_lode', DYNASSUR: 'acc_dynassur', DTX: 'acc_dtx',
  HEXAGROUP: 'acc_hexagroup', PRIVE: 'acc_prive', HOL: 'acc_holding',
}

export async function chargerCollaborateurs(societe, colonnes = 'code,nom_complet') {
  const col = COLONNE_ACCES[String(societe || '').toUpperCase()]
  const { data } = await supabase.from('collaborateurs')
    .select(col ? `${colonnes},${col}` : colonnes)
    .eq('actif', true).not('code', 'is', null).order('nom_complet')
  return data || []
}

export function filtrerSociete(liste, societe, codeAGarder = null) {
  const col = COLONNE_ACCES[String(societe || '').toUpperCase()]
  if (!col) return liste
  return liste.filter(c => c[col] === true || (codeAGarder && c.code === codeAGarder))
}

// QUI TRAVAILLE POUR UNE SOCIÉTÉ — ce qui n'est PAS « qui a le droit d'ouvrir
// son module dans le Hub » (14/11/2026).
//
// Le défaut signalé par Ludovic : dans un chantier LODE, la liste
// « Commercial » ne montrait plus que LLO, et seulement sur les chantiers où
// elle était déjà enregistrée. Mesuré : `filtrerSociete` s'appuie sur
// `acc_lode`, et sur **31 collaborateurs actifs, 2 seulement** l'ont à true.
// Les deux commerciaux LODE l'ont à false — ils n'ont pas besoin d'ouvrir
// l'écran LODE pour vendre. Ce qu'il voyait n'était donc pas une liste de
// commerciaux, c'était une liste d'ayants droit.
//
// ⚠️ Mettre `acc_lode` à true pour qu'ils apparaissent serait le mauvais
// geste : on élargirait un DROIT D'ACCÈS pour corriger un AFFICHAGE. Les deux
// notions doivent rester distinctes.
//
// La bonne source existait déjà : `collaborateur_societes` dit que chez LODE,
// LDE, LLO et JCL sont commerciaux et NGI gestionnaire.
//
// ⚠️ On lit la VUE `v_collaborateurs_societe`, jamais la table : celle-ci
// porte `brut_mensuel`, `prime_annuelle` et `honoraires_mensuels`, et sa
// policy de lecture est `USING (true)` pour tout compte connecté. L'appeler
// depuis un écran de chantier exposerait la rémunération à qui ouvre l'onglet
// réseau. La vue ne rend que société, code, nom, fonction, id et coût horaire
// — ce dernier déjà affiché par la fiche chantier. C'est la règle d'exposition
// du projet : colonnes listées une par une, jamais `select *`.
//
// Les lignes sans `code` sont écartées à la source : `dossiers.responsable`
// stocke un code, une ligne sans code ne pourrait jamais être choisie. Il y en
// a deux chez LODE, dont un doublon de JCL sous une autre graphie.
export async function chargerParSociete(societe, codeAGarder = null) {
  const { data } = await supabase.from('v_collaborateurs_societe')
    .select('id,code,nom_complet,fonction,cout_horaire')
    .eq('societe', String(societe || '').toUpperCase())
    .order('nom_complet')
  const liste = data || []

  // ⚠️ ON NE FILTRE PAS SUR `fonction = 'commercial'`, et c'est délibéré.
  // Ce serait reproduire exactement le piège qu'on corrige : quelqu'un
  // disparaîtrait de la liste sans que rien ne dise pourquoi, cette fois
  // parce qu'une fonction n'aurait pas été renseignée. La fonction sert donc
  // à l'ORDRE — commerciaux en tête — jamais à exclure.
  liste.sort((a, b) => (a.fonction === 'commercial' ? 0 : 1) - (b.fonction === 'commercial' ? 0 : 1)
                    || String(a.nom_complet).localeCompare(String(b.nom_complet)))

  // Le code déjà posé sur le document reste toujours proposable : un chantier
  // attribué ne doit pas afficher un commercial absent de sa propre liste.
  // Ça couvre aussi la base de test, où `collaborateur_societes` est vide :
  // la liste y sera réduite au code enregistré, mais rien ne plante.
  if (codeAGarder && !liste.some(c => c.code === codeAGarder)) {
    liste.push({ id: null, code: codeAGarder, nom_complet: codeAGarder, fonction: null })
  }
  return liste
}
