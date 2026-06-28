// Charge les coordonnées des sociétés depuis la table `societes` et les applique
// aux configs utilisées par les modules devis/factures. Ainsi, toute modification
// faite dans le module Configuration se reflète sur les documents sans redéploiement.
import { supabase } from './supabase'
import { LODE } from './lodeConfig'
import { DTX } from './dtxConfig'
import { DYN } from './dynConfig'

const MAP = { lode: LODE, dtx: DTX, dyn: DYN }
let loaded = false

export async function bootstrapConfigs(force = false) {
  if (loaded && !force) return
  loaded = true
  try {
    const { data } = await supabase.from('societes').select('*').not('entite_key', 'is', null)
    for (const s of data || []) {
      const cfg = MAP[s.entite_key]
      if (!cfg) continue
      if (s.nom)              cfg.raison_sociale = s.nom
      if (s.activite != null) cfg.activite       = s.activite
      if (s.adresse)          cfg.adresse        = s.adresse
      if (s.cp)               cfg.cp             = s.cp
      if (s.ville)            cfg.ville          = s.ville
      if (s.pays)             cfg.pays           = s.pays
      if (s.tva)              cfg.tva            = s.tva
      if (s.iban_principal)   cfg.iban           = s.iban_principal
      if (s.bic != null)      cfg.bic            = s.bic
      if (s.telephone != null) cfg.telephone     = s.telephone
      if (s.email_expediteur) cfg.email          = s.email_expediteur
      if (s.couleur)          cfg.couleur        = s.couleur
      if (s.logo_url)         cfg.logo_url        = s.logo_url
      if (s.delai_paiement_jours != null) cfg.delai_paiement_jours = s.delai_paiement_jours
      if (s.tva_taux_defaut != null)      cfg.tva_taux_defaut      = s.tva_taux_defaut
    }
  } catch (e) {
    // En cas d'échec (ex. session non prête), on conserve les valeurs par défaut.
  }
}
