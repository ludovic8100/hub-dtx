-- Les tickets sortent de la table « taches »
-- ---------------------------------------------------------------------------
-- Héritage : le module Tâches a été supprimé le 01/11/2026, mais sa table a
-- survécu parce qu'elle portait les tickets (drapeau is_ticket). Depuis cette
-- suppression, « taches » ne contient plus QUE des tickets — 62 lignes, toutes
-- is_ticket = true. Le nom n'a donc plus de sens.
--
-- Cette migration ne fait QUE renommer : aucune donnée déplacée, aucune colonne
-- supprimée, aucun comportement modifié. Les identifiants, la séquence et les
-- clés étrangères sont conservés — tickets_messages.tache_id pointe toujours
-- sur les mêmes lignes.
--
-- Bascule sans interruption : une vue « taches » prend la place de la table le
-- temps que les onglets déjà ouverts sur l'ancien bundle se rechargent.
--
-- Reste pour la migration suivante (élagage), à passer à un moment calme :
--   • supprimer la vue « taches » ;
--   • supprimer les 20 colonnes héritées des tâches, à zéro usage sur les
--     62 tickets : echeance, code_type, categorie, source, file_attente,
--     assigne_par, assigne_a, assigned_by, lien_url, societe_id, tags,
--     user_email, sous_categories, email_objet, email_de, pieces_jointes,
--     lu_par, is_ticket, statut (doublon de ticket_statut) et date_creation
--     (identique à created_at sur les 62 lignes) ;
--   • renommer tickets_messages en ticket_messages et tache_id en ticket_id ;
--   • réécrire creer_ticket_depuis_mail(), ticket_add_email_message() et
--     tickets_rappels_echeance(), qui écrivent encore une partie de ces
--     colonnes et passent donc par la vue « taches » jusque-là.

-- 1) La table ----------------------------------------------------------------
alter table public.taches rename to tickets;
alter sequence public.taches_id_seq rename to tickets_id_seq;

alter table public.tickets rename constraint taches_pkey to tickets_pkey;
alter table public.tickets rename constraint taches_client_id_fkey to tickets_client_id_fkey;

alter index public.idx_taches_client_id      rename to idx_tickets_client_id;
alter index public.idx_taches_dossier_client rename to idx_tickets_dossier_client;
alter index public.idx_taches_gestionnaire   rename to idx_tickets_gestionnaire;
alter index public.idx_taches_echeance       rename to idx_tickets_echeance;
alter index public.idx_taches_file_attente   rename to idx_tickets_file_attente;
alter index public.idx_taches_societe        rename to idx_tickets_societe;
alter index public.idx_taches_statut         rename to idx_tickets_statut;

alter trigger taches_updated_at on public.tickets rename to tickets_updated_at;
alter policy allow_all_taches on public.tickets rename to allow_all_tickets;

-- 2) La vue de compatibilité, temporaire -------------------------------------
-- security_invoker : la vue s'efface devant les droits de l'appelant, donc la
-- RLS de public.tickets continue de s'appliquer telle quelle.
create view public.taches with (security_invoker = on) as
  select * from public.tickets;

comment on view public.taches is
  'Compatibilite temporaire (02/11/2026) le temps que les onglets ouverts se rechargent. A supprimer avec les colonnes mortes et la reecriture des trois fonctions SQL des tickets.';

grant select, insert, update, delete on public.taches to anon, authenticated;
grant all on public.taches to service_role;

notify pgrst, 'reload schema';
