-- RATTRAPAGE DU SCHÉMA DE TEST — 85 colonnes qui n'existaient qu'en production.
--
-- Trouvé le 11/11/2026 en testant un écran, pas en lisant le code. Ajouter un
-- compte producteur en test rendait :
--
--     Could not find the 'descriptif' column of 'producteurs'
--
-- En cherchant pourquoi, j'ai comparé les deux schémas colonne par colonne.
-- L'écart est bien plus large qu'un champ oublié :
--
--     PRODUCTION  128 tables · 1 927 colonnes
--     TEST        107 tables · 1 526 colonnes
--
-- Et surtout : 9 tables existent DES DEUX CÔTÉS avec des colonnes
-- différentes. Ce sont les plus dangereuses — rien ne les signale, et
-- l'écran casse seulement quand quelqu'un touche la bonne colonne.
--
--     collaborateurs          69 colonnes manquantes — tous les droits par
--                             module (acc_*, dyn_*, lode_*, hex_*, prive_*,
--                             dtx_*), l'identité Microsoft (o365_*, user_id)
--                             et personne_id
--     ref_bureaux              5 — l'adresse complète du bureau
--     profils_investisseur     3 — date_effet, source_date, version_fiche
--     transactions             3 — cle_extrait, fournisseur_id, origine
--     bordereaux               1 — compagnie_id
--     clients                  1 — personne_id
--     collaborateur_taux       1 — societe (le taux dépend de la société)
--     famille                  1 — type_groupe_libelle
--     lode_factures_lignes     1 — bloc
--
-- ⚠️ CE N'EST PAS UNE MIGRATION DE PLUS, C'EST LA PREUVE D'UN DÉFAUT.
-- Aucune de ces colonnes n'a jamais eu de migration : elles ont été ajoutées
-- directement en base de production. Un environnement de test qui ne porte
-- pas le même schéma ne teste pas la production — il teste autre chose, et il
-- le fait sans prévenir.
--
-- Les 12 tables absentes du test (fournisseurs, personnes, releves_producteur
-- et ses partitions, clients_attribution…) restent à rattraper séparément :
-- créer une table demande de connaître ses contraintes et ses index, pas
-- seulement ses colonnes.
--
-- Idempotente : sans effet en production, elle comble le test.

-- bordereaux : 1 colonne(s)
alter table public.bordereaux add column if not exists compagnie_id uuid;

-- clients : 1 colonne(s)
alter table public.clients add column if not exists personne_id bigint;

-- collaborateur_taux : 1 colonne(s)
alter table public.collaborateur_taux add column if not exists societe text;

