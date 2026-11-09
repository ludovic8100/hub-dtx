-- Le commercial d'un chantier se propage à ses documents.
--
-- Ludovic : « l'attribution des commerciaux doit être bidirectionnelle. Si
-- j'attribue un devis à LLO, le chantier doit être attribué aussi, les
-- factures d'achat et les factures de vente. C'est logique non ? »
--
-- Oui — mais PAS en recopiant la valeur dans quatre tables.
--
-- LE COMMERCIAL APPARTIENT AU CHANTIER
--
-- Quatre copies d'un même fait, ce sont quatre occasions de diverger sans que
-- rien ne le signale. C'est exactement ce qui s'est passé aujourd'hui avec les
-- trois mecanismes d'attribution rivaux et les deux listes de commerciaux.
--
-- Le chantier porte la verite. Les devis et les factures de vente la suivent
-- (ils ont deja la colonne, utilisee par les ecrans existants). Les factures
-- d'ACHAT n'ont PAS de colonne et n'en auront pas : elles sont deja rattachees
-- au chantier par destination_id, donc elles heritent. Ajouter une colonne la
-- serait la quatrieme copie.
--
-- POURQUOI UNE FONCTION ET PAS DU CODE DANS CHAQUE ECRAN
--
-- Deux ecrans permettent de changer le commercial : la fiche du chantier et
-- l'editeur de devis. Deux implementations, ce sont deux regles qui finiront
-- par differer. Une seule fonction, appelee des deux cotes.

create or replace function synchroniser_commercial(p_dossier_id uuid, p_code text)
returns table (devis_maj integer, factures_maj integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_devis int := 0;
  v_fact  int := 0;
begin
  if p_dossier_id is null then
    return query select 0, 0;
    return;
  end if;

  update dossiers set responsable = v_code, updated_at = now()
   where id = p_dossier_id and responsable is distinct from v_code;

  -- `is distinct from` et non `<>` : sans ca, une ligne dont le responsable
  -- est NULL ne serait jamais mise a jour (NULL <> 'LLO' vaut NULL, pas vrai).
  update lode_devis set responsable = v_code
   where dossier_id = p_dossier_id and responsable is distinct from v_code;
  get diagnostics v_devis = row_count;

  update lode_factures set responsable = v_code
   where dossier_id = p_dossier_id and responsable is distinct from v_code;
  get diagnostics v_fact = row_count;

  return query select v_devis, v_fact;
end;
$$;

revoke execute on function synchroniser_commercial(uuid, text) from public, anon;
grant  execute on function synchroniser_commercial(uuid, text) to authenticated;
