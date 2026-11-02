# Outils — comment en ajouter un

La boîte à outils (`/tools`) est un ensemble de petits modules autonomes. Depuis le
02/11/2026 ils partagent un cadre : **un registre** et **une coquille**.

## Les deux fichiers du cadre

| Fichier | Rôle |
|---|---|
| `src/lib/outils.js` | le registre `OUTILS` — une entrée par outil, d'où découlent la route, la carte sur `/tools` et le contrôle de permission |
| `src/components/OutilPage.jsx` | la coquille — retour vers la liste, titre, sous-titre, boutons d'action, voyant de chargement, bandeau d'erreur |

Avant, ajouter un outil demandait de toucher trois endroits (la liste dans `ToolsHome`,
l'import différé dans `App.jsx`, la route dans `App.jsx`) et de recopier à la main l'en-tête,
le lien « ← Outils » et la gestion d'erreur. Maintenant : **une entrée dans le registre**.

## Ajouter un outil

**1. Écrire la page** — `src/pages/tools/MonOutil.jsx` :

```jsx
import { useState, useEffect } from 'react'
import OutilPage from '../../components/OutilPage'
import { supabase } from '../../lib/supabase'

export default function MonOutil() {
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    supabase.from('ma_vue').select('*').then(({ data, error }) => {
      if (error) setErreur(error)
      setDonnees(data || [])
    })
  }, [])

  return (
    <OutilPage
      titre="Mon outil"
      sousTitre="Ce qu'il fait, en une ligne"
      chargement={donnees === null}
      erreur={erreur}
      largeurMax={780}
    >
      {/* le contenu propre à l'outil, et rien d'autre */}
    </OutilPage>
  )
}
```

**2. Le déclarer** — une entrée dans `OUTILS` (`src/lib/outils.js`) :

```js
{
  cle: 'mon-outil',
  titre: 'Mon outil',
  sousTitre: "Ce qu'il fait, en une ligne",
  description: "Le texte de la carte sur /tools, deux phrases.",
  icone: '/assets/tools/icon-mon-outil.png',
  chemin: '/tools/mon-outil',
  permission: 'acc_tools',
  composant: lazy(() => import('../pages/tools/MonOutil')),
}
```

Rien d'autre. La route, la carte et le contrôle d'accès suivent.

## Props de `OutilPage`

| Prop | Effet |
|---|---|
| `titre` | en-tête de la page **et** libellé dans la barre du Hub |
| `sousTitre` | une ligne d'explication sous le titre |
| `actions` | bouton(s) alignés à droite du titre (ex. « Rafraîchir ») |
| `chargement` | `true` → voyant à la place du contenu |
| `erreur` | `string`, `Error` ou `{ message }` → bandeau rouge au-dessus du contenu |
| `largeurMax` | largeur du contenu en px (défaut : pleine largeur) |
| `pleinePage` | l'outil gère lui-même sa mise en page ; seul le lien « ← Outils » est ajouté (cas de `ToolSuccession`, une iframe) |

`OutilPage` traite l'erreur **attendue** — un appel Supabase qui échoue, un PDF illisible —
celle que l'outil met dans son état. L'exception non rattrapée est déjà couverte par
l'`ErrorBoundary` de `Layout`.

## Permissions

Tous les outils partagent `acc_tools`, sauf le simulateur de succession (`prive_succession`).
C'est **trop grossier** : donner la recherche BCE revient à tout donner. Le registre rend le
jour où on corrigera ça indolore (une ligne par outil), mais le modèle de permissions
lui-même relève du chantier Paramètres — voir `docs/DROITS-ACCES.md`.

Depuis le passage au registre, un outil auquel on n'a pas droit **n'apparaît plus** sur
`/tools` ; avant, la carte « Droit de Succession » s'affichait pour tout le monde et menait
à un refus d'accès.

## Ce qui manque encore

**Aucune mesure d'usage.** On ne sait pas quels outils servent. C'est exactement ce qui a
laissé les modules Tâches et RDV survivre des mois sans usage réel. Le champ `cle` du registre
est prévu pour ça : il est stable, et ne doit jamais être renommé une fois l'outil en service.
