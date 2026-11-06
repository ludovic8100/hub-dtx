-- Les trois indicateurs du haut de la page Clients n'affichaient rien.
--
-- CONSTATE LE 06/11, visible sur les captures du 05/11 : « Avec alerte »,
-- « Sans contrat » et « Sans comm. 2026 » montraient « … », c'est-a-dire
-- l'etat de chargement, en permanence.
--
-- DEUX CAUSES, trouvees en appelant simplement la fonction.
--
-- 1. ELLE NE RENDAIT RIEN DU TOUT. Elle lisait
--    `contrats.situation___libelle`, colonne qui n'existe pas — un nom Qlik
--    a trois underscores, disparu depuis. Chaque appel levait « column does
--    not exist », le front recevait une erreur et gardait son « … ».
--    La colonne s'appelle `situation`.
--
-- 2. `sans_commissions` COMPTAIT TOUS LES CLIENTS. La table `quittances` est
--    VIDE : zero ligne, aucune annee. L'indicateur comptait donc les clients
--    sans quittance dans une table qui n'en contient aucune — soit les
--    10 308. C'est attendu et ecrit dans CLAUDE.md : le financier ne vient
--    plus de Qlik mais des bordereaux. La source a ete coupee, l'indicateur
--    qui s'en nourrissait est reste.
--
--    Il rend desormais `null`, pas zero : zero voudrait dire « tous les
--    clients ont produit », ce qui serait un second mensonge. Et il expose
--    `commissions_source_vide` pour que l'ecran dise pourquoi.
--
-- APRES CORRECTION : 10 308 clients, 3 856 sans contrat, commissions
-- indisponibles. `avec_alerte` vaut 0 et c'est exact : la colonne `alerte`
-- est nulle sur les 10 308 lignes.
--
-- A SURVEILLER, hors de ce correctif : cette fonction est SECURITY DEFINER,
-- donc elle compte TOUS les clients quel que soit celui qui regarde. Sans
-- objet aujourd'hui (les droits sont ouverts), mais le jour ou le
-- portefeuille sera cloisonne par bureau, ces totaux fuiteront d'un bureau
-- a l'autre. A reprendre avec docs/DROITS-ACCES.md.
create or replace function public.get_clients_kpis()
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  result            json;
  annee_en_cours    int := extract(year from now())::int;
  quittances_vides  boolean;
begin
  select not exists (select 1 from quittances limit 1) into quittances_vides;

  select json_build_object(
    'total_clients',
    (select count(distinct dossier) from clients where dossier is not null),

    'avec_alerte',
    (select count(distinct dossier) from clients
      where alerte is not null and alerte <> '' and alerte <> ' '),

    'sans_contrat',
    (select count(distinct c.dossier) from clients c
      where c.dossier is not null
        and not exists (
          select 1 from contrats ct
           where ct.dossier = c.dossier
             and (ct.situation is null or ct.situation = 'En cours')
        )),

    'sans_commissions',
    case when quittances_vides then null else
      (select count(distinct c.dossier) from clients c
        where c.dossier is not null
          and not exists (
            select 1 from quittances q
             where q.dossier = c.dossier
               and extract(year from q.date_comptable::date) = annee_en_cours
          ))
    end,

    'commissions_source_vide', quittances_vides
  ) into result;

  return result;
end;
$function$;
