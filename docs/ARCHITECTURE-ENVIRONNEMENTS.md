# Hub DTX — État des lieux et architecture cible (test / prod / couche applicative)

Rédigé le 29 octobre 2026 à partir du dépôt `ludovic8100/hub-dtx` (main `6c7493a`), du projet Vercel `hub-dtx`,
du projet Supabase `tndwonqdbeszkcztkzqe`, de l'instance n8n `n8n.srv1082740.hstgr.cloud` et des GitHub Actions.

---

## 1. État des lieux

### 1.1 Ce qui existe

| Brique | Constat |
|---|---|
| **Front** | React 18 + Vite, ~27 700 lignes JSX, 65 pages (6 entités : Groupe, Dynassur, DTX, LODE, Hexagroup, Privé) + outils transverses (BCE, questionnaire, devoir d'info, succession) + tickets. Styles inline, aucun test, aucun lint. |
| **Accès données** | Le front appelle **directement Supabase** (clé publishable + RLS, 147 policies) depuis les composants. La logique métier (facturation, rapprochement, notes de frais…) vit dans les composants. |
| **Backend** | 7 fonctions serverless Vercel (`api/`) : envoi devis/factures/cotisations via Microsoft Graph, relance Qlik (dispatch GitHub), lookup/log 3CX. Chacune ré-implémente la vérification du JWT Supabase. |
| **Base** | Supabase Postgres 17 (EU, plan **Free**), 100 tables, 17 vues, 14 triggers, 1 cron (`tickets_rappels_echeance`), 7 buckets storage, 118 migrations appliquées via MCP (pas de dossier `supabase/migrations` dans le dépôt : `sql/` est une reconstruction documentaire). Taille : 192 Mo. 15 utilisateurs Auth (Azure AD). |
| **ETL** | GitHub Actions `qlik-sync.yml` (cron 06:30 UTC, Python → Qlik Cloud → Supabase avec `SUPABASE_SERVICE_KEY`). n8n : Import Brio, Sync Ponto, Bordereaux, Rapprochement factures, Miniatures, BCE search, Peppol (Billit). |
| **Documents** | SharePoint `dynassur.sharepoint.com/sites/ADMINISTRATION` = source de vérité des fichiers (factures achat, ventes, bordereaux, justificatifs). Accès via Graph depuis n8n et `api/`. |
| **Déploiement** | Vercel (team `dynassur-s-projects`, Hobby) : push sur `main` = prod `hub-dtx.vercel.app`. Aucun environnement intermédiaire. Variables d'env Vercel : `AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET`, `GITHUB_DISPATCH_TOKEN`. |
| **Branches** | `main` (prod), `claude/hub-review-a3iwxe`, `ccr-8101e91b-vi88yi` (site dynassur.be), 3 branches `feat/lode-*` déjà fusionnées (à supprimer). |

### 1.2 Ce qui empêche aujourd'hui un vrai environnement de test

1. **Configuration codée en dur** : l'URL et la clé Supabase apparaissent dans **38 fichiers** du front/api et **11 scripts Python** ; l'URL n8n dans 6 composants ; les chemins SharePoint dans 6 fichiers. Impossible de pointer une build vers une autre base sans modifier le code.
2. **Un seul projet Supabase** : toute modification de schéma ou de RLS se fait directement en prod.
3. **Un seul projet Vercel, une seule branche** : tout commit sur `main` est en prod dans la minute.
4. **ETL câblés sur la prod** : n8n et GitHub Actions écrivent dans la base de prod sans notion d'environnement.
5. **Pas de migrations versionnées** : le schéma réel n'est reproductible nulle part (118 migrations appliquées à la main, `sql/schema.sql` n'a ni FK, ni vues, ni fonctions, ni policies).
6. **Pas de couche applicative** : règles métier dupliquées entre composants, écritures sensibles (factures, numérotation, secrets) faites depuis le navigateur, vérification JWT copiée-collée dans chaque fonction.

### 1.3 Alertes sécurité relevées (advisor Supabase, 29/10/2026)

- **Critique** : `public.execute_raw_sql(sql_query text)` est `SECURITY DEFINER` et exécutable par le rôle `anon` → n'importe qui connaissant l'URL du projet peut exécuter du SQL arbitraire. Seul usage légitime trouvé : l'outil Succession (`ToolSuccession.jsx`, pont `postMessage` → action `execute_sql`). À révoquer pour `anon` **immédiatement**, puis remplacer par des RPC dédiées à la simulation.
- 13 autres fonctions `SECURITY DEFINER` exécutables par `anon` (devis publics, 3CX, tickets mail, votes Hexagroup) : acceptables si elles vérifient un secret/token, à auditer une par une.
- 16 vues `SECURITY DEFINER` (contournent la RLS), 26 fonctions sans `search_path` fixé, `hexagroup_votes` avec RLS sans policy, extensions `vector`/`unaccent`/`pg_net` dans `public`.
- Secrets tiers dans le code n8n (clé CBEAPI en clair dans un nœud Code).

