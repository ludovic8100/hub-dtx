-- Jeu de démonstration de l'ENVIRONNEMENT DE TEST.
--
-- ⚠️ À N'EXÉCUTER QUE SUR LE PROJET wsuawmtwlvcyppgfvqzj (hub-dtx-test).
-- Il commence par VIDER les tables métier : lancé en production, il détruit
-- tout. Le garde-fou ci-dessous refuse de s'exécuter ailleurs.
--
-- POURQUOI CE FICHIER EXISTE
--
-- Constat du 08/11 : la base de test contenait 7 375 factures d'achat
-- RÉELLES (fournisseurs et montants véritables) et rien d'autre — ni client,
-- ni mouvement bancaire, ni devis. Le bandeau « AUCUNE DONNÉE RÉELLE » était
-- donc faux, et il était malgré tout impossible d'y tester quoi que ce soit.
--
-- Deux défauts opposés dans la même base : des données qu'on ne devrait pas
-- avoir, et pas celles dont on a besoin.
--
-- CE QU'IL CONSTRUIT
--
-- Un LODE complet et cohérent : comptes bancaires, clients, devis, factures
-- de vente, achats fournisseurs, mouvements bancaires et dossiers de
-- chantier. Les quatre cas de figure du suivi de chantier sont représentés
-- (manquant chiffré, soldé, sans prix client, encaissement partiel), plus
-- des achats non attribués pour alimenter la corbeille.
--
-- Tous les noms sont inventés. Toute ressemblance serait un bogue.

-- GARDE-FOU. Il ne peut pas reposer sur le nom de la base : dans Supabase,
-- la production ET le test s'appellent tous deux « postgres ». Il repose donc
-- sur une table marqueur créée A LA MAIN dans le seul projet de test. Si elle
-- manque, ce script refuse de tourner — et c'est exactement ce qu'on veut
-- qu'il fasse s'il atterrit un jour en production.
--
--   create table marqueur_environnement_test (vide boolean);
--
do $$
begin
  if to_regclass('public.marqueur_environnement_test') is null then
    raise exception
      'REFUS : table marqueur_environnement_test absente. Ce script VIDE les tables metier et ne doit jamais tourner en production.';
  end if;
end $$;

-- ─────────────────────────── PURGE ───────────────────────────
delete from lode_devis_lignes;
delete from lode_factures_lignes;
delete from lode_devis;
delete from lode_factures;
delete from lode_clients;
delete from dossiers;
delete from factures_achat;
delete from transactions;
delete from comptes_bancaires;
delete from tmp_chargement;
delete from numeros_sequences;

-- ─────────────────────── COMPTES BANCAIRES ───────────────────────
insert into comptes_bancaires (id, banque, libelle, iban, bic, devise, solde_actuel, actif, "ENTITE", societe_id)
values
 ('11111111-1111-4111-8111-111111111111','ING','LODE — compte courant','BE68 5390 0754 7034','BBRUBEBB','EUR', 18450.22, true,'LODE',     (select id from societes where code='LODE')),
 ('22222222-2222-4222-8222-222222222222','BNP','LODE — compte épargne','BE71 0961 2345 6769','GEBABEBB','EUR',  9000.00, true,'LODE',     (select id from societes where code='LODE')),
 ('33333333-3333-4333-8333-333333333333','ING','DYNASSUR — courant',   'BE62 5100 0754 7061','BBRUBEBB','EUR', 54120.90, true,'DYNASSUR', (select id from societes where code='DYNASSUR')),
 ('44444444-4444-4444-8444-444444444444','BNP','DTX — courant',        'BE43 0689 9999 9501','GEBABEBB','EUR', 12300.00, true,'DTX',      (select id from societes where code='DTX'));

