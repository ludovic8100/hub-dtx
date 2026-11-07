# Hub DTX — Hub de gestion multi-sociétés

Application interne de gestion pour un groupe de 6 entités belges :
**DYNASSUR** (courtage assurance), **DTX**, **LODE**, **HEXAGROUP** (ASBL), **PRIVE**, **HOL** (holding/consolidé).

## Stack

- **Frontend** : React 18 + Vite + react-router, styles inline (pas de framework CSS). Langue : français.
- **Backend** : Supabase (projet `tndwonqdbeszkcztkzqe`, Postgres 17, EU) — appelé directement depuis le front avec la clé anon + RLS.
- **Déploiement** : Vercel, déploie automatiquement la branche `main`.
  Prod : **https://hub.dtx-group.be** (depuis le 07/11/2026).
  `hub-dtx.vercel.app` a été **retiré le 07/11/2026**, sur décision de Ludovic.
  J'avais écrit ici qu'il ne devait jamais l'être, à cause des liens de devis. **C'était un
  avertissement écrit sans mesure.** Mesuré ensuite : 4 devis envoyés sur 15, dont **3 déjà
  acceptés** et 1 dont la validité avait expiré le 26/09 ; et surtout **aucun des 15 liens n'a
  jamais été ouvert** (`opened_at` est null partout). La page publique `/devis/:token` n'a donc
  jamais servi une seule fois.
  Deux alias Vercel subsistent et ne sont pas supprimables — `hub-dtx-dynassur-s-projects.vercel.app`
  et `hub-dtx-git-main-dynassur-s-projects.vercel.app`. Ils font toujours porte de secours si le
  DNS de `dtx-group.be` tombe.
- **ETL / automatisations** : instance n8n `https://n8n.srv1082740.hstgr.cloud` (voir § n8n).
- **Documents** : SharePoint (`dynassur.sharepoint.com/sites/ADMINISTRATION`) est la source de vérité des fichiers (factures, bordereaux…). Supabase ne stocke que métadonnées + URL.

## Structure

- `src/pages/<entite>/…` : une page par module et par société (dashboard, comptabilité, banque, clients…).
- `src/components/` : composants partagés (ComptabiliteView, VueFactures, SelecteurFactureAchat, RapprochementAuto, CompagniesView, TicketsView…).
- `src/lib/` : client supabase, auth (`user_permissions`), configs par entité, utilitaires (`factures.js` : exclusion des extraits de compte).
- `sql/` : schéma canonique régénéré depuis la base (`schema.sql`, 93 tables) + scripts par module.
- `n8n_workflows/` : exports JSON de certains workflows n8n (pas tous, voir inventaire).
- `api/` : fonctions serverless Vercel (3CX lookup/call, envoi devis).

## Base de données — domaines clés

| Domaine | Tables principales |
|---|---|
| Référentiel | `societes`, `user_permissions`, `collaborateurs`, `compagnies`, `producteurs` |
| Assurance (Dynassur) | `clients`, `contrats`, `quittances`, `sinistres`, `objets_risque`, `mouvements_production`, `segmentation`, `parentes` |
| Banque / compta | `comptes_bancaires`, `transactions` (Ponto), `factures_achat` (SharePoint), `categories`, `categories_regles`, `transaction_ventilation`, `notes_frais*`, `credits` |
| Commissions | `bordereaux`, `collaborateur_taux` |
| Facturation vente | `lode_*` (actif), `dtx_*` / `dyn_*` (prévus, vides) |
| Hexagroup | `hex_membres`, `hex_cotisations*` |
| Activité | `appels` (3CX), `tickets`, `tickets_messages`, `ticket_categories` |

Conventions : montants en `numeric`, dates ISO, colonne `societe` = code entité en MAJUSCULES.

## Droits d'accès (refonte en cours, 30/10/2026)

Chantier en trois blocs pour remplacer les droits `USING (true)` ouverts à tous par de vraies
règles : portefeuille par bureau, un seul modèle de modules, espace client séparé. Détail complet,
état d'avancement et points ouverts : `docs/DROITS-ACCES.md`.

## Rapprochement bancaire (cœur du module compta)

- Lien bidirectionnel : `transactions.facture_url` + `rapproche` ⟷ `factures_achat.transaction_id`.
  **Toujours écrire les deux côtés** (voir `lierFactureChoisie` dans ComptabiliteView).
- Après liaison, déclencher la régénération des vignettes : `POST https://n8n.srv1082740.hstgr.cloud/webhook/backfill-thumbs2`.
- Les fichiers du dossier SharePoint FACTURES qui ne sont **pas** des factures (extraits de compte, relevés, CODA)
  sont filtrés côté app via `src/lib/factures.js` (`sansExtraits`). Idéalement ils devraient aussi être exclus
  à la source dans le nœud « Compiler Factures » du workflow n8n de rapprochement.

## Refonte applicative (01/11/2026)

Objectif : sortir des liens fragiles vers n8n et construire une vraie base applicative.
Les workflows n8n ont été arrêtés et archivés côté n8n ; le Hub ne doit plus en dépendre.

**Modules supprimés** — code, routes, menus, permissions et tables :

| Module | Tables supprimées | Pourquoi |
|---|---|---|
| Tâches | `taches_historique`, `taches_suivi`, `taches_rapprochement` + les 59 lignes non-ticket de `taches` (table renommée `tickets` le 02/11) | alimenté par « Mails HUB → Tâches », jamais adopté |
| RDV / Agenda | `rdv`, `rdv_categories`, fonction `rdv_autolink()` | plus aucune écriture depuis le 6 août 2026 |
| Liens cassés | `liens_casses_log` | plus aucune écriture depuis le 13 août 2026 |
| Synchronisation | `sync_log` (vide) | boutons pointant vers des webhooks morts |

