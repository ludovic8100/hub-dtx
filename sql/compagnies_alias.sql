-- ════════════════════════════════════════════════════════════════════════════
-- Référentiel d'alias compagnie — fin de l'indexation sur du texte libre
-- ════════════════════════════════════════════════════════════════════════════
-- Appliqué le 01/11/2026. Reflet de l'état en production.
--
-- PROBLÈME. `bordereaux.compagnie` vient du nom de fichier, donc du texte libre.
-- Sur 4 687 documents on trouvait : 9 groupes de doublons purement orthographiques
-- (DAS/D.A.S, BT-TB/BT -TB/BT - TB, ALPHA CREDIT/ALPHACREDIT, EB-LEASE/EB - LEASE…),
-- des fautes (VIIVIUM, VIVUM, AVISE, TMV, EUROP ASSISATNCE…), des numéros de compte
-- collés au nom (AG - 58824, TVM - 7046484) et des compagnies absentes du référentiel.
-- Chaque variante produisait une « compagnie » distincte dans les agrégats : des
-- chiffres éclatés, sans que rien ne le signale.
--
-- SOLUTION. Une table d'alias (libellé observé -> compagnie) et une vraie clé
-- étrangère `bordereaux.compagnie_id`. Les imports futurs s'appuient sur un
-- identifiant, plus jamais sur du texte. Ajouter une variante = une ligne.
--
-- PRINCIPE. Ce qui n'est pas résolu reste VISIBLE (compagnie_id null) plutôt que
-- de créer une compagnie fantôme. Un trou qu'on voit vaut mieux qu'un chiffre faux.

create table public.compagnies_alias (
  id            bigserial primary key,
  libelle       text not null,
  libelle_cle   text generated always as (upper(regexp_replace(libelle, '[^A-Za-z0-9]', '', 'g'))) stored,
  compagnie_id  uuid references public.compagnies(id) on delete set null,
  source        text not null default 'bordereaux',
  note          text,
  cree_le       timestamptz not null default now()
);
create unique index idx_cal_cle on public.compagnies_alias (libelle_cle);

alter table public.bordereaux add column if not exists compagnie_id uuid references public.compagnies(id);
create index idx_bordereaux_compagnie_id on public.bordereaux (compagnie_id);

-- Peuplement : tous les libellés réellement observés, sans en inventer aucun.
insert into public.compagnies_alias (libelle)
select distinct compagnie from public.bordereaux
where compagnie is not null and trim(compagnie) <> ''
on conflict (libelle_cle) do nothing;

-- Rattachements automatiques, par ordre de certitude décroissante :
--   1. la clé correspond au code d'une compagnie
--   2. idem après retrait d'un numéro de compte en fin de libellé
--   3. la clé correspond au nom complet d'une compagnie
--   4. fautes de frappe listées explicitement (voir migration alias_fautes_de_frappe)
-- Résultat au 01/11/2026 : 4 058 / 4 687 documents rattachés (86,6 %).
--
-- NE SONT PAS traités automatiquement, car ils demandent une décision humaine :
--   • abréviations maison : VDH (70 docs), HP (36), BDM (35), HYPO (29), LAR (22),
--     VS (7), DLL (4), GDMC INVEST, « 03 »
--   • compagnies absentes du référentiel : LEGAL VILLAGE (101), ARCES (65),
--     CARES ASSISTANCE (51), PROTECT (27), STATER (12+10), FIDEA (10), KREFIMA,
--     RECORD CREDITS, ETHIAS, AVANSSUR, KUTTU, SANTEVET, FCGB
--   • DYNASSUR (85 docs) : notre propre nom — relevés internes, pas une compagnie
--   • P&V (12) : à rattacher à Vivium ou à garder distinct, selon l'usage métier

alter table public.compagnies_alias enable row level security;
create policy ca_read  on public.compagnies_alias for select to authenticated using (true);
create policy ca_libre on public.compagnies_alias for all to anon using (true) with check (true);
