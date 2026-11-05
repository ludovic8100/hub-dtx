-- Collaborateurs : nom et prenom separes.
--
-- `collaborateurs` n'avait que `nom_complet`, un champ libre ou cohabitent
-- quatre conventions : « NOM Prenom », « Prenom Nom », « Prenom NOM -
-- Societe SRL », et des lignes qui ne designent pas des personnes (boites
-- generiques, agences, comptes de test). On ne peut ni trier, ni rapprocher,
-- ni afficher proprement.
--
-- CE FICHIER NE CONTIENT AUCUN NOM. Le depot est public. Les 39 identites
-- etablies le 05/11/2026 l'ont ete par une correction ponctuelle en base,
-- pas par ce fichier : y lister le personnel reviendrait a le publier.
-- Ce qui est reproductible, ce sont les REGLES ci-dessous.
--
-- ──────────────────────────────────────────────────────────────────────────
-- UNE ERREUR A NE PAS REFAIRE : LE RAPPROCHEMENT PAR ADRESSE MAIL
-- ──────────────────────────────────────────────────────────────────────────
--
-- Premier jet : « la fiche CLIENT de meme adresse mail porte deja nom et
-- prenom separes, prenons-les ». Quinze collaborateurs correspondaient. Le
-- raisonnement etait faux, et il a ecrit de fausses identites en production
-- avant d'etre rattrape : trois collaborateurs ont recu le nom d'un client,
-- et deux lignes de societe ont recu un nom de personne.
--
-- LA CAUSE : l'adresse professionnelle d'un courtier figure sur les fiches
-- des clients qu'il gere. Une adresse mail identifie un POINT DE CONTACT,
-- pas une personne. Et comme le declencheur ci-dessous recompose
-- `nom_complet`, le nom d'origine a ete ecrase du meme coup — la correction
-- a donc du etre faite de memoire, a partir d'un releve pris avant.
--
-- CE QUI A PERMIS DE LE VOIR : le CODE a trois lettres est fait des
-- initiales. Un collaborateur « JFS » ne peut pas s'appeler Sebastien W.
-- Un controle gratuit, qu'il fallait faire AVANT d'ecrire et non apres.
--
-- ──────────────────────────────────────────────────────────────────────────
-- LES SOURCES, PAR FIABILITE DECROISSANTE
-- ──────────────────────────────────────────────────────────────────────────
--
--   1. `nom_sa_data` / `o365_display_name` — deja au format « NOM Prenom »,
--      et propres au collaborateur.                                13 lignes
--   2. le motif « nom en MAJUSCULES » dans `nom_complet`.          14 lignes
--   3. le code a trois lettres, quand l'ordre est ambigu.           2 lignes
--   4. une relecture humaine, apres l'erreur ci-dessus.             4 lignes
--   5. rien — et ce ne sont pas des personnes.                     15 lignes
--
-- Deux cas que seul le code tranchait : un « Nom Prenom » en minuscules a
-- inverser, et un nom a particule qu'aucun motif n'attrapait.
--
-- Un champ vide se voit et se corrige. Un prenom range dans la case nom ne
-- se voit pas, et se propage partout ou l'on croit lire un nom.

begin;

alter table public.collaborateurs
  add column if not exists nom             text,
  add column if not exists prenom          text,
  add column if not exists source_identite text;

comment on column public.collaborateurs.nom is
  'Nom de famille. Vide tant qu''il n''a pas ete etabli : on ne devine pas.';
comment on column public.collaborateurs.source_identite is
  'D''ou viennent nom et prenom : nom_sa_data, majuscules, code_initiales, '
  'restaure_manuel, saisie. Sans cette colonne, on ne sait plus six mois '
  'plus tard ce qui a ete verifie et ce qui a ete deduit.';

-- ── Le declencheur ───────────────────────────────────────────────────────
-- `nom_complet` EST CONSERVE : 36 usages dans cinq fichiers du front. Il est
-- recompose a partir de nom + prenom quand les DEUX existent ; une ligne
-- laissee vide garde exactement son libelle d'origine, aussi imparfait
-- soit-il. Mieux vaut un nom bancal qu'un nom vide dans trente-six endroits.
create or replace function public.collaborateurs_nom_complet()
returns trigger language plpgsql as $$
begin
  if new.nom is not null and btrim(new.nom) <> ''
     and new.prenom is not null and btrim(new.prenom) <> '' then
    new.nom_complet := btrim(new.nom) || ' ' || btrim(new.prenom);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_collaborateurs_nom_complet on public.collaborateurs;
create trigger trg_collaborateurs_nom_complet
  before insert or update on public.collaborateurs
  for each row execute function public.collaborateurs_nom_complet();

-- ── La regle automatique, sur une base vierge ────────────────────────────
--
-- Elle ne traite que le cas sans ambiguite : un nom en MAJUSCULES, en tete
-- ou en fin. Le reste est laisse vide, a completer dans Parametres.
--
-- TROIS PIEGES, TROUVES EN DEROULANT LA REGLE A BLANC AVANT DE L'ECRIRE :
--   - une capture non gourmande coupait les noms composes en deux ;
--   - les raisons sociales (SPRL, GIE…) devenaient des noms de famille ;
--   - le suffixe « - Societe SRL » doit etre retire AVANT ce test, sinon
--     toute personne qui le porte est prise pour une societe.
with propre as (
  select id, btrim(regexp_replace(nom_complet,
           '\s*-\s*(Dynassur|DTX|Lode|Hexagroup).*$', '', 'i')) as n
  from public.collaborateurs
  where nom is null and nom_complet is not null
), personnes as (
  select * from propre
   where n !~* '\m(SPRL|SRL|S\.?A\.?|GIE|ASBL|SCRL|BV|NV|SC)\M'
)
update public.collaborateurs co
   set nom    = btrim((regexp_match(p.n, '^([A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ])\s+(\S.*)$'))[1]),
       prenom = btrim((regexp_match(p.n, '^([A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ])\s+(\S.*)$'))[2]),
       source_identite = 'majuscules'
  from personnes p
 where co.id = p.id
   and p.n ~ '^[A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ]\s+\S';

with propre as (
  select id, btrim(regexp_replace(nom_complet,
           '\s*-\s*(Dynassur|DTX|Lode|Hexagroup).*$', '', 'i')) as n
  from public.collaborateurs
  where nom is null and nom_complet is not null
), personnes as (
  select * from propre
   where n !~* '\m(SPRL|SRL|S\.?A\.?|GIE|ASBL|SCRL|BV|NV|SC)\M'
)
update public.collaborateurs co
   set nom    = btrim((regexp_match(p.n, '^(\S.*?)\s+([A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ])$'))[2]),
       prenom = btrim((regexp_match(p.n, '^(\S.*?)\s+([A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ])$'))[1]),
       source_identite = 'majuscules'
  from personnes p
 where co.id = p.id
   and p.n ~ '\s[A-ZÀ-Þ][A-ZÀ-Þ''\- ]*[A-ZÀ-Þ]$';

commit;