-- ──────────────────────────── CLIENTS ────────────────────────────
insert into lode_clients (id, nom, prenom, denomination, type, email, telephone, gsm, adresse, cp, ville, pays, tva, actif)
values
 ('c1000000-0000-4000-8000-000000000001','DUPLAND','Marc',   null,'particulier','marc.dupland@example.be',   null,'+32470000001','Rue des Tilleuls, 12','4450','Juprelle','Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000002','VERLAINE','Sophie',null,'particulier','s.verlaine@example.be',     null,'+32470000002','Avenue du Parc, 3',  '4040','Herstal', 'Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000003',null,null,'CABINET NORDIA','entreprise','contact@nordia.example',   '+3242000003',null,'Boulevard d''Avroy, 88','4000','Liège','Belgique','BE0888.111.222',true),
 ('c1000000-0000-4000-8000-000000000004','BRASSEUR','Thierry',null,'particulier','t.brasseur@example.be',    null,'+32470000004','Chemin du Moulin, 5','4600','Visé','Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000005','HENNEQUIN','Claire',null,'particulier','c.hennequin@example.be',   null,'+32470000005','Rue Haute, 44',      '4020','Liège','Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000006',null,null,'GARAGE PELTIER','entreprise','info@peltier.example',     '+3242000006',null,'Route de Tongres, 210','4450','Juprelle','Belgique','BE0777.333.444',true),
 ('c1000000-0000-4000-8000-000000000007','MARCHAL','Olivier',null,'particulier','o.marchal@example.be',      null,'+32470000007','Clos des Vignes, 7', '4671','Blégny','Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000008','SIMONET','Nathalie',null,'particulier',null,                       null,'+32470000008','Rue de l''Église, 19','4452','Wihogne','Belgique',null,true),
 ('c1000000-0000-4000-8000-000000000009',null,null,'RÉSIDENCE LES AUBÉPINES','entreprise','syndic@aubepines.example','+3242000009',null,'Quai de Rome, 15','4000','Liège','Belgique','BE0999.555.666',true),
 ('c1000000-0000-4000-8000-000000000010','DEWEZ','Pascal',null,'particulier','p.dewez@example.be',           null,'+32470000010','Allée Verte, 2',     '4432','Alleur','Belgique',null,true);

-- ──────────────────────────── DOSSIERS ────────────────────────────
-- Les six cas qu'on veut pouvoir regarder.
insert into dossiers (id, societe, numero, titre, type, statut, client_type, client_id, client_nom,
                      montant_a_facturer, adresse, cp, ville, date_debut)
values
 ('d0000000-0000-4000-8000-000000000001','LODE','DOS-2026-001','Remplacement moteur porte de garage','intervention','ouvert','lode_client','c1000000-0000-4000-8000-000000000001','DUPLAND',          2841.96,'Rue des Tilleuls, 12','4450','Juprelle', date '2026-10-14'),
 ('d0000000-0000-4000-8000-000000000002','LODE','DOS-2026-002','Pose pergola bioclimatique',         'intervention','ouvert','lode_client','c1000000-0000-4000-8000-000000000002','VERLAINE',         7450.00,'Avenue du Parc, 3',  '4040','Herstal',  date '2026-09-02'),
 ('d0000000-0000-4000-8000-000000000003','LODE','DOS-2026-003','Borne de recharge',                  'intervention','ouvert','lode_client','c1000000-0000-4000-8000-000000000003','CABINET NORDIA',      null,'Boulevard d''Avroy, 88','4000','Liège', date '2026-10-28'),
 ('d0000000-0000-4000-8000-000000000004','LODE','DOS-2026-004','Dépannage volet roulant',            'intervention','ouvert','lode_client','c1000000-0000-4000-8000-000000000004','BRASSEUR',           620.00,'Chemin du Moulin, 5','4600','Visé',     date '2026-08-11'),
 ('d0000000-0000-4000-8000-000000000005','LODE','DOS-2026-005','Remplacement châssis façade arrière','intervention','ouvert','lode_client','c1000000-0000-4000-8000-000000000005','HENNEQUIN',        12800.00,'Rue Haute, 44',      '4020','Liège',    date '2026-10-02'),
 ('d0000000-0000-4000-8000-000000000006','LODE','DOS-2026-006','Porte sectionnelle atelier',         'intervention','clos',  'lode_client','c1000000-0000-4000-8000-000000000006','GARAGE PELTIER',    4310.00,'Route de Tongres, 210','4450','Juprelle',date '2026-06-17');

insert into numeros_sequences (type, societe, annee, dernier) values ('dossier','LODE',2026,6);

-- ───────────────────────────── DEVIS ─────────────────────────────
insert into lode_devis (id, numero, client_id, client_nom, client_email, client_adresse, client_cp, client_ville,
                        objet, date_devis, date_validite, statut, total_ht, total_tva, total_ttc, langue, responsable, dossier_id)