✅ **Fait le 02/11** : la table `taches` ne contenait plus que des tickets. Elle a été
renommée `tickets` (`supabase/migrations/20261102100000_table_tickets.sql`) — même lignes,
mêmes identifiants, `tickets_messages.tache_id` pointe toujours dessus. Une vue `taches`
assure la compatibilité le temps que les onglets ouverts se rechargent ; elle disparaîtra
avec les colonnes héritées des tâches (`echeance`, `code_type`, `source`, `file_attente`,
`assigne_par`, `lien_url`… — 20 colonnes à zéro usage sur les 62 tickets).

**La seule synchronisation externe conservée** : Qlik → Hub pour les **clients**, les
**contrats** et le **statut de production** (N.A., Renon…). Elle passe par la GitHub Action
`qlik-sync.yml`, déclenchable depuis le dashboard Dynassur (`src/components/SyncQlik.jsx`
→ `api/reload-qlik.js`). Tout ce qui est **financier** (comptes, quittances, commissions,
objectifs) ne vient plus de Qlik mais des comptes bancaires (Ponto) et des bordereaux.

### Garde-fou des synchronisations

Toute synchronisation automatique doit se déclarer dans `jobs_attendus` (ce qui doit tourner,
à quelle fréquence) et journaliser chaque passage dans `jobs_log` via `job_debut()` / `job_fin()`
(écriture réservée au `service_role`). La vue `v_jobs_sante` en déduit un état, affiché dans
**Outils → Synchronisations** (`/tools/jobs`) : un job sans succès depuis plus que sa fréquence
attendue + sa tolérance passe en **en_retard**.

Côté code : helper dupliqué `jobDebut` / `jobFin` dans chaque Edge Function (try/catch
silencieux — le journal ne doit jamais faire échouer la synchro), `scripts/job_journal.py`
pour les GitHub Actions, `job_tickets_rappels()` pour les crons purement SQL.

**Un nouveau job sans entrée dans `jobs_attendus` est un job qu'on ne verra pas tomber.**

Premier effet mesuré : la synchronisation Entra échouait depuis sa création (secrets jamais
saisis, `Token Entra 404`). Révélée dès la mise en service du garde-fou, elle a été retirée
le 01/11/2026 — **les accès du Hub se gèrent désormais à la main** dans Paramètres, et rien
ne coupe plus automatiquement l'accès d'un collaborateur parti. Elle sera remise en place avec
le chantier sécurité (bloc 2 bis de `docs/DROITS-ACCES.md`), en même temps que le suivi d'accès
et la traçabilité des modifications — les trois dépendent du retour du login.

### Factures entrantes : une seule chaîne, toutes les heures

Déposer un PDF dans `COMPTA/FACTURES/<_SOCIETE>/ACHATS/<année>` suffit. La GitHub Action
`factures-entrantes.yml` enchaîne les quatre étapes qui étaient quatre lancements manuels :

1. **scan** (`factures_sharepoint.py`) — le fichier devient une ligne de `factures_achat` ;
2. **lecture** (`factures_lecture_pdf.py`) — montant, date, fournisseur et **destinataire** ;
3. **renommage** (`factures_renommage.py`) — le nom vient de la base, jamais l'inverse ;
4. **rapprochement** (`rapprocher_factures_sures()`) — candidat unique + nom concordant +
   **un paiement ne justifie qu'une facture**.

Deux déclencheurs : cron horaire, et le bouton **Traiter les factures** de la comptabilité
(`src/components/TraiterFactures.jsx` → `api/traiter-factures.js`). Le volume de lecture est
borné par passage (`ECHANTILLON`) : cette chaîne sert le flux courant, pas l'arriéré.

**La société d'une facture ne vient pas du dossier.** Le PDF dit à qui il est adressé ; si le
destinataire ne correspond pas, la facture est marquée `a_verifier` et le renommeur lui rend
son `nom_origine`. Un nom moche coûte une recherche, un nom faux clôt la question.

La purge des lignes orphelines reste au scan quotidien de 5h37, qui voit tout l'arbre —
jamais au passage horaire, qui n'en voit qu'une partie.

### Banque : Ponto lit les banques 4 fois par jour, pas en continu

Ponto ne consulte pas les banques en temps réel : il se synchronise **4 fois par jour** en
arrière-plan (vers 2h, 8h, 14h et 20h heure belge). Lire l'API Ponto plus souvent ne sert donc
à rien — on relit le même cache.

Le cron `sync_ponto_comptes_4x` lit à **03:15, 09:15, 15:15 et 21:15 UTC**, soit au moins deux
heures après chaque synchro Ponto, été comme hiver.

⚠️ **Un cron ne doit jamais déclencher de synchronisation Ponto → banque.** Ces synchronisations
(`POST /synchronizations`) sont réservées aux cas « client présent » par les normes techniques
PSD2, exigent l'adresse IP réelle du client et sont limitées à une par compte toutes les
30 minutes. C'est le rôle du bouton **Synchroniser**, déclenché par un humain — jamais d'un
traitement automatique.

### Attribution de la production : la base fait foi, pas le bordereau

Les lignes de bordereau portent un code sous-agent ou commercial (ex. `BLA` chez AG), **qui ne
doit jamais servir à attribuer la production**. Ce code est figé au moment où la compagnie édite
le document : il peut désigner un commercial parti depuis, et un contrat change de gestionnaire,
de commercial ou de sous-agent au fil de sa vie.

**Seuls `clients.gestionnaire_code` et `clients.sa_code` (et les mouvements de production) font
foi.** Le code lu dans le bordereau n'est conservé qu'à titre d'information, jamais comme clé
d'attribution — ni pour les chiffres, ni pour les objectifs, ni pour les commissions.

#### Attribution d'un client : portefeuille, puis gestionnaire (05/11/2026)

Règle métier donnée par Ludovic : **on se base d'abord sur le portefeuille, ensuite sur le
gestionnaire. C'est le gestionnaire qui détermine le commercial.** La correspondance
gestionnaire → commercial doit être paramétrable dans le Hub, surtout pour Juprelle.

