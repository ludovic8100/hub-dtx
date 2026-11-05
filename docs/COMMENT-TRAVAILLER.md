# Comment on travaille sur le Hub sans casser la production

Écrit le 5 novembre 2026, à ta demande : « *on doit pouvoir travailler sur le hub
sans tout casser car les employés bossent dessus* ».

---

## 1. TEST, PREVIEW, PRODUCTION — ce que c'est vraiment

Ces trois mots ne désignent pas trois degrés de la même chose. Ils se
distinguent sur **une seule question** : *contre quelles données l'écran
tourne-t-il ?*

| | PRODUCTION | PREVIEW | TEST |
|---|---|---|---|
| **Adresse** | `hub-dtx.vercel.app` | une adresse différente **par branche**, générée automatiquement | `hub-dtx-test.vercel.app` |
| **Code affiché** | la branche `main` | la branche sur laquelle tu travailles, avant toute fusion | la branche `staging` |
| **Base de données** | **la vraie** (`tndwonq…`) | **la vraie** (`tndwonq…`) | une **copie anonymisée** (`lvdnzbhp…`) |
| **Mails envoyés** | pour de vrai, au client | pour de vrai, au client | détournés vers toi, objet `[TEST]` |
| **SharePoint** | les vrais dossiers | les vrais dossiers | un dossier `_TEST` à part |
| **Qui l'utilise** | les employés, toute la journée | toi et moi, le temps d'une relecture | toi, pour essayer |
| **Existe aujourd'hui** | ✅ | ✅ (déjà, sur chaque PR) | ❌ **à créer** |

### Le point important, et il est contre-intuitif

**PREVIEW N'EST PAS UN ENVIRONNEMENT DE TEST.** C'est le piège.

Une preview affiche du code neuf, mais **branché sur la vraie base de données**.
Elle est donc parfaite pour *regarder* un écran — une couleur, un tri, une
colonne ajoutée — et **dangereuse pour *essayer* quoi que ce soit qui écrit** :
supprimer un collaborateur, réattribuer un portefeuille, envoyer une facture,
lancer une synchro. Ces gestes-là partiraient sur les vraies données et les
vrais clients, exactement comme en production.

Tu m'avais dit le 05/11 : « *je pense que l'environnement preview ne sert à
rien* ». À moitié vrai, et il faut corriger l'autre moitié : **la preview sert
déjà, aujourd'hui, sur chaque PR**. Vercel la construit automatiquement, et je
refuse de fusionner tant qu'elle n'est pas verte. C'est ce qui attrape les
erreurs de compilation avant qu'elles n'atteignent les employés. Elle ne
remplace simplement pas un vrai environnement de test.

| Ce que tu veux faire | L'endroit |
|---|---|
| Regarder à quoi ressemble un écran | **Preview** |
| Vérifier qu'un chiffre est juste sur de vraies données | **Preview** (en lecture seule) |
| Essayer une suppression, un envoi, une synchro | **Test** — jamais ailleurs |
| Travailler | **Production** |

---

## 2. Comment on travaille, concrètement

### La règle, en une phrase

> **Ce qui ne fait que s'afficher va directement en production. Ce qui écrit,
> envoie, supprime ou synchronise passe d'abord par le test.**

C'est moi qui applique ce tri, pas toi. Tu n'as pas à te demander dans quelle
catégorie tombe une demande.

### Ce que ça donne au quotidien

**Un changement d'affichage** — un tri, une colonne, un libellé, un filtre, une
correction de calcul à l'écran :

```
branche → PR → preview verte → fusion dans main → en ligne
```

C'est ce qu'on fait depuis le début, et ça reste comme ça. Inutile d'alourdir :
une colonne Bureau ne peut pas corrompre un dossier client.

**Un changement qui touche les données, l'argent ou l'extérieur** — une
migration, une suppression, un envoi de mail ou de facture, une synchronisation,
une réattribution de portefeuille :

```
branche → PR → fusion dans staging → tu essaies sur hub-dtx-test.vercel.app
       → tu me dis OK → fusion dans main → en ligne
```

Deux fusions au lieu d'une. C'est le prix, et il ne se paie que sur les
changements qui méritent qu'on le paie.

### Ce que je m'engage à faire

1. `npm run build` passe avant tout envoi.
2. Je lis le diff avant de fusionner — une PR de plusieurs jours peut avoir été
   dépassée.
3. **Je vérifie le déploiement ET son alias après la fusion**, pas seulement que
   la fusion a eu lieu. « Fusionné » et « en ligne » sont deux choses
   différentes, et c'est la seconde qui t'intéresse. Les 4 et 5 novembre, six PR
   ont été annoncées comme faites alors que tous les déploiements échouaient.
4. Je ne fusionne rien dans `main` entre 8h et 18h si le changement touche un
   écran que les employés utilisent en continu, sauf si tu me dis d'y aller.

### Ce que je te demande

Rien au quotidien. Deux choses seulement :

- **Quand je te dis « c'est sur le test »**, tu l'ouvres et tu me dis oui ou non.
- **Quand tu vois quelque chose de cassé en production**, tu me le dis tout de
  suite : on peut revenir à la version précédente en une minute (Vercel garde
  chaque déploiement et sait en remettre un ancien en ligne).

---

## 3. Ce qui reste à faire pour que ce soit vrai

L'environnement de test **n'existe pas encore**. Le `CLAUDE.md` laissait croire
le contraire — c'était faux, et c'est corrigé.

Ce qui est prêt :

- la branche `staging`, alignée sur `main` ;
- le projet Supabase de test, créé le 29/10 avec le schéma complet (**à vérifier :
  un projet gratuit se met en pause tout seul après une semaine d'inactivité**) ;
- tout le code : `APP_ENV=test` suffit à détourner les mails, à basculer
  SharePoint sur `_TEST`, à suffixer les webhooks n8n et à afficher le bandeau
  orange. Rien à développer.

Ce qui manque, et que je ne peux pas faire : **créer le projet Vercel
`hub-dtx-test`**. Le jeton de mon connecteur sait lire et déployer, pas créer
(403, constaté le 30/10 et reconfirmé le 05/11). La marche à suivre complète est
dans `docs/ENVIRONNEMENT-TEST.md` § 2, et le point est en attente de toi, en
rouge, dans le tableau des chantiers.

---

## 4. Un avertissement qui n'a rien à voir avec le test

Le dossier `api/` contient **exactement 12 fonctions serverless**, pour une
limite de 12 sur le plan Vercel gratuit. **La prochaine fonction ajoutée casse
tous les déploiements de production** — c'est précisément ce qui s'est produit
les 4 et 5 novembre.

Un environnement de test ne protège pas de ça : le plafond est une limite du
projet de production, pas du code. Le test déploierait très bien, et la
production tomberait quand même. Décision à prendre (plan Pro, ou fusionner les
quatre fonctions d'envoi de mail qui font la même chose) — c'est aussi en
attente de toi.
