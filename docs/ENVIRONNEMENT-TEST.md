# Environnement de TEST — état et checklist

Mis à jour le 29 octobre 2026. Complète `docs/ARCHITECTURE-ENVIRONNEMENTS.md` (phase 2).

## 1. Ce qui est en place

| Brique | TEST | PRODUCTION |
|---|---|---|
| Supabase | **`lvdnzbhplnzuwdqtitdb`** — `https://lvdnzbhplnzuwdqtitdb.supabase.co` (plan Free, eu-west-3, créé le 29/10/2026). Schéma complet appliqué depuis `supabase/migrations/20261029120000_baseline_prod.sql` : 100 tables, 226 contraintes, 275 index, 43 fonctions, 17 vues, 14 triggers, 147 policies, 7 buckets + 16 policies storage. Clé publishable : `sb_publishable_DSKvPVSTr-RjyQBkkX60eA_3FBM3RZT`. Cron `tickets_rappels_echeance` **non planifié** (pas de mails depuis le test). | `tndwonqdbeszkcztkzqe` |
| Données | Référentiel copié et anonymisé (compagnies, catégories, comptes, collaborateurs, producteurs, utilisateurs actifs, LODE devis/factures, Hexagroup). Secrets `config_secrets` factices. Échantillon Dynassur : via l'Action `seed-test.yml` (voir § 3). | données réelles |
| Branche Git | `staging` | `main` |
| Vercel | **à créer** (§ 2.1) : `hub-dtx-test` | `hub-dtx` |
| Mails | redirigés vers `MAIL_REDIRECT_TO` avec objet `[TEST]` (`api/_lib/mail.js`) ; sans cette variable, envoi refusé | envoi réel |
| n8n | les webhooks déclencheurs reçoivent le suffixe `-test` (`n8nWebhook()`), donc 404 tant que le workflow jumeau n'existe pas : **aucun workflow de prod ne peut être déclenché depuis le test**. Les aperçus en lecture seule (`apercu-facture`) restent partagés. | — |
| SharePoint | racine `Documents partages/_TEST` (variable `SHAREPOINT_ROOT`) | `Documents partages` |
| GitHub Actions | `qlik-sync`, `qlik-contrats`, `qlik-objets-risque` : entrée `target` (test/production) → environnement GitHub du même nom. Le cron quotidien vise toujours la production. `seed-test.yml` : copie anonymisée prod → test. | — |

## 2. Actions manuelles restantes (vous)

### 2.1 Vercel — projet `hub-dtx-test` (le jeton du connecteur n'a pas le droit de créer un projet)
1. https://vercel.com/dynassur-s-projects → **Add New… → Project** → importer `ludovic8100/hub-dtx`, nom **`hub-dtx-test`**, framework Vite, build `npm run build`, output `dist`.
2. **Settings → Git → Production Branch : `staging`**.
3. **Settings → Deployment Protection : désactiver Vercel Authentication** (l'app a son propre login Azure ; sinon chaque testeur doit avoir un compte Vercel).
4. **Settings → Environment Variables** (Production + Preview) :

   | Clé | Valeur |
   |---|---|
   | `VITE_APP_ENV` / `APP_ENV` | `test` |
   | `VITE_SUPABASE_URL` / `SUPABASE_URL` | `https://lvdnzbhplnzuwdqtitdb.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY` | `sb_publishable_DSKvPVSTr-RjyQBkkX60eA_3FBM3RZT` |
   | `VITE_SHAREPOINT_ROOT` / `SHAREPOINT_ROOT` | `Documents partages/_TEST` |
   | `MAIL_REDIRECT_TO` | `lde@dynassur.be` |
   | `GITHUB_SYNC_REF` | `staging` |
   | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `GITHUB_DISPATCH_TOKEN` | mêmes valeurs que le projet `hub-dtx` (à recopier : le connecteur ne peut pas les lire) |
5. Pousser `staging` (ou **Redeploy**) → `https://hub-dtx-test.vercel.app` affiche le bandeau orange.

### 2.2 Azure AD — App Registration du Hub
- **Authentication → Redirect URIs → ajouter** `https://lvdnzbhplnzuwdqtitdb.supabase.co/auth/v1/callback`.

### 2.3 Supabase TEST — Authentication (dashboard, projet `hub-dtx-test`)
1. **Providers → Azure** : activer, même *Client ID* / *Secret* / *Tenant URL* que le projet de prod.
2. **URL Configuration** : Site URL `https://hub-dtx-test.vercel.app` ; Redirect URLs `https://hub-dtx-test.vercel.app/auth/callback`, `https://*-dynassur-s-projects.vercel.app/auth/callback`, `http://localhost:4173/auth/callback`.
3. Première connexion : votre ligne `user_permissions` (admin, actif) est déjà copiée ; les autres utilisateurs actifs aussi.

### 2.4 GitHub — Environments (Settings → Environments)
- **`production`** : secret `SUPABASE_SERVICE_KEY` (service_role prod — peut rester le secret de dépôt existant), *Required reviewers* : vous.
- **`test`** : variable `SUPABASE_URL` = `https://lvdnzbhplnzuwdqtitdb.supabase.co` ; secrets `SUPABASE_SERVICE_KEY` (service_role du projet **test**, Settings → API) et `PROD_SUPABASE_SERVICE_KEY` (service_role prod, utilisé en lecture seule par `seed-test.yml`).

### 2.5 SharePoint
- Créer `Documents partages/_TEST/` avec la même arborescence que la racine pour ce que vous testerez (`COMPTA/FACTURES/_LODE`, `_DYNASSUR`, … ; `VENTES` LODE). Rien n'y est écrit tant que n8n n'est pas dupliqué.

### 2.6 n8n — jumeaux de test (optionnel, par workflow)
Dupliquer un workflow, changer le chemin du webhook en `<chemin>-test` et ses credentials Supabase vers le projet test. Chemins appelés par le Hub : `iban-sync`, `run-bordereaux`, `rapprochement-factures`, `backfill-thumbs2`, `nf-notify`, `ticket-alerte`, `nettoyer-liens-casses`, `lode-peppol-send`, `lode-facture-archive`. Tant qu'un jumeau n'existe pas, le bouton correspondant répond « n8n inactif » en test — c'est voulu.

## 3. Rafraîchir les données de test
- **Référentiel + échantillon anonymisé** : Actions → *Seed TEST depuis la production* → `sample_clients` (300 par défaut). Idempotent.
- **Données Qlik complètes** (non anonymisées) : Actions → *Qlik BRIO → Supabase* → `target = test`, `dry_run` décoché.

## 4. Limites connues
- Les fonctions SQL `tickets_rappels_echeance` et `creer_ticket_depuis_mail` contiennent en dur l'URL de prod du Hub et le webhook n8n `ticket-alerte` ; en test le cron n'est pas planifié et l'intake mail n'est pas branché, donc sans effet. À paramétrer en phase 3.
- Les policies RLS sont copiées telles quelles ; plusieurs sont `USING (true)` pour `public` (héritage prod). Le durcissement est prévu en phase 3.
- Projet Free : mise en pause après 7 jours sans requête ; réveil en un clic dans le dashboard.
