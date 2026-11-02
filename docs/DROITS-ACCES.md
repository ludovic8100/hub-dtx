# Droits d'accès — refonte en cours (30/10/2026)

Chantier en trois blocs, décidé après un audit qui a montré que `clients` et les tables liées
(`contrats`, `objets_risque`, `quittances`, `segmentation`, `parentes`) avaient des règles de
sécurité `USING (true)` : tout utilisateur connecté voyait tous les clients, sans restriction.

## Bloc 1 — Portefeuille par bureau (livré)

- `clients.bureau_id` → `ref_bureaux(id)`, rempli automatiquement depuis le bureau du
  gestionnaire (`clients.gestionnaire_code`), puis du sous-agent (`clients.sa_code`) pour les
  dossiers sans gestionnaire.
- `user_permissions.voit_tout_portefeuille` : un utilisateur non-admin qui doit voir tout le
  portefeuille d'une société sans restriction de bureau (ex. comptabilité, direction).
- Fonctions : `mon_bureau_id()`, `voit_tout_portefeuille()`, `client_visible(dossier)`.
- Règle : un utilisateur voit un client si administrateur, ou `voit_tout_portefeuille`, ou même
  bureau que le client (`collaborateurs.bureau_id` via `user_permissions.collab_code`). Sans
  bureau déterminé → invisible par défaut (sécurité par défaut, pas l'inverse).
- Un bureau peut regrouper plusieurs collaborateurs qui partagent le même portefeuille (ex. le
  siège de Juprelle : plusieurs gestionnaires et commerciaux voient le même ensemble de clients).

### État au 30/10/2026
- 8 050 / 10 298 clients rattachés automatiquement à un bureau.
- 2 248 clients sans bureau déterminé (ni gestionnaire ni sous-agent rattaché à un bureau),
  invisibles pour tout le monde sauf les administrateurs en attendant correction.
- Corrigé : code `ICA` créé dans `collaborateurs`, `jfs@dynassur.be` relié à la fiche `JFS`
  existante, code `FMZ` dédoublonné (une fiche inactive recodée, index unique partiel ajouté
  sur `collaborateurs(code) where actif`).
- À construire : rapport hebdomadaire par mail de la liste des clients sans bureau.

## Fusion `collaborateurs` / `user_permissions` (livré, 30/10/2026)

Les deux tables portaient la même information (qui a accès au Hub) dans deux endroits
différents, sans lien fiable entre elles (18 personnes existaient en double, reliées par rien
d'autre qu'un email identique par coïncidence). Fusion dans `collaborateurs`, seule source
désormais pour l'identité et les droits d'un collaborateur :

- `collaborateurs.compte_hub_actif` (nouveau) = peut se connecter au Hub — distinct de
  `collaborateurs.actif`, qui reste le statut métier de la personne (ex. un collaborateur parti
  peut rester `actif` côté compta le temps de clôturer ses dossiers, sans accès Hub).
- `collaborateurs.est_admin` = seul indicateur d'administrateur Hub (remplace
  `user_permissions.role`). 3 administrateurs : LDE, NGI, Gael Minon — vérifié, préexistant.
- `collaborateurs.email` = identité de connexion (remplace `user_permissions.user_email`).
- Les ~45 colonnes d'accès par société/page (`dyn_*`, `dtx_*`, `lode_*`, `hex_*`, `prive_*`,
  `grp_*`, `acc_*`) sont reprises telles quelles sur `collaborateurs` — pas encore normalisées
  (c'est l'objet du Bloc 2 ci-dessous).
- 9 fonctions SQL et le RLS de `collaborateurs` (déjà équivalent à l'ancien RLS de
  `user_permissions` : lecture ouverte aux connectés, écriture admin) pointent maintenant sur
  cette table unique. 6 fichiers front mis à jour en conséquence (`auth.jsx`,
  `ComptabiliteView.jsx`, `NotesFraisView.jsx`, `TachesView.jsx`, `TicketsView.jsx`,
  `ConfigModule.jsx`).
