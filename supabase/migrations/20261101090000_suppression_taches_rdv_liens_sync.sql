-- ================================================================
-- Refonte du Hub — suppression des modules Tâches, RDV/Agenda,
-- Liens cassés et Synchronisation (01/11/2026)
--
-- Contexte : ces quatre modules s'appuyaient sur des workflows n8n
-- aujourd'hui arrêtés et archivés. Plutôt que de les laisser dériver,
-- on repart d'une base propre. Tout sera reconstruit au besoin, sur
-- une vraie couche applicative.
--
-- Ce qui est CONSERVÉ :
--   • taches  : la table porte les TICKETS (is_ticket = true), seul
--               module de ce groupe encore utilisé. Seules les lignes
--               non-ticket sont supprimées.
--   • tickets_messages, ticket_categories, tickets_rappels_echeance()
--   • v_lacunes_bordereaux (alerte bordereaux manquants)
--   • la synchro Qlik → Hub (clients, contrats, statut de production),
--     portée par la GitHub Action qlik-sync.yml
--   • les crons sync_entra_collaborateurs_hourly et sync_ponto_comptes_daily
-- ================================================================

begin;

-- 1) Vue dérivée des tâches (jamais lue par le Hub)
drop view if exists public.v_taches_enrichies;

-- 2) Annexes des tâches : historique, notes de suivi, listing de
--    rapprochement figé en juillet 2026. Aucune n'est lue par le Hub.
drop table if exists public.taches_historique;
drop table if exists public.taches_suivi;
drop table if exists public.taches_rapprochement;

-- 3) Les tâches proprement dites. Les tickets (is_ticket = true) restent.
delete from public.taches where is_ticket is not true;

-- 4) RDV / Agenda : alimentés par le workflow n8n « Agenda → RDV »,
--    sans écriture depuis le 6 août 2026.
drop table if exists public.rdv cascade;          -- emporte trg_rdv_autolink
drop table if exists public.rdv_categories;
drop function if exists public.rdv_autolink();

-- 5) Liens cassés : workflow n8n de nettoyage, sans écriture depuis
--    le 13 août 2026.
drop table if exists public.liens_casses_log;

-- 6) Journal de synchronisation : table vide, jamais alimentée.
drop table if exists public.sync_log;

commit;
