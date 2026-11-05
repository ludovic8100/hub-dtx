-- Amorcage de fonds_investissement depuis l'ancien objet FUND_RISK.
--
-- Ces 53 valeurs viennent du code, pas d'un document. Elles sont marquees
-- source = 'heritee_code' pour que personne ne les prenne pour des SRI
-- verifies : aucune n'a ete confrontee a un document d'informations cles.
-- Le SRI reste null tant qu'il n'a pas ete lu dans le DIC du fonds.

begin;

insert into public.fonds_investissement (compagnie, nom, nom_normalise, risque, categorie, source, commentaire)
select v.compagnie, v.nom, public.normaliser_nom_fonds(v.nom), v.risque, v.categorie, 'heritee_code',
       'Reprise de l''objet FUND_RISK du composant ToolQuestionnaire. Valeur jamais confrontee a un DIC : a verifier.'
from (values
  ('AG INSURANCE SA', 'pension life', 0, 'garanti'),
  ('AG INSURANCE SA', 'ag life stability', 10, 'fonds'),
  ('AG INSURANCE SA', 'ag life income', 15, 'fonds'),
  ('AG INSURANCE SA', 'ag life balanced', 50, 'fonds'),
  ('AG INSURANCE SA', 'ag life growth', 75, 'fonds'),
  ('AG INSURANCE SA', 'ag life dynamic', 85, 'fonds'),
  ('AG INSURANCE SA', 'ag life equities', 90, 'fonds'),
  ('AG INSURANCE SA', 'top rendement', 5, 'fonds'),
  ('AG INSURANCE SA', 'capital branch 21', 0, 'garanti'),
  ('BALOISE BELGIUM SA', 'r-valor fund', 85, 'fonds'),
  ('BALOISE BELGIUM SA', 'megatrends fund', 80, 'fonds'),
  ('BALOISE BELGIUM SA', 'infrastructure fund', 55, 'fonds'),
  ('BALOISE BELGIUM SA', 'bgf world technology fund', 90, 'fonds'),
  ('BALOISE BELGIUM SA', 'jpm global focus fund', 75, 'fonds'),
  ('BALOISE BELGIUM SA', 'c-quadrat arts balanced fund', 50, 'fonds'),
  ('BALOISE BELGIUM SA', 'bfi global equity select', 85, 'fonds'),
  ('BALOISE BELGIUM SA', 'bfi megatrends select', 80, 'fonds'),
  ('BALOISE BELGIUM SA', 'bfi multi asset select', 45, 'fonds'),
  ('BALOISE BELGIUM SA', 'bfi positive impact select', 65, 'fonds'),
  ('BALOISE BELGIUM SA', 'bfi real estate and infrastructure select', 55, 'fonds'),
  ('BALOISE BELGIUM SA', 'compte branche 21', 0, 'garanti'),
  ('BALOISE BELGIUM SA', 'compte branche 21 - 0%', 0, 'garanti'),
  ('BALOISE BELGIUM SA', 'european bonds', 10, 'fonds'),
  ('BALOISE BELGIUM SA', 'balanced', 50, 'fonds'),
  ('BALOISE BELGIUM SA', 'growth', 75, 'fonds'),
  ('BALOISE BELGIUM SA', 'equities', 90, 'fonds'),
  ('BALOISE BELGIUM SA', 'branche 21', 0, 'garanti'),
  ('BALOISE BELGIUM SA', 'branche 26', 0, 'garanti'),
  ('BALOISE BELGIUM SA', 'invest 1', 30, 'fonds'),
  ('BALOISE BELGIUM SA', 'invest 2', 50, 'fonds'),
  ('BALOISE BELGIUM SA', 'invest 3', 70, 'fonds'),
  ('NN BELGIUM SA', 'nn life star fund', 70, 'fonds'),
  ('NN BELGIUM SA', 'nn life star fund - eur', 70, 'fonds'),
  ('NN BELGIUM SA', 'fng sustainable impact', 60, 'fonds'),
  ('NN BELGIUM SA', 'fng patrimonial balanced', 45, 'fonds'),
  ('NN BELGIUM SA', 'fng patrimonial defensive', 20, 'fonds'),
  ('NN BELGIUM SA', 'fng growth', 70, 'fonds'),
  ('NN BELGIUM SA', 'nn life strategy defensive', 15, 'fonds'),
  ('NN BELGIUM SA', 'nn life strategy balanced', 45, 'fonds'),
  ('NN BELGIUM SA', 'nn life strategy dynamic', 80, 'fonds'),
  ('NN BELGIUM SA', 'branche 21 nn', 0, 'garanti'),
  ('AXA BELGIUM SA', 'axa b pension stability', 10, 'fonds'),
  ('AXA BELGIUM SA', 'axa b pension balanced', 45, 'fonds'),
  ('AXA BELGIUM SA', 'axa b pension dynamic', 80, 'fonds'),
  ('AXA BELGIUM SA', 'crest 21', 0, 'garanti'),
  ('AXA BELGIUM SA', 'crest 26', 5, 'garanti'),
  ('AXA BELGIUM SA', 'venture 1', 30, 'fonds'),
  ('AXA BELGIUM SA', 'venture 2', 55, 'fonds'),
  ('AXA BELGIUM SA', 'venture 3', 75, 'fonds'),
  ('ALLIANZ BENELUX SA', 'strategy balanced', 50, 'fonds'),
  ('ALLIANZ BENELUX SA', 'strategy dynamic', 80, 'fonds'),
  ('ALLIANZ BENELUX SA', 'strategy defensive', 15, 'fonds'),
  ('ALLIANZ BENELUX SA', 'allianz branche 21', 0, 'garanti')
) as v(compagnie, nom, risque, categorie)
on conflict (compagnie, nom_normalise) do nothing;
commit;