values
 ('e0000000-0000-4000-8000-000000000001','2026-011','c1000000-0000-4000-8000-000000000002','VERLAINE','s.verlaine@example.be','Avenue du Parc, 3','4040','Herstal','Pergola bioclimatique 4×3 m', date '2026-08-20', date '2026-09-20','accepté', 6157.02,1292.98, 7450.00,'fr','JCL','d0000000-0000-4000-8000-000000000002'),
 ('e0000000-0000-4000-8000-000000000002','2026-012','c1000000-0000-4000-8000-000000000005','HENNEQUIN','c.hennequin@example.be','Rue Haute, 44','4020','Liège','Châssis PVC façade arrière',    date '2026-09-25', date '2026-10-25','envoyé', 10578.51,2221.49,12800.00,'fr','LLO','d0000000-0000-4000-8000-000000000005'),
 ('e0000000-0000-4000-8000-000000000003','2026-013','c1000000-0000-4000-8000-000000000007','MARCHAL','o.marchal@example.be','Clos des Vignes, 7','4671','Blégny','Volets solaires 3 fenêtres',     date '2026-10-08', date '2026-11-08','envoyé',  2231.40, 468.60, 2700.00,'fr','JCL',null),
 ('e0000000-0000-4000-8000-000000000004','2026-014','c1000000-0000-4000-8000-000000000009','RÉSIDENCE LES AUBÉPINES','syndic@aubepines.example','Quai de Rome, 15','4000','Liège','Motorisation portail commun', date '2026-10-30', date '2026-11-30','brouillon', 3760.33, 789.67, 4550.00,'fr','LLO',null),
 ('e0000000-0000-4000-8000-000000000005','2026-010','c1000000-0000-4000-8000-000000000006','GARAGE PELTIER','info@peltier.example','Route de Tongres, 210','4450','Juprelle','Porte sectionnelle 3,5 m',   date '2026-06-02', date '2026-07-02','accepté', 3561.98, 748.02, 4310.00,'fr','JCL','d0000000-0000-4000-8000-000000000006'),
 ('e0000000-0000-4000-8000-000000000006','2026-015','c1000000-0000-4000-8000-000000000010','DEWEZ','p.dewez@example.be','Allée Verte, 2','4432','Alleur','Remplacement moteur basculante', date '2026-09-14', date '2026-10-14','refusé',   1033.06, 216.94, 1250.00,'fr','JCL',null);

insert into lode_devis_lignes (devis_id, position, titre, description, quantite, prix_unitaire, tva_pct, total_ht, optionnelle)
values
 ('e0000000-0000-4000-8000-000000000001',1,'Pergola bioclimatique','Structure aluminium 4×3 m, lames orientables',1, 5200.00,21, 5200.00,false),
 ('e0000000-0000-4000-8000-000000000001',2,'Éclairage LED périmétrique','Bandeau LED gradable',                   1,  520.00,21,  520.00,false),
 ('e0000000-0000-4000-8000-000000000001',3,'Pose et raccordement','Main-d''œuvre',                                 1,  437.02,21,  437.02,false),
 ('e0000000-0000-4000-8000-000000000001',4,'Capteur de vent','Option',                                             1,  310.00,21,  310.00,true),
 ('e0000000-0000-4000-8000-000000000002',1,'Châssis PVC double vitrage','5 ouvrants, blanc',                       5, 1680.00,21, 8400.00,false),
 ('e0000000-0000-4000-8000-000000000002',2,'Dépose ancien châssis','Évacuation comprise',                          1,  980.00,21,  980.00,false),
 ('e0000000-0000-4000-8000-000000000002',3,'Pose et finitions','Main-d''œuvre',                                    1, 1198.51,21, 1198.51,false),
 ('e0000000-0000-4000-8000-000000000003',1,'Volet solaire','Pose comprise',                                        3,  620.00,21, 1860.00,false),
 ('e0000000-0000-4000-8000-000000000003',2,'Télécommande centralisée','',                                          1,  371.40,21,  371.40,false),
 ('e0000000-0000-4000-8000-000000000004',1,'Motorisation portail battant','2 vantaux',                             1, 2980.33,21, 2980.33,false),
 ('e0000000-0000-4000-8000-000000000004',2,'Digicode extérieur','',                                                1,  780.00,21,  780.00,false),
 ('e0000000-0000-4000-8000-000000000005',1,'Porte sectionnelle 3,5 m','Motorisée, isolée',                         1, 3061.98,21, 3061.98,false),
 ('e0000000-0000-4000-8000-000000000005',2,'Pose','Main-d''œuvre',                                                 1,  500.00,21,  500.00,false),
 ('e0000000-0000-4000-8000-000000000006',1,'Moteur basculante','Remplacement',                                     1, 1033.06,21, 1033.06,false);

