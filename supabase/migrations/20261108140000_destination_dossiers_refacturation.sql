-- Destination analytique, dossiers, et refacturation.
--
-- POURQUOI TROIS CHOSES ET PAS UNE
--
-- Ludovic : « lorsqu'on achète, on doit pouvoir le lier à un chantier, un
-- dossier, une facture de vente ». Ce sont DEUX axes, pas un seul :
--
--   1. LA DESTINATION — pour qui / pour quoi la dépense a été faite.
--      C'est l'axe analytique. Il répond à « combien m'a coûté le chantier
--      Dricot », « combien me coûte le logement de Tongres ».
--
--   2. LA REFACTURATION — est-ce que ça a été revendu, et sur quelle facture.
--      C'est l'axe commercial. Il répond à « qu'est-ce que j'ai oublié de
--      facturer ».
--
-- Une facture de vente N'EST PAS une destination : c'est la preuve que la
-- destination a été refacturée. Les confondre casse le cas le plus courant —
-- un achat affecté à un chantier mais INCLUS DANS UN FORFAIT, donc jamais
-- refacturé. Sans l'état « inclus », l'écran « À refacturer » se remplit de
-- lignes qui n'ont rien à y faire, et plus personne ne l'ouvre.
--
-- POURQUOI destination_id EST DU TEXTE
--
-- Les cibles n'ont pas le même type de clé : clients.id est bigint,
-- lode_clients.id est uuid, dossiers.id est uuid. Une colonne polymorphe ne
-- peut donc être ni bigint ni uuid. Pas de clé étrangère possible non plus —
-- c'est la conséquence directe de « chaque entité reste séparée ». La
-- cohérence est tenue par un CHECK (type et id vont ensemble) et par le code.
--
-- POURQUOI LES DEUX COLONNES SONT AUSSI SUR transactions
--
-- Sur les projets immobiliers, beaucoup d'achats n'ont aucune facture : le
-- mouvement bancaire est le seul canal. Un modèle qui n'affecte qu'à partir
-- des factures laisserait ces projets sans analytique.
--
-- ⚠️ transactions N'A PAS de colonne societe — elle passe par compte_id.
-- Toute lecture par société doit joindre comptes_bancaires.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Séquences de numéros métier (générique, atomique)
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists numeros_sequences (
  type     text    not null,
  societe  text    not null,
  annee    int     not null,
  dernier  int     not null default 0,
  primary key (type, societe, annee)
);

alter table numeros_sequences enable row level security;

-- Personne ne lit ni n'écrit cette table directement : elle n'est touchée que
-- par la fonction ci-dessous, qui est SECURITY DEFINER.
revoke all on numeros_sequences from public, anon, authenticated;

