-- Clôture automatique d'un chantier
-- =================================
-- Demande de Ludovic (08/11/2026) : « il se clôture tout seul quand la
-- facture est payée, ou que le devis est refusé ».
--
-- Pris au pied de la lettre, « la facture est payée → on ferme » ferme un
-- chantier qui a encore un solde à facturer : l'éditeur sait faire une
-- facture d'acompte, donc un chantier porte souvent DEUX factures. Et « un
-- devis refusé → on ferme » fermerait un chantier qui porte deux devis — une
-- porte et un châssis — dont l'un est refusé et l'autre accepté.
--
-- La règle retenue ferme donc sur « plus rien d'ouvert », pas sur « un
-- évènement est arrivé » — ce qui couvre exactement les deux cas cités :
--
--   (a) au moins une facture de vente, TOUTES payées,
--       aucun devis encore en brouillon ou envoyé,
--       aucun achat restant « à refacturer » ;
--   (b) aucune facture, au moins un devis, TOUS refusés ou expirés,
--       aucun achat restant « à refacturer ».
--
-- Un devis « accepté » bloque la clôture tant qu'aucune facture n'est payée :
-- accepté veut dire qu'il reste du travail à facturer.
--
-- La clôture est marquée (cloture_auto, cloture_motif, cloture_le) pour que
-- la vérification par l'administration — demandée le même jour — porte
-- précisément sur ces chantiers-là. Fermé automatiquement ne veut pas dire
-- fermé sans que personne ne regarde.
--
-- Le mécanisme est un trigger et non du code React : une facture peut être
-- marquée payée par un rapprochement bancaire, un import Peppol ou un script,
-- pas seulement par l'écran qui l'a créée.

alter table dossiers add column if not exists cloture_auto  boolean not null default false;
alter table dossiers add column if not exists cloture_motif text;
alter table dossiers add column if not exists cloture_le    timestamptz;

create or replace function dossier_cloture_si_termine(p_dossier uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut    text;
  v_auto      boolean;
  v_factures  integer;
  v_fact_open integer;
  v_devis     integer;
  v_devis_viv integer;   -- brouillon / envoyé / accepté
  v_devis_att integer;   -- brouillon / envoyé seulement
  v_achats    integer;
  v_motif     text;
begin
  if p_dossier is null then return false; end if;

  select statut, cloture_auto into v_statut, v_auto from dossiers where id = p_dossier;
  if v_statut is null then return false; end if;

  -- Un chantier fermé À LA MAIN reste fermé : seule la fermeture automatique
  -- se défait automatiquement.
  if v_statut <> 'ouvert' and not coalesce(v_auto, false) then return false; end if;

  select count(*), count(*) filter (where statut is distinct from 'payée')
    into v_factures, v_fact_open
    from lode_factures where dossier_id = p_dossier;

  select count(*),
         count(*) filter (where statut in ('brouillon', 'envoyé', 'accepté')),
         count(*) filter (where statut in ('brouillon', 'envoyé'))
    into v_devis, v_devis_viv, v_devis_att
    from lode_devis where dossier_id = p_dossier;

  -- Un achat encore « à refacturer » est exactement le problème qu'on essaie
  -- de résoudre : fermer le chantier le ferait disparaître de l'écran.
  select count(*) into v_achats
    from factures_achat
   where destination_type = 'dossier'
     and destination_id = p_dossier::text
     and coalesce(refacture_statut, 'a_refacturer') = 'a_refacturer';

  if v_achats > 0 then
    v_motif := null;
  elsif v_factures > 0 and v_fact_open = 0 and v_devis_att = 0 then
    v_motif := case when v_factures = 1 then 'facture payée'
                    else v_factures || ' factures payées' end;
  elsif v_factures = 0 and v_devis > 0 and v_devis_viv = 0 then
    v_motif := case when v_devis = 1 then 'devis refusé'
                    else 'tous les devis refusés' end;
  else
    v_motif := null;
  end if;

  if v_motif is not null and v_statut = 'ouvert' then
    update dossiers
       set statut        = 'clos',
           date_fin      = coalesce(date_fin, current_date),
           cloture_auto  = true,
           cloture_motif = v_motif,
           cloture_le    = now(),
           updated_at    = now()
     where id = p_dossier and statut = 'ouvert';
    return true;
  end if;

  -- Réouverture — trouvée par le test, pas par la relecture. Un chantier qui
  -- porte deux devis (une porte, un châssis) se fermait sur le premier refus,
  -- et le second devis accepté arrivait sur un chantier clos, donc invisible.
  -- Ce qui s'est fermé tout seul doit pouvoir se rouvrir tout seul.
  if v_motif is null and v_statut <> 'ouvert' and coalesce(v_auto, false) then
    update dossiers
       set statut        = 'ouvert',
           date_fin      = null,
           cloture_auto  = false,
           cloture_motif = null,
           cloture_le    = null,
           updated_at    = now()
     where id = p_dossier;
    return true;
  end if;

  return false;
end;
$$;

-- Trigger générique : chaque table concernée n'a qu'à exposer dossier_id.
create or replace function trg_dossier_cloture()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'factures_achat' then
    -- destination_id est du text (les cibles n'ont pas le même type de clé) :
    -- on ne tente la conversion que si la valeur ressemble vraiment à un uuid,
    -- sinon un enregistrement mal formé ferait échouer la sauvegarde.
    if new.destination_type is distinct from 'dossier'
       or new.destination_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then return new; end if;
    perform dossier_cloture_si_termine(new.destination_id::uuid);
    return new;
  end if;

  perform dossier_cloture_si_termine(new.dossier_id);
  -- Le devis ou la facture vient peut-être d'être DÉTACHÉ d'un chantier :
  -- l'ancien chantier peut alors, lui aussi, n'avoir plus rien d'ouvert.
  if tg_op = 'UPDATE' and old.dossier_id is distinct from new.dossier_id then
    perform dossier_cloture_si_termine(old.dossier_id);
  end if;
  return new;
end;
$$;

drop trigger if exists lode_factures_cloture on lode_factures;
create trigger lode_factures_cloture
  after insert or update of statut, dossier_id on lode_factures
  for each row execute function trg_dossier_cloture();

drop trigger if exists lode_devis_cloture on lode_devis;
create trigger lode_devis_cloture
  after insert or update of statut, dossier_id on lode_devis
  for each row execute function trg_dossier_cloture();

-- Un achat qui passe de « à refacturer » à « inclus » peut débloquer la
-- clôture : sans ce trigger, le chantier resterait ouvert pour rien.
drop trigger if exists factures_achat_cloture on factures_achat;
create trigger factures_achat_cloture
  after insert or update of refacture_statut, destination_type, destination_id on factures_achat
  for each row execute function trg_dossier_cloture();

-- security definer : la fonction écrit dans dossiers pour le compte de
-- l'utilisateur courant, qui peut ne pas avoir le droit d'UPDATE direct.
-- Elle n'accepte qu'un identifiant de chantier et ne fait qu'une chose.
revoke execute on function dossier_cloture_si_termine(uuid) from public, anon;
grant  execute on function dossier_cloture_si_termine(uuid) to authenticated;
revoke execute on function trg_dossier_cloture() from public, anon;
