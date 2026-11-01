-- Rapproche automatiquement un relevé de compte producteur du virement qui lui
-- correspond, par le MONTANT.
--
-- Le solde annoncé par le relevé est, au centime, le montant que la compagnie
-- verse. On cherche donc le virement entrant de cette compagnie, du même montant,
-- dans les 60 jours qui suivent la clôture du relevé.
--
-- Prudence volontaire : on ne rattache que si la correspondance est UNIQUE.
-- Deux virements du même montant dans la fenêtre, ou deux relevés du même solde,
-- et on ne décide rien — l'humain tranchera. Mieux vaut un lien manquant qu'un
-- lien faux : derrière, ce sont les chiffres de production.
--
-- Écrit TOUJOURS les deux côtés du lien (voir CLAUDE.md, rapprochement bancaire).

create or replace function public.rapprocher_bordereaux_virements(
  p_jours_fenetre integer default 60,
  p_simulation    boolean default false
)
returns table (
  bordereau_id   bigint,
  nom_fichier    text,
  transaction_id uuid,
  montant        numeric,
  date_virement  date,
  applique       boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select b.id              as b_id,
           b.nom_fichier     as b_nom,
           b.solde_releve    as b_solde,
           b.date_cloture    as b_cloture,
           b.compagnie_id    as b_compagnie,
           (select t.id from public.transactions t
             join public.compagnies_alias ca on upper(t.contrepartie_nom) like upper(ca.libelle) || '%'
            where ca.compagnie_id = b.compagnie_id
              and t.montant = b.solde_releve
              and t.date_execution between b.date_cloture and b.date_cloture + p_jours_fenetre
              and t.bordereau_id is null
            limit 2) as t_id,
           (select count(*) from public.transactions t
             join public.compagnies_alias ca on upper(t.contrepartie_nom) like upper(ca.libelle) || '%'
            where ca.compagnie_id = b.compagnie_id
              and t.montant = b.solde_releve
              and t.date_execution between b.date_cloture and b.date_cloture + p_jours_fenetre
              and t.bordereau_id is null) as n_candidats
      from public.bordereaux b
     where b.type = 'RCP'
       and b.solde_releve is not null
       and b.date_cloture is not null
       and b.compagnie_id is not null
       and b.transaction_id is null
  loop
    if r.n_candidats = 1 and r.t_id is not null then
      if not p_simulation then
        update public.bordereaux   set transaction_id = r.t_id where id = r.b_id;
        update public.transactions set bordereau_id   = r.b_id where id = r.t_id;
      end if;
      bordereau_id := r.b_id; nom_fichier := r.b_nom; transaction_id := r.t_id;
      montant := r.b_solde;
      select t.date_execution into date_virement from public.transactions t where t.id = r.t_id;
      applique := not p_simulation;
      return next;
    end if;
  end loop;
end;
$$;

comment on function public.rapprocher_bordereaux_virements(integer, boolean) is
  'Lie relevés et virements par le montant, uniquement quand la correspondance est unique. p_simulation=true pour voir sans écrire.';

revoke execute on function public.rapprocher_bordereaux_virements(integer, boolean) from public, anon;
grant  execute on function public.rapprocher_bordereaux_virements(integer, boolean) to authenticated, service_role;