create or replace function prochain_numero(
  p_type    text,
  p_societe text,
  p_prefixe text,
  p_annee   int default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee int := coalesce(p_annee, extract(year from current_date)::int);
  v_seq   int;
begin
  -- L'atomicité vient du ON CONFLICT : deux sessions simultanées ne peuvent
  -- pas obtenir le même numéro, contrairement à un max(numero)+1 lu puis écrit.
  insert into numeros_sequences (type, societe, annee, dernier)
  values (p_type, upper(p_societe), v_annee, 1)
  on conflict (type, societe, annee)
    do update set dernier = numeros_sequences.dernier + 1
  returning dernier into v_seq;

  return p_prefixe || '-' || v_annee || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke execute on function prochain_numero(text, text, text, int) from public, anon;
grant  execute on function prochain_numero(text, text, text, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Table dossiers
-- ─────────────────────────────────────────────────────────────────────────
--
-- Générique, avec societe. ZÉRO champ obligatoire côté terrain au-delà de la
-- société et d'un titre : JCL tient ses dossiers sur papier, et vouloir
-- structurer ses notes techniques le ferait arrêter. Elles entrent comme
-- pièces jointes, jamais comme colonnes.

create table if not exists dossiers (
  id           uuid primary key default gen_random_uuid(),
  societe      text not null,
  numero       text,
  titre        text not null,
  type         text,                      -- chantier, depannage, projet…
  statut       text not null default 'ouvert',

  -- Le client est polymorphe pour la même raison que destination_id :
  -- clients.id est bigint, lode_clients.id est uuid.
  client_type  text,                      -- 'client' (Dynassur) | 'lode_client'
  client_id    text,
  client_nom   text,                      -- recopié, pour lire sans jointure

  adresse      text,
  cp           text,
  ville        text,
  distance_km  numeric,                   -- stockée une fois, pas recalculée

  date_debut   date,
  date_fin     date,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint dossiers_client_coherent
    check ((client_type is null and client_id is null)
        or (client_type is not null and client_id is not null))
);

create index if not exists dossiers_societe_statut_idx on dossiers (societe, statut);
create index if not exists dossiers_client_idx          on dossiers (client_type, client_id);
create unique index if not exists dossiers_numero_uk    on dossiers (societe, numero) where numero is not null;

alter table dossiers enable row level security;

revoke all on dossiers from public, anon;
grant select, insert, update on dossiers to authenticated;

-- Cloisonnement : on reprend le modèle de modules déjà en place.
-- Pas de policy DELETE : un dossier se clôture, il ne se supprime pas.
drop policy if exists dossiers_lecture   on dossiers;
drop policy if exists dossiers_ecriture  on dossiers;
drop policy if exists dossiers_maj       on dossiers;

create policy dossiers_lecture  on dossiers for select to authenticated using (acces_compta(societe));
create policy dossiers_ecriture on dossiers for insert to authenticated with check (acces_compta(societe));
create policy dossiers_maj      on dossiers for update to authenticated
  using (acces_compta(societe)) with check (acces_compta(societe));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Destination — sur factures_achat ET transactions
-- ─────────────────────────────────────────────────────────────────────────
--
-- 'bien' est autorisé dès maintenant alors que la table biens n'existe pas
-- encore : le pivot « bien » est décidé (locatif, projets immobiliers), et
-- destination_id étant du texte, l'autoriser ne coûte rien. La table viendra
-- avec le module locatif.

do $$
declare t text;
begin
  foreach t in array array['factures_achat', 'transactions'] loop
    execute format('alter table %I add column if not exists destination_type text', t);
    execute format('alter table %I add column if not exists destination_id   text', t);
    execute format('alter table %I add column if not exists destination_nom  text', t);

    execute format('alter table %I drop constraint if exists %I', t, t || '_destination_type_chk');
    execute format($f$alter table %I add constraint %I
      check (destination_type is null or destination_type in
             ('tiers','bien','dossier','structure','consommable'))$f$, t, t || '_destination_type_chk');

    -- 'structure' et 'consommable' ne désignent pas un objet : ils n'ont pas
    -- d'identifiant. Les trois autres en ont un obligatoirement, sinon
    -- l'affectation ne mène nulle part et se lit pourtant comme faite.
    execute format('alter table %I drop constraint if exists %I', t, t || '_destination_id_chk');
    execute format($f$alter table %I add constraint %I
      check (destination_type is null
          or (destination_type in ('structure','consommable') and destination_id is null)
          or (destination_type in ('tiers','bien','dossier')  and destination_id is not null))$f$,
      t, t || '_destination_id_chk');

    execute format('create index if not exists %I on %I (destination_type, destination_id)',
                   t || '_destination_idx', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Refacturation — sur factures_achat seulement
-- ─────────────────────────────────────────────────────────────────────────
--
-- Pas de clé étrangère vers la facture de vente : elle vit dans la table de
-- sa société (lode_factures aujourd'hui, dtx_* / dyn_* demain). Le couple
-- (societe, id) est un lien mou, et c'est voulu — une FK polymorphe
-- n'existe pas en Postgres.

alter table factures_achat add column if not exists refacture_statut    text;
alter table factures_achat add column if not exists refacture_societe   text;
alter table factures_achat add column if not exists refacture_facture_id uuid;

alter table factures_achat drop constraint if exists factures_achat_refacture_statut_chk;
alter table factures_achat add  constraint factures_achat_refacture_statut_chk
  check (refacture_statut is null or refacture_statut in
         ('a_refacturer',      -- doit être revendu, ne l'est pas encore
          'refacture',         -- revendu : refacture_facture_id dit où
          'inclus',            -- compris dans un forfait, jamais refacturé seul
          'non_refacturable'));-- frais propre, ne sera jamais revendu

-- Un statut « refacturé » sans facture en face est une affirmation sans preuve.
alter table factures_achat drop constraint if exists factures_achat_refacture_preuve_chk;
alter table factures_achat add  constraint factures_achat_refacture_preuve_chk
  check (refacture_statut is distinct from 'refacture'
      or (refacture_societe is not null and refacture_facture_id is not null));

create index if not exists factures_achat_refacture_idx
  on factures_achat (societe, refacture_statut)
  where refacture_statut = 'a_refacturer';

comment on column factures_achat.refacture_statut is
  'a_refacturer | refacture | inclus | non_refacturable. Null = pas encore tranché.';
