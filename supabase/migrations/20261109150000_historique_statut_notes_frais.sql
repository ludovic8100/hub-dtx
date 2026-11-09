-- 1. L'HISTORIQUE DU STATUT
-- Décision de Ludovic, 09/11 : « on garde l'historique ». Un salarié qui
-- devient indépendant ne doit pas effacer ce qu'il était : les commissions
-- déjà payées et les chantiers déjà facturés sont attachés à l'ancien statut.
-- C'est la même règle que le taux horaire figé sur un chantier — ce qui a été
-- vrai en 2023 doit rester lisible en 2026.
alter table collaborateur_societes add column if not exists date_debut date;
alter table collaborateur_societes add column if not exists date_fin   date;

update collaborateur_societes
   set date_debut = coalesce(date_debut, created_at::date)
 where date_debut is null;

-- Une ligne OUVERTE au plus par personne et par société ; autant de lignes
-- fermées qu'on veut derrière. L'ancienne contrainte d'unicité interdisait
-- justement de garder la trace du passé, d'où l'index partiel.
alter table collaborateur_societes drop constraint if exists collaborateur_societes_collaborateur_id_societe_key;
create unique index if not exists idx_collab_soc_courante
  on collaborateur_societes (collaborateur_id, societe)
  where date_fin is null;

alter table collaborateur_societes
  drop constraint if exists collaborateur_societes_periode_coherente;
alter table collaborateur_societes
  add constraint collaborateur_societes_periode_coherente
  check (date_fin is null or date_debut is null or date_fin >= date_debut);

comment on column collaborateur_societes.date_fin is
  'Null = ligne en cours. Renseignée = période close, gardée pour l''historique.';

-- 2. LES NOTES DE FRAIS
-- Ludovic : « ajoute plutôt une case à cocher Notes de frais, pour que son nom
-- apparaisse dans les notes de frais ». C'est plus juste que de le déduire du
-- statut : un administrateur ou un indépendant peut rentrer des frais, et un
-- employé peut n'avoir jamais à en rentrer. Déduire, c'était décider à sa
-- place sur la foi d'un autre champ.
alter table collaborateurs add column if not exists notes_frais_beneficiaire boolean not null default false;
update collaborateurs set notes_frais_beneficiaire = true where est_employe is true;
comment on column collaborateurs.notes_frais_beneficiaire is
  'Apparaît dans la liste des bénéficiaires de notes de frais. Choisi à la main — ce n''est pas le statut.';
