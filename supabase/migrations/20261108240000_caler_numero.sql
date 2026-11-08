-- Recaler le compteur apres une renumerotation manuelle.
--
-- Ludovic, avant la mise en production : « place les noms des dossiers
-- chantiers en mode editable, que je puisse reecrire correctement et remettre
-- dans l'ordre, puis tu enleveras cette option apres ».
--
-- LE PIEGE QU'IL NE VOIT PAS
--
-- Les numeros viennent de numeros_sequences via prochain_numero(). Si on
-- renumerote un dossier a la main en DOS-2026-012 alors que le compteur en
-- est a 6, le prochain dossier cree recevra DOS-2026-007... puis un jour
-- DOS-2026-012, qui existe deja. L'index unique (societe, numero) refusera
-- l'ecriture, et le refus tombera des semaines plus tard, sur quelqu'un qui
-- n'aura rien fait de mal.
--
-- Cette fonction recale le compteur sur le plus grand des deux. Elle ne le
-- fait JAMAIS redescendre : un numero deja attribue ne doit pas pouvoir etre
-- redistribue.

create or replace function caler_numero(p_type text, p_societe text, p_numero text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee int;
  v_seq   int;
begin
  -- Format attendu : <prefixe>-<annee>-<sequence>. Tout autre format est
  -- ignore sans erreur : renommer librement doit rester possible.
  if p_numero !~ '^[A-Za-z]+-\d{4}-\d+$' then
    return null;
  end if;
  v_annee := split_part(p_numero, '-', 2)::int;
  v_seq   := split_part(p_numero, '-', 3)::int;

  insert into numeros_sequences (type, societe, annee, dernier)
  values (p_type, upper(p_societe), v_annee, v_seq)
  on conflict (type, societe, annee)
    do update set dernier = greatest(numeros_sequences.dernier, excluded.dernier);

  return v_seq;
end;
$$;

revoke execute on function caler_numero(text, text, text) from public, anon;
grant  execute on function caler_numero(text, text, text) to authenticated;