---

## 2. Architecture cible

### 2.1 Deux environnements isolés

| | **TEST** | **PRODUCTION** |
|---|---|---|
| Branche Git | `staging` | `main` |
| Vercel | projet **`hub-dtx-test`** (même dépôt, Production Branch = `staging`), URL `hub-dtx-test.vercel.app`, sans protection SSO Vercel (l'app a déjà son login Azure) | projet `hub-dtx` inchangé |
| Supabase | nouveau projet **`hub-dtx-test`** (plan Free, 0 €/mois ; se met en pause après 7 jours d'inactivité, réveil en 1 clic) | `tndwonqdbeszkcztkzqe` |
| Auth Azure | même App Registration, URI de redirection supplémentaire `https://<ref-test>.supabase.co/auth/v1/callback` ; `Site URL`/`Redirect URLs` du projet test = `hub-dtx-test.vercel.app` | inchangé |
| Données | schéma identique (migrations) + copie **partielle et anonymisée** de la prod (script `scripts/seed_test.py`), rafraîchissable à la demande | données réelles |
| SharePoint | même tenant, racine **`Documents partages/_TEST/`** (variable `SHAREPOINT_ROOT`) ; aucun écrit dans les dossiers réels | racine actuelle |
| n8n | mêmes workflows, paramétrés par un champ `env` dans le body du webhook (ou header) → credentials `Supabase TEST` / `Supabase PROD` ; crons planifiés uniquement sur PROD | idem |
| GitHub Actions | GitHub **Environment `test`** (secrets `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` du projet test) ; déclenchement manuel avec `target=test` | Environment **`production`** avec *required reviewer* pour les migrations |
| Microsoft Graph (mails) | mêmes credentials, mais **`MAIL_REDIRECT_TO=lde@dynassur.be`** : tout mail sortant en test est redirigé vers vous avec préfixe `[TEST]` | envoi réel |
| Bandeau UI | bandeau orange « ENVIRONNEMENT DE TEST » dans le header | aucun |

Flux : branche de travail → PR → **preview Vercel** (pointe sur Supabase TEST) → merge dans `staging` → **hub-dtx-test** → validation → merge `staging` → `main` → **prod**.

### 2.2 Couche configuration (préalable à tout)

Une seule source de vérité par runtime, plus aucune valeur en dur :

```
src/config/env.js        → import.meta.env.VITE_APP_ENV, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
                           VITE_N8N_URL, VITE_SHAREPOINT_ROOT, VITE_HUB_URL
api/_lib/env.js          → process.env.APP_ENV, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
                           AZURE_*, GITHUB_DISPATCH_TOKEN, N8N_URL, SHAREPOINT_ROOT, MAIL_REDIRECT_TO
scripts/_env.py          → mêmes noms pour les scripts Python
.env.example             → liste documentée (sans valeurs)
```

Vercel : variables par *target* (Production / Preview) sur chaque projet. Le front ne reçoit que les `VITE_*` (publiques).

### 2.3 Couche applicative (`api/`)

Objectif : sortir du navigateur toute écriture à effet de bord ou à règle métier, et factoriser ce qui est dupliqué.

```
api/
  _lib/
    env.js            configuration
    auth.js           requireUser(req) → vérifie le JWT Supabase, charge user_permissions, expose need('lode_devis')
    supabase.js       client service_role (serveur) + client "as user" (RLS)
    graph.js          token Azure + sendMail (redirection automatique en TEST) + SharePoint (upload, lien)
    n8n.js            appel webhook avec env
    http.js           handler(fn) : méthode, JSON, erreurs normalisées { ok, error, code }
  mail/devis.js, mail/facture.js, mail/cotisation.js, mail/cotisation-rappel.js   (existant, réécrit sur _lib)
  sync/qlik.js        (ex reload-qlik)
  3cx/lookup.js, 3cx/call.js
  facturation/lode/emettre.js      ← nouvelle : numérotation + verrouillage + PDF archivé + Peppol en une transaction
  secrets/upsert.js                ← remplace l'appel RPC upsert_secret depuis le navigateur
```

Côté front : `src/services/<domaine>.js` (clients, factures, tickets, notesFrais, banque…) qui encapsulent `supabase.from(...)` et les appels `fetch('/api/...')`. Les composants n'importent plus `supabase` directement. Migration **progressive** : on commence par les écritures sensibles (facturation LODE, notes de frais, secrets, sync), la lecture reste en accès direct RLS tant que ce n'est pas un problème.

Base : les fonctions `SECURITY DEFINER` exposées à `anon` sont réduites à celles qui exigent un token/secret ; `execute_raw_sql` est supprimée.

### 2.4 Schéma versionné et CI

- `supabase/` initialisé avec la CLI (`supabase init`, `supabase db pull` depuis la prod → migration de base `0001_baseline.sql` **complète** : tables, FK, vues, fonctions, policies, triggers, cron).
- Toute évolution = fichier dans `supabase/migrations/` dans la PR. Plus de DDL via MCP en prod.
- Workflow GitHub `deploy-db.yml` :
  - push sur `staging` → `supabase db push` sur **test** (Environment `test`)
  - push sur `main` → `supabase db push` sur **prod** (Environment `production`, approbation manuelle)
- Workflow `ci.yml` sur PR : `npm ci`, `npm run lint`, `npm run build`, tests Vitest.

### 2.5 Qualité minimale

ESLint (config React), Vitest sur `src/services` et `api/_lib`, un test Playwright de fumée (login + ouverture dashboard) exécuté contre `hub-dtx-test` après chaque déploiement de `staging`.

---

## 3. Plan par phases

| Phase | Contenu | Livrable | Risque prod |
|---|---|---|---|
| **0 — Sécurité immédiate** | Révoquer `execute_raw_sql` pour `anon`/`authenticated` (ou la supprimer) ; audit rapide des 13 autres RPC anon | migration + note | nul (lecture d'abord) |
| **1 — Configuration** | `src/config/env.js`, `api/_lib/env.js`, `scripts/_env.py`, `.env.example` ; remplacement des 38 + 11 + 6 occurrences ; bandeau TEST ; variables Vercel ; branche `staging` ; nettoyage des branches fusionnées | PR « config par environnement », déployée en prod sans changement fonctionnel | faible (valeurs prod identiques par défaut) |
| **2 — Environnement TEST** | Projet Supabase test + `db pull` baseline + seed anonymisé ; URI Azure ; projet Vercel `hub-dtx-test` ; GitHub Environments + secrets ; `SHAREPOINT_ROOT=_TEST` ; `MAIL_REDIRECT_TO` ; n8n paramétré par `env` | `hub-dtx-test.vercel.app` fonctionnel de bout en bout | nul |
| **3 — Couche applicative** | `api/_lib`, réécriture des 7 fonctions existantes dessus, `src/services`, migration des écritures sensibles (facturation LODE, notes de frais, secrets, sync) | PRs par domaine, validées en TEST avant prod | moyen, mitigé par TEST |
| **4 — Migrations & CI** | `supabase/migrations`, `deploy-db.yml`, `ci.yml`, ESLint, Vitest | pipeline complet | faible |
| **5 — Qualité continue** | Playwright fumée, CLAUDE.md mis à jour (règles : jamais de DDL direct en prod, PR obligatoire), suppression des exports n8n obsolètes du dépôt | — | nul |

Durée indicative : phases 0-1 en une session de travail, phase 2 en une seconde (dépend de 3 actions manuelles de votre côté : création projet Supabase test, URI de redirection Azure, création projet Vercel test), phases 3-4 étalées, par domaine.

---

## 4. Décisions à prendre

1. **Supabase TEST = second projet Free (0 €)** plutôt que le *branching* Supabase (exige le plan Pro à 25 $/mois + ~10 $/mois par branche). Recommandation : second projet Free.
2. **Vercel TEST = second projet `hub-dtx-test`** (URL stable, pas de SSO Vercel) plutôt que les previews du projet existant (protégées par login Vercel, URL changeante). Recommandation : second projet.
3. **Données de test** : copie anonymisée partielle (clients/contrats/quittances échantillonnés, mails et IBAN masqués) ou copie intégrale ? Recommandation : partielle anonymisée, rafraîchissable par script.
4. **Mails en test** : redirection de tout envoi vers `lde@dynassur.be` (recommandé) ou blocage total ?
5. **Phase 0** : révocation de `execute_raw_sql` pour `anon` tout de suite (sans impact : l'outil Succession l'appelle connecté), puis suppression une fois l'outil Succession passé sur des RPC dédiées. `upsert_secret` reste exposée car appelée par le workflow n8n Ponto (via REST) ; à migrer vers `api/secrets`.
