-- Les pages publiques qui listent les fonds, fournies le 05/11/2026.
--
-- Complement de reglement_fonds_url : la page est lisible par un humain, le
-- PDF reglementaire est plus sur a analyser. On garde les deux, parce que le
-- jour ou l'un bouge, l'autre sert de recours.
--
-- Ces domaines ne resolvent pas depuis l'environnement cloud : rien ne peut
-- les lire tant que la politique reseau ne les autorise pas.

begin;

alter table public.compagnies
  add column if not exists fonds_page_url text;

comment on column public.compagnies.fonds_page_url is
  'Page publique listant les fonds de la compagnie (fund finder). Complement '
  'de reglement_fonds_url, qui pointe le PDF reglementaire.';

update public.compagnies set fonds_page_url = 'https://www.baloise.be/fr/contact-service/fonds-de-placement.html' where code = 'BALOISE';
update public.compagnies set fonds_page_url = 'https://www.axa.be/fr/particuliers/pension/fundfinder' where code = 'AXA';
update public.compagnies set fonds_page_url = 'https://ag.be/particuliers/fr/placements#/' where code = 'AG';
update public.compagnies set fonds_page_url = 'https://www.nn.be/fr/apercudesfonds/nn' where code = 'NN';
update public.compagnies set fonds_page_url = 'https://www.vivium.be/fr/particuliers/epargne-et-investissement/fonds-vivium' where code = 'VIVIUM';

commit;