**Rien de tout cela n'existe en base aujourd'hui.** Ce qui existe :

| | |
|---|---|
| `clients.bureau_id` | Juprelle 4 847 clients et **6 gestionnaires**, Spa 1 144, Eghezée 779, Ertezée 608, Beauraing 284, Tinlot 234, Beyne-Heusay 154, et **2 254 clients sans bureau** |
| `clients.gestionnaire_code`, `clients.sa_code` | renseignés |
| `ref_portefeuilles` | 3 lignes — Professionnel, VIP, Particulier — et **aucun collaborateur rattaché** |
| colonne « commercial » sur `clients` | **n'existe pas** |

Il manque donc les deux bouts de la chaîne : la notion de portefeuille au sens « à qui
appartient le client », et la table de correspondance gestionnaire → commercial.

**Question ouverte, à trancher avant de coder** : « portefeuille » désigne-t-il
`ref_portefeuilles` (Particulier / Professionnel / VIP — qui est un *segment*, pas un
propriétaire), le bureau, ou une troisième notion ? Juprelle ayant six gestionnaires pour
un seul bureau, le bureau seul ne suffit pas à attribuer.

**Ne pas confondre avec le code du bordereau** (section ci-dessus) : ce code reste
interdit comme clé d'attribution. La règle du portefeuille ne change pas cela — elle dit
d'où vient le commercial, pas que le bordereau redevient une source.

**Règle** : ne pas rajouter de dépendance n8n. Ce qui doit tourner côté serveur passe par une
fonction Edge Supabase + `pg_cron`, ou une fonction serverless Vercel.

### Référence partagée, usage séparé

Question posée le 04/11/2026 : les six sociétés sont séparées — faut-il séparer aussi
les fournisseurs et les catégories ?

**Non, et les chiffres le disent.** 55 fournisseurs sur 446 servent plusieurs sociétés,
mais ils portent **732 factures sur 1 679, soit 44 % du volume**. Engie, Partena, ING et
Proximus facturent à plusieurs entités. Séparer reviendrait à saisir Engie cinq fois —
cinq numéros de TVA, cinq noms courts, cinq corrections à chaque changement d'adresse —
et à n'avoir jamais qu'une vue partielle des doublons et des paiements en double.

Le principe :

> **Ce qui est un fait sur le monde est partagé. Ce qui est un fait sur une société lui appartient.**

- Le numéro de TVA d'Engie, son adresse, son nom d'usage : un fait sur le monde →
  une seule fiche dans `fournisseurs`.
- « Dynassur a payé 1 240 € à Engie en mars » : un fait sur Dynassur →
  reste porté par `factures_achat.societe`.

Ce n'est pas une entorse à la séparation des sociétés, c'en est la condition : la
comptabilité consolidée (`/groupe/comptabilite`) ne peut comparer les dépenses de LODE et
de DTX chez un même fournisseur que si ce fournisseur est une seule et même fiche.

**`categories` applique déjà ce motif** : 52 catégories, `societe` à null, et une colonne
`entites` qui dit à quelles sociétés chacune s'applique. Une liste commune, une
applicabilité par société. Rien à y changer — c'est le modèle à reprendre ailleurs.

**Point ouvert** : une fiche partagée est visible de tous. Les factures restent sous les
règles d'accès de leur société, mais un collaborateur DTX voit que Dynassur travaille avec
tel fournisseur. Acceptable pour un groupe sous un même toit, mais à décider explicitement
avec le chantier des droits (`docs/DROITS-ACCES.md`), pas à subir.

## Devis & factures : un seul design, décliné par société (07/11/2026)

Règle donnée par Ludovic : **« garde bien en mémoire le design qu'on a construit
style LODE, mais avec les couleurs de Dynassur. Tu devras faire ça pour DTX. »**

L'éditeur refait le 06/11 (PR #144, #147) est **le modèle**, pas une page LODE :

- le document à gauche tel qu'il sera imprimé, les réglages dans un panneau à
  droite, bascule **Éditeur / PDF** en haut ;
- numéro, dates, objet et client édités **sur le document lui-même** — les champs
  ne se révèlent qu'au survol ;
- un clic sur un article ouvre sa fiche : quantité avec pas −/＋, prix HTVA **ou
  TVA comprise**, remise repliée tant qu'elle vaut zéro, photos, option ;
- sur téléphone : trois onglets **Document / Détails / PDF**, et les articles en
  cartes — un tableau à six colonnes sur 390 px est illisible ;
- facture d'acompte : **deux tableaux aux mêmes colonnes**, PDF et Word ;
- communication structurée (modulo 97) et QR de paiement EPC sur la facture.

**Ce qui change d'une société à l'autre, et rien d'autre** : la couleur, le logo,
les coordonnées. Tout est déjà paramétré dans `src/lib/lodeConfig.js`,
`dynConfig.js` et `dtxConfig.js`, qui ont la même forme (`couleur`, `logo_url`,
`iban`, `bic`, `tva`…), et dans `src/lib/entites.js` pour les couleurs d'identité :

| | Couleur | Foncé |
|---|---|---|
| LODE | `#ea580c` orange | `#7c2d12` |
| Dynassur | `#0080BD` bleu | `#0D2F5E` |
| DTX | `#94a3b8` gris | `#334155` |

Ces couleurs **ne sont pas des jetons de thème** : elles sont volontairement hors
de `src/lib/theme.js`. Le orange de LODE n'est pas « la couleur d'accent », c'est
LODE.

**Le piège, et il est déjà là** : l'éditeur LODE fait 2 923 lignes, celui de DTX
1 023. L'écart était de 900 lignes le 03/11, il est de 1 900 depuis le 06/11 —
parce que tout ce qui précède n'existe que pour LODE. Décliner le design sur
Dynassur et DTX en recopiant la page une troisième fois revient à payer trois
fois chaque correction. **Trancher d'abord la question des trois jeux de tables
jumelles (`lode_*`, `dtx_*`, `dyn_*`) — un seul écran avec une colonne
`societe` — puis décliner.** C'est le point « Trancher : trois modules
parallèles, ou un seul par société ? » de la feuille de route.

