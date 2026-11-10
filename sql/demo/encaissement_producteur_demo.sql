-- JEU D'ESSAI — ENCAISSEMENT PRODUCTEUR
--
-- ⚠️ POUR L'ENVIRONNEMENT DE TEST UNIQUEMENT (projet hub-dtx-test).
-- Ne jamais exécuter en production : il insère des clients inventés.
--
-- Les noms, numéros de dossier et montants sont FICTIFS. Le dépôt est public :
-- aucun nom de client réel ne doit y entrer, et la règle vaut pour un jeu
-- d'essai autant que pour un commentaire.
--
-- Ce que le jeu met en scène, un cas par client, parce qu'un modèle ne se juge
-- pas sur le cas facile :
--
--   MOREAU Thierry    paie 160 € RONDS par virement, pour des primes à
--                     152,40 / 152,40 / 163,75. Une régularisation en
--                     septembre. → le solde est NÉGATIF : il a payé d'avance.
--                     C'est le cas que le rapprochement ligne à ligne ne sait
--                     pas traiter, et que le compte courant absorbe sans rien
--                     signaler.
--
--   BERTRAND Céline   paie EN ESPÈCES au bureau, quittances numérotées.
--                     → à jour. Sans le mode « espèces », elle apparaîtrait
--                     comme n'ayant jamais rien payé.
--
--   VANHOVE Marc      n'a plus rien versé depuis trois mois.
--                     → solde débiteur. C'est la seule vraie alerte.
--
--   DELCOURT Anne     virements + un versement en espèces + un virement saisi
--                     avant d'être vu par la banque.
--                     → à jour, mais un versement « à rapprocher ».

begin;

-- ── Référentiel ───────────────────────────────────────────────────────────
insert into compagnies (code, nom, nom_court, numero, actif)
values ('AG', 'AG Insurance', 'AG', '79', true)
on conflict (code) do nothing;

insert into producteurs (compagnie_nom, numero_producteur, fsma, statut, compagnie_id)
select 'AG Insurance', '58824', '79', 'actif', c.id from compagnies c where c.code = 'AG'
on conflict do nothing;

-- ── Clients fictifs ───────────────────────────────────────────────────────
insert into clients (id, dossier, nom, prenom, cp, localite, gestionnaire_code) values
  (900001, 'D-900001', 'MOREAU',   'Thierry', '4450', 'JUPRELLE', 'LDE'),
  (900002, 'D-900002', 'BERTRAND', 'Céline',  '4000', 'LIEGE',    'LDE'),
  (900003, 'D-900003', 'VANHOVE',  'Marc',    '4900', 'SPA',      'JFS'),
  (900004, 'D-900004', 'DELCOURT', 'Anne',    '4877', 'OLNE',     'LDE')
on conflict (id) do nothing;

-- ── L'arrangement : ces quatre-là paient au courtier ──────────────────────
insert into encaissement_comptes (client_id, producteur_id, compagnie_id, code_releve, depuis, notes)
select v.client_id, p.id, c.id, v.code, date '2026-01-01', v.note
from (values
  (900001, 'EP-4471', 'Mensuel, montant rond, régularisation annuelle'),
  (900002, 'EP-4472', 'Paie au comptoir, quittance remise à chaque fois'),
  (900003, 'EP-4473', 'Sans nouvelles depuis juillet'),
  (900004, 'EP-4474', 'Virements, un versement en espèces en août')
) as v(client_id, code, note)
cross join compagnies c
join producteurs p on p.compagnie_id = c.id and p.numero_producteur = '58824'
where c.code = 'AG'
on conflict (client_id, producteur_id) do nothing;

-- ── Ce que chacun DOIT : les quittances du bordereau ──────────────────────
insert into quittances (client_id, client_nom, client_prenom, police, compagnie,
                        compte_producteur, type_quittance, prime_totale, commission,
                        date_comptable, etat, periodicite)
