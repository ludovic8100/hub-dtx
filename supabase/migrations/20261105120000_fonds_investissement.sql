-- Les fonds branche 23, par compagnie — en base, plus en dur dans le code.
--
-- POURQUOI CETTE TABLE EXISTE
--
-- Le niveau de risque des fonds vivait dans un objet JavaScript de cinquante
-- lignes, au milieu d'un composant React. Conséquence directe, constatée le
-- 05/11/2026 : « BR 21 » n'y figurait pas, aucun motif ne le rattrapait, et
-- le cas par défaut valait 50 — c'est-à-dire « profil neutre ». Une épargne
-- à capital garanti ressortait en profil équilibré.
--
-- Une liste de référence qui change (les compagnies ouvrent et ferment des
-- fonds) n'a rien à faire dans un fichier qu'il faut déployer pour corriger.
--
-- CE QU'ON STOCKE : LE SRI, PAS UN BARÈME MAISON
--
-- Le SRI (indicateur synthétique de risque, 1 à 7) est défini par le
-- règlement PRIIPs. Il est calculé par la compagnie, publié dans le document
-- d'informations clés de chaque fonds, daté et opposable. C'est lui la
-- donnée de référence.
--
-- `risque` (0 à 100) n'est qu'une commodité de calcul, pour pondérer une
-- composition de plusieurs fonds. Il est dérivé du SRI quand le SRI est
-- connu. Il ne doit jamais être présenté au client comme un indicateur.
--
-- COMMENT ELLE SE REMPLIT
--
-- Pas par un catalogue importé une fois puis périmé : par l'usage. Quand le
-- questionnaire rencontre un fonds inconnu, il le dit et propose de
-- l'enregistrer. Après quelques dizaines de dossiers, la table couvre le
-- portefeuille réel — qui est beaucoup plus petit que le catalogue des
-- compagnies.
--
-- La source de vérité pour un import en masse est le « règlement de gestion
-- des fonds branche 23 » que chaque compagnie publie : un document unique
-- qui liste tous ses fonds. Celui de Baloise en annonce 29.

begin;

create table if not exists public.fonds_investissement (
  id              bigint generated always as identity primary key,
  compagnie       text not null,
  nom             text not null,
  -- Clé de recherche : minuscules, sans accent, espaces normalisés. C'est la
  -- forme sur laquelle le questionnaire fait sa correspondance, parce que le
  -- nom saisi à la main ne sera jamais écrit deux fois pareil.
  nom_normalise   text not null,
  -- 1 à 7, tel que publié dans le DIC du fonds. Null tant qu'on ne l'a pas
  -- lu — on ne devine pas un indicateur réglementaire.
  sri             smallint check (sri between 1 and 7),
  -- 0 (capital garanti) à 100 (actions pures). Dérivé du SRI, ou saisi à la
  -- main pour les fonds dont on n'a pas encore le DIC.
  risque          smallint check (risque between 0 and 100),
  -- 'garanti' : branche 21/26, pas de risque de marché.
  -- 'fonds'   : branche 23.
  categorie       text not null default 'fonds' check (categorie in ('garanti', 'fonds')),
  isin            text,
  -- D'où vient la valeur. 'heritee_code' = reprise de l'ancien objet
  -- JavaScript, jamais vérifiée contre un document : à confirmer.
  source          text not null default 'saisie'
                  check (source in ('dic', 'reglement_gestion', 'saisie', 'heritee_code')),
  verifie_le      date,
  verifie_par     text,
  actif           boolean not null default true,
  commentaire     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Un fonds porte parfois le même nom chez deux compagnies (« Balanced »,
-- « Growth »), avec des compositions différentes. La clé est donc le couple.
create unique index if not exists fonds_investissement_cle
  on public.fonds_investissement (compagnie, nom_normalise);

create index if not exists fonds_investissement_recherche
  on public.fonds_investissement (nom_normalise) where actif;

comment on table public.fonds_investissement is
  'Fonds branche 23 par compagnie, avec leur SRI (1-7). Alimente le calcul du '
  'profil investisseur. Se remplit par l''usage : un fonds inconnu rencontré '
  'dans le questionnaire est proposé à l''enregistrement.';

-- ── Normalisation : la même règle qu'en JavaScript ───────────────────────
-- src/lib/fondsRisque.js fait exactement ceci côté front. Les deux doivent
-- rester d'accord, sinon une recherche trouve en base ce que l'écran ne
-- trouve pas.
-- translate() plutot que l'extension unaccent : deterministe, immutable, et
-- sans dependance a un dictionnaire qui peut differer entre deux bases.
create or replace function public.normaliser_nom_fonds(p_nom text)
returns text language sql immutable as $$
  select regexp_replace(
           lower(trim(translate(coalesce(p_nom, ''),
             'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'))),
           '\s+', ' ', 'g')
$$;

create or replace function public.fonds_investissement_avant_ecriture()
returns trigger language plpgsql as $$
begin
  new.nom_normalise := public.normaliser_nom_fonds(new.nom);
  new.updated_at := now();
  -- Le barème interne se déduit du SRI quand il est connu, et n'est jamais
  -- écrasé s'il a été saisi à la main sans SRI.
  if new.sri is not null then
    new.risque := case new.sri
      when 1 then 0 when 2 then 12 when 3 then 30 when 4 then 50
      when 5 then 70 when 6 then 85 else 95 end;
  end if;
  if new.categorie = 'garanti' then
    new.risque := 0;
  end if;
  return new;
end $$;

drop trigger if exists trg_fonds_investissement on public.fonds_investissement;
create trigger trg_fonds_investissement
  before insert or update on public.fonds_investissement
  for each row execute function public.fonds_investissement_avant_ecriture();

-- ── Droits ───────────────────────────────────────────────────────────────
-- Référence partagée : lisible par tout utilisateur connecté, comme
-- `compagnies`. L'écriture suit la même règle pour l'instant — c'est la
-- personne qui encode un questionnaire qui rencontre un fonds manquant.
-- À resserrer avec le chantier des droits (docs/DROITS-ACCES.md).
alter table public.fonds_investissement enable row level security;

drop policy if exists fonds_investissement_lecture on public.fonds_investissement;
drop policy if exists fonds_investissement_ecriture on public.fonds_investissement;

create policy fonds_investissement_lecture on public.fonds_investissement
  for select using ((select auth.uid()) is not null);
create policy fonds_investissement_ecriture on public.fonds_investissement
  for all using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

commit;