**Dynassur d'abord, et pour une raison chiffrée** : Dynassur émet ~33 factures
par mois via Accountable (facture 2026-329 au 01/10/2026), contre 23 factures au
total pour LODE. C'est le vrai volume du groupe.

## Outils (`/tools`)

Les six outils partagent depuis le 02/11/2026 un cadre commun : le registre `src/lib/outils.js`
(une entrée par outil → route, carte sur `/tools`, permission) et la coquille
`src/components/OutilPage.jsx` (retour, titre, chargement, erreurs). **Ajouter un outil =
une entrée dans le registre**, plus aucun câblage dans `App.jsx` ni dans `ToolsHome`.
Mode d'emploi : `docs/OUTILS.md`.

Point ouvert : tous les outils partagent `acc_tools` sauf la succession (`prive_succession`) —
grain trop grossier, dépend du modèle de modules (`docs/DROITS-ACCES.md`). Et aucun usage
n'est mesuré, donc on ne sait pas lesquels servent.

## Téléphonie 3CX (module Appels)

C'est 3CX qui écrit dans le Hub (`api/3cx/call.js` → `crm_log_appel` → `appels`), jamais l'inverse.
Le sens Hub → 3CX est ouvert mais inutilisé, en attente d'un client API côté central.

**Le piège principal** : 3CX ne journalise qu'**une étape par appel**, pas le transfert. Un appel
passé par le menu puis transféré n'apparaît qu'une fois. Les statistiques ne comptent donc que les
appels arrivés sur le poste d'un collaborateur, et c'est un plancher. Trois autres pièges déjà
corrigés (quatre valeurs de `direction`, deux formats de durée, un événement par coup de sonnerie)
et tout le reste : `docs/TELEPHONIE.md`.

## Workflows n8n (inventaire, vérifié le 30/10/2026 via le connecteur n8n)

Détail complet (nœuds, écritures Supabase, credentials, implications test) : `docs/N8N-INVENTAIRE.md`.

| ID | Nom | Rôle | Déclencheur |
|---|---|---|---|
| `hmL5WFBknLUfDwGw` | Rapprochement Factures ↔ Transactions | scan SharePoint `COMPTA/FACTURES/_*` → `factures_achat`, purge des orphelins, puis appelle `backfill-thumbs2` | cron quotidien + webhook `rapprochement-factures` |
| `slxHb4qy0VvvZsz2` | Miniatures Factures v2 | vignettes PDF → bucket `factures-thumbs`, `transactions.facture_thumb_url` | webhook `backfill-thumbs2` |
| `9mVOQPAN2fI5z9um` | Bordereaux BQT/RCP → Supabase | fichiers `AAAA.MM - BQT/RCP - Cie - n°.pdf` → `bordereaux` (sans montants, extraction Claude désactivée) | cron 01:00 + webhook `run-bordereaux` |
| `3HDF690T2XJeaSWY` | Notes de frais - Notifications | mails Outlook soumission / acceptation | webhook `nf-notify` |
| `i9dZDnCbZRhiDVI7` | NF - Liste _NOTE_DE_FRAIS | liste Graph du dossier `COMPTA/_NOTE_DE_FRAIS` | webhook GET `nf-list` |
| `xgkgnuSSkoQXlXlp` | Tickets - Alertes mail | envoi mail via Graph `sendMail` | webhook `ticket-alerte` |
| `szxoCijzm3wJ55Jd` | Tickets - Réponses mail → fil | lit la boîte hub, RPC ticket, archive | cron 2 min |
| `mGJGzrRNLw1ZAfOZ` | LODE - Peppol Send (Billit) | facture LODE → Billit → Peppol | webhook `lode-peppol-send` |
| `EiB9oTn9MPJjELKW` | LODE - Facture Archive | PDF → SharePoint `COMPTA/FACTURES/_LODE/VENTES/<année>` | webhook `lode-facture-archive` |
| `M9QvKGMBz6WA0N7M` | BCE Search (proxy CBEAPI) | recherche Banque-Carrefour des Entreprises | webhook |
| `mQQnOMKccXmmWc3s` | Invoice - List | classement factures SharePoint avec Claude | cron 5 min |
| `dGPwTdmWtzKu2mPi` | Invoice/BQT - Rename | renommage factures/bordereaux avec Claude | cron 1 min |
| `JF04qGomUN2kubuo` / `driebSzUwKy5SeW4` | SINISTRES / IARD _GESTION_DYNASSUR | agents IA (hors Hub) | webhook |

L'ancien « Import Brio » (`XveWrHrBybFWp2B0`, webhook `run-import-dynassur`) n'existe plus : remplacé par les
workflows Qlik (`.github/workflows/qlik-*.yml`). Les exports dans `n8n_workflows/` sont partiels ; la référence
est l'instance n8n, lisible via le connecteur (option « Available in MCP » cochée sur chaque workflow).

## Règles pour Claude

- Répondre et coder en **français** (UI, commits, commentaires).
- Suivre le style existant : composants fonction + styles inline, helpers locaux dupliqués par fichier (`fmt`, `fmtDate`).
- `npm run build` doit passer avant tout push.
- Déploiement = merge dans `main` (Vercel suit). Travailler sur une branche, PR, merge.
- Ne jamais committer de secret (clé API, service_role). Le repo est public.
- Toute écriture en base de prod (Supabase MCP) : lecture d'abord, écriture ciblée, jamais de delete massif sans validation humaine.

### Fusion des PR : autonome depuis le 05/11/2026

