-- Coût horaire d'un collaborateur, calculé — et figé sur le chantier.
--
-- Ludovic : « tu peux toujours mettre le taux horaire et il est calculé dans
-- la fiche employé : on place son salaire brut, le coût de sa voiture, etc.,
-- et tu calcules le taux horaire global. »
--
-- Puis, et c'est la remarque qui a sauvé la conception :
--
--   « Attention qu'il devra être fixé sur le moment. Car le salaire augmente
--    avec le temps, mais le coût horaire d'il y a trois ans ne doit pas
--    évoluer. La M.O. d'il y a trois ans, c'était la M.O. d'il y a trois
--    ans... »
--
-- D'OÙ DEUX CHOSES, ET PAS UNE
--
--   1. La fiche employé calcule un taux COURANT (colonne générée ci-dessous).
--   2. Le chantier STOCKE le taux qui lui a été appliqué (dossiers.mo_taux_horaire).
--
-- Sans le point 2, augmenter un salaire aujourd'hui réécrirait la marge d'un
-- chantier de 2023. C'est la même règle que pour le prix d'une ligne de
-- devis : on garde ce qui a été appliqué, pas un renvoi vers une valeur qui
-- bouge.
--
-- LE DÉNOMINATEUR EST LE VRAI PIÈGE
--
-- Le coût employeur se calcule sans difficulté. C'est le nombre d'heures qui
-- fausse tout : diviser par 1 820 h théoriques donne un taux trop bas d'environ
-- 20 %, parce que les congés, les jours fériés, la maladie, la formation et les
-- trajets ne sont pas des heures facturables. Le défaut est donc 1 530 h, et il
-- est modifiable par personne — personne n'a le même taux d'occupation.
--
-- LES 13,92 MOIS
--
-- 12 mois + 13e mois + 0,92 mois de double pécule de vacances. C'est la base
-- belge, la même que celle du simulateur construit avec Ludovic en octobre.

alter table collaborateurs add column if not exists cout_brut_mensuel     numeric;
alter table collaborateurs add column if not exists cout_mois_payes       numeric default 13.92;
alter table collaborateurs add column if not exists cout_charges_pct      numeric default 25;
alter table collaborateurs add column if not exists cout_vehicule_mensuel numeric;
alter table collaborateurs add column if not exists cout_autres_mensuel   numeric;
alter table collaborateurs add column if not exists cout_heures_annuelles numeric default 1530;
alter table collaborateurs add column if not exists cout_note             text;

alter table collaborateurs drop constraint if exists collaborateurs_cout_positif_chk;
alter table collaborateurs add  constraint collaborateurs_cout_positif_chk
  check (coalesce(cout_brut_mensuel, 0)     >= 0
     and coalesce(cout_vehicule_mensuel, 0) >= 0
     and coalesce(cout_autres_mensuel, 0)   >= 0
     and coalesce(cout_charges_pct, 0)      >= 0
     and coalesce(cout_mois_payes, 1)        > 0
     and coalesce(cout_heures_annuelles, 1)  > 0);

-- La formule vit EN BASE, pas dans un écran : trois écrans qui la recopient,
-- ce sont trois formules qui divergeront.
alter table collaborateurs drop column if exists cout_horaire;
alter table collaborateurs add column cout_horaire numeric
  generated always as (
    case
      when coalesce(cout_heures_annuelles, 0) > 0 and coalesce(cout_brut_mensuel, 0) > 0
      then round((
             cout_brut_mensuel * coalesce(cout_mois_payes, 13.92)
               * (1 + coalesce(cout_charges_pct, 25) / 100)
             + coalesce(cout_vehicule_mensuel, 0) * 12
             + coalesce(cout_autres_mensuel, 0)   * 12
           ) / cout_heures_annuelles, 2)
      else null
    end
  ) stored;

comment on column collaborateurs.cout_horaire is
  'Coût horaire COURANT, recalculé par la base. Ne jamais l''utiliser pour un chantier passé : le chantier garde son propre taux dans dossiers.mo_taux_horaire.';
comment on column collaborateurs.cout_heures_annuelles is
  'Heures réellement prestées par an. 1530 par défaut, PAS 1820 : congés, fériés, maladie, formation et trajets ne sont pas facturables.';

-- Le chantier fige le taux qui lui a été appliqué.
alter table dossiers add column if not exists mo_collaborateur_id bigint references collaborateurs(id);
alter table dossiers add column if not exists mo_taux_horaire     numeric;

alter table dossiers drop constraint if exists dossiers_mo_taux_positif_chk;
alter table dossiers add  constraint dossiers_mo_taux_positif_chk
  check (mo_taux_horaire is null or mo_taux_horaire >= 0);

comment on column dossiers.mo_taux_horaire is
  'Taux horaire FIGÉ au moment de la saisie. Il ne suit jamais la fiche employé : la main-d''oeuvre d''il y a trois ans ne change pas quand un salaire augmente.';
