-- Outils → Synchronisations : la vue n'était lisible par personne depuis l'app.
--
-- v_jobs_sante avait été créée sans GRANT SELECT pour `anon`. Le Hub appelle
-- Supabase avec la clé anon (et, tant que l'accès libre temporaire est en place,
-- sans session : le rôle est donc `anon` et non `authenticated`). Résultat :
-- /tools/jobs affichait « Aucun job déclaré » — l'écran construit pour voir les
-- synchronisations tomber ne voyait rien du tout, et le disait sans le dire,
-- parce que l'erreur Supabase était avalée côté front.
--
-- Le front a été corrigé (bandeau d'erreur au lieu du silence, PR #41) ; il reste
-- à ouvrir la lecture. La vue est en lecture seule et n'expose que l'état des
-- jobs — même niveau de confidentialité que jobs_attendus et jobs_log, déjà
-- lisibles par anon.

GRANT SELECT ON public.v_jobs_sante TO anon, authenticated;
