import { lazy } from 'react'

// ─── Registre des outils ───────────────────────────────────────────────────
//
// Déclarer un outil ICI suffit : la route (App.jsx), la carte sur la page
// d'accueil (ToolsHome) et le contrôle de permission en découlent tous de
// cette liste. Avant, il fallait toucher trois endroits pour en ajouter un.
//
// Champs :
//   cle         identifiant court et stable — clé React, et plus tard clé de
//               mesure d'usage. Ne jamais le renommer une fois en service.
//   titre       titre affiché dans l'en-tête de l'outil et sur sa carte
//   sousTitre   une ligne d'explication sous le titre, dans l'en-tête
//   description texte de la carte sur /tools
//   icone       image de la carte (public/assets/tools/…)
//   chemin      route, toujours sous /tools/
//   permission  colonne de collaborateurs exigée pour y accéder
//   composant   lazy(() => import(…)) — absent : outil annoncé, pas encore écrit
//   pleinePage  true quand l'outil gère lui-même toute sa mise en page
//               (ToolSuccession : une iframe qui occupe le cadre entier)
//
// Pour ajouter un outil : écrire src/pages/tools/MonOutil.jsx avec <OutilPage>,
// ajouter une entrée ici. Rien d'autre.

export const OUTILS = [
  {
    cle: 'bce',
    titre: 'Recherche BCE',
    sousTitre: 'Entreprise belge — par dénomination ou n° BCE (10 chiffres)',
    description: "Rechercher une entreprise belge par nom ou n° BCE et consulter ses données officielles (KBO/BCE).",
    icone: '/assets/tools/icon-bce.png',
    chemin: '/tools/bce',
    permission: 'acc_tools',
    composant: lazy(() => import('../pages/tools/ToolBce')),
  },
  {
    cle: 'questionnaire',
    titre: 'Questionnaire Profil Investisseur',
    sousTitre: 'Recherchez un client, sélectionnez un contrat Vie, uploadez la proposition, remplissez le questionnaire',
    description: "Reconstituer un questionnaire profil investisseur à partir d'un contrat d'assurance-vie (PDF). Profil déduit automatiquement.",
    icone: '/assets/tools/icon-questionnaire.png',
    chemin: '/tools/questionnaire',
    permission: 'acc_tools',
    composant: lazy(() => import('../pages/tools/ToolQuestionnaire')),
  },
  {
    cle: 'devoir-info',
    titre: "Devoir d'information — non-vie",
    sousTitre: 'Client, contrat, conditions particulières, vérification, signature',
    description: "Remplir le devoir d'information IARD depuis le client et le contrat, conseil personnalisé généré depuis les garanties, signature sur tablette.",
    icone: '/assets/tools/icon_DI.png',
    chemin: '/tools/devoir-information',
    permission: 'acc_tools',
    composant: lazy(() => import('../pages/tools/ToolDevoirInfo')),
  },
  {
    cle: 'succession',
    titre: 'Droit de Succession',
    sousTitre: 'Simulateur successoral belge',
    description: "Simulateur successoral belge — calculez les droits de succession selon les régions (Wallonie, Flandre, Bruxelles) et comparez avec une assurance-vie.",
    icone: '/assets/tools/Icon_droit_succession.png',
    chemin: '/tools/succession',
    permission: 'prive_succession',
    composant: lazy(() => import('../pages/tools/ToolSuccession')),
    pleinePage: true,
  },
  {
    cle: 'jobs',
    titre: 'Synchronisations',
    sousTitre: "Ce qui doit tourner automatiquement, et ce qui a réellement tourné",
    description: "État des synchronisations automatiques : ce qui doit tourner, ce qui a réellement tourné, et ce qui est en retard ou en échec.",
    icone: '/assets/tools/icon-ai.png',
    chemin: '/tools/jobs',
    permission: 'acc_tools',
    composant: lazy(() => import('../pages/tools/ToolJobs')),
  },
]

// Même règle que ProtectedRoute dans App.jsx : une permission « xxx_yyy »
// exige aussi l'accès à l'entité (acc_xxx). Dupliqué ici volontairement pour
// que le registre reste autonome ; si la règle change, changer les deux.
const ACC = { dyn: 'acc_dynassur', dtx: 'acc_dtx', lode: 'acc_lode', hex: 'acc_hexagroup', prive: 'acc_prive', grp: 'acc_holding' }

export function aDroitOutil(perms, permission) {
  if (!perms) return false
  if (perms.est_admin) return true
  if (!permission) return true
  const accCol = permission.startsWith('acc_') ? permission : ACC[permission.split('_')[0]]
  return (!accCol || !!perms[accCol]) && !!perms[permission]
}

// Les outils que ce collaborateur a le droit d'ouvrir.
export const outilsVisibles = perms => OUTILS.filter(o => aDroitOutil(perms, o.permission))
