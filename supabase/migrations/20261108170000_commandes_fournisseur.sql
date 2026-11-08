-- Les commandes fournisseur, et pourquoi elles portent l'affectation.
--
-- LE PROBLÈME, DIT PAR LUDOVIC
--
-- « JCL commande pour des chantiers et je ne sais pas les relier aux
-- factures ». La commande vit dans une boîte mail, la facture arrive des
-- semaines plus tard, et entre les deux personne ne se souvient de rien.
--
-- CE QUE LA MESURE A MONTRÉ (3 factures Winsol lues le 08/11)
--
--   N°d'ordre:        05-02-1444-6 · 05-01-1289-6 · 85-01-2095-6   → 3/3
--   Chantier:         TONGRES 120  · (absent)     · TONGRES 474    → 2/3
--   Votre référence:  SCREENS EXACTE · KINÉ · 81222                → 3/3, inutilisable
--
-- « Votre référence » est le champ que JCL remplit à la main. Ses valeurs
-- désignent successivement un produit, un surnom et un nombre. Elle est donc
-- conservée POUR INFORMATION et n'est JAMAIS une clé d'attribution — même
-- règle que le code sous-agent des bordereaux.
--
-- CORRECTION DU 08/11, APRES LECTURE DU BON DE COMMANDE
--
-- J'ai d'abord cru que le N d'ordre de la facture etait la cle. C'est faux :
-- Winsol porte DEUX identifiants differents.
--
--   Bon de commande : Ref. Winsol  05EM26-0352-02-802601
--   Facture         : N d'ordre    05-01-1289-6
--
-- Les deux ne se correspondent pas. Ce qui relie reellement les deux
-- documents, c'est le couple (Ref. Client + montant au centime) :
--
--   Bon de commande : Ref. Client KINE - 1 824,95 EUR TTC
--   Facture 1012196 : Votre ref.  KINE - 1 824,96 EUR
--
-- Le numero d'ordre reste stocke (il regroupe entre elles les factures d'une
-- meme commande : acompte 50 % puis solde) mais il ne relie pas la facture
-- au bon de commande.
--
-- POURQUOI ON AFFECTE LA COMMANDE ET PAS LA FACTURE
--
-- Winsol facture en acompte, par article : une commande produit plusieurs
-- factures, plus les suppléments et les notes de crédit. Affecter facture par
-- facture, c'est reposer la même question cinq fois — et la reposer encore
-- dans trois mois, quand le solde arrivera. Affecter la commande une fois
-- suffit : toutes ses factures suivent, y compris celles qui n'existent pas
-- encore.
--
-- POURQUOI LA FACTURE NE RECOPIE PAS LA DESTINATION
--
-- Une copie se périme dès qu'on corrige la commande. La résolution se fait
-- donc à la lecture, par `v_factures_destination` : la destination propre de
-- la facture l'emporte (cas d'un achat sans commande), sinon celle de sa
-- commande.

-- D'OU VIENNENT LES COMMANDES : DE LA BOITE MAIL, PAS D'UNE SAISIE
--
-- Mesure le 08/11 : JCL envoie DEJA un mail par dossier a info@lode-group.be.
-- Objet « dDossier client MONDY », corps « Le prix pour le client est de
-- 2348.73 EUR htva », pieces jointes « Bon de commande winsol ref kine.pdf »
-- et « Accord du client signe.pdf ».
--
-- Tout ce dont le Hub a besoin existe donc deja, et personne ne le lit. On ne
-- demande aucune habitude nouvelle a JCL : on arrete d'ignorer la sienne.
--
-- Ce que ce dossier a coute de ne pas etre suivi :
--   cout Winsol 1 824,96 (facture impayee) - a facturer 2 841,96 TTC
--   - encaisse 840,00 - facture de vente : AUCUNE => 2 001,96 jamais reclames.
--
-- L'objet du mail est du texte libre, et celui-ci porte une coquille
-- (« dDossier »). Le rapprochement du nom de client sera donc imparfait : une
-- validation humaine par dossier est prevue. Une par dossier est tenable, une
-- par facture ne l'est pas.

create table if not exists commandes (
  id              uuid primary key default gen_random_uuid(),
  societe         text not null,
  fournisseur     text,
  fournisseur_id  uuid,

  -- La clé du fournisseur, telle qu'elle apparaît sur sa facture.
  numero_ordre    text not null,
  -- Ce que la personne a tapé à la commande. Information, jamais clé.
  reference       text,
  -- La ligne « Chantier: » du fournisseur — une adresse de livraison.
  -- Sert à PROPOSER une destination, jamais à la décider seule.
  chantier_texte  text,

  destination_type text,
  destination_id   text,
  destination_nom  text,

  -- Le client, polymorphe comme ailleurs (clients.id bigint, lode_clients.id uuid).
  client_type     text,
  client_id       text,
  client_nom      text,

  statut          text not null default 'ouverte',
  date_commande   date,
  -- Ce que la commande coute, lu sur le bon de commande.
  montant_commande   numeric,
  -- Ce qu'il faut facturer au client, lu dans le corps du mail de JCL.
  -- C'est CE chiffre qui manque aujourd'hui, et c'est lui qui chiffre l'oubli.
  montant_a_facturer numeric,
  montant_estime  numeric,

  -- Tracabilite de la source : le mail et ses deux pieces maitresses.
  source_mail_id    text,
  bon_commande_url  text,
  accord_client_url text,

  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint commandes_destination_type_chk
    check (destination_type is null or destination_type in
           ('tiers','bien','dossier','structure','consommable')),
  constraint commandes_destination_id_chk
    check (destination_type is null
        or (destination_type in ('structure','consommable') and destination_id is null)
        or (destination_type in ('tiers','bien','dossier')  and destination_id is not null)),
  constraint commandes_statut_chk
    check (statut in ('ouverte','livree','soldee','annulee'))
);

