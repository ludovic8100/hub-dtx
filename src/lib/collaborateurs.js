import { supabase } from './supabase'

// ⚠️ NE JAMAIS CONSTRUIRE UNE LISTE DE MÉTIER SUR LES COLONNES `acc_<societe>`
// (`acc_lode`, `acc_dynassur`, `acc_dtx`, `acc_hexagroup`, `acc_prive`,
// `acc_holding`) de la table `collaborateurs`.
//
// Ces colonnes disent « a le droit d'OUVRIR ce module dans le Hub ». Elles ne
// disent jamais « travaille pour cette société ». Les deux notions ne se
// recouvrent pas : mesuré le 14/11/2026, sur 31 collaborateurs actifs, 2
// seulement ont `acc_lode`, et aucun des commerciaux LODE.
//
// Trois helpers bâtis sur ces colonnes — `COLONNE_ACCES`,
// `chargerCollaborateurs` et `filtrerSociete` — ont été supprimés le
// 14/11/2026 : leur nom les rendait attirants pour un futur écran DTX ou
// Dynassur, qui aurait réintroduit le défaut. Pour savoir qui travaille pour
// une société, utiliser `chargerParSociete` / `chargerCommerciaux` ci-dessous,
// qui lisent le rattachement réel via `v_collaborateurs_societe`.

// QUI TRAVAILLE POUR UNE SOCIÉTÉ — ce qui n'est PAS « qui a le droit d'ouvrir
// son module dans le Hub » (14/11/2026).
//
// Le défaut signalé par Ludovic : dans un chantier LODE, la liste
// « Commercial » ne montrait plus que LLO, et seulement sur les chantiers où
// elle était déjà enregistrée. Mesuré : l'ancien filtre (`filtrerSociete`,
// supprimé depuis) s'appuyait sur `acc_lode`, et sur **31 collaborateurs
// actifs, 2 seulement** l'ont à true.
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
    .select('id,code,nom_complet,fonction,cout_horaire,roles')
    .eq('societe', String(societe || '').toUpperCase())
    .order('nom_complet')
  const liste = data || []

  // Le code déjà posé sur le document reste toujours proposable : un chantier
  // attribué ne doit pas afficher un commercial absent de sa propre liste.
  // Ça couvre aussi la base de test, où `collaborateur_societes` est vide :
  // la liste y sera réduite au code enregistré, mais rien ne plante.
  return avecCodeGarde(liste, codeAGarder)
}

const avecCodeGarde = (liste, code) =>
  !code || liste.some(c => c.code === code)
    ? liste
    : [...liste, { id: null, code, nom_complet: code, fonction: null, roles: [] }]

// UNE PERSONNE FAIT PLUSIEURS CHOSES À LA FOIS — corrigé le 14/11/2026 après
// que Ludovic a détaillé qui fait quoi chez LODE.
//
// J'avais d'abord filtré sur `fonction`, une colonne à UNE valeur. C'était
// encore faux, et ses quatre exemples le montrent sans appel :
//
//   LDE  commercial, gère certains chantiers ET installe
//   JCL  commercial, gère ET installe
//   LLO  commerciale, mais ne fera JAMAIS d'installation ni de gestion
//   NGI  ni l'un ni l'autre — administratif, elle ne prestera jamais chez LODE
//
// Avec une seule valeur, « commercial » écrasait « installe », et la liste de
// la main-d'œuvre rendait LLO et NGI, qui n'y ont rien à faire.
//
// D'où `collaborateur_societes.roles text[]`, alimentée depuis `ref_roles`,
// un référentiel en base — pas une liste en dur ici, parce que le projet
// interdit la règle métier codée en dur et qu'ajouter un métier ne doit pas
// demander un déploiement.
//
// ⚠️ QUATRE NOTIONS DISTINCTES, à ne jamais refondre en une :
//
//   `collaborateurs.est_admin`          administrateur DU HUB (lu par is_admin())
//   `collaborateurs.acc_<societe>`      a le droit d'OUVRIR ce module
//   `collaborateur_societes.statut`     le lien contractuel
//   `collaborateur_societes.roles`      ce que la personne FAIT  ← la seule
//                                       qui doit alimenter ces listes
//
// `fonction` est conservée telle quelle : elle n'est plus lue, mais une
// colonne supprimée ne se récupère pas d'un `git revert`.
export async function chargerParRole(societe, roles, codeAGarder = null) {
  const voulus = [].concat(roles)
  const tous = await chargerParSociete(societe)
  const retenus = tous.filter(c => (c.roles || []).some(r => voulus.includes(r)))

  // Repli volontaire : si personne ne porte le rôle, on rend tout le monde
  // plutôt qu'une liste vide. Un champ vide sans explication est exactement
  // le défaut qu'on corrige — il serait absurde d'en créer un nouveau.
  // C'est aussi ce qui tient debout en base de test, où les rattachements
  // ne sont pas renseignés.
  return avecCodeGarde(retenus.length ? retenus : tous, codeAGarder)
}

export const chargerCommerciaux = (societe, codeAGarder = null) =>
  chargerParRole(societe, 'commercial', codeAGarder)

// « Qui a posé la pergola » n'est pas « qui l'a vendue ».
export const chargerIntervenants = (societe, codeAGarder = null) =>
  chargerParRole(societe, ['gestion_chantier', 'installation'], codeAGarder)