- `ConfigModule.jsx` (onglet « users ») : « Supprimer le compte » ne supprime plus la fiche
  collaborateur si elle porte un code métier (commissions, portefeuille…) — elle coupe
  seulement `compte_hub_actif`. Seul un compte Hub sans code métier (ex. créé uniquement pour
  un accès) est réellement supprimé.
- `user_permissions` n'est plus lue ni écrite par l'application ni les fonctions. Elle est
  renommée `user_permissions_obsolete_20261030` (conservée, pas supprimée) le temps de
  confirmer que plus rien n'en dépend.

## Synchronisation Entra : retirée (01/11/2026)

Les comptes du Hub ne sont plus synchronisés depuis Entra. **Les accès se gèrent à la main
dans Paramètres.**

Historique court, parce qu'il explique la décision :

- Le workflow n8n `UnuI7LdT7RHfow8n` (HUB_DTX_USER_PERMISSION) écrivait dans `user_permissions`
  avec une clé codée en clair — et invalide : un jeton d'accès personnel Supabase collé par
  erreur à la place d'une clé API. Il ne synchronisait donc rien. Archivé le 01/11/2026.
- Il avait été remplacé le 30/10 par une Edge Function `sync-entra-collaborateurs` + un cron
  `sync_entra_collaborateurs_hourly`. Ses secrets Entra (`MS_TENANT_ID`, `MS_CLIENT_ID`,
  `MS_CLIENT_SECRET`) n'ont jamais été saisis : elle échouait sur `Token Entra 404` à chaque
  passage, en silence.
- Le garde-fou `jobs_log`, mis en service le 01/11, l'a révélé dès sa première exécution.
  Décision prise dans la foulée : retirer la synchro plutôt que d'entretenir un mécanisme que
  personne n'a configuré en deux jours.

**Conséquence à connaître** : plus rien ne coupe automatiquement l'accès Hub d'un collaborateur
dont le compte Entra est désactivé. Au départ d'un collaborateur, il faut passer `compte_hub_actif`
à `false` dans Paramètres. C'est le premier point à traiter quand le suivi d'accès sera construit.

Ce qui reste en place : `config_secrets.sync_entra_secret` — le nom est trompeur, mais le cron
`sync_ponto_comptes_daily` s'en sert aussi comme `x-sync-secret`. Ne pas le supprimer.

## ⚠️ Accès libre temporaire, sans connexion (31/10/2026)

Le login Microsoft restait bloqué (bascule infinie entre Supabase et l'app, cause
jamais confirmée malgré plusieurs correctifs successifs — course de timing,
verrou concurrent, flux PKCE). Décision : retirer complètement le login le temps
de reconstruire, plutôt que de continuer à deviner en production.

- `src/lib/auth.jsx` : `ACCES_LIBRE_TEMPORAIRE = true` court-circuite tout le
  flux de connexion. Quiconque ouvre `hub-dtx.vercel.app` entre directement avec
  les droits de `lde@dynassur.be` (admin) — aucun écran de login, aucune
  authentification. Le code de connexion Microsoft d'origine est conservé
  intact plus bas dans le fichier, juste court-circuité par ce drapeau.
- Base de données : policy `temp_acces_libre_sans_login` ajoutée sur chaque
  table avec RLS (sauf `config_secrets` et l'obsolète
  `user_permissions_obsolete_20261030`), donnant un accès complet au rôle
  `anon`. Les policies existantes (admin/bureau/authenticated) ne sont pas
  modifiées, seulement complétées — retrait propre possible à tout moment.
- **Le Hub est donc totalement public tant que c'est actif** : n'importe qui
  avec le lien voit et peut modifier tous les clients, IBAN, contrats,
  commissions. Fenêtre à refermer dès que possible.

**Pour revenir en arrière :**
1. `ACCES_LIBRE_TEMPORAIRE = false` dans `src/lib/auth.jsx`, redéployer.
2. Exécuter `sql/retirer_acces_libre_temporaire.sql` (retire les policies
   `temp_acces_libre_sans_login`, dans l'ordre : jamais avant l'étape 1).
3. Reconstruire un vrai login (Microsoft ou autre) avant de rouvrir l'accès.

### Cause réelle de la « bascule infinie » — établie le 02/11/2026

