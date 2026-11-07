-- 17 vues etaient en SECURITY DEFINER : elles lisent avec les droits de leur
-- proprietaire, donc elles IGNORENT la RLS des tables. Mesure faite en se
-- faisant passer pour JFS (bureau de Spa, qui ne doit voir que 1 144 clients) :
--
--   clients (table)        1 144   <- le cloisonnement marche
--   dyn_clients (vue)     10 313   <- et la vue l'annule
--   v_famille_clients      9 297
--   v_risques_clients     30 899
--
-- DEUX TRAITEMENTS, parce que le bon correctif depend de l'usage reel.
--
-- 14 de ces vues ne sont appelees par AUCUN ecran (verifie sur tout le depot,
-- hors sql/, migrations et docs). Pour elles, fermer l'acces ferme le trou
-- entierement, sans pari sur les performances : c'est strictement mieux que
-- security_invoker, qui avait fait depasser 25 s sur v_factures_impayees ce
-- matin meme. Si l'une redevient utile, on lui rendra un acces cadre.

revoke all on table public.v_famille_clients            from anon, authenticated;
revoke all on table public.v_risques_clients            from anon, authenticated;
revoke all on table public.v_ca_producteur              from anon, authenticated;
revoke all on table public.v_tresorerie_holding         from anon, authenticated;
revoke all on table public.v_lacunes_bordereaux         from anon, authenticated;
revoke all on table public.v_rp_qualite                 from anon, authenticated;
revoke all on table public.v_producteurs_officiels      from anon, authenticated;
revoke all on table public.v_pnl_producteur_2026        from anon, authenticated;
revoke all on table public.v_paiements_rcp_2026         from anon, authenticated;
revoke all on table public.v_rapprochement_rcp_2026     from anon, authenticated;
revoke all on table public.v_polices_2026_sans_commission from anon, authenticated;
revoke all on table public.v_vie_active_sans_quittance  from anon, authenticated;
revoke all on table public.view_rentabilite_compagnies  from anon, authenticated;
revoke all on table public.mv_rp_mensuel                from anon, authenticated;

-- Les 3 restantes servent vraiment : elles passent sous les droits de celui qui
-- les interroge, donc sous la RLS.
alter view public.dyn_clients                 set (security_invoker = on);
alter view public.v_pnl_producteur_annee      set (security_invoker = on);
alter view public.v_bordereaux_reconciliation set (security_invoker = on);

-- VERIFIE ROLE PAR ROLE, PAS DEDUIT :
--
--                              avant        apres admin   apres JFS
--   dyn_clients                JFS 10 313   10 313        1 144   OK
--   v_pnl_producteur_annee     JFS 18       18            0       OK (pas de compta)
--   v_risques_clients          JFS 30 899   --            REFUSE  OK
--
-- Effet de bord favorable : dyn_clients passe de 173 ms a 3 ms pour un
-- utilisateur de bureau. La RLS filtre en amont au lieu de tout lire puis jeter.
--
-- RESTE OUVERT, et c'est une autre table : v_bordereaux_reconciliation rend
-- toujours 4 178 lignes a tout le monde, parce que la TABLE bordereaux porte
-- encore `allow_all_bordereaux` (ALL pour tout connecte). La vue respecte
-- desormais la RLS ; c'est la RLS de bordereaux qui ne cloisonne pas.
