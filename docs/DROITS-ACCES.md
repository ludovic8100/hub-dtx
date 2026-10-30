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
- À corriger dans `collaborateurs` : code `ICA` absent (gestionnaire cité par l'admin, à créer),
  `jfs@dynassur.be` non relié à la fiche `JFS` existante (`user_permissions.collab_code` à
  renseigner), code `FMZ` en double (deux personnes, un seul code).
- À construire : rapport hebdomadaire par mail de la liste des clients sans bureau.

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
