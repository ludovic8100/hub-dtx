# Sécuriser l'accès quand plusieurs intervenants externes travaillent sur le Hub

Établi le 05/11/2026, après que Ludovic a signalé que trois intervenants externes
travaillent ou vont travailler sur le projet.

## Le constat de départ

> « J'aimerais créer un droit spécial pour les Consultant IT pour ne pas qu'ils puissent
> avoir des droits de modificateur. »

L'intention est juste, l'endroit est faux. **Un drapeau « consultant » dans l'écran
Paramètres ne protège rien aujourd'hui** : le Hub n'a plus de login, 33 règles d'accès sur
150 sont ouvertes à tout le monde, et n'importe qui avec la clé publique interroge la base
directement.

Ce qui donne réellement accès aux données d'un intervenant externe, ce n'est pas un écran.
C'est :

| | |
|---|---|
| `SUPABASE_SERVICE_KEY` | contourne **toutes** les règles d'accès, y compris celles qu'on construira |
| `GRAPH_CLIENT_SECRET` | lit et écrit dans SharePoint |
| le droit d'écriture sur le dépôt | permet de **faire sortir les deux précédentes** |

Ce dernier point est le nœud, et il n'est pas théorique.

## Le trou démontré

Le 05/11, pour auditer les droits SharePoint, j'ai poussé une branche non fusionnée et
lancé un workflow dessus. **Il a tourné avec les secrets de production.**

N'importe quel collaborateur disposant du droit d'écriture peut faire la même chose, en
remplaçant l'audit par un `echo "$SUPABASE_SERVICE_KEY"`. Aucune relecture, aucune fusion,
aucune trace visible : la clé s'affiche dans le journal du run.

**Protéger `main` ne suffit pas** : le problème n'est pas la fusion, c'est le lancement
d'un workflow de production depuis une branche quelconque.

## Ce qui est fait dans le code (PR du 05/11)

**`permissions: contents: read` sur les 17 workflows.** Aucun n'écrit dans le dépôt — ils
lisent le code et parlent à Supabase, SharePoint ou Qlik. Sans cette ligne, le jeton du
workflow porte les droits par défaut du dépôt.

**`.github/CODEOWNERS`.** Le code applicatif se relit normalement. Mais `.github/`,
`scripts/`, `api/`, `supabase/`, `sql/` et `CLAUDE.md` demandent la relecture du
propriétaire. Le danger n'est pas l'écran Comptabilité, c'est une Action ajoutée
discrètement ou une migration qui ouvre une règle d'accès.

> CODEOWNERS ne bloque rien tout seul : il faut cocher « Require review from Code Owners »
> dans la protection de branche pour qu'il ait un effet.

## Ce qui reste à faire à la main

Ces réglages ne sont pas dans le code et doivent être posés dans GitHub. Dans l'ordre
d'importance.

### 1. Environnement `production` : restreindre les branches (le plus important)

GitHub → Settings → Environments → `production` → **Deployment branches** →
*Selected branches* → `main` uniquement.

C'est **le** réglage qui ferme le trou démontré plus haut. Sans lui, tout le reste est
décoratif : on peut toujours lancer un workflow de production depuis sa propre branche.

⚠️ Ne pas ajouter de *Required reviewers* sur `production` : la chaîne
`factures-entrantes` tourne toutes les heures et demanderait une approbation à chaque
passage.

### 2. Protéger `main`

GitHub → Settings → Branches → Add rule, `main` :

- Require a pull request before merging
- Require review from Code Owners
- Do not allow bypassing the above settings — **à ne cocher que si Ludovic accepte de ne
  plus pousser directement**, sinon il se bloque lui-même
- Block force pushes
- Restrict deletions

Ne **pas** exiger un nombre d'approbations : Ludovic est seul propriétaire et ne pourrait
plus rien fusionner.

### 3. Donner aux consultants le droit `write`, jamais `admin`

GitHub → Settings → Collaborators. `admin` permet de défaire tout ce qui précède,
y compris les protections de branche.

### 4. Séparer les secrets test et production

Les secrets d'environnement (`production`, `test`) plutôt que les secrets du dépôt : un
workflow lancé sur `test` ne doit pas pouvoir atteindre la base de production. À vérifier
dans Settings → Secrets → Actions.

### 5. Supabase

Settings → Team : qui est membre, et avec quel rôle. Et surtout : **qui détient la clé
`service_role`**. Elle contourne tout. Si un consultant l'a eue, elle doit être
régénérée à son départ — et le jour où on la régénère, il faut la reposer dans les secrets
GitHub, sinon les traitements tombent.

## Ce que ça ne protège pas

Le dépôt est **public**. Le code est lisible par tout le monde, consultants compris, et le
restera. Ce qui se protège ici, ce sont les clés et la base — pas le code.

Et tant que le login n'est pas revenu, **la base reste lisible par quiconque a la clé
publique du Hub**. Les réglages ci-dessus ferment la porte des secrets ; ils ne ferment
pas celle des données. C'est le chantier `docs/DROITS-ACCES.md`.
