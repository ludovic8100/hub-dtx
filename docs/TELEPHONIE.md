# Téléphonie 3CX

Tout ce que le module **Appels** (`/dynassur/appels`) suppose du central, et
pourquoi. Écrit le 02/11/2026, après une journée passée à comprendre pourquoi
les chiffres ne tombaient pas juste.

## Le sens de la connexion : 3CX → Hub, jamais l'inverse

C'est 3CX qui appelle le Hub, pas le contraire :

| Endpoint | Rôle |
|---|---|
| `api/3cx/lookup.js` | 3CX demande qui est au bout du numéro (scénario CRM) |
| `api/3cx/call.js` | 3CX dépose chaque appel terminé → RPC `crm_log_appel` → table `appels` |

Le secret partagé `threecx_api_secret` (table `config_secrets`) est **la serrure
sur notre porte**, pas une clé vers le central.

Le sens inverse a été ouvert le 02/11 mais ne sert encore à rien :
`api/_lib/threecx.js` (OAuth2 `client_credentials` sur `/connect/token`) et
`api/3cx/diagnostic.js`, pilotable depuis **Outils → Synchronisations**. Il
attend un client API créé côté 3CX. Variables : `THREECX_URL`,
`THREECX_CLIENT_ID`, `THREECX_CLIENT_SECRET`.

⚠️ 3CX blackliste l'IP après quelques authentifications ratées (observé : deux
401 puis six 403). Ne jamais enchaîner les demandes de jeton — le diagnostic
n'en fait qu'une et se tait 60 s en cas d'échec.

## La limite qui gouverne tous les chiffres

**3CX ne journalise qu'UNE étape par appel, pas le transfert.**

Le parcours réel est : numéro général (80) → menu → file (91 assurance,
92 crédit, 93 sinistres) → poste d'un collaborateur ; hors horaires, l'appel
part au bureau fermé (86).

Mais sur 492 passages au menu, **76 seulement** sont suivis d'un appel du même
numéro chez un collaborateur dans la journée (15 %). Idem pour les files :
23 % sur le 93, 34 % sur le 91.

Conséquence : on ne peut ni reconstituer un appel de bout en bout, ni
dédoublonner les étapes. Les compteurs ne retiennent que les appels **arrivés
sur le poste d'un collaborateur** — c'est un plancher, pas un total exact. Les
2 807 autres entrants sont comptés à part et affichés sous les chiffres clés.

## Les pièges déjà corrigés

**Quatre valeurs de `direction`**, pas deux : `Inbound`, `Outbound`,
`Notanswered`, `Missed`. Un test `startsWith('in')` fait passer les appels
manqués pour des sortants.

**Deux formats de durée** cohabitent dans `appels.duree`, qui est du texte :
`MM:SS` (depuis le 01/07) et un nombre de secondes brut (13/08 → 30/09, d'un
second importateur depuis arrêté). La vue `v_appels` normalise en `duree_s`.

**Une sonnerie n'est pas un appel.** 3CX envoie un événement par coup de
sonnerie : trois lignes à 7 s d'écart = un seul appel manqué. `v_appels` les
marque `relance_sonnerie` ; 11 des 93 manqués étaient dans ce cas.

**Le menu ne parle à personne.** 10 s de durée moyenne sur 492 appels, 51 s sur
les files, 209 s en messagerie. Ces étapes sont exclues du temps de
conversation : moyenne 136 s → 166 s.

## Les postes

`collaborateurs.extension` pour les personnes (saisi dans Paramètres),
`postes_telephonie` pour le reste.

| Poste | Quoi | Catégorie |
|---|---|---|
| 20–28 | collaborateurs de Juprelle | — |
| 80 | menu d'accueil | `svi` |
| 86 | bureau fermé | `hors_horaires` |
| 91 / 92 / 93 | files assurance / crédit / sinistres | `file` |
| 30 / 32 | messageries bureau fermé / crédit | `messagerie`, masquées |

Le mapping initial n'a pas été saisi : l'ancien format d'agent `22.NGI`
(abandonné le 30/09) portait le code du collaborateur, la migration l'a relu.

**Seuls les employés de Juprelle ont une ligne 3CX.** La correspondance est
exacte : `bureau_id = 1` ⟺ possède une extension. Tous les gestionnaires sans
poste sont des `est_sous_agent` — c'est normal, pas un trou de saisie.

## Plus tard

**Routage par gestionnaire** (idée du 02/11, non prioritaire). Faire sonner
directement le poste du gestionnaire du client, puis basculer vers son
commercial. `api/3cx/lookup.js` répond déjà à chaque appel entrant : lui faire
renvoyer le poste est une petite modification.

Deux inconnues avant de s'y mettre :

1. **Le « commercial » d'un client n'existe pas en base.** `clients` ne porte
   que `gestionnaire_code`, `sa_code`, `bureau_id`, `bureau`. À trancher : le
   repli est-il le sous-agent, le commercial du bureau, ou une nouvelle colonne ?
2. **3CX sait-il router sur une valeur renvoyée par le lookup**, et pas
   seulement l'afficher ? Dépend de la version et de la licence. Le diagnostic
   le dira.

Portée : 4 681 clients routables (gestionnaire à Juprelle), 4 292 chez un
sous-agent (aucune ligne à appeler), 1 322 sans gestionnaire. Zéro code
orphelin sur 10 301 clients.

**Supervision temps réel** (statut, occupation, file d'attente) : les trois
colonnes manquantes de la maquette. Même dépendance au diagnostic. Voir aussi
que 3CX fournit déjà un wallboard natif, et qu'un historique nominatif de
présence relève de la CCT 81.

**Deux points de saisie** : Didier Coco (DCO), à Juprelle, n'a pas de poste —
oubli ou normal ? Et le poste 24 reste attribué à Blairon, inactif : s'il est
réattribué, le journal rattachera les anciens appels à la mauvaise personne.

## Angle mort

Rien dans le Hub ne surveille le flux 3CX → `appels`. Il n'est **pas déclaré
dans `jobs_attendus`** : s'il s'arrête, personne ne le verra. C'est exactement
le trou que le garde-fou des synchronisations existe pour éviter, et c'est
aujourd'hui la seule source de tout le module.
