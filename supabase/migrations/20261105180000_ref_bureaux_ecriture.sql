-- ref_bureaux : l'ecriture etait refusee a tout le monde, en silence.
--
-- La table avait RLS active et UNE SEULE regle : la lecture. Aucune regle
-- d'INSERT, d'UPDATE ni de DELETE. Toute modification d'un bureau etait donc
-- refusee, pour tout le monde, administrateur compris.
--
-- POURQUOI PERSONNE NE L'A VU PENDANT DES MOIS
--
-- Un UPDATE refuse par RLS ne renvoie AUCUNE erreur : il touche zero ligne et
-- repond « succes ». L'ecran enregistrait a la sortie du champ, sans bouton
-- et sans confirmation. On tapait, on cliquait ailleurs, rien ne se passait —
-- et rien ne le disait.
--
-- Meme regle que collaborateurs : l'ecriture aux administrateurs.

drop policy if exists ref_bureaux_ecriture on public.ref_bureaux;
create policy ref_bureaux_ecriture on public.ref_bureaux
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