Ludovic : « *tu peux fusionner tous les PR existants, ne me demande plus et prévois-le* ».
**Ne plus demander l'autorisation de fusionner.** Ouvrir la PR, la vérifier, la fusionner,
et dire ce qui a été fait.

Autonome ne veut pas dire les yeux fermés. Avant chaque fusion :

1. `npm run build` passe ;
2. lire le diff — une PR vieille de plusieurs jours peut avoir été dépassée par le reste ;
3. après la fusion, **vérifier le déploiement, pas seulement la fusion**.

Ce troisième point n'est pas théorique : entre le 04 et le 05/11, six PR ont été fusionnées
dans `main` pendant que **tous les déploiements de production échouaient** (13 fonctions
serverless pour une limite de 12). Elles ont été annoncées comme faites. Elles ne l'étaient
pas. « Fusionné » et « en ligne » sont deux choses différentes, et c'est la seconde qui
intéresse l'utilisateur. Contrôler l'état du déploiement Vercel **et son alias**
(`hub.dtx-group.be`, `aliasError: null`) avant d'annoncer quoi que ce soit.

Ce qui continue d'exiger un accord explicite, parce que ce n'est pas réversible d'un
`git revert` : les écritures massives en base de production, les suppressions, et tout
geste qui sort du dépôt (envoi de courrier, publication, appel à une API tierce qui écrit).

### Le plafond des fonctions serverless est levé (06/11/2026)

Le projet Vercel est passé en **plan Pro**. La limite de 12 fonctions
serverless, qui a cassé tous les déploiements de production les 4 et 5/11
(13 fonctions pour une limite de 12), n'existe plus.

**Vérifié, pas supposé** : une preview portant une 13ᵉ fonction a été construite
avec succès le 06/11. Sur le plan gratuit, ce déploiement échouait.

La fusion des quatre routes d'envoi de mail (`cotisation-rappel`,
`cotisation-send`, `devis-send`, `facture-send`) n'est donc plus nécessaire.
Elle reste souhaitable par propreté — elles font toutes la même chose — mais
ce n'est plus un sujet de stabilité.

## Trois pièges mesurés le 06/11/2026

### Fermer une fonction demande DEUX révocations, pas une

`anon` tient son droit d'exécution de **deux sources à la fois**, et il faut
couper les deux. Je me suis fait prendre une fois par chacune, le même jour.

1. **`PUBLIC`** — Postgres accorde `EXECUTE` à `PUBLIC` sur toute fonction
   nouvelle. Un `revoke … from anon` seul laisse donc le droit intact.
2. **Le privilège par défaut de Supabase** — il accorde `EXECUTE` à `anon`,
   `authenticated` et `service_role` sur toute fonction nouvelle du schéma
   `public`. Un `revoke … from public` seul laisse donc le droit intact aussi.

**La forme correcte**, pour toute fonction sensible :

```sql
revoke execute on function public.f(...) from public, anon;
grant  execute on function public.f(...) to authenticated;  -- ou service_role
```

puis **revérifier** avec `has_function_privilege('anon', …)`. La vérification
n'est pas une précaution de style : elle a rattrapé l'erreur les deux fois.
Un correctif de sécurité non revérifié rassure sans protéger.

Rappel : `anon` est le rôle d'**avant** connexion, et sa clé est dans le bundle
du navigateur **et dans ce dépôt public**. « Appelable par `anon` » = appelable
par n'importe qui sur Internet.

### Le planificateur de GitHub n'honore pas un cron horaire

`factures-entrantes.yml` est déclaré en `cron: '23 * * * *'`, soit 24 passages
par jour. **Mesuré sur 24 h : trois**, à 02h32, 11h05 et 18h48 — toutes les huit
heures, avec une dérive de −18 à +25 minutes. GitHub abandonne les
déclenchements planifiés quand ses files sont chargées, et les plannings à
haute fréquence sont les premiers sacrifiés.

Les trois crons **quotidiens** (`qlik-sync`, `factures-sharepoint`,
`bordereaux-sharepoint`) passent tous les jours sans faute. Seul l'horaire est
touché.

**Donc : ne pas compter sur GitHub pour du sous-journalier.** `pg_cron` tient
Ponto à 03h15, 09h15, 15h15 et 21h15 sans dériver. Une facture déposée dans
SharePoint n'apparaît pas « dans l'heure » mais en moyenne dans les huit ;
le bouton **Traiter les factures** reste le seul moyen fiable.

### `quittances` est vide — tout indicateur qui en dépend est faux

Zéro ligne, aucune année. C'est attendu (le financier vient des bordereaux,
plus de Qlik), mais l'indicateur « Clients sans commission » qui s'en nourrit
comptait donc **les 10 308 clients**. Il rend désormais `null` et l'écran dit
pourquoi.

**Règle générale** : un indicateur calculé sur une source vide doit renvoyer
`null`, jamais un total — et surtout jamais zéro, qui se lit comme une mesure.

### Une RLS sur une table partitionnée ne protège pas ses partitions (07/11/2026)

Postgres applique la sécurité **par relation**. `releves_producteur` avait bien
RLS activée, mais ses **15 partitions** (`releves_producteur_2017` … `_2030`,
`_hors_plage`) ne l'avaient pas — et PostgREST expose **chaque partition sous son
propre nom**. Interroger `releves_producteur_2026` directement contournait donc
entièrement la politique du parent.

`anon` y avait **SELECT et INSERT**. N'importe qui sur Internet pouvait lire, et
surtout **écrire**, des lignes de commission. La table était vide, donc rien n'a
fui — mais c'était de la chance : les chantiers `prod-p3-*` consistent justement
à la remplir.

Corrigé le 07/11 (`20261107090000_rls_partitions_releves_et_tmp_manquant.sql`) :
RLS activée sur chaque partition, `anon` révoqué sur le parent, les partitions et
les deux séquences.

**Vérifié en se faisant passer pour chaque rôle**, parce qu'activer la RLS sur une
partition aurait pu casser la lecture par le parent :

