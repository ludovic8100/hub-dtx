-- Correction de la migration 20261102200000 (PR #51).
--
-- Cette migration-là avait ouvert v_jobs_sante à `anon`, pour réparer un écran
-- qui n'affichait rien : à ce moment, le Hub tournait sans connexion
-- (ACCES_LIBRE_TEMPORAIRE) et appelait donc Supabase en tant qu'`anon`.
--
-- Deux choses ont changé depuis :
--   • le login Microsoft est revenu, les utilisateurs sont `authenticated` —
--     le GRANT à `anon` ne sert plus à rien ;
--   • v_jobs_sante n'est pas en security_invoker : elle s'exécute avec les
--     droits de son propriétaire et contourne la RLS de jobs_attendus et
--     jobs_log. Combiné au GRANT, l'état des synchronisations devenait lisible
--     par quiconque dispose de la clé publique, sans se connecter.
--
-- On retire l'accès anonyme et on passe la vue en security_invoker : elle
-- applique désormais les policies des tables sous-jacentes, qui exigent
-- auth.uid() IS NOT NULL. Vérifié : un utilisateur connecté voit ses 4 jobs,
-- `anon` n'en voit aucun.

REVOKE SELECT ON public.v_jobs_sante FROM anon;
ALTER VIEW public.v_jobs_sante SET (security_invoker = true);
