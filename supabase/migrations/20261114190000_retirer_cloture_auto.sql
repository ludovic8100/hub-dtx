-- LA CLÔTURE AUTOMATIQUE DES CHANTIERS EST RETIRÉE (14/11/2026)
-- ---------------------------------------------------------------------------
--
-- Décision de Ludovic, en une phrase : « non, pas besoin de clôture
-- automatique ».
--
-- Elle avait été posée le 08/11 pour désencombrer la liste : un chantier dont
-- toutes les factures sont payées, sans devis vivant ni achat en attente, se
-- fermait seul.
--
-- Ce qui l'a condamnée, et c'est mesuré, pas supposé : elle l'a bloqué DEUX
-- FOIS dans la même heure, le 14/11.
--
--   1. Il a voulu créer un chantier en DOS-2026-002 et a lu « déjà utilisé ».
--      Il est allé le chercher dans la liste : introuvable, parce que les
--      chantiers clos y sont masqués. Il a cru à un bug.
--   2. Il a voulu rattacher un devis à ce même chantier : absent de la liste,
--      pour la même raison.
--
-- Le défaut de fond est là : un chantier clos disparaît de PARTOUT, alors
-- qu'un client revient souvent avec un complément. Une règle qui range mieux
-- qu'elle ne sert finit par coûter plus de temps qu'elle n'en fait gagner.
--
-- ⚠️ Les trois triggers sont supprimés ; `dossier_cloture_si_termine()` et
-- `trg_dossier_cloture()` sont CONSERVÉES. Elles ne tournent plus — plus rien
-- ne les appelle — mais une fonction supprimée ne se récupère pas d'un
-- `git revert`, et la logique qu'elles portent (quand peut-on considérer un
-- chantier terminé ?) reste juste. Si la clôture revient un jour, avec un
-- délai ou en simple proposition, tout est là.
--
-- La clôture à la main, elle, ne change pas : c'est le champ « État » de la
-- fiche, et une décision humaine reste.

drop trigger if exists lode_factures_cloture   on lode_factures;
drop trigger if exists lode_devis_cloture      on lode_devis;
drop trigger if exists factures_achat_cloture  on factures_achat;

-- Rouvrir ce qu'une règle désormais supprimée avait fermé. On ne touche PAS
-- aux chantiers fermés à la main : `cloture_auto` les distingue, et une
-- décision humaine ne se défait pas toute seule.
update dossiers
   set statut = 'ouvert', cloture_auto = false,
       cloture_motif = null, cloture_le = null, date_fin = null,
       updated_at = now()
 where cloture_auto = true and statut = 'clos';

do $$
declare n int;
begin
  select count(*) into n from pg_trigger t join pg_proc p on p.oid = t.tgfoid
   where not t.tgisinternal and p.proname = 'trg_dossier_cloture';
  if n > 0 then
    raise exception 'Il reste % trigger(s) de cloture automatique', n;
  end if;
end $$;
