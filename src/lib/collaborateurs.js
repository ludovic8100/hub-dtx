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
