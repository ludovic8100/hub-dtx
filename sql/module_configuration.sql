-- =====================================================================
--  MODULE CONFIGURATION — Hub DTX
--  À exécuter dans Supabase > SQL Editor (une seule fois).
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

-- 1) ───────── Étendre la table societes (coordonnées + paramètres doc) ─────────
alter table societes add column if not exists entite_key            text;   -- 'lode' | 'dtx' | 'dyn' (lien vers les modules devis)
alter table societes add column if not exists activite              text;
alter table societes add column if not exists cp                    text;
alter table societes add column if not exists ville                 text;
alter table societes add column if not exists pays                  text default 'Belgique';
alter table societes add column if not exists bic                   text;
alter table societes add column if not exists telephone             text;
alter table societes add column if not exists email_expediteur      text;
alter table societes add column if not exists email_cc              text;
alter table societes add column if not exists cgv                   text;   -- une clause par ligne
alter table societes add column if not exists delai_paiement_jours  integer default 30;
alter table societes add column if not exists tva_taux_defaut       integer default 21;

-- 2) ───────── Pré-remplir les 3 sociétés émettrices de devis ─────────
update societes set
  entite_key='lode', activite=coalesce(activite,''),
  adresse=coalesce(nullif(adresse,''),'Chaussée de Tongres 474'),
  cp='4450', ville='Juprelle', pays='Belgique',
  iban_principal=coalesce(nullif(iban_principal,''),'BE40 3632 4445 2063'),
  bic=coalesce(bic,'BBRUBEBB'),
  email_expediteur='info@lode-group.be', email_cc='contact@lode-group.be'
where code='LODE';

update societes set
  entite_key='dtx', activite=coalesce(activite,''),
  adresse=coalesce(nullif(adresse,''),'Chaussée de Tongres 489'),
  cp='4450', ville='Juprelle', pays='Belgique',
  iban_principal=coalesce(nullif(iban_principal,''),'BE26 7320 6295 0829'),
  email_expediteur='info@dtx-group.be'
where code='DTX';

update societes set
  entite_key='dyn', activite=coalesce(activite,''),
  adresse=coalesce(nullif(adresse,''),'Chaussée de Tongres 489'),
  cp='4450', ville='Juprelle', pays='Belgique',
  email_expediteur='info@dynassur.be'
where code='DYNASSUR';

-- 3) ───────── Colonnes d'accès « Devis & Factures » dans user_permissions ─────────
alter table user_permissions add column if not exists lode_devis boolean default false;
alter table user_permissions add column if not exists dtx_devis  boolean default false;
alter table user_permissions add column if not exists dyn_devis  boolean default false;
-- les admins y ont accès d'office (le menu les affiche déjà pour role='admin')
update user_permissions set lode_devis=true, dtx_devis=true, dyn_devis=true where role='admin';

-- 4) ───────── Helper sécurité : l'utilisateur courant est-il admin actif ? ─────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from user_permissions
    where lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin' and actif = true
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- 5) ───────── RLS : lecture pour tous les connectés, écriture réservée aux admins ─────────
alter table societes enable row level security;
drop policy if exists societes_select_auth on societes;
drop policy if exists societes_write_admin on societes;
create policy societes_select_auth on societes for select to authenticated using (true);
create policy societes_write_admin  on societes for all   to authenticated using (is_admin()) with check (is_admin());

alter table user_permissions enable row level security;
drop policy if exists up_select_auth  on user_permissions;
drop policy if exists up_write_admin  on user_permissions;
create policy up_select_auth on user_permissions for select to authenticated using (true);
create policy up_write_admin on user_permissions for all   to authenticated using (is_admin()) with check (is_admin());

-- 6) ───────── Storage : upload/maj des logos réservé aux admins (lecture publique inchangée) ─────────
drop policy if exists logos_insert_admin on storage.objects;
drop policy if exists logos_update_admin on storage.objects;
create policy logos_insert_admin on storage.objects for insert to authenticated with check (bucket_id='logos' and is_admin());
create policy logos_update_admin on storage.objects for update to authenticated using (bucket_id='logos' and is_admin()) with check (bucket_id='logos' and is_admin());

-- =====================================================================
--  Fin. Vérif rapide :
--    select code, entite_key, cp, ville, bic, email_expediteur from societes order by code;
-- =====================================================================