-- ───────────────────── FACTURES DE VENTE ─────────────────────
insert into lode_factures (id, numero, client_id, client_nom, client_email, client_adresse, client_cp, client_ville,
                           objet, date_facture, date_echeance, statut, type, total_ht, total_tva, total_ttc,
                           montant_paye, langue, responsable, devis_id, dossier_id)
values
 ('f0000000-0000-4000-8000-000000000001','2026-021','c1000000-0000-4000-8000-000000000002','VERLAINE','s.verlaine@example.be','Avenue du Parc, 3','4040','Herstal','Pergola bioclimatique — acompte 40 %', date '2026-09-05', date '2026-09-19','payée','acompte', 2462.81, 517.19, 2980.00, 2980.00,'fr','JCL','e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002'),
 ('f0000000-0000-4000-8000-000000000002','2026-022','c1000000-0000-4000-8000-000000000002','VERLAINE','s.verlaine@example.be','Avenue du Parc, 3','4040','Herstal','Pergola bioclimatique — solde',       date '2026-09-28', date '2026-10-12','payée','solde',   3694.21, 775.79, 4470.00, 4470.00,'fr','JCL','e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002'),
 ('f0000000-0000-4000-8000-000000000003','2026-023','c1000000-0000-4000-8000-000000000004','BRASSEUR','t.brasseur@example.be','Chemin du Moulin, 5','4600','Visé','Dépannage volet roulant',              date '2026-08-20', date '2026-09-03','partiellement payée','facture', 512.40, 107.60, 620.00, 300.00,'fr','JCL',null,'d0000000-0000-4000-8000-000000000004'),
 ('f0000000-0000-4000-8000-000000000004','2026-024','c1000000-0000-4000-8000-000000000006','GARAGE PELTIER','info@peltier.example','Route de Tongres, 210','4450','Juprelle','Porte sectionnelle atelier', date '2026-06-28', date '2026-07-12','payée','facture', 3561.98, 748.02, 4310.00, 4310.00,'fr','JCL','e0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000006'),
 ('f0000000-0000-4000-8000-000000000005','2026-025','c1000000-0000-4000-8000-000000000008','SIMONET',null,'Rue de l''Église, 19','4452','Wihogne','Réparation store banne',                             date '2026-10-22', date '2026-11-05','envoyée','facture',  388.43,  81.57,  470.00,    0.00,'fr','JCL',null,null),
 ('f0000000-0000-4000-8000-000000000006','2026-026','c1000000-0000-4000-8000-000000000003','CABINET NORDIA','contact@nordia.example','Boulevard d''Avroy, 88','4000','Liège','Entretien annuel portail',   date '2026-07-04', date '2026-07-18','en retard','facture', 268.60,  56.40,  325.00,    0.00,'fr','LLO',null,null);

insert into lode_factures_lignes (facture_id, position, titre, description, quantite, prix_unitaire, tva_pct, total_ht)
values
 ('f0000000-0000-4000-8000-000000000001',1,'Acompte 40 %','Sur devis 2026-011',1,2462.81,21,2462.81),
 ('f0000000-0000-4000-8000-000000000002',1,'Solde','Sur devis 2026-011',       1,3694.21,21,3694.21),
 ('f0000000-0000-4000-8000-000000000003',1,'Déplacement et main-d''œuvre','',  1, 210.00,21, 210.00),
 ('f0000000-0000-4000-8000-000000000003',2,'Moteur de remplacement','',        1, 302.40,21, 302.40),
 ('f0000000-0000-4000-8000-000000000004',1,'Porte sectionnelle motorisée','',  1,3061.98,21,3061.98),
 ('f0000000-0000-4000-8000-000000000004',2,'Pose','',                          1, 500.00,21, 500.00),
 ('f0000000-0000-4000-8000-000000000005',1,'Réparation store banne','',        1, 388.43,21, 388.43),
 ('f0000000-0000-4000-8000-000000000006',1,'Entretien annuel portail','',      1, 268.60,21, 268.60);

-- ──────────────────── ACHATS FOURNISSEURS ────────────────────
-- Fournisseurs inventés. Certains achats sont rattachés à un dossier,
-- d'autres volontairement orphelins pour alimenter « Achats à attribuer ».
insert into factures_achat (fichier_id, societe, sens, nom, fournisseur, numero, montant, tva_taux, date_facture,
                            destination_type, destination_id, destination_nom)
