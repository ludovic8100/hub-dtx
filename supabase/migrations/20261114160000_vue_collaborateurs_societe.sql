-- QUI TRAVAILLE POUR UNE SOCIÉTÉ — ce qui n'est PAS « qui a le droit d'ouvrir
-- son module dans le Hub » (14/11/2026)
-- ---------------------------------------------------------------------------
--
-- Signalé par Ludovic : dans un chantier LODE, la liste « Commercial » ne
-- montrait plus qu'une seule personne, et seulement sur les chantiers où elle
-- était déjà inscrite.
--
-- Mesuré : l'écran filtrait sur `collaborateurs.acc_lode`, et sur
-- **31 collaborateurs actifs, 2 seulement** l'ont à true. Les deux commerciaux
-- LODE l'ont à false — ils n'ont tout simplement pas besoin d'ouvrir l'écran
-- LODE pour vendre. Ce que l'écran affichait n'était donc pas une liste de
-- commerciaux, c'était une liste d'ayants droit, et personne ne pouvait le
-- deviner.
--
-- ⚠️ Donner `acc_lode` aux commerciaux aurait « réglé » l'affichage en
-- élargissant un DROIT D'ACCÈS. C'est le geste à ne pas faire : les deux
-- notions doivent rester séparées.
--
-- La bonne source existait déjà : `collaborateur_societes` dit, pour LODE,
-- qui est commercial et qui est gestionnaire.
--
-- ⚠️ POURQUOI UNE VUE ET PAS LA TABLE. `collaborateur_societes` porte
-- `brut_mensuel`, `prime_annuelle`, `honoraires_mensuels`, `vehicule_mensuel`,
-- et sa policy de lecture est `USING (true)` pour tout compte connecté. La
-- faire lire par un écran de chantier exposerait la rémunération à qui ouvre
-- l'onglet réseau du navigateur. La vue ne rend que ce dont l'écran a besoin —
-- c'est la règle d'exposition du projet : colonnes listées une par une,
-- jamais `select *`, jamais `to_jsonb()`.
--
-- (Le trou de fond reste entier : cette policy `USING (true)` sur les
-- rémunérations est à traiter avec le chantier des droits. Un seul brut est
-- renseigné aujourd'hui, donc rien de sérieux ne fuit — mais c'est de la
-- chance, pas une protection.)
--
-- Les lignes sans `code` sont écartées ici : `dossiers.responsable` stocke un
-- code, une ligne sans code ne pourrait jamais être choisie. Il y en a deux
-- chez LODE, dont un doublon d'un collaborateur sous une autre graphie.
--
-- `create or replace` et non `drop` + `create` : les colonnes ajoutées le sont
-- en fin de liste, ce que Postgres accepte sans supprimer la vue.

create or replace view public.v_collaborateurs_societe as
select cs.societe,
       c.code,
       c.nom_complet,
       cs.fonction,
       c.id,
       c.cout_horaire
from collaborateur_societes cs
join collaborateurs c on c.id = cs.collaborateur_id
where coalesce(cs.actif, true) and coalesce(c.actif, false) and c.code is not null;

-- ⚠️ `create or replace view` réarme les privilèges par défaut de Supabase :
-- sans ces lignes, `anon` retrouve le droit de lecture. Les deux révocations
-- sont nécessaires — PUBLIC et anon tiennent le droit séparément.
revoke all   on public.v_collaborateurs_societe from public, anon;
grant  select on public.v_collaborateurs_societe to authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.v_collaborateurs_societe', 'select') then
    raise exception 'anon peut encore lire v_collaborateurs_societe';
  end if;
end $$;
