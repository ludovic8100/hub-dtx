-- Collaborateurs : nom et prenom separes.
--
-- `collaborateurs` n'avait que `nom_complet`, un champ libre ou cohabitent
-- quatre conventions :
--
--     LAPAILLE Audrey                      NOM Prenom
--     Arnaud Petit                         Prenom Nom
--     Benedicte DE ROOCKER - Dynassur SRL  + suffixe societe
--     Homelinks / grace-hollogne / CSA     pas des personnes
--
-- On ne peut ni trier, ni rapprocher, ni afficher proprement.
--
-- ──────────────────────────────────────────────────────────────────────────
-- UNE ERREUR A EVITER DE REFAIRE : LE RAPPROCHEMENT PAR ADRESSE MAIL
-- ──────────────────────────────────────────────────────────────────────────
--
-- Premier jet : « la fiche CLIENT de meme adresse mail porte deja nom et
-- prenom separes, prenons-les ». Quinze collaborateurs correspondaient. Le
-- raisonnement etait faux, et il a ecrit de fausses identites en production
-- avant d'etre rattrape :
--
--     BDR  « Benedicte DE ROOCKER »  →  BRITO MALUENGA WILIAM
--     JFS  « Jean-Francois SIMONIS » →  WILKET SEBASTIEN
--     ICE  « Cezassur SPRL »         →  ENGLISH-BULLDOG-CLUB.BE
--
-- La cause : l'adresse professionnelle d'un courtier figure sur les fiches
-- des clients qu'il gere. `bdr@dynassur.be` est donc sur la fiche de
-- M. Brito Maluenga. L'adresse mail identifie un POINT DE CONTACT, pas une
-- personne. Et comme le declencheur recompose `nom_complet`, le nom d'origine
-- a ete ecrase du meme coup.
--
-- Ce qui a permis de le voir : le CODE a trois lettres est fait des
-- initiales. JFS ne peut pas etre Sebastien Wilket. Un controle gratuit,
-- qu'il aurait fallu faire avant d'ecrire et non apres.
--
-- ──────────────────────────────────────────────────────────────────────────
-- LES SOURCES RETENUES, PAR FIABILITE DECROISSANTE
-- ──────────────────────────────────────────────────────────────────────────
--
--   1. `nom_sa_data` / `o365_display_name` — deja au format « NOM Prenom »,
--      et propres au collaborateur. 13 lignes.
--   2. le motif « nom en MAJUSCULES » dans `nom_complet`. 14 lignes.
--   3. le code a trois lettres, quand l'ordre est ambigu. 2 lignes.
--   4. rien. 15 lignes restent vides — et ce ne sont pas des personnes :
--      Homelinks, grace-hollogne, Info - Dynassur SRL, test.Microsoft…
--
-- Un champ vide se voit et se corrige. Un prenom range dans la case nom ne se
-- voit pas, et se propage partout ou l'on croit lire un nom.
--
-- `nom_complet` EST CONSERVE : il est utilise 36 fois dans cinq fichiers du
-- front. Un declencheur le recompose a partir de nom + prenom quand les deux
-- existent ; les lignes vides gardent leur valeur d'origine.

begin;

alter table public.collaborateurs
  add column if not exists nom             text,
  add column if not exists prenom          text,
  add column if not exists source_identite text;

comment on column public.collaborateurs.nom is
  'Nom de famille. Vide tant qu''il n''a pas ete etabli : on ne devine pas.';
comment on column public.collaborateurs.source_identite is
  'D''ou viennent nom et prenom : nom_sa_data, majuscules, code_initiales, '
  'restaure_manuel, saisie. Sans cette colonne, on ne sait plus six mois plus '
  'tard ce qui a ete verifie et ce qui a ete deduit.';

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

