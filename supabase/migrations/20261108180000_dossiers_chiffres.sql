-- Le dossier porte les quatre chiffres d'une intervention.
--
-- L'INVARIANT, DONNE PAR LUDOVIC LE 08/11
--
-- « Dans tous les cas, on a un dossier par intervention, que ce soit une
-- nouvelle installation, un depannage de moteur, ou un remplacement de porte
-- de garage. »
--
-- Les deux chemins aboutissent au meme objet :
--
--   Depannage     Winsol passe le client -> JCL appelle -> accord telephone
--                 -> il commande -> il depanne -> on facture
--   Installation  visite -> devis -> accord -> commande -> acompte
--                 -> installation -> solde
--
-- CE QUI A ETE ABANDONNE, ET POURQUOI
--
-- J'ai d'abord voulu faire de la boite mail la source des commandes : JCL
-- envoie un mail par dossier a info@lode-group.be, avec le prix client et le
-- bon de commande. Ludovic a corrige : « des fois il envoie, des fois non »,
-- et « des fois il va sur le site de Winsol ou SDA, il commande la piece ».
--
-- Un mecanisme qui ne couvre qu'un canal sur deux ne couvre rien. La table
-- `commandes` (branche commandes-fournisseur) reste donc inutilisee : le
-- dossier suffit, et il couvre les deux chemins.
--
-- LE NUMERO DE DOSSIER EST LA REFERENCE FOURNISSEUR
--
-- Mesure sur trois factures Winsol : le champ « Votre reference » vaut
-- « SCREENS EXACTE », « KINE », « 81222 » — ce que JCL a en tete. Ludovic :
-- « on pourrait les nommer ». C'est la cle du systeme : JCL tape deja quelque
-- chose dans ce champ, il tapera le numero du dossier. Meme geste, meme
-- champ — mais ce que le fournisseur reimprime sur sa facture devient un
-- identifiant que la base reconnait, quel que soit le canal de commande.
--
-- Et ca ne DEPEND pas de sa discipline, conformement a la regle du Hub : sans
-- numero, la facture tombe dans « achats a attribuer » et le systeme reclame
-- le jour ou elle arrive — pas six mois plus tard.

-- Ce qu'il faut facturer au client. Saisi a l'ouverture du dossier (le prix
-- donne au telephone), ou repris du devis. C'est CE chiffre qui manque
-- aujourd'hui : sans lui, un oubli de facturation ne se voit pas.
alter table dossiers add column if not exists montant_a_facturer numeric;

-- Le devis et la facture de vente pointent vers leur dossier.
-- Pas de contrainte NOT NULL : les 23 factures LODE existantes n'ont pas de
-- dossier, et leur en inventer un serait une donnee fausse.
alter table lode_devis    add column if not exists dossier_id uuid references dossiers(id);
alter table lode_factures add column if not exists dossier_id uuid references dossiers(id);

create index if not exists lode_devis_dossier_idx    on lode_devis (dossier_id)    where dossier_id is not null;
create index if not exists lode_factures_dossier_idx on lode_factures (dossier_id) where dossier_id is not null;

comment on column dossiers.montant_a_facturer is
  'Prix annonce au client. Compare a ce qui a ete reellement facture, il chiffre l''oubli.';
