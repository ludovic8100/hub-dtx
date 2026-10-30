-- Phase 0 sécurité (29/10/2026) — appliqué en prod via migration `security_phase0_revoke_rpc_anon`.
--
-- Audit des 14 fonctions SECURITY DEFINER exposées au rôle anon (advisor Supabase) :
--   • creer_ticket_depuis_mail, ticket_add_email_message : vérifient hub_ticket_intake_secret  → OK
--   • crm_lookup, crm_log_appel                           : vérifient threecx_api_secret        → OK
--   • lode/dtx/dyn_devis_public / _decision              : exigent le token UUID du devis       → OK
--   • hexagroup_vote / hexagroup_results                 : page de vote publique, bornée        → OK (voulu)
--   • execute_raw_sql                                    : AUCUN contrôle, SQL arbitraire       → REVOQUÉE anon
--   • tickets_rappels_echeance                           : envoie des mails, cron uniquement    → REVOQUÉE anon+authenticated

revoke execute on function public.execute_raw_sql(text) from public, anon;
revoke execute on function public.tickets_rappels_echeance() from public, anon, authenticated;

-- Reste à faire (phase 3) : remplacer l'appel execute_raw_sql de src/pages/tools/ToolSuccession.jsx
-- par des RPC dédiées, puis `drop function public.execute_raw_sql(text)`.
