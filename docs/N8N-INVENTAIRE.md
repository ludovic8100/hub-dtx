# n8n — inventaire détaillé et implications

Vérifié le 30 octobre 2026 en lisant les workflows via le connecteur n8n (19 workflows exposés).
Instance : `https://n8n.srv1082740.hstgr.cloud`. Workflow d'erreur commun : `kiHuvbyPQi7aHpmK` (non exposé).

## 1. Webhooks appelés par le Hub → workflow

| Chemin (`n8nWebhook('…')`) | Workflow | Méthode | Réponse |
|---|---|---|---|
| `iban-sync` | IBAN SYNC `hf6G2dE1ZcfXDO4W` | POST | immédiate |
| `rapprochement-factures` | Rapprochement `hmL5WFBknLUfDwGw` | POST | immédiate |
| `backfill-thumbs2` | Miniatures v2 `slxHb4qy0VvvZsz2` | POST | dernier nœud |
| `run-bordereaux` | Bordereaux `9mVOQPAN2fI5z9um` | POST | immédiate |
| `nettoyer-liens-casses` | Nettoyage liens cassés `c680QZUbZkFpwMEh` | POST | immédiate |
| `nf-notify` | Notes de frais - Notifications `3HDF690T2XJeaSWY` | POST | immédiate |
| `nf-list` | NF - Liste `i9dZDnCbZRhiDVI7` | GET | JSON (liste Graph) |
| `ticket-alerte` | Tickets - Alertes mail `xgkgnuSSkoQXlXlp` | POST | JSON |
| `lode-peppol-send` | LODE Peppol Send `mGJGzrRNLw1ZAfOZ` | POST | JSON |
| `lode-facture-archive` | LODE Facture Archive `EiB9oTn9MPJjELKW` | POST | JSON |
| `run-import-dynassur` | **n'existe plus** (Import Brio supprimé, remplacé par Qlik) | — | 404 |

## 2. Ce que les workflows écrivent dans Supabase (production)

| Workflow | Tables / objets | Clé utilisée |
|---|---|---|
| IBAN SYNC | `transactions` (upsert `ponto_transaction_id`), RPC `maj_solde_compte` | **publishable (anon)** |
| Rapprochement | `factures_achat` (upsert `fichier_id`, **DELETE** des orphelins), `transactions` (PATCH déliaison) | **publishable (anon)** |
| Miniatures v2 | bucket `factures-thumbs` (upload), `transactions.facture_thumb_url` | **publishable (anon)** |
| Bordereaux | `bordereaux` (upsert `cle_unique`) | **publishable (anon)** |
| Nettoyage liens cassés | `transactions` (PATCH), `liens_casses_log` (insert) | **publishable (anon)** |
| Mails HUB → Tâches, Agenda → RDV, USER_PERMISSION, Tickets réponses | `taches`, `rdv`, `user_permissions`, RPC ticket | à vérifier (non lus en détail) |

### ⚠️ Constat de sécurité (phase 3, priorité haute)
Tous les workflows lus écrivent en base avec la **clé publishable**, c'est-à-dire le rôle `anon`, celui du
navigateur de n'importe quel visiteur du Hub. Cela ne fonctionne que parce que les policies RLS de ces tables
autorisent `anon` à insérer, modifier et supprimer (`USING (true)`, héritage signalé dans
`docs/ENVIRONNEMENT-TEST.md` § 4). Conséquence : quiconque possède la clé publique, présente dans le bundle du
site, peut supprimer des lignes de `factures_achat` ou modifier `transactions`.

Correction prévue en phase 3, dans cet ordre :
1. Créer dans n8n un credential « Supabase service_role » (Header Auth) et l'utiliser dans tous les nœuds
   HTTP Supabase et dans les nœuds Code (via `$credentials`), à la place de la clé en clair.
2. Retirer ensuite les policies d'écriture `anon` sur `transactions`, `factures_achat`, `bordereaux`,
   `liens_casses_log`, le bucket `factures-thumbs` et la RPC `maj_solde_compte` ; l'écriture depuis le Hub
   passe alors par des utilisateurs authentifiés (policies `authenticated` + `user_permissions`).
3. La clé Billit (nœuds « Créer Facture » et « Envoyer vers Peppol » du workflow Peppol) est écrite en clair
   dans les en-têtes HTTP : à déplacer dans un credential n8n.

## 3. Credentials et dépendances externes
- Microsoft Graph : credential n8n `microsoftGraphSecurityOAuth2Api` (SharePoint, mail, calendriers, Entra).
- Ponto : HTTP Basic (credential n8n) pour le token OAuth2.
- Anthropic : credential `anthropicApi` (bordereaux : nœud désactivé ; Invoice List / Rename : actif).
- Billit : clé en clair (voir § 2).
- Site SharePoint : `dynassur.sharepoint.com,438fcfb3-10f8-455b-8308-1f832d4db26d`, drive
  `b!s8-PQ_gQW0WDCB-DLU2ybfMoM6iRwklCj8QNH1cSEoznLVG9EIBnTrUMiFeCwXD8`.
- IBAN SYNC contient une table IBAN → `comptes_bancaires.id` codée en dur (13 comptes) : tout nouveau compte
  doit y être ajouté à la main.

## 4. Implications pour l'environnement de test
Dupliquer un workflow ne suffit pas : l'URL Supabase de production et la clé sont écrites **dans chaque nœud
HTTP et dans le code JavaScript** (Rapprochement, Nettoyage). Pour un jumeau `-test` il faut, par workflow :
1. dupliquer, renommer `<nom> (TEST)`, changer le chemin du webhook en `<chemin>-test` ;
2. remplacer `tndwonqdbeszkcztkzqe.supabase.co` par `lvdnzbhplnzuwdqtitdb.supabase.co` et la clé par celle du
   projet test (ou, mieux, par le credential service_role test après la phase 3) dans tous les nœuds ;
3. pour Rapprochement, Bordereaux, Miniatures, LODE Archive, NF Liste : pointer Graph vers
   `Documents partages/_TEST/...` ;
4. supprimer les déclencheurs cron du jumeau (webhook seulement) ;
5. dans Rapprochement, faire pointer « Déclencher miniatures » vers `backfill-thumbs2-test`.

Ordre conseillé : IBAN SYNC (lecture Ponto, écriture simple) → Miniatures → Rapprochement → Bordereaux →
Nettoyage. Les workflows de mail (`nf-notify`, `ticket-alerte`) n'ont pas besoin de jumeau : en test le Hub
n'envoie des mails que via `api/_lib/mail.js` (redirigés), et un appel sur `-test` tombe en 404 sans effet.

## 5. Connecteur n8n (Claude)
Le connecteur n'expose que les workflows dont « Settings → Available in MCP » est coché. Il permet de lister,
lire et exécuter, pas de créer ni de modifier. Toute modification se fait dans l'éditeur n8n.
