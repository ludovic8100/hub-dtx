-- =====================================================================
-- HUB DTX — Table sinistres (source : BRIO Analytics Qlik, table Damage)
-- Grain : 1 ligne par sinistre (Pointeur sinistre). Montants agrégés.
-- Alimentée quotidiennement par scripts/qlik_sync.py (GitHub Action).
-- =====================================================================
create table if not exists public.sinistres (
  pointeur_sinistre    text primary key,
  reference_sinistre   text,
  reference_producteur text,
  police_objet_lien    text,
  date_survenance      date,
  date_ouverture       date,
  date_etat            date,
  etat                 text,
  etat_code            text,
  responsabilite       text,
  domaine              text,
  garantie             text,
  gestionnaire         text,
  sinistre_nom         text,
  description          text,
  montant_a_payer      numeric default 0,
  montant_paye         numeric default 0,
  montant_attente      numeric default 0,
  montant_reserve      numeric default 0,
  montant_recours      numeric default 0,
  annee                int,
  source               text default 'qlik_brio',
  imported_at          timestamptz default now()
);

create index if not exists idx_sinistres_etat        on public.sinistres(etat_code);
create index if not exists idx_sinistres_gestionnaire on public.sinistres(gestionnaire);
create index if not exists idx_sinistres_annee        on public.sinistres(annee);
create index if not exists idx_sinistres_police       on public.sinistres(police_objet_lien);

alter table public.sinistres enable row level security;
drop policy if exists sinistres_read on public.sinistres;
create policy sinistres_read on public.sinistres for select using (true);
grant select on public.sinistres to anon, authenticated;