-- collaborateurs : 69 colonne(s)
alter table public.collaborateurs add column if not exists acc_dtx boolean;
alter table public.collaborateurs add column if not exists acc_dynassur boolean;
alter table public.collaborateurs add column if not exists acc_hexagroup boolean;
alter table public.collaborateurs add column if not exists acc_holding boolean;
alter table public.collaborateurs add column if not exists acc_lode boolean;
alter table public.collaborateurs add column if not exists acc_prive boolean;
alter table public.collaborateurs add column if not exists acc_tools boolean;
alter table public.collaborateurs add column if not exists appel boolean;
alter table public.collaborateurs add column if not exists date_envoi_acces timestamp with time zone;
alter table public.collaborateurs add column if not exists date_naissance date;
alter table public.collaborateurs add column if not exists dtx_comptabilite boolean;
alter table public.collaborateurs add column if not exists dtx_dashboard boolean;
alter table public.collaborateurs add column if not exists dtx_devis boolean;
alter table public.collaborateurs add column if not exists dtx_immobilier boolean;
alter table public.collaborateurs add column if not exists dtx_notesfrais boolean;
alter table public.collaborateurs add column if not exists dtx_taches boolean;
alter table public.collaborateurs add column if not exists dtx_trading boolean;
alter table public.collaborateurs add column if not exists dtx_vehicules boolean;
alter table public.collaborateurs add column if not exists dyn_appels boolean;
alter table public.collaborateurs add column if not exists dyn_banque boolean;
alter table public.collaborateurs add column if not exists dyn_bordereaux boolean;
alter table public.collaborateurs add column if not exists dyn_chiffres boolean;
alter table public.collaborateurs add column if not exists dyn_clients boolean;
alter table public.collaborateurs add column if not exists dyn_compagnies boolean;
alter table public.collaborateurs add column if not exists dyn_comptabilite boolean;
alter table public.collaborateurs add column if not exists dyn_credits boolean;
alter table public.collaborateurs add column if not exists dyn_dashboard boolean;
alter table public.collaborateurs add column if not exists dyn_devis boolean;
alter table public.collaborateurs add column if not exists dyn_notesfrais boolean;
alter table public.collaborateurs add column if not exists dyn_objectifs boolean;
alter table public.collaborateurs add column if not exists dyn_production boolean;
alter table public.collaborateurs add column if not exists dyn_rdv boolean;
alter table public.collaborateurs add column if not exists dyn_rentabilite boolean;
alter table public.collaborateurs add column if not exists dyn_sinistres boolean;
alter table public.collaborateurs add column if not exists dyn_taches boolean;
alter table public.collaborateurs add column if not exists est_employe boolean;
alter table public.collaborateurs add column if not exists grp_notesfrais boolean;
alter table public.collaborateurs add column if not exists grp_taches boolean;
alter table public.collaborateurs add column if not exists gsm text;
alter table public.collaborateurs add column if not exists gsm_e164 text;
alter table public.collaborateurs add column if not exists hex_banque boolean;
alter table public.collaborateurs add column if not exists hex_comptabilite boolean;
alter table public.collaborateurs add column if not exists hex_cotisations boolean;
alter table public.collaborateurs add column if not exists hex_dashboard boolean;
alter table public.collaborateurs add column if not exists hex_membres boolean;
alter table public.collaborateurs add column if not exists hex_notesfrais boolean;
alter table public.collaborateurs add column if not exists hex_taches boolean;
alter table public.collaborateurs add column if not exists last_login_at timestamp with time zone;
alter table public.collaborateurs add column if not exists lode_banque boolean;
alter table public.collaborateurs add column if not exists lode_clients boolean;
alter table public.collaborateurs add column if not exists lode_comptabilite boolean;
alter table public.collaborateurs add column if not exists lode_dashboard boolean;
alter table public.collaborateurs add column if not exists lode_devis boolean;
alter table public.collaborateurs add column if not exists lode_notesfrais boolean;
alter table public.collaborateurs add column if not exists lode_taches boolean;
alter table public.collaborateurs add column if not exists notes_frais_beneficiaire boolean;
alter table public.collaborateurs add column if not exists o365_display_name text;
alter table public.collaborateurs add column if not exists o365_object_id text;
alter table public.collaborateurs add column if not exists o365_only boolean;
alter table public.collaborateurs add column if not exists personne_id bigint;
alter table public.collaborateurs add column if not exists prive_banque boolean;
alter table public.collaborateurs add column if not exists prive_comptabilite boolean;
alter table public.collaborateurs add column if not exists prive_dashboard boolean;
alter table public.collaborateurs add column if not exists prive_notesfrais boolean;
alter table public.collaborateurs add column if not exists prive_succession boolean;
alter table public.collaborateurs add column if not exists prive_taches boolean;
alter table public.collaborateurs add column if not exists titre text;
alter table public.collaborateurs add column if not exists user_id text;
alter table public.collaborateurs add column if not exists voir_commissions boolean;

-- famille : 1 colonne(s)
alter table public.famille add column if not exists type_groupe_libelle text;

-- lode_factures_lignes : 1 colonne(s)
alter table public.lode_factures_lignes add column if not exists bloc text;

-- profils_investisseur : 3 colonne(s)
alter table public.profils_investisseur add column if not exists date_effet date;
alter table public.profils_investisseur add column if not exists source_date text;
alter table public.profils_investisseur add column if not exists version_fiche text;

-- ref_bureaux : 5 colonne(s)
alter table public.ref_bureaux add column if not exists boite text;
alter table public.ref_bureaux add column if not exists code_postal text;
alter table public.ref_bureaux add column if not exists numero text;
alter table public.ref_bureaux add column if not exists rue text;
alter table public.ref_bureaux add column if not exists ville text;

-- transactions : 3 colonne(s)
alter table public.transactions add column if not exists cle_extrait text;
alter table public.transactions add column if not exists fournisseur_id uuid;
alter table public.transactions add column if not exists origine text;
