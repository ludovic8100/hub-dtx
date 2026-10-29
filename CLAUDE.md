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

## Rapprochement bancaire (cœur du module compta)

- Lien bidirectionnel : `transactions.facture_url` + `rapproche` ⟷ `factures_achat.transaction_id`.
  **Toujours écrire les deux côtés** (voir `lierFactureChoisie` dans ComptabiliteView).
- Après liaison, déclencher la régénération des vignettes : `POST https://n8n.srv1082740.hstgr.cloud/webhook/backfill-thumbs2`.
- Les fichiers du dossier SharePoint FACTURES qui ne sont **pas** des factures (extraits de compte, relevés, CODA)
  sont filtrés côté app via `src/lib/factures.js` (`sansExtraits`). Idéalement ils devraient aussi être exclus
  à la source dans le nœud « Compiler Factures » du workflow n8n de rapprochement.

## Workflows n8n (inventaire)

| ID | Nom | Rôle | Webhook |
|---|---|---|---|
| `XveWrHrBybFWp2B0` | Import Brio | clients/contrats/production/quittances depuis CSV SharePoint | `run-import-dynassur` |
| `hf6G2dE1ZcfXDO4W` | Sync Ponto | soldes + transactions bancaires | `iban-sync` |
| `9mVOQPAN2fI5z9um` | Bordereaux BQT/RCP | import bordereaux SharePoint | `run-bordereaux` |
| `hmL5WFBknLUfDwGw` | Rapprochement Factures ↔ Transactions | scan SharePoint FACTURES → `factures_achat` + auto-liaison (tous les jours 4h) | `rapprochement-factures` |
| `slxHb4qy0VvvZsz2` | Miniatures Factures v2 | vignettes PDF des factures liées | `backfill-thumbs2` |
| `M9QvKGMBz6WA0N7M` | BCE Search | proxy recherche Banque-Carrefour des Entreprises | — |
| `mGJGzrRNLw1ZAfOZ` | LODE Peppol Send (Billit) | envoi factures LODE vers Peppol | `lode-peppol-send` |

Les exports dans `n8n_workflows/` ne couvrent qu'une partie ; la référence est l'instance n8n elle-même.

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