-- Un même numéro d'ordre peut exister chez deux fournisseurs différents :
-- l'unicité porte sur le triplet, jamais sur le numéro seul.
create unique index if not exists commandes_cle_uk
  on commandes (societe, coalesce(fournisseur,''), numero_ordre);
create index if not exists commandes_destination_idx on commandes (destination_type, destination_id);
create index if not exists commandes_societe_statut_idx on commandes (societe, statut);

alter table commandes enable row level security;
revoke all on commandes from public, anon;
grant select, insert, update on commandes to authenticated;

drop policy if exists commandes_lecture  on commandes;
drop policy if exists commandes_ecriture on commandes;
drop policy if exists commandes_maj      on commandes;
create policy commandes_lecture  on commandes for select to authenticated using (acces_compta(societe));
create policy commandes_ecriture on commandes for insert to authenticated with check (acces_compta(societe));
create policy commandes_maj      on commandes for update to authenticated
  using (acces_compta(societe)) with check (acces_compta(societe));

-- Ce que le lecteur PDF rapporte désormais de la facture elle-même.
alter table factures_achat add column if not exists commande_id          uuid references commandes(id);
alter table factures_achat add column if not exists numero_ordre         text;
alter table factures_achat add column if not exists reference_fournisseur text;
alter table factures_achat add column if not exists chantier_texte       text;

create index if not exists factures_achat_commande_idx     on factures_achat (commande_id);
create index if not exists factures_achat_numero_ordre_idx on factures_achat (societe, numero_ordre)
  where numero_ordre is not null;

comment on column factures_achat.reference_fournisseur is
  'Champ « Votre référence » du fournisseur. INFORMATION SEULEMENT — mesuré le 08/11 : valeurs « SCREENS EXACTE », « KINÉ », « 81222 ». Jamais une clé d''attribution.';
comment on column factures_achat.numero_ordre is
  'Champ « N°d''ordre » du fournisseur. C''est LA clé qui relie la facture à sa commande.';

-- Rattache une facture à sa commande, en créant la commande si elle manque.
-- Appelée par le lecteur PDF, et utilisable à la main depuis le Hub.
-- Ne touche JAMAIS à la destination de la commande : une commande déjà
-- affectée garde son affectation quand une nouvelle facture lui arrive.
create or replace function rattacher_facture_commande(
  p_facture_id    bigint,
  p_numero_ordre  text,
  p_fournisseur   text default null,
  p_reference     text default null,
  p_chantier      text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_societe text;
  v_cmd     uuid;
begin
  if p_numero_ordre is null or btrim(p_numero_ordre) = '' then
    return null;
  end if;

  select societe into v_societe from factures_achat where id = p_facture_id;
  if v_societe is null then
    return null;
  end if;

  select id into v_cmd from commandes
   where societe = v_societe
     and coalesce(fournisseur,'') = coalesce(p_fournisseur,'')
     and numero_ordre = p_numero_ordre;

  if v_cmd is null then
    insert into commandes (societe, fournisseur, numero_ordre, reference, chantier_texte)
    values (v_societe, p_fournisseur, p_numero_ordre, p_reference, p_chantier)
    returning id into v_cmd;
  else
    -- On comble les vides, on n'écrase pas : la commande peut avoir été
    -- corrigée à la main, et une facture plus récente n'a pas à défaire ça.
    update commandes
       set reference      = coalesce(reference, p_reference),
           chantier_texte = coalesce(chantier_texte, p_chantier),
           updated_at     = now()
     where id = v_cmd;
  end if;

  update factures_achat set commande_id = v_cmd where id = p_facture_id;
  return v_cmd;
end;
$$;

revoke execute on function rattacher_facture_commande(bigint, text, text, text, text) from public, anon;
grant  execute on function rattacher_facture_commande(bigint, text, text, text, text) to authenticated, service_role;

-- La destination effective d'une facture : la sienne si elle en a une,
-- sinon celle de sa commande. Résolue à la lecture, jamais recopiée.
--
-- Colonnes listées explicitement — règle d'exposition du Hub. Pas de
-- security_invoker ici : la vue ne sert qu'à l'intérieur, et le poser a déjà
-- fait dépasser 25 s sur v_factures_impayees.
create or replace view v_factures_destination as
select
  f.id,
  f.fichier_id,
  f.societe,
  f.sens,
  f.nom,
  f.fournisseur,
  f.numero,
  f.date_facture,
  f.montant,
  f.commande_id,
  f.numero_ordre,
  f.reference_fournisseur,
  c.numero_ordre                                      as commande_numero_ordre,
  c.statut                                            as commande_statut,
  coalesce(f.destination_type, c.destination_type)    as destination_type,
  coalesce(f.destination_id,   c.destination_id)      as destination_id,
  coalesce(f.destination_nom,  c.destination_nom)     as destination_nom,
  (f.destination_type is null and c.destination_type is not null) as destination_heritee,
  f.refacture_statut,
  f.refacture_societe,
  f.refacture_facture_id
from factures_achat f
left join commandes c on c.id = f.commande_id;

revoke all on v_factures_destination from public, anon;
grant select on v_factures_destination to authenticated;