values
  -- MOREAU : trois échéances, dont une revue à la hausse
  (900001,'MOREAU','Thierry','AG-11240071','AG Insurance','58824','TERME',152.40,22.86,'2026-07-01','encaissée','mensuelle'),
  (900001,'MOREAU','Thierry','AG-11240071','AG Insurance','58824','TERME',152.40,22.86,'2026-08-01','encaissée','mensuelle'),
  (900001,'MOREAU','Thierry','AG-11240071','AG Insurance','58824','TERME',163.75,24.56,'2026-09-01','encaissée','mensuelle'),
  -- BERTRAND : deux échéances
  (900002,'BERTRAND','Céline','AG-11240088','AG Insurance','58824','TERME', 94.30,14.15,'2026-08-01','encaissée','mensuelle'),
  (900002,'BERTRAND','Céline','AG-11240088','AG Insurance','58824','TERME', 94.30,14.15,'2026-09-01','encaissée','mensuelle'),
  -- VANHOVE : trois échéances, rien payé
  (900003,'VANHOVE','Marc','AG-11240102','AG Insurance','58824','TERME',218.65,32.80,'2026-07-01','impayée','mensuelle'),
  (900003,'VANHOVE','Marc','AG-11240102','AG Insurance','58824','TERME',218.65,32.80,'2026-08-01','impayée','mensuelle'),
  (900003,'VANHOVE','Marc','AG-11240102','AG Insurance','58824','TERME',218.65,32.80,'2026-09-01','impayée','mensuelle'),
  -- DELCOURT : deux échéances
  (900004,'DELCOURT','Anne','AG-11240115','AG Insurance','58824','TERME',305.00,45.75,'2026-08-01','encaissée','mensuelle'),
  (900004,'DELCOURT','Anne','AG-11240115','AG Insurance','58824','TERME',305.00,45.75,'2026-09-01','encaissée','mensuelle');

-- ── Ce que chacun a VERSÉ ─────────────────────────────────────────────────
insert into encaissement_versements (compte_id, date_versement, montant, mode, quittance_numero, recu_par, notes)
select ec.id, v.d::date, v.m, v.mode, v.quit, v.par, v.note
from (values
  -- MOREAU : des montants ronds, puis la régularisation
  (900001,'2026-07-05',160.00,'virement',null,       null,  'Montant rond — acompte, pas la prime exacte'),
  (900001,'2026-08-05',160.00,'virement',null,       null,  'Montant rond'),
  (900001,'2026-09-05',160.00,'virement',null,       null,  'Montant rond'),
  -- BERTRAND : au comptoir, quittance à chaque fois
  (900002,'2026-08-04', 94.30,'especes', 'Q-2026-0411','LDE','Payé au bureau'),
  (900002,'2026-09-03', 94.30,'especes', 'Q-2026-0438','LDE','Payé au bureau'),
  -- VANHOVE : rien depuis juillet — aucune ligne, c'est le fait
  -- DELCOURT : virements, un versement en espèces, un virement pas encore vu par la banque
  (900004,'2026-08-06',305.00,'virement',null,        null, null),
  (900004,'2026-09-07',150.00,'especes', 'Q-2026-0440','LDE','Moitié au comptoir'),
  (900004,'2026-09-08',155.00,'virement',null,        null, 'Saisi avant que la banque ne le rende')
) as v(client_id, d, m, mode, quit, par, note)
join encaissement_comptes ec on ec.client_id = v.client_id;

commit;

-- Ce que la vue doit alors montrer :
--
--   MOREAU    dû 468,55 · versé 480,00 · solde −11,45   (payé d'avance)
--   BERTRAND  dû 188,60 · versé 188,60 · solde    0,00  (à jour, 100 % espèces)
--   VANHOVE   dû 655,95 · versé   0,00 · solde  655,95  ← la seule alerte
--   DELCOURT  dû 610,00 · versé 610,00 · solde    0,00  (1 virement à rapprocher)