| | |
|---|---|
| connecté → lecture par le **parent** | **OK** — l'application marche toujours |
| `anon` → partition en direct | **refusé** |
| `anon` → parent | **refusé** |

⚠️ **Toute nouvelle partition créée plus tard repartira sans RLS** : Postgres n'en
hérite pas. Le `do $$` de la migration est écrit pour être rejouable — le relancer
après avoir ajouté une partition.

Au passage, `tmp_manquant` portait `FOR INSERT TO anon WITH CHECK (true)` : la
**seule écriture publique de la base**, sans aucune condition, 1 700 lignes déjà
dedans. Politique supprimée et `anon` révoqué. La table est morte (aucun usage
dans le code) mais **pas supprimée** — une suppression ne se défait pas.

### Une vue sans `security_invoker` ne protège rien non plus (07/11/2026)

Même règle que les partitions, autre forme : **Postgres applique la sécurité par
relation**. Une vue lit ses tables avec les droits de **son propriétaire** tant
qu'elle n'est pas `security_invoker` — fermer les tables ne ferme donc rien tant
que les vues restent ouvertes.

Trois vues d'anomalies comptables portaient en plus le droit de lecture d'`anon`.
Mesuré en se faisant passer pour `anon`, pas déduit :

| Vue | Lisible par Internet |
|---|---|
| `v_factures_impayees` | **1 457 lignes** — fournisseurs, montants, six sociétés |
| `v_factures_doublons` | 62 lignes |
| `v_paiements_doubles` | 27 lignes |

Fermé le 07/11 (`20261107100000_fermer_vues_a_anon.sql`), vérifié rôle par rôle :
`anon` refusé sur les six vues, l'administrateur garde 1 457 / 62 / 27.

**Le piège de la lecture des policies.** J'avais d'abord conclu que `credits`
acceptait une insertion publique, en lisant `pg_policies`. Faux : pour une policy
`INSERT`, `qual` est `NULL` et la condition vit dans `with_check`. Le test en se
faisant passer pour `anon` a dit l'inverse en une seconde. **Lire une policy ne
vaut pas la tester.**

**Et `security_invoker` n'est pas gratuit.** Posé sur `v_factures_impayees`, il
fait dépasser 25 s (RLS évaluée par ligne sur 7 388 factures croisées à 6 644
transactions — les fonctions sont pourtant déjà `STABLE`) et l'onglet Anomalies
ne répond plus. Essayé, mesuré, retiré. Le correctif est une réécriture de la
vue, pas un drapeau.

### Le cloisonnement par bureau marche — mesuré le 07/11/2026

En se faisant passer pour deux collaborateurs non-administrateurs :

| | JFS (Spa) | RCA (Tinlot) |
|---|---|---|
| `clients` | 1 144 | 234 |
| `contrats` | 4 453 | 703 |
| `objets_risque` | 17 911 | 2 267 |
| `transactions`, `factures_achat`, `comptes_bancaires` | 0 | 0 |

**Ce qui n'est pas cloisonné, et c'est le reste du bloc 2** : `sinistres` **8 014
pour tout le monde** (alors que RCA ne voit que 234 clients — les sinistres
portent le numéro de dossier des 10 000 autres), `bordereaux` **6 867 en
lecture ET écriture**, `appels` 6 873, `collaborateurs` 54 avec IBAN, BIC et
date de naissance.

### Deux comptes nommés d'après leur société, et c'est voulu (07/11/2026)

| Compte | Personne | Société |
|---|---|---|
| `rde@dynassur.be` | Renaud Desclez | R'Assur |
| `ice@dynassur.be` | Ingrid CEZAR | cezassur |

Ils ont été créés **sous le nom de leur société dans Qlik**. On les garde tels
quels **tant que Qlik est là** ; la standardisation se fera à l'arrêt de Qlik,
pas avant — renommer maintenant casserait la correspondance avec la source.

## Le Hub est derrière le login Microsoft — vérifié le 06/11/2026

Question de Ludovic : *« l'entièreté du Hub doit passer par l'authentificateur
Microsoft ? Plus aucune page ne peut être accessible sans ce login. »*

**Oui, et c'est vérifié par un test, pas par une lecture du code** : les
50 routes ouvertes une à une dans un contexte de navigateur **neuf** (ni
cookie, ni `localStorage`, ni session héritée — l'équivalent strict d'une
navigation privée), en cherchant dans la page rendue à la fois l'écran de
connexion et toute trace de contenu applicatif.

**47 sur 50 affichent l'écran de connexion. Zéro fuite de contenu.** Les trois
autres sont voulues :

| Route | Ce qu'elle montre |
|---|---|
| `/auth/callback` | « Connexion en cours… » — c'est l'étape du login |
| `/access-denied` | « Ton compte n'a pas encore accès au Hub » — aucune donnée |
| `/devis/:token` | **la seule vraie page publique** |

`ACCES_LIBRE_TEMPORAIRE` (la porte dérobée de `src/lib/auth.jsx`) est bien à
`false`.

### `/devis/:token` : la seule exception, et elle est voulue

Un client qui reçoit un devis n'a pas de compte Microsoft. La page est donc
ouverte, protégée par un jeton UUID imprévisible — testé avec un UUID au
hasard : « Lien indisponible », aucune fuite.

**Deux limites à connaître** (constatées, non corrigées — c'est un choix
métier) :

- **Le lien n'expire jamais.** `lode_devis.date_validite` existe mais
  `lode_devis_public()` ne la regarde pas.
- **La fonction renvoie toute la ligne** (`to_jsonb(d)`), donc aussi `notes`,
  `responsable`, `opened_at`, `relance_sent_at`. Pas de colonne de marge ni de
  prix de revient — rien de confidentiel — mais si `notes` sert à des
  remarques internes, le client les lit.

### `APP_ENV=test` n'isole que Supabase, pas SharePoint (07/11/2026)