Les trois pistes évoquées en octobre (course de timing, verrou concurrent, flux
PKCE) étaient fausses. Ce qui s'est réellement passé, vérifié dans l'historique
Git, le journal d'audit Supabase et l'API Auth :

1. **La clé Supabase publishable avait été supprimée** lors d'un nettoyage des
   clés API, sans être remplacée → `401 Unauthorized` sur `/rest/v1` et sur
   l'échange de jeton. L'utilisateur cliquait, partait chez Microsoft, revenait,
   et retombait sur `/login` : la bascule. **Corrigée le 31/10 à 10:40**
   (commit `c25d1f8`) — soit 28 minutes *après* la pose de
   `ACCES_LIBRE_TEMPORAIRE` à 10:12. Le contournement étant déjà en place, le
   login n'a jamais été retesté.
2. `auth.audit_log_entries` confirme que la connexion Microsoft **fonctionnait**
   ce matin-là : `user_signedup` · azure · `lde@dynassur.be` à 10:10:10. Les
   comptes `lde@` et `ngi@` ont ensuite été supprimés par `service_role` à
   10:18. `auth.users` est vide depuis — sans conséquence, une connexion OAuth
   recrée l'utilisateur.
3. **Ce qui bloque aujourd'hui est autre chose** : `GET /auth/v1/settings`
   renvoie `"azure": false`. Le provider Microsoft a été désactivé dans le
   projet Supabase. Repasser le drapeau à `false` sans le réactiver
   reproduirait la bascule, avec une nouvelle cause.

**Défaut de code qui a rendu tout cela indiagnosticable** : `signInWithMicrosoft`
ignorait le `{ error }` renvoyé par `signInWithOAuth`. Provider désactivé = clic
sans effet et sans message. Corrigé : les erreurs s'affichent sur l'écran de
login, et le bloc de diagnostic laissé en production dans `AuthCallback`
(il montrait des fragments de jeton) a été retiré.

### Politique de session (décidée le 02/11/2026)

Objectif : une authentification Microsoft complète au moins toutes les 24 h, et
à chaque nouveau navigateur ou appareil.

| Où | Quoi | État |
|---|---|---|
| `src/lib/auth.jsx` | `queryParams: { prompt: 'login' }` | posé |
| `src/lib/auth.jsx` | `DUREE_MAX_SESSION` = 24 h, `DUREE_MAX_INACTIVITE` = 4 h | posé |
| Entra → méthodes d'authentification | passkey (FIDO2) préférée, Authenticator en secours | à activer |

**Pourquoi la durée est appliquée dans le code et non dans Supabase.** Les
réglages serveur *Time-box user sessions* et *Inactivity timeout* existent, mais
ils sont **réservés au plan Pro** ; le projet est en Free. Vérifié le 02/11/2026
dans Authentication → Sessions.

Limite à connaître : la règle vit dans le navigateur. Elle couvre une session
laissée ouverte, un poste partagé, un navigateur resté connecté — le scénario
réel. Elle ne couvre pas un jeton exfiltré et rejoué depuis ailleurs. Seul un
time-box côté serveur (plan Pro) serait opposable.

Effet de bord favorable : l'inactivité est mesurée sur les actions **réelles**
(clic, touche), pas sur l'usage du jeton de rafraîchissement. Le réglage natif de
Supabase ne fermait jamais une fenêtre laissée ouverte, puisque `supabase-js`
renouvelle le jeton tout seul tant que l'onglet vit. Ici, si. Revenir sur un
onglet ouvert depuis la veille ne compte pas comme une activité : la session est
fermée, pas prolongée.

**Pourquoi `prompt: 'login'` est indispensable.** Sans lui, l'expiration ne
produit qu'une redirection **invisible** : Entra réutilise la session SSO ouverte
par Outlook ou Teams et re-délivre un jeton sans rien demander. On croirait se
ré-authentifier chaque jour sans que personne n'ait rien saisi.

**Changement de navigateur ou d'appareil** : rien à régler. La session vit dans
le `localStorage`, propre à chaque profil de navigateur et à chaque appareil —
Chrome, Edge et le téléphone ne la partagent jamais.

