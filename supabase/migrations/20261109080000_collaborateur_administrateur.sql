-- Une personne morale (une société sous-agent) n'a pas de nom de personne :
-- elle a un administrateur, qui est une personne physique. Sans cette colonne,
-- la fiche d'un sous-agent en société ne disait pas QUI on a en face.
--
-- Ce n'est volontairement PAS une clé vers collaborateurs : l'administrateur
-- d'une société partenaire n'a pas de compte dans le Hub. Ludovic, 09/11 :
-- « c'est toujours un administrateur ».
alter table collaborateurs add column if not exists administrateur text;
comment on column collaborateurs.administrateur is
  'Personne morale uniquement : nom de l''administrateur de la société. Texte libre, pas un compte du Hub.';