-- ── Les 39 identites, nommees une par une ────────────────────────────────
--
-- Volontairement explicites plutot que calculees. Chaque ligne a ete lue et
-- verifiee contre le code a trois lettres. Une expression reguliere qui se
-- trompe sur une ligne se trompe en silence ; une liste se relit.
-- UPDATE et non INSERT ... ON CONFLICT : l'index unique sur `code` est
-- PARTIEL (where actif = true), donc inutilisable pour une inference de
-- conflit — et un INSERT creerait des lignes fantomes pour les codes absents.
update public.collaborateurs co
   set nom = v.nom, prenom = v.prenom, source_identite = v.src
  from (values
  ('ALA','LAPAILLE','Audrey','majuscules'),
  ('BHU','HURARD','Béatrice','majuscules'),
  ('BLA','LAMBERT','Benoit','majuscules'),
  ('EGR','GROESMANS','Emilie','majuscules'),
  ('FRO','ROBERT','Françoise','majuscules'),
  ('JCL','LORANGE','Jean-Charles','majuscules'),
  ('LFA','FAVAUGE','Laurence','majuscules'),
  ('MTE','TERRANA','Michelangelo','majuscules'),
  ('NGI','GINIS','Nadine','majuscules'),
  ('PFQ','FERNANDEZ QUIROGA','Priscilla','majuscules'),
  ('SRA','RAEPSAET','Stéphanie','majuscules'),
  ('VBE','BERTRAND','Vanda','majuscules'),
  ('GGO','GODFROID','Grégory','majuscules'),
  ('LDE','DETILLOUX','Ludovic','majuscules'),
  ('LLO','LORANGE','Ludivine','majuscules'),
  ('OBA','BAUDELET','Olivier','majuscules'),
  ('RCA','CARREA','Raphaël','majuscules'),
  ('TJA','JAPSENNE','Thibaut','majuscules'),
  ('APE','PETIT','Arnaud','nom_sa_data'),
  ('DCO','COCO','Didier','nom_sa_data'),
  ('FBL','BLAIRON','Fanny','nom_sa_data'),
  ('FLA','LARUE','Frédéric','nom_sa_data'),
  ('JCA','CARBONNE','Jonathan','nom_sa_data'),
  ('KGO','GONCALVES','Kévin','nom_sa_data'),
  ('MQU','QUENON','Maxime','nom_sa_data'),
  ('VLR','LA ROSA','Vincenzo','nom_sa_data'),
  ('VPE','PESSER','Vincent','nom_sa_data'),
  ('YCH','CHOU','Youjin','nom_sa_data'),
  ('LER','LERHO','Madeleine','nom_sa_data'),
  -- RFI : « Ficarrotta Rosario » se lisait Nom Prenom. Le code dit
  -- R(osario) FI(carrotta) — donc l'inverse.
  ('RFI','FICARROTTA','Rosario','nom_sa_data'),
  -- MVM : « Van Muylder » n'a pas deux majuscules d'affilee, aucun motif ne
  -- l'attrapait. M(ichael) V(an) M(uylder).
  ('MVM','VAN MUYLDER','Michaël','nom_sa_data'),
  ('ICA','CAMPSTEIN','Ilenia','code_initiales'),
  ('PDE','DEGRÉ','Pierre','code_initiales'),
  -- Les quatre rattrapes apres le faux rapprochement par mail.
  ('BDR','DE ROOCKER','Bénédicte','restaure_manuel'),
  ('JFS','SIMONIS','Jean-François','restaure_manuel'),
  ('FMZ','MAMMO ZAGARELLA','Fabrizio','restaure_manuel'),
  ('LGM','GAEN MUNOZ','Luisa','restaure_manuel')
) as v(code, nom, prenom, src)
 where upper(co.code) = v.code;

-- Les deux lignes sans code, reperees par leur adresse.
update public.collaborateurs set nom='MINON', prenom='Gael',  source_identite='majuscules'
 where lower(email) = 'gael@dynassur.be';
update public.collaborateurs set nom='HABAY', prenom='Rudy',  source_identite='majuscules'
 where lower(email) = 'rudy@rhassur.be';

-- Garde-fou : si le nombre d'identites etablies s'ecarte de ce qui a ete
-- verifie a la main, c'est que la table a change — on prefere echouer.
do $$
declare n integer;
begin
  select count(*) into n from public.collaborateurs where nom is not null;
  if n < 30 then
    raise exception 'Seulement % identites etablies, 39 attendues. Verifier avant de poursuivre.', n;
  end if;
  raise notice 'Identites etablies : %', n;
end $$;

commit;
