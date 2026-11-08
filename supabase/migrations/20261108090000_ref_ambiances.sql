-- Le calendrier des ambiances : quelle ambiance, a quelles dates.
--
-- POURQUOI UNE TABLE PLUTOT QUE DES DATES EN DUR
--
-- `ambianceDuCalendrier()` portait les dates ecrites dans le code. Changer
-- « Noel commence le 1er decembre » demandait donc une PR, un build et un
-- deploiement — pour un reglage qui est une decision de gout, pas de code.
--
-- Cette table le rend parametrable depuis Parametres > Ambiances.
--
-- UN REGLAGE DE GROUPE, PAS UNE PREFERENCE PERSONNELLE
--
-- Regle donnee par Ludovic le 08/11 : « c'est un admin qui change pour tout
-- le monde ». Il n'y a donc PAS de choix par utilisateur — le selecteur a
-- ete retire de l'en-tete, et cette table est la seule source.
--
-- DEUX FACONS DE CHOISIR, ET UNE SEULE GAGNE
--
-- `forcee` : l'administrateur impose une ambiance, quelles que soient les
-- dates. Un index unique partiel garantit qu'il n'y en a jamais deux.
-- Aucune ligne forcee : c'est le calendrier qui decide, par les dates.
--
-- « Calendrier eteint » = aucune saison active. Les dates restent dans la
-- ligne meme quand `actif` est faux, donc rien n'est perdu en eteignant, et
-- rien n'est a ressaisir en rallumant.
--
-- LIVREE ETEINTE
--
-- Aucune ligne forcee, aucune saison active : le Hub reste en Standard tant
-- que personne n'a touche a Parametres. « L'activation automatique ne doit
-- pas s'imposer sans validation » — la validation, c'est ce clic.

create table if not exists public.ref_ambiances (
  code        text primary key,
  libelle     text not null,
  -- Mois et jour, sans annee : une saison revient chaque annee.
  debut_mois  smallint check (debut_mois between 1 and 12),
  debut_jour  smallint check (debut_jour between 1 and 31),
  fin_mois    smallint check (fin_mois between 1 and 12),
  fin_jour    smallint check (fin_jour between 1 and 31),
  actif       boolean  not null default false,
  -- Imposee par l'administrateur, calendrier ignore. Au plus une a la fois.
  forcee      boolean  not null default false,
  ordre       smallint not null default 0,
  maj_le      timestamptz not null default now()
);

comment on table public.ref_ambiances is
  'Ambiance du Hub, reglee par un administrateur pour tout le groupe. Une saison sans dates (Standard) est le repli.';

-- Deux ambiances imposees en meme temps n'auraient aucun sens, et le code
-- aurait a departager arbitrairement. La base s'en charge.
create unique index if not exists ref_ambiances_une_seule_forcee
  on public.ref_ambiances ((forcee)) where forcee;

-- Le catalogue. `on conflict do nothing` : rejouable, et surtout une
-- migration ne doit jamais ecraser des dates que quelqu''un a reglees.
insert into public.ref_ambiances (code, libelle, debut_mois, debut_jour, fin_mois, fin_jour, actif, forcee, ordre) values
  ('standard',  'Standard',   null, null, null, null, false, false, 1),
  ('noel',      'Noël',         12,    1,   12,   26, false, false, 2),
  ('nouvel-an', 'Nouvel An',    12,   27,    1,    6, false, false, 3),
  ('halloween', 'Halloween',    10,   24,   11,    2, false, false, 4),
  ('vacances',  'Vacances',      7,    1,    8,   31, false, false, 5)
on conflict (code) do nothing;

alter table public.ref_ambiances enable row level security;

-- Meme forme que `ref_modules` : tout le monde lit, l''administrateur ecrit.
-- Un calendrier d''ambiances n''est pas confidentiel, mais `anon` est le role
-- d''AVANT connexion et sa cle est dans ce depot public — il ne lit rien.
drop policy if exists ambiances_lecture on public.ref_ambiances;
create policy ambiances_lecture on public.ref_ambiances
  for select to authenticated using (true);

drop policy if exists ambiances_ecriture on public.ref_ambiances;
create policy ambiances_ecriture on public.ref_ambiances
  for all to authenticated using (is_admin()) with check (is_admin());

revoke all on table public.ref_ambiances from anon;
grant select on table public.ref_ambiances to authenticated;
grant insert, update, delete on table public.ref_ambiances to authenticated;
