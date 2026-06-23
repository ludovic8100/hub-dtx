-- =====================================================================
-- HUB DTX — Auto-liaison RDV -> client (trigger)
-- Relie automatiquement un RDV à un client quand NOM ET PRÉNOM sont
-- présents dans l'objet et désignent UNE SEULE personne (haute précision).
-- Couvre tous les RDV futurs (synchro horaire incluse). Ne touche jamais
-- un lien déjà posé (manuel ou auto) : ne s'applique que si client_id IS NULL.
-- =====================================================================

create extension if not exists unaccent;

create or replace function public.rdv_autolink()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  stop text[] := array[
    'RDV','RDVS','PH','PRET','HYPO','HYPOTHEQUE','HYPOTHECAIRE','SIGN','SIGNATURE','CARDIF',
    'DOSSIER','DOSSIERS','CREDIT','SRDU','DEUX','AVEC','ATTENTION','SORTIR','BNB','CAR',
    'FAILLITE','FAILLI','REUNION','EXPERTISE','MME','MR','MONSIEUR','MADAME','LES','DES','POUR',
    'RESTO','REPAS','EQUIPE','DYNASSUR','FORMATION','PROVIDIS','MICROSOFT','POWER','DAYS','FOUNDRY',
    'LIEGE','JUPRELLE','VISIO','TEAMS','APPEL','CALL','TEL','VIE','IARD','AUTO','CONTRAT','CLIENT',
    'NOUVEAU','NEW','SUIVI','POINT','DEBRIEF','MEETING','LUNCH','MIDI','URGENT','SUITE','ROADSHOW',
    'BUREAU','FERME','FERMETURE','OUVERTURE','PETIT','DEJEUNER','VACANCES','CONGE','ANNIVERSAIRE',
    'ZOOM','ABSENT','FERIE','OFFICE','BANQUE','GARAGE'];
  excl text[] := array['DETILLOUX'];
  toks text[];
  ncand int;
  hid bigint;
  hdos text;
begin
  if NEW.client_id is not null then return NEW; end if;
  if NEW.objet is null then return NEW; end if;

  -- tokens significatifs de l'objet (majuscule, sans accents, >=3, hors stop-words)
  select array_agg(t) into toks
  from unnest(regexp_split_to_array(upper(unaccent(NEW.objet)), '[^A-Z]+')) as t
  where length(t) >= 3 and not (t = any(stop));

  if toks is null then return NEW; end if;

  -- nombre de personnes distinctes (nom+prénom) dont nom ET prénom apparaissent dans l'objet
  select count(distinct (upper(unaccent(nom)) || '|' || upper(unaccent(coalesce(prenom,'')))))
  into ncand
  from clients
  where upper(unaccent(nom)) = any(toks)
    and not (upper(unaccent(nom)) = any(excl))
    and coalesce(prenom,'') <> ''
    and upper(unaccent(prenom)) = any(toks)
    and length(upper(unaccent(nom))) >= 3;

  if ncand = 1 then
    select id, dossier into hid, hdos
    from clients
    where upper(unaccent(nom)) = any(toks)
      and not (upper(unaccent(nom)) = any(excl))
      and coalesce(prenom,'') <> ''
      and upper(unaccent(prenom)) = any(toks)
    order by (dossier is not null) desc, id
    limit 1;
    if hid is not null then
      NEW.client_id := hid;
      NEW.dossier_client := hdos;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_rdv_autolink on public.rdv;
create trigger trg_rdv_autolink
before insert or update of objet on public.rdv
for each row execute function public.rdv_autolink();

-- Rétro-traitement des RDV existants non encore liés
update public.rdv set objet = objet where client_id is null;