select v.fid, 'LODE', 'achat', v.nom, v.fsr, v.num, v.mt, 21, v.dt,
       case when v.dos is null then null else 'dossier' end,
       case when v.dos is null then null else v.dos end,
       case when v.dos is null then null else (select numero || ' · ' || titre from dossiers where id = v.dos::uuid) end
from (values
  ('t-a01','20261015 - LODE - Vermeulen Stores - n1012196.pdf','Vermeulen Stores','1012196',1824.96, date '2026-10-15','d0000000-0000-4000-8000-000000000001'),
  ('t-a02','20260905 - LODE - Aldeco Profil - n44120.pdf',     'Aldeco Profil',   '44120',  3200.00, date '2026-09-05','d0000000-0000-4000-8000-000000000002'),
  ('t-a03','20260912 - LODE - Elexio - n88213.pdf',            'Elexio',          '88213',   890.00, date '2026-09-12','d0000000-0000-4000-8000-000000000002'),
  ('t-a04','20261030 - LODE - Voltéa - n5512.pdf',             'Voltéa',          '5512',   1150.00, date '2026-10-30','d0000000-0000-4000-8000-000000000003'),
  ('t-a05','20260814 - LODE - Vermeulen Stores - n803411.pdf', 'Vermeulen Stores','803411',  210.00, date '2026-08-14','d0000000-0000-4000-8000-000000000004'),
  ('t-a06','20261003 - LODE - Aldeco Profil - n44501.pdf',     'Aldeco Profil',   '44501',  6420.00, date '2026-10-03','d0000000-0000-4000-8000-000000000005'),
  ('t-a07','20260620 - LODE - Portalux - n77003.pdf',          'Portalux',        '77003',  2180.00, date '2026-06-20','d0000000-0000-4000-8000-000000000006'),
  ('t-b01','20261103 - LODE - Vermeulen Stores - n1021440.pdf','Vermeulen Stores','1021440', 478.20, date '2026-11-03', null),
  ('t-b02','20261028 - LODE - Matéris - n77012.pdf',           'Matéris',         '77012',   132.45, date '2026-10-28', null),
  ('t-b03','20261021 - LODE - Aldeco Profil - n44980.pdf',     'Aldeco Profil',   '44980',  2040.00, date '2026-10-21', null),
  ('t-b04','20261106 - LODE - Elexio - n90155.pdf',            'Elexio',          '90155',    64.90, date '2026-11-06', null),
  ('t-b05','20260930 - LODE - Matéris - n76310.pdf',           'Matéris',         '76310',   287.65, date '2026-09-30', null),
  ('t-c01','20261005 - LODE - Énergis - n2026-10.pdf',         'Énergis',         '2026-10', 142.30, date '2026-10-05', null),
  ('t-c02','20260905 - LODE - Énergis - n2026-09.pdf',         'Énergis',         '2026-09', 138.70, date '2026-09-05', null),
  ('t-c03','20261012 - LODE - Teleconnect - n556677.pdf',      'Teleconnect',     '556677',   64.99, date '2026-10-12', null),
  ('t-c04','20260912 - LODE - Teleconnect - n551122.pdf',      'Teleconnect',     '551122',   64.99, date '2026-09-12', null)
) as v(fid, nom, fsr, num, mt, dt, dos);

-- Marquer en « structure » les frais généraux : ils ne vont à aucun chantier,
-- et c'est une information, pas un oubli. Sans ça ils encombreraient la
-- corbeille « Achats à attribuer » et la rendraient inutile.
update factures_achat
   set destination_type = 'structure', destination_nom = 'Frais de structure'
 where fichier_id like 't-c%';

-- ──────────────────── MOUVEMENTS BANCAIRES ────────────────────
-- Les entrées correspondent aux factures de vente encaissées, les sorties
-- aux achats payés. Quelques mouvements n'ont aucune facture en face : c'est
-- volontaire, c'est le cas que la comptabilité doit savoir montrer.
-- ponto_transaction_id est NOT NULL : la table suppose que tout mouvement
-- vient de Ponto. Un jeu de démonstration doit donc s'en inventer un.
insert into transactions (id, compte_id, ponto_transaction_id, date_valeur, date_execution, montant, devise,
                          contrepartie_nom, information_paiement, description, type_transaction, statut, rapproche)
select v.id::uuid, '11111111-1111-4111-8111-111111111111', 'demo-'||right(v.id,3), v.d, v.d, v.mt, 'EUR',
       v.tiers, v.comm, v.comm, case when v.mt > 0 then 'credit' else 'debit' end, 'booked', false