Trouvé en mettant l'environnement de test en service. `scripts/_env.py` fait
basculer la base de données selon `APP_ENV` — et **rien d'autre**. Les scripts
parlent au même site SharePoint dans les deux cas : `FACTURES_RACINE` vaut
`COMPTA/FACTURES`, quel que soit l'environnement. Le `_TEST` annoncé plus bas
dans ce fichier **n'a jamais existé dans le code**.

Conséquence mesurée : un renommage lancé avec `target=test` prendrait ses ordres
dans la base de **test** et modifierait de **vrais documents**.

Périmètre exact, vérifié et plus étroit qu'il n'y paraît : sur les quatre scripts
qui contiennent un `PATCH`, **deux seulement écrivent dans SharePoint** —
`factures_renommage.py` et `fdp_renommage.py`. `factures_lecture_pdf.py` et
`office_users_sync.py` écrivent dans Supabase.

Corrigé par `refuser_ecriture_sharepoint()` dans `scripts/_env.py`, appelée aux
deux points d'écriture. En test, l'écriture est **sautée et journalisée**.

**Refuser plutôt que rediriger vers `_TEST`**, et c'est délibéré : un dossier de
test à part se périme et donne une fausse assurance, alors qu'un refus se voit
dans le journal. Ce qu'on vérifie en test, c'est la lecture et les décisions —
pas que Graph sait renommer.

⚠️ **Tout nouveau script qui écrit dans SharePoint doit appeler ce garde-fou.**
Rien ne l'impose automatiquement.

## Environnements & configuration (depuis le 29/10/2026)

- **Aucune URL/clé en dur** dans le code : tout passe par `src/config/env.js` (front, variables `VITE_*`),
  `api/_lib/env.js` (fonctions Vercel, `process.env`) et `scripts/_env.py` (Python, `os.environ`).
  Liste des variables : `.env.example`. Sans variable → production. Avec `APP_ENV=test`, l'URL et la
  clé Supabase sont obligatoires (le démarrage échoue plutôt que de retomber sur la prod) et le
  bandeau `BandeauEnv` s'affiche.
- Helpers à utiliser : `n8nWebhook('iban-sync')`, `sharepointUrl('COMPTA/FACTURES/_LODE')`, `LOGOS_URL`, `HUB_URL`.
- Branches : `main` = production (`hub.dtx-group.be`), `staging` = test (projet Vercel `hub-dtx-test`,
  à créer en phase 2). Feature → PR → `staging` → `main`.
- Plan complet (test/prod, couche applicative, migrations, CI) : `docs/ARCHITECTURE-ENVIRONNEMENTS.md`.
- Sécurité phase 0 appliquée : `execute_raw_sql` et `tickets_rappels_echeance` ne sont plus exécutables
  par `anon` (`sql/security_phase0_revoke_rpc_anon.sql`).
### Environnement TEST — état au 07/11/2026

⚠️ **L'ancien projet Supabase `lvdnzbhplnzuwdqtitdb` N'EXISTE PLUS.** L'organisation DYNASSUR
ne contient que la production. Supprimé, ou créé sur un autre compte — on ne sait pas.

**Nouveau projet : `wsuawmtwlvcyppgfvqzj`** (`hub-dtx-test`, région Paris comme la production,
plan gratuit, 0 €). Schéma monté à **100 tables + 31 des 43 migrations**.

**Et c'est le plan A qui est retenu, pas le second projet Vercel** : on garde UN seul projet
Vercel et on fait pointer la cible **Preview** sur la base de test. Une page de réglages, et
d'un coup toute branche et toute PR deviennent inoffensives — au lieu de la seule branche
`staging`. Ça bouche en plus le trou actuel, qui est que les préversions écrivent dans les
vraies données.

✅ **Les cinq variables sont posées sur la cible Preview** (07/11, production intacte) :
`VITE_APP_ENV=test`, `APP_ENV=test`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`MAIL_REDIRECT_TO`.

### Ce qu'un seul interrupteur arme — mesuré, pas supposé

En lisant enfin les variables, le trou s'est révélé plus large qu'annoncé : il n'y avait
**aucune variable Supabase nulle part**, ni en production ni en preview. Les deux retombaient
sur les constantes de production écrites dans `src/config/env.js`. Et Preview portait déjà
`AZURE_CLIENT_SECRET`, `GITHUB_DISPATCH_TOKEN`, `CBEAPI` et les `THREECX_*` — sans `APP_ENV`,
le code **se croyait en production** : les garde-fous existaient, aucun n'était armé.

| | Avant | Après |
|---|---|---|
| Base de données | **PRODUCTION** | projet de test |
| Mails | **envoi réel** | redirigés (`MAIL_REDIRECT_TO`) ou refusés |
| GitHub Actions | `target=production` | `target=test` |
| Branche déclenchée | `main` | `staging` |
| Envoi Peppol | autorisé | refusé (`PEPPOL_AUTORISE`) |
| Webhooks n8n | les vrais | suffixés `-test` |

**Le plus sérieux était `GITHUB_DISPATCH_TOKEN`** : une préversion pouvait lancer une GitHub
Action **sur `main` avec les secrets de production**. `api/declencher.js` lisait déjà `IS_TEST`
pour choisir sa cible et sa branche — il faisait bien son travail, mais personne ne lui avait
dit qu'il était en test.

⚠️ **Reste non cadré** : les `THREECX_*` sont sur Preview et `api/3cx/` ne contient **aucun**
garde-fou de test. Le sens Hub → 3CX est documenté comme ouvert mais inutilisé — à mesurer
avant de conclure.

### Accéder à Vercel depuis une session cloud

**Le connecteur MCP ne peut NI lire NI écrire les variables d'environnement** (403 sur
`/projects/{id}/env`, et Vercel précise qu'une reconnexion n'y changera rien). Tout le reste
passe : déploiements, projet, domaines.

