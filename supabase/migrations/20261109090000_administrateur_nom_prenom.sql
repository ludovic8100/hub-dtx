-- L'administrateur d'une personne morale se saisit en deux champs, comme
-- toute personne physique du Hub : un NOM et un prénom. Un seul champ « nom
-- de l'administrateur » recommençait l'erreur de `nom_complet`, qui mélangeait
-- quatre conventions et rendait tout tri impossible.
alter table collaborateurs add column if not exists administrateur_nom    text;
alter table collaborateurs add column if not exists administrateur_prenom text;

-- Reprise de l'ancienne colonne (créée le matin même, vide partout en prod).
update collaborateurs
   set administrateur_nom = nullif(btrim(administrateur), '')
 where administrateur_nom is null and nullif(btrim(coalesce(administrateur, '')), '') is not null;

comment on column collaborateurs.administrateur_nom is
  'Personne morale : NOM de l''administrateur. Texte libre, pas un compte du Hub.';
comment on column collaborateurs.administrateur_prenom is
  'Personne morale : prénom de l''administrateur.';
-- Pas de DROP : une suppression ne se défait pas. La colonne part quand
-- Ludovic confirme qu'aucune fiche ne s'en sert.
comment on column collaborateurs.administrateur is
  'OBSOLÈTE depuis le 09/11/2026 — remplacée par administrateur_nom + administrateur_prenom. À supprimer après validation.';
