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

- `src/pages/<entite>/…` : une page par module et par société (dashboard, comptabilité, banque, tâches…).
- `src/components/` : composants partagés (ComptabiliteView, VueFactures, SelecteurFactureAchat, RapprochementAuto, BordereauxView…).
- `src/lib/` : client supabase, auth (`user_permissions`), configs par entité, utilitaires (`factures.js` : exclusion des extraits de compte).
- `sql/` : schéma canonique régénéré depuis la base (`schema.sql`, 100 tables) + scripts par module.
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
| Activité | `rdv`, `appels` (3CX), `taches*`, `tickets_messages` |

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

## Workflows n8n (inventaire, vérifié le 30/10/2026 via le connecteur n8n)

Détail complet (nœuds, écritures Supabase, credentials, implications test) : `docs/N8N-INVENTAIRE.md`.

| ID | Nom | Rôle | Déclencheur |
|---|---|---|---|
| ~~`hf6G2dE1ZcfXDO4W`~~ | ~~IBAN SYNC~~ | Remplacé le 31/10/2026 par la fonction Edge `sync-ponto-comptes` + `pg_cron` (`sync_ponto_comptes_daily`, 00:11) — la synchro n8n utilisait une clé Supabase invalide, 11 jours de retard découverts au passage. À désactiver dans n8n une fois les secrets Ponto renseignés. | — |
| `hmL5WFBknLUfDwGw` | Rapprochement Factures ↔ Transactions | scan SharePoint `COMPTA/FACTURES/_*` → `factures_achat`, purge des orphelins, puis appelle `backfill-thumbs2` | cron quotidien + webhook `rapprochement-factures` |
| `slxHb4qy0VvvZsz2` | Miniatures Factures v2 | vignettes PDF → bucket `factures-thumbs`, `transactions.facture_thumb_url` | webhook `backfill-thumbs2` |
| `9mVOQPAN2fI5z9um` | Bordereaux BQT/RCP → Supabase | fichiers `AAAA.MM - BQT/RCP - Cie - n°.pdf` → `bordereaux` (sans montants, extraction Claude désactivée) | cron 01:00 + webhook `run-bordereaux` |
| `c680QZUbZkFpwMEh` | Nettoyage liens cassés | délie les transactions dont la facture a disparu, log `liens_casses_log` | cron 02:00 + webhook `nettoyer-liens-casses` |
| `3HDF690T2XJeaSWY` | Notes de frais - Notifications | mails Outlook soumission / acceptation | webhook `nf-notify` |
| `i9dZDnCbZRhiDVI7` | NF - Liste _NOTE_DE_FRAIS | liste Graph du dossier `COMPTA/_NOTE_DE_FRAIS` | webhook GET `nf-list` |
| `xgkgnuSSkoQXlXlp` | Tickets - Alertes mail | envoi mail via Graph `sendMail` | webhook `ticket-alerte` |
| `szxoCijzm3wJ55Jd` | Tickets - Réponses mail → fil | lit la boîte hub, RPC ticket, archive | cron 2 min |
| `Rted8kqbayA30OaJ` | Mails HUB → Tâches | mails → `taches` | cron 15 min |
| `EH3JHKrmbzv6rItv` | Agenda → RDV | calendriers O365 → `rdv` | cron horaire |
| `UnuI7LdT7RHfow8n` | HUB_DTX_USER_PERMISSION | users Entra ↔ `user_permissions` (insert / désactivation) | cron horaire |
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