**Le contournement qui marche**, mis en service le 07/11 : un **secret réseau de type Bearer**
dans les réglages de l'environnement cloud — hôte `api.vercel.com`, en-tête `Authorization`,
préfixe `Bearer`, valeur = un jeton Vercel d'équipe. Le proxy injecte l'en-tête ; Claude ne voit
jamais le jeton. Il faut **aussi** ajouter `api.vercel.com` aux domaines autorisés du réseau,
sinon l'hôte est injoignable (`curl` renvoie `000`). Les deux ont pris effet **sans redémarrer
la session**. ⚠️ Laisser les préfixes de chemin vides : l'API Vercel éparpille ses routes sur
`/v5/`, `/v6/`, `/v10/`, `/v13/`.

⚠️ **Ne pas confondre avec un connecteur cassé** : le 07/11 j'ai cru qu'il l'était pendant deux
heures parce que j'utilisais un identifiant d'équipe faux, et j'ai envoyé Ludovic reconnecter
pour rien. Le bon est `team_ullhaGKqy8NSZIrW8WRu4Vho`.

La **Deployment Protection est déjà activée** (`ssoProtection`, `all_except_custom_domains`) :
les préversions ne sont pas ouvertes à qui connaît l'adresse.

**Ce qui reste, et c'est le vrai sujet** : les 12 migrations qui échouent révèlent que **le
dépôt ne reproduit pas la production** — une trentaine d'objets n'existent qu'en base, dont
`collaborateur_acces`, `ref_modules`, `a_module()` et `acces_compta()`, c'est-à-dire le cœur
des droits d'accès. Voir la section suivante.

Méthode de travail et différence test / preview / production : `docs/COMMENT-TRAVAILLER.md`.
Checklist et variables : `docs/ENVIRONNEMENT-TEST.md`.

### Le dépôt ne reproduit pas la production (mesuré le 07/11/2026)

Trouvé en montant le projet de test : 12 des 43 migrations échouent parce qu'elles modifient
des objets qu'**aucune migration du dépôt ne crée**. Ils ont été appliqués directement en base.

| | Absents du dépôt |
|---|---|
| **Tables** | `collaborateur_acces`, `ref_modules`, `ref_modules_societes` (tout le modèle de droits), `personnes`, `fournisseurs`, `fournisseurs_alias`, `compagnies_alias`, `clients_attribution`, `releves_producteur` + 18 partitions |
| **Vues** | `v_factures_impayees`, `v_factures_doublons`, `v_paiements_doubles`, `v_fournisseurs_usage`, `v_lacunes_bordereaux`, `v_rp_qualite`, `mv_rp_mensuel` |
| **Fonctions** | `a_module`, `acces_compta`, `acces_compta_compte`, `rapprocher_factures_sures`, `rapprocher_factures_paiements`, `noms_concordent`, `mouvement_interne`, `job_tickets_rappels` |

Et l'inverse : le projet de test porte `user_permissions`, `bordereaux_brio` et
`v_matrice_rcp_2026`, que la production **n'a plus** — les migrations qui les suppriment ont
échoué en chaîne.

**Conséquence** : « rejouer les migrations » ne reconstruit pas la base. Ça pèse sur la
restauration d'une sauvegarde, sur l'utilité du test, et sur la sécurité — les règles de
cloisonnement ne sont pas versionnées, donc ni relisibles en diff, ni réappliquables, ni
opposables.

**Premier morceau fait le 07/11** (`20261107160000_rattrapage_modele_de_droits.sql`) :
`compte_hub_actif` et les trois tables du modèle de droits — `ref_modules`,
`ref_modules_societes`, `collaborateur_acces` — avec leur catalogue. Migration **idempotente** :
sans effet en production (vérifié : 18 modules, 35 déclinaisons, 184 attributions, 19 comptes
actifs, tous inchangés), elle comble le test. Gain au passage : `anon` perd le droit de lecture
sur `collaborateur_acces`.

**Ce qui l'a révélé est instructif** : l'environnement de test ne laissait pas se connecter.
L'authentification Microsoft réussissait, puis le Hub cherchait la fiche du collaborateur et
tombait sur « Accès non autorisé », faute de ces objets. Le défaut le plus abstrait du projet
s'est manifesté de la façon la plus concrète qui soit.

**Reste à rattraper** : `fournisseurs`, `fournisseurs_alias`, `compagnies_alias`, `personnes`,
`clients_attribution`, `releves_producteur` + partitions, les sept vues, et les fonctions
`a_module`, `acces_compta`, `acces_compta_compte`, `rapprocher_factures_sures`,
`rapprocher_factures_paiements`, `noms_concordent`, `mouvement_interne`, `job_tickets_rappels`.

### L'environnement de test fonctionne — 07/11/2026

Connexion Microsoft vérifiée de bout en bout sur une préversion, avec le bandeau
« ENVIRONNEMENT DE TEST — BASE WSUAWMTWLVCYPPGFVQZJ — AUCUNE DONNÉE RÉELLE ».

Côté Azure, l'application **Hub DTX** porte désormais les **deux** URI de retour (production et
test) et un second secret `Supabase-Test`. Côté Supabase de test : fournisseur Azure activé avec
le même Client ID `5065b920-f43b-489d-8c68-1576803f020f`, et `Redirect URLs` =
`https://hub-*-dynassur-s-projects.vercel.app/**` — **le joker est indispensable**, chaque
préversion ayant une adresse différente.

⚠️ Le `Site URL` du projet de test est resté sur `http://localhost:3000`. Sans effet tant que le
joker couvre les préversions, mais c'est l'adresse de repli.

En test : mails redirigés (`api/_lib/mail.js`), webhooks n8n suffixés `-test`, et **SharePoint
NON isolé** — voir la section « `APP_ENV=test` n'isole que Supabase ».
- Workflows Qlik : entrée `target` (test/production) = environnement GitHub ; le cron vise la prod.
