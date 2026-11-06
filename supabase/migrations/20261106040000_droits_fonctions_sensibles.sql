-- Trois fonctions ouvertes beaucoup trop largement, trouvees le 06/11 en
-- recensant les 37 fonctions SECURITY DEFINER appelables par le Hub.
--
-- RAPPEL DE CE QUE SIGNIFIE « anon » : c'est le role employe AVANT toute
-- connexion, avec la cle publishable — laquelle figure dans le bundle servi
-- au navigateur ET dans ce depot, qui est public. « Appelable par anon »
-- veut donc dire : appelable par n'importe qui sur Internet.
--
-- ── 1. rapprocher_factures_paiements : LA PLUS GRAVE ────────────────────
-- SECURITY DEFINER, elle ECRIT (elle lie factures et paiements), et elle
-- etait appelable par anon. Son parametre p_simulation vaut true par
-- defaut, mais rien n'empechait de passer false : n'importe qui pouvait
-- reecrire le rapprochement bancaire des six societes.
-- Aucun appelant cote navigateur (verifie sur tout src/ et api/) : le
-- rapprochement part des GitHub Actions, en service_role.
--
-- ── 2. lancer_sync_ponto : declenchable par un inconnu ──────────────────
-- Elle n'ecrit pas de donnee metier et se protege (refus si une synchro a
-- demarre depuis moins de 5 minutes), donc la casse etait bornee. Mais
-- CLAUDE.md reserve ce geste au cas « client present » : le laisser au
-- public est le contraire de cette regle.
--
-- ── 3. upsert_secret : tout employe pouvait reecrire n'importe quel secret ──
-- INSERT ... ON CONFLICT DO UPDATE sur `config_secrets`, accordee a
-- `authenticated`. Ce n'est pas qu'une nuisance : plusieurs fonctions
-- ouvertes a anon (crm_log_appel, crm_lookup, creer_ticket_depuis_mail,
-- ticket_add_email_message) se protegent par un p_secret compare a cette
-- table. Reecrire le secret, c'est pouvoir ensuite appeler ces fonctions
-- depuis l'exterieur avec une valeur choisie — injecter de faux appels, de
-- faux tickets. Elle n'a AUCUN appelant dans le depot.
--
-- ── LA LECON, QUI A FAILLI ME COUTER LE CORRECTIF ───────────────────────
--
-- Mon premier jet faisait `revoke execute ... from anon`. Verification
-- apres coup : `has_function_privilege('anon', ...)` rendait TOUJOURS true.
--
-- Postgres accorde EXECUTE a PUBLIC sur toute fonction nouvelle, par
-- defaut. `anon` ne tenait donc pas son droit d'une attribution qui le
-- nomme, mais de PUBLIC. Retirer le droit au role ne retire rien tant que
-- PUBLIC le porte.
--
-- C'est le genre de correctif de securite qui rassure sans proteger. La
-- bonne forme est ci-dessous : retirer a PUBLIC, puis accorder nommement
-- aux seuls roles qui en ont besoin — et REVERIFIER.

revoke execute on function public.rapprocher_factures_paiements(text, integer, integer, date, boolean) from public;
revoke execute on function public.rapprocher_factures_paiements(text, integer, integer, date, boolean) from anon;
revoke execute on function public.rapprocher_factures_paiements(text, integer, integer, date, boolean) from authenticated;
grant  execute on function public.rapprocher_factures_paiements(text, integer, integer, date, boolean) to service_role;

revoke execute on function public.lancer_sync_ponto() from public;
revoke execute on function public.lancer_sync_ponto() from anon;
grant  execute on function public.lancer_sync_ponto() to authenticated;  -- bouton « Synchroniser », ecran Banque
grant  execute on function public.lancer_sync_ponto() to service_role;

revoke execute on function public.upsert_secret(text, text) from public;
revoke execute on function public.upsert_secret(text, text) from anon;
revoke execute on function public.upsert_secret(text, text) from authenticated;
grant  execute on function public.upsert_secret(text, text) to service_role;
-- Pas de search_path fige : le defaut classique d'une fonction DEFINER.
alter function public.upsert_secret(text, text) set search_path = public;

revoke execute on function public.execute_raw_sql(text) from public;
grant  execute on function public.execute_raw_sql(text) to authenticated;  -- outil Succession
grant  execute on function public.execute_raw_sql(text) to service_role;

-- ETAT VERIFIE APRES APPLICATION, en production :
--   execute_raw_sql                 anon=non  connecte=oui  service_role=oui
--   lancer_sync_ponto               anon=non  connecte=oui  service_role=oui
--   rapprocher_factures_paiements   anon=non  connecte=non  service_role=oui
--   upsert_secret                   anon=non  connecte=non  service_role=oui
