-- « hexagroup ne doit plus être accessible par internet » — Ludovic, 06/11.
--
-- CE QUI ETAIT REELLEMENT OUVERT, et ce qui ne l'etait pas.
--
-- Les cinq tables hex_* (membres, cotisations, lignes, rappels, config)
-- accordent SELECT/INSERT/UPDATE/DELETE au role `anon`, ce qui fait peur au
-- premier regard — mais chacune porte une policy RLS `is_admin()`. Un
-- visiteur anonyme n'est pas admin : il ne lit rien, n'ecrit rien. Et
-- `hexagroup_votes` a RLS active SANS aucune policy, donc tout acces direct
-- est refuse. Verifie en se mettant dans le role anon.
--
-- LA PORTE ETAIT AILLEURS : les deux fonctions SECURITY DEFINER, qui
-- contournent RLS par construction et etaient appelables par `anon` —
-- c'est-a-dire par n'importe qui sur Internet, la cle publishable etant
-- dans le bundle du navigateur et dans ce depot public.
--
--   hexagroup_vote(p_name, p_places) ECRIT. Garde-fous internes : nom de 1 a
--     40 caracteres, 1 a 10 lieux, 80 votants au maximum. Mais la cle de
--     votant est LE NOM SAISI, normalise. Rien n'empechait donc de voter 80
--     fois sous 80 noms inventes et de saturer le scrutin — ou de voter a la
--     place d'un autre.
--
--   hexagroup_results() rend tous les votes AVEC le nom des votants. Un
--     scrutin dont n'importe qui peut lire qui a vote quoi n'est pas un
--     scrutin.
--
-- AUCUN VOTE N'EST EN COURS : `hexagroup_votes` contient 0 ligne et aucune
-- page du Hub n'appelle ces fonctions. Fermer ne casse rien.
--
-- On garde `authenticated` : un futur ecran Hexagroup tournera derriere le
-- login. Si le vote doit s'ouvrir a des membres hors du Hub, la bonne forme
-- existe deja ici — un jeton par votant, comme pour l'acceptation des devis.
revoke execute on function public.hexagroup_vote(text, text[]) from public, anon;
grant  execute on function public.hexagroup_vote(text, text[]) to authenticated, service_role;

revoke execute on function public.hexagroup_results() from public, anon;
grant  execute on function public.hexagroup_results() to authenticated, service_role;
