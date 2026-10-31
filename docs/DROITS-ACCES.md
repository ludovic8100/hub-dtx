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

## Remplacement du workflow n8n de sync Entra (30/10/2026)

Le workflow n8n `UnuI7LdT7RHfow8n` (HUB_DTX_USER_PERMISSION, sync Entra → Hub horaire) écrivait
dans `user_permissions` avec une clé codée en clair dans le nœud (et, pire, une clé invalide —
un jeton d'accès personnel Supabase collé par erreur à la place d'une clé API). Remplacé par :

- **Fonction Edge Supabase `sync-entra-collaborateurs`** (`supabase/functions/sync-entra-collaborateurs/`) :
  même logique (nouveaux comptes Entra actifs → fiche `collaborateurs` avec `compte_hub_actif=false` ;
  comptes Entra désactivés → `compte_hub_actif=false`), mais écrit directement sur `collaborateurs`
  avec la clé `service_role` (secret de fonction, jamais exposée), et notifie par mail via Graph.
- **Job `pg_cron`** `sync_entra_collaborateurs_hourly` (toutes les heures à :07) qui appelle cette
  fonction via `pg_net`, authentifié par un secret partagé (`config_secrets.sync_entra_secret`
  ↔ secret de fonction `SYNC_SHARED_SECRET`) plutôt que par JWT Supabase — script dans
  `sql/sync_entra_cron.sql`.
- **Secrets à saisir dans le Dashboard Supabase** (Edge Functions > `sync-entra-collaborateurs` >
  Secrets — jamais via Claude, la valeur ne transite pas par l'assistant) :
  `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` (app registration Entra existante — celle
  utilisée par n8n — avec la permission d'application `User.Read.All`, et `Mail.Send` pour la
  notification ; un nouveau secret client doit être généré pour cette app), et
  `SYNC_SHARED_SECRET` (valeur déjà déposée côté base dans `config_secrets.sync_entra_secret`,
  à recopier telle quelle — voir `sql/sync_entra_cron.sql`).
- **À faire par l'utilisateur** : désactiver (ou supprimer) le workflow n8n `UnuI7LdT7RHfow8n`
  une fois les secrets renseignés et la synchro Edge Function vérifiée.

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

## Bloc 3 — Espace client (à venir, après le bloc 2)

Connexion par numéro de GSM avec code reçu par SMS à chaque connexion (Supabase Auth, provider
téléphone natif, fournisseur SMS à connecter type Twilio). Un client ne voit que son propre
dossier. Points ouverts à trancher le moment venu : accès familial délégué (ex. un enfant voit le
dossier d'un parent, avec son accord — vérifier le cadre RGPD), rattachement d'un même GSM à
plusieurs dossiers.
