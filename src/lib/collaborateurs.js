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
    .select('id,code,nom_complet,fonction,cout_horaire')
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
    : [...liste, { id: null, code, nom_complet: code, fonction: null }]

// LA FONCTION ATTRIBUE, PAS LE STATUT — règle donnée par Ludovic le
// 14/11/2026 : « pour attribuer tu ne dois te baser que sur la fonction ».
//
// Les deux colonnes de `collaborateur_societes` ne disent pas la même chose :
//
//   `statut`   le lien contractuel  — administrateur, employé
//   `fonction` le métier exercé     — commercial, gestionnaire
//
// Un administrateur peut parfaitement être commercial, et deux des trois
// commerciaux LODE le sont. Filtrer sur le statut écarterait les patrons de
// leur propre portefeuille.
//
// ⚠️ Et c'est une liste DIFFÉRENTE de celle de la main-d'œuvre. « Qui a posé
// la pergola » n'est pas « qui a vendu le chantier » : le poseur n'est pas
// commercial, et l'exclure de la saisie des heures rendrait celle-ci
// impossible. `chargerParSociete` sert la seconde, celle-ci la première.
//
// Le repli est volontaire : si personne n'a la fonction renseignée, on rend
// tout le monde plutôt qu'une liste vide. Un champ vide sans explication est
// exactement le défaut qu'on corrige ici — il serait absurde d'en créer un
// nouveau en le corrigeant.
export async function chargerCommerciaux(societe, codeAGarder = null) {
  const tous = await chargerParSociete(societe)
  const commerciaux = tous.filter(c => c.fonction === 'commercial')
  return avecCodeGarde(commerciaux.length ? commerciaux : tous, codeAGarder)
}
