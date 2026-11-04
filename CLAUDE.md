# Hub DTX — Hub de gestion multi-sociétés

Application interne de gestion pour un groupe de 6 entités belges :
**DYNASSUR** (courtage assurance), **DTX**, **LODE**, **HEXAGROUP** (ASBL), **PRIVE**, **HOL** (holding/consolidé).

## Stack

- **Frontend** : React 18 + Vite + react-router, styles inline (pas de framework CSS). Langue : français.
- **Backend** : Supabase (projet `tndwonqdbeszkcztkzqe`, Postgres 17, EU) — appelé directement depuis le front avec la clé anon + RLS.
- **Déploiement** : Vercel, déploie automatiquement la branche `main`. Prod : https://hub-dtx.vercel.app
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

## Environnements & configuration (depuis le 29/10/2026)

- **Aucune URL/clé en dur** dans le code : tout passe par `src/config/env.js` (front, variables `VITE_*`),
  `api/_lib/env.js` (fonctions Vercel, `process.env`) et `scripts/_env.py` (Python, `os.environ`).
  Liste des variables : `.env.example`. Sans variable → production. Avec `APP_ENV=test`, l'URL et la
  clé Supabase sont obligatoires (le démarrage échoue plutôt que de retomber sur la prod) et le
  bandeau `BandeauEnv` s'affiche.
- Helpers à utiliser : `n8nWebhook('iban-sync')`, `sharepointUrl('COMPTA/FACTURES/_LODE')`, `LOGOS_URL`, `HUB_URL`.
- Branches : `main` = production (`hub-dtx.vercel.app`), `staging` = test (projet Vercel `hub-dtx-test`,
  à créer en phase 2). Feature → PR → `staging` → `main`.
- Plan complet (test/prod, couche applicative, migrations, CI) : `docs/ARCHITECTURE-ENVIRONNEMENTS.md`.
- Sécurité phase 0 appliquée : `execute_raw_sql` et `tickets_rappels_echeance` ne sont plus exécutables
  par `anon` (`sql/security_phase0_revoke_rpc_anon.sql`).
- **Environnement TEST (phase 2, 29/10/2026)** : projet Supabase `lvdnzbhplnzuwdqtitdb` (schéma =
  `supabase/migrations/20261029120000_baseline_prod.sql`, données anonymisées via `scripts/seed_test.py`),
  projet Vercel `hub-dtx-test` sur `staging`. Checklist et variables : `docs/ENVIRONNEMENT-TEST.md`.
  En test : mails redirigés (`api/_lib/mail.js`), webhooks n8n suffixés `-test`, SharePoint sous `_TEST`.
- Workflows Qlik : entrée `target` (test/production) = environnement GitHub ; le cron vise la prod.
