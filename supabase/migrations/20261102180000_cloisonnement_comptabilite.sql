-- Cloisonne la comptabilité par société — APPLIQUÉE EN PRODUCTION le 02/11/2026.
--
-- Avant : TOUT utilisateur connecté pouvait lire comptes_bancaires,
-- transactions, transaction_ventilation et factures_achat. Leurs policies
-- étaient USING (true) pour le rôle `authenticated` — c'est pourquoi elles
-- n'apparaissaient pas dans le lot des 49 tables ouvertes à `anon` fermées le
-- matin même. L'interface bloquait, pas la base : un appel direct à l'API
-- suffisait pour lire la comptabilité des six entités, comptes privés compris.
--
-- Après : on ne voit la comptabilité d'une société que si on a le module
-- « comptabilite » sur cette société dans collaborateur_acces — la table créée
-- le même jour par 20261102160000_modele_modules_catalogue.sql. C'est son
-- premier usage réel.
--
-- Un administrateur du Hub voit tout, PRIVE compris. Une exception avait été
-- posée puis retirée dans la foulée : décision assumée du dirigeant, une règle
-- vaut mieux qu'un cas particulier.
--
-- Vérifié après application, en simulant trois sessions :
--   bhu@dynassur.be  (gestionnaire Dynassur, sans compta) → 0 / 0 / 0
--   rudy@rhassur.be  (compta Hexagroup uniquement)        → 1 compte, 78 opérations, 589 factures
--   gael@dynassur.be (administrateur)                     → 13 / 6 582 / 7 519

create or replace function public.a_module(p_module text, p_societe text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from collaborateur_acces a
      join collaborateurs c on c.id = a.collaborateur_id
     where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and c.compte_hub_actif
       and a.module_code = p_module
       and a.societe = p_societe
  );
$$;

create or replace function public.acces_compta(p_societe text)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or (p_societe is not null and a_module('comptabilite', p_societe));
$$;

-- Société d'un compte bancaire, lue sans repasser par les RLS : évite toute
-- récursion entre les policies de transactions et de comptes_bancaires.
create or replace function public.acces_compta_compte(p_compte uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select acces_compta((select cb."ENTITE" from comptes_bancaires cb where cb.id = p_compte));
$$;

grant execute on function public.a_module(text, text)      to authenticated;
grant execute on function public.acces_compta(text)        to authenticated;
grant execute on function public.acces_compta_compte(uuid) to authenticated;

-- comptes_bancaires
-- pol_comptes_admin s'appuyait sur get_role(), qui lit une table `utilisateurs`
-- héritée d'un ancien modèle. Policy permissive : elle aurait annulé toute
-- restriction, quelle que soit la nouvelle règle.
drop policy if exists pol_comptes_admin on public.comptes_bancaires;
drop policy if exists comptes_bancaires_select_auth on public.comptes_bancaires;

create policy comptes_lecture on public.comptes_bancaires
  for select to authenticated using (acces_compta("ENTITE"));
create policy comptes_ecriture on public.comptes_bancaires
  for all to authenticated using (acces_compta("ENTITE")) with check (acces_compta("ENTITE"));

-- transactions (pas de colonne societe : le rattachement passe par le compte)
drop policy if exists "Lecture transactions" on public.transactions;
drop policy if exists "Update transactions categorie" on public.transactions;
drop policy if exists "Insert transactions" on public.transactions;

create policy transactions_lecture on public.transactions
  for select to authenticated using (acces_compta_compte(compte_id));
create policy transactions_ecriture on public.transactions
  for all to authenticated using (acces_compta_compte(compte_id)) with check (acces_compta_compte(compte_id));

-- transaction_ventilation : suit la transaction, dont la policy filtre déjà
drop policy if exists "Lecture ventilation" on public.transaction_ventilation;
drop policy if exists "Ecriture ventilation" on public.transaction_ventilation;

create policy ventilation_acces on public.transaction_ventilation
  for all to authenticated
  using (exists (select 1 from transactions t where t.id = transaction_ventilation.transaction_id))
  with check (exists (select 1 from transactions t where t.id = transaction_ventilation.transaction_id));

-- factures_achat (societe : DYNASSUR, DTX, HEXAGROUP, LODE, PRIVE — aucun null)
drop policy if exists allow_all_factures_achat on public.factures_achat;
drop policy if exists ff_select on public.factures_achat;
drop policy if exists "Update factures_achat" on public.factures_achat;

create policy factures_achat_lecture on public.factures_achat
  for select to authenticated using (acces_compta(societe));
create policy factures_achat_ecriture on public.factures_achat
  for all to authenticated using (acces_compta(societe)) with check (acces_compta(societe));