**Poste abandonné déverrouillé** : la vraie réponse reste le verrouillage de
session du système d'exploitation (5 à 10 min, mot de passe à la reprise). Aucun
réglage applicatif ne protège le reste du poste.

**Aucune licence Entra ID P1 n'est nécessaire** : la fréquence est imposée par le
Hub, et les passkeys font partie du niveau gratuit d'Entra. P1 ne servirait qu'à
un accès conditionnel par appareil ou par risque.

**Deux applications Azure distinctes, à ne pas fusionner** (constat du
02/11/2026) :

| Application | ID | Rôle |
|---|---|---|
| `Hub DTX` | `5065b920-f43b-489d-8c68-1576803f020f` | connexion des utilisateurs (OAuth délégué) |
| `Hub DTX - Sharepoint` | `d9b91434-168e-4706-a113-ff4cd14b80e2` | lecture SharePoint (`Sites.Read.All`, permission d'application) |

Les garder séparées est délibéré : la seconde porte un accès de niveau locataire
sans utilisateur, qui n'a rien à faire sur l'application par laquelle 49
personnes se connectent — et une rotation de secret d'un côté ne doit pas couper
l'autre. L'application `d38526f5…` citée dans `office_users_sync.py` est une
troisième, supprimée du locataire, sans rapport avec le login.

Locataire : `29a87d83-130a-42d9-82c9-29c930952c76`.

## Table `personnes` et fusion Utilisateurs/Acteurs métier (31/10/2026)

Suite au point précédent, première étape du modèle d'identité unique : table `personnes`
(nom complet, date de naissance, GSM, email, adresse, CP, ville), `collaborateurs.personne_id`
et `clients.personne_id` (vide pour l'instant). Les 49 collaborateurs existants sont tous reliés
à une `personne` (1 pour 1, sans ambiguïté). Le rapprochement des 10 298 clients reste un
chantier séparé, non commencé.

- `collaborateurs` garde ses propres colonnes d'identité (adresse, gsm, email, nom_complet,
  date_naissance) en parallèle de `personnes`, pour ne pas casser les écrans qui les lisent
  encore directement (`auth.jsx`, `NotesFraisView`, `TachesView`, `TicketsView`,
  `ComptabiliteView`). `ConfigModule` écrit désormais sur les deux à chaque enregistrement.
  Une vraie bascule (lire/écrire uniquement via `personnes`, retirer les colonnes dupliquées
  de `collaborateurs`) est une phase 2 distincte, plus tard.
- `collaborateurs.titre` (nouveau) : titre/fonction affiché, distinct du rôle métier
  (Commercial/Gestionnaire/Sous-agent/Apporteur) qui sert au calcul des commissions et aux droits.
- `ref_bureaux` a maintenant une adresse structurée (`rue`, `numero`, `boite`, `code_postal`,
  `ville`), utilisée pour les devoirs d'information et les courriers clients.
- Écrans **Utilisateurs & accès** et **Acteurs métier** fusionnés en une seule fiche par
  collaborateur dans `ConfigModule.jsx` (onglet « Utilisateurs & acteurs métier ») :
  Coordonnées, Rôle métier & commissions, Accès au Hub. `ActeursMetierPanel.jsx` supprimé.
  « Admin d'une société » n'est plus un champ séparé : cocher tous les modules d'une société
  équivaut à en être administrateur (bouton dédié dans chaque carte société). `est_admin` reste
  réservé au seul administrateur du Hub entier (accès à tout, toutes sociétés).
- Nouvelle table : mêmes précautions RLS/droits que lors de la fusion précédente (une table
  neuve n'hérite d'aucun droit par défaut) — voir `sql/creation_table_personnes.sql`.

Point noté, pas traité ici : Renaud Desclez (sous-agent indépendant) emploie Bénédicte De Roocker
(gestionnaire) — relation qui se lit côté client/contrat (police accident du travail souscrite par
Renaud pour ses employés), pas dans les droits du Hub. Le bureau commun (Eghezée) suffit pour le
portefeuille clients partagé ; pas de champ « responsable »/hiérarchie ajouté, aucun besoin
fonctionnel identifié à ce jour.

## Problème identité plus large (noté le 30/10/2026, pas encore traité)

Une même personne physique peut être à la fois client, collaborateur, sous-agent, assuré et
membre d'une famille (conjoint, enfant…) sans qu'aucune colonne ne relie ces rôles entre eux.
Constat : `clients` est organisé par dossier (pas par personne, pas de clé d'identité fiable),
et `parentes` n'est qu'un regroupement par texte (`membre_nom`), pas une relation entre ID.
18 personnes existent déjà en double entre `clients` et `collaborateurs` (email identique, pas
de lien). Modèle cible envisagé : une table `personnes` (identité physique unique), avec
`clients.personne_id` et `collaborateurs.personne_id` pointant vers elle, et une vraie table
`relations_personnes` (conjoint/enfant/parent…) à la place de `parentes`. Risque identifié :
le rapprocher pour `collaborateurs` (49 lignes) est trivial, mais pour `clients` (10 298 lignes)
c'est un exercice de déduplication qui demande une revue humaine des correspondances proposées
avant toute fusion réelle — pas une migration automatique. Non commencé.

## Bloc 2 — Un seul modèle de modules (à venir)

Remplacer les ~70 colonnes booléennes de `user_permissions` (une par page × par société,
largement dupliquées, ex. `dyn_comptabilite`/`dtx_comptabilite`/`lode_comptabilite`…) par une
liste unique de modules et une table d'attribution utilisateur × société × module. L'écran
d'administration (`ConfigModule.jsx`, onglet « users ») garde la même forme, piloté par la table
plutôt que par du code en dur.

## Bloc 2 bis — Sécurité des accès (à venir, décidé le 01/11/2026)

Trois chantiers qui vont ensemble et qui n'ont de sens qu'une fois le login remis :

**1. Remettre la synchronisation Entra.** Retirée le 01/11 parce qu'elle n'avait jamais
fonctionné (secrets `MS_TENANT_ID` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET` jamais saisis).
À reconstruire en Edge Function + `pg_cron`, avec cette fois une entrée dans `jobs_attendus`
dès le premier jour pour qu'un échec soit visible. Le code retiré est récupérable dans
l'historique Git (`supabase/functions/sync-entra-collaborateurs/`, retiré en PR #29).
**En attendant, l'accès d'un collaborateur qui part se coupe à la main** : `compte_hub_actif`
à `false` dans Paramètres.

**2. Suivi d'accès.** Qui se connecte, qui travaille, sur quoi. La matière existe déjà :
`connexions_log` (4 160 lignes, identités réelles jusqu'au 30/10) et `clients_consultes`.
Ce qui manque est un écran qui les croise, et surtout la reprise du login — depuis le
31/10, `ACCES_LIBRE_TEMPORAIRE = true` fait entrer tout le monde sous `lde@dynassur.be`,
donc toute mesure d'activité est actuellement fausse.

**3. Traçabilité des modifications.** Pouvoir répondre à « qui a changé ça ? » sur les tables
sensibles (clients, contrats, collaborateurs, bordereaux, comptes). Techniquement simple —
triggers `AFTER INSERT/UPDATE/DELETE` écrivant dans une table d'audit, avec `auth.uid()`.
**Mais sans valeur tant que le login n'est pas remis** : aujourd'hui chaque écriture serait
attribuée au même utilisateur. L'ordre est donc imposé : login d'abord, audit ensuite.
À noter : l'historique ne se reconstruit pas rétroactivement — tout ce qui est modifié
d'ici la mise en place est perdu pour l'audit.

## Bloc 3 — Espace client (à venir, après le bloc 2)

Connexion par numéro de GSM avec code reçu par SMS à chaque connexion (Supabase Auth, provider
téléphone natif, fournisseur SMS à connecter type Twilio). Un client ne voit que son propre
dossier. Points ouverts à trancher le moment venu : accès familial délégué (ex. un enfant voit le
dossier d'un parent, avec son accord — vérifier le cadre RGPD), rattachement d'un même GSM à
plusieurs dossiers.