from (values
  ('a0000000-0000-4000-8000-000000000001', date '2026-09-08',  2980.00,'SOPHIE VERLAINE','Facture 2026-021 acompte pergola'),
  ('a0000000-0000-4000-8000-000000000002', date '2026-10-02',  4470.00,'SOPHIE VERLAINE','Facture 2026-022 solde pergola'),
  ('a0000000-0000-4000-8000-000000000003', date '2026-08-25',   300.00,'THIERRY BRASSEUR','Acompte depannage volet'),
  ('a0000000-0000-4000-8000-000000000004', date '2026-07-02',  4310.00,'GARAGE PELTIER SRL','Facture 2026-024'),
  ('a0000000-0000-4000-8000-000000000005', date '2026-10-18',   890.00,'MARC DUPLAND','Acompte moteur porte garage'),
  ('a0000000-0000-4000-8000-000000000006', date '2026-09-20',  1250.00,'PLATEFORME SEJOURS','Versement sejours courte duree'),
  ('a0000000-0000-4000-8000-000000000007', date '2026-10-20',   980.00,'PLATEFORME SEJOURS','Versement sejours courte duree'),
  ('a0000000-0000-4000-8000-000000000011', date '2026-10-20', -1824.96,'VERMEULEN STORES SA','Facture 1012196'),
  ('a0000000-0000-4000-8000-000000000012', date '2026-09-12', -3200.00,'ALDECO PROFIL SA','Facture 44120'),
  ('a0000000-0000-4000-8000-000000000013', date '2026-09-19',  -890.00,'ELEXIO SA','Facture 88213'),
  ('a0000000-0000-4000-8000-000000000014', date '2026-06-28', -2180.00,'PORTALUX SA','Facture 77003'),
  ('a0000000-0000-4000-8000-000000000015', date '2026-10-10',  -142.30,'ENERGIS','Electricite octobre'),
  ('a0000000-0000-4000-8000-000000000016', date '2026-09-10',  -138.70,'ENERGIS','Electricite septembre'),
  ('a0000000-0000-4000-8000-000000000017', date '2026-10-16',   -64.99,'TELECONNECT','Abonnement telephonie'),
  ('a0000000-0000-4000-8000-000000000018', date '2026-10-26',  -412.00,'CARBURANT EXPRESS','Carte carburant octobre'),
  ('a0000000-0000-4000-8000-000000000019', date '2026-10-29',  -215.50,'MATERIS','Achat comptoir'),
  ('a0000000-0000-4000-8000-000000000020', date '2026-11-04',  -950.00,'VIREMENT INTERNE','Vers compte epargne')
) as v(id, d, mt, tiers, comm);

-- Rapprocher ce qui doit l'être : on écrit LES DEUX côtés du lien, comme
-- partout ailleurs dans le Hub. Un seul côté écrit donne un rapprochement
-- qui se voit d'un écran et pas de l'autre.
update factures_achat set transaction_id = 'a0000000-0000-4000-8000-000000000011' where fichier_id = 't-a01';
update factures_achat set transaction_id = 'a0000000-0000-4000-8000-000000000012' where fichier_id = 't-a02';
update factures_achat set transaction_id = 'a0000000-0000-4000-8000-000000000013' where fichier_id = 't-a03';
update factures_achat set transaction_id = 'a0000000-0000-4000-8000-000000000014' where fichier_id = 't-a07';
update transactions set rapproche = true where id in (
  'a0000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000012',
  'a0000000-0000-4000-8000-000000000013','a0000000-0000-4000-8000-000000000014');

-- Les factures de vente encaissées pointent vers leur mouvement.
update lode_factures set transaction_id = 'a0000000-0000-4000-8000-000000000002' where numero = '2026-022';
update lode_factures set transaction_id = 'a0000000-0000-4000-8000-000000000004' where numero = '2026-024';

-- ─────────────────────────── CONTRÔLE ───────────────────────────
select 'clients' o, count(*)::text v from lode_clients
union all select 'dossiers',        count(*)::text from dossiers
union all select 'devis',           count(*)::text from lode_devis
union all select 'factures vente',  count(*)::text from lode_factures
union all select 'achats',          count(*)::text from factures_achat
union all select 'achats a attribuer', count(*)::text from factures_achat where destination_type is null
union all select 'mouvements',      count(*)::text from transactions
union all select 'comptes',         count(*)::text from comptes_bancaires;
