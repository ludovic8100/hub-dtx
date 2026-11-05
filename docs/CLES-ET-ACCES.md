# Clés et accès — où vit quoi

**Ce document ne contient aucune valeur.** Uniquement des noms et des
emplacements. Le dépôt est public : une valeur écrite ici serait brûlée.

Reconstruit le 05/11/2026 depuis le code, pas depuis une mémoire : la liste
est celle des variables que le Hub **exige** pour fonctionner. Si une clé n'y
figure pas, aucun code ne la lit.

---

## Les trois coffres

Le Hub ne range pas ses clés au même endroit selon qui les utilise.

| Coffre | Qui s'en sert | Où le trouver |
|---|---|---|
| **GitHub Secrets** | les 19 workflows (Actions) | Settings → Secrets and variables → Actions |
| **Vercel Environment Variables** | les 12 fonctions `api/` | Vercel → le projet → Settings → Environment Variables |
| **Supabase Edge Function secrets** | les fonctions Edge | Supabase → Edge Functions → Secrets |

---

## 1. GitHub Secrets

Utilisés par les workflows : synchronisation Qlik, chaîne des factures,
renommages SharePoint, fusion des dossiers clients.

| Nom | Sert à | Où retrouver la valeur | Relisible ? |
|---|---|---|---|
| `SUPABASE_SERVICE_KEY` | écrire en base sans RLS | Supabase → Project Settings → API Keys → `service_role` | **oui** |
| `GRAPH_TENANT_ID` | identifier le tenant Microsoft | Azure → Entra ID → l'app → Vue d'ensemble | **oui** |
| `GRAPH_CLIENT_ID` | identifier l'application | même page | **oui** |
| `GRAPH_CLIENT_SECRET` | authentifier l'application | Azure → l'app → Certificats et secrets | **non — à régénérer** |
| `QLIK_API_KEY` | lire Qlik (clients, contrats) | console Qlik → API keys | à vérifier |
| `ANTHROPIC_API_KEY` | lecture des factures scannées | console.anthropic.com → API keys | **non — à régénérer** |
| `PROD_SUPABASE_SERVICE_KEY` | `seed-test` lit la prod pour anonymiser | Supabase (projet de production) | **oui** |

⚠️ **Un secret GitHub ne se relit jamais.** On ne le déplace pas, on le
ressaisit ailleurs puis on efface l'ancien. Deux des sept ne sont pas
relisibles : prévoir une régénération, pas un copier-coller.

**Point de sécurité ouvert au 05/11** : ces secrets sont au niveau du
**dépôt**, pas de l'environnement. La règle « production → branche `main` »
ne gouverne que les jobs qui déclarent `environment:`. Un workflow écrit sans
cette ligne lit les secrets du dépôt depuis n'importe quelle branche. Les
déplacer dans les environnements `production` et `test`, **puis les supprimer
du dépôt**, ferme ce trou. Les 19 workflows déclarent déjà un environnement,
donc rien ne casse.

---

## 2. Vercel Environment Variables

Utilisées par les fonctions `api/` : envoi de devis, Peppol, 3CX,
déclenchement des Actions.

### Secrets

| Nom | Sert à | Où retrouver la valeur |
|---|---|---|
| `AZURE_TENANT_ID` | Microsoft Graph (SharePoint, courrier) | Azure → Entra ID → l'app |
| `AZURE_CLIENT_ID` | idem | idem |
| `AZURE_CLIENT_SECRET` | idem | Azure → Certificats et secrets — **non relisible** |
| `SUPABASE_SERVICE_KEY` | écrire en base sans RLS | Supabase → API Keys |
| `SUPABASE_ANON_KEY` | lire en base avec RLS | idem |
| `BILLIT_API_KEY` | envoyer les factures LODE sur Peppol | console Billit |
| `BILLIT_PARTY_ID` | identifier l'émetteur LODE | console Billit |
| `BILLIT_DTX_API_KEY` | prévu pour DTX, non branché | console Billit |
| `GITHUB_DISPATCH_TOKEN` | relancer l'Action `qlik-sync` depuis le Hub | GitHub → Developer settings → Tokens |
| `THREECX_CLIENT_ID` | lire l'état du standard | console 3CX → Admin → Intégrations → API |
| `THREECX_CLIENT_SECRET` | idem | idem |

### Configuration, sans secret

`SUPABASE_URL`, `HUB_URL`, `N8N_URL`, `N8N_TEST_SUFFIX`, `SHAREPOINT_SITE`,
`SHAREPOINT_SITE_ID`, `SHAREPOINT_ROOT`, `MAIL_EXPEDITEUR_ID`,
`MAIL_REDIRECT_TO`, `GITHUB_REPO`, `GITHUB_SYNC_REF`,
`BILLIT_AUTORISE_EN_TEST`, `THREECX_URL`, `APP_ENV`, et leurs jumelles
`VITE_*` côté navigateur.

> ⚠️ **Le piège, et il mord pendant une migration.** La même application Azure
> est rangée sous **deux noms différents** : `GRAPH_*` côté GitHub,
> `AZURE_*` côté Vercel. Si tu régénères le secret client dans Azure, il faut
> le remettre **aux deux endroits**. N'en corriger qu'un casse l'autre
> silencieusement — les workflows continuent pendant que `api/` tombe, ou
> l'inverse. À vérifier : confirmer dans Azure que c'est bien la même
> inscription d'application (`Hub DTX - Sharepoint`).

---

## 3. Supabase Edge Function secrets

| Nom | Sert à | Où retrouver la valeur |
|---|---|---|
| `PONTO_CLIENT_ID` | lire les comptes bancaires | console Ponto → intégrations |
| `PONTO_CLIENT_SECRET` | idem | idem — **non relisible** |
| `SYNC_SHARED_SECRET` | authentifier les appels entre fonctions | valeur interne, régénérable librement |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | fournis automatiquement par Supabase | rien à saisir |

---

## Ce qui n'est plus utilisé

- **n8n** : les workflows sont arrêtés et archivés. `N8N_URL` subsiste dans
  le code mais plus aucune chaîne n'en dépend.
- **`Mail.Read`** sur l'application Azure : sept fichiers envoient du
  courrier, **aucun n'en lit**. La permission reste accordée et couvre toutes
  les boîtes du tenant. Voir le chantier des droits.

---

## En cas de fuite

1. **Révoquer d'abord, remplacer ensuite.** Une clé révoquée casse un service ;
   une clé fuitée et laissée vivante ne casse rien et ne se voit pas.
2. `SUPABASE_SERVICE_KEY` contourne toutes les règles d'accès : c'est la plus
   grave. Elle se régénère dans Supabase → API Keys.
3. Le dépôt est **public**. Une clé committée est compromise même après
   suppression du fichier : elle reste dans l'historique Git. La révoquer est
   la seule réponse.
