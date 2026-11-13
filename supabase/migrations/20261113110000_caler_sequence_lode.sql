-- RECALER LA SÉQUENCE LODE APRÈS UNE CORRECTION MANUELLE DE NUMÉRO.
--
-- Demandé par Ludovic le 13/11/2026 : « je veux que les numéros de devis et
-- de chantier soient modifiables le temps que je puisse mettre à jour toutes
-- les données ». Le numéro de chantier l'était déjà ; celui du devis ne
-- l'était pas.
--
-- ⚠️ POURQUOI UN RECALAGE EST NÉCESSAIRE, ET PAS SEULEMENT UN CHAMP OUVERT.
--
-- `next_lode_numero` tire ses numéros de séquences Postgres
-- (seq_lode_devis_2026, seq_lode_facture_2026, seq_lode_nc_2026). Une
-- séquence ignore ce qu'on écrit à la main dans la table : si on corrige un
-- devis en 2026-0050 alors que la séquence en est à 14, elle rendra 15, 16,
-- 17… et finira par retomber sur 0050. L'index unique refusera alors
-- l'insertion — l'écran dira « numéro déjà pris » sur un devis tout neuf, et
-- personne ne comprendra pourquoi.
--
-- Cette fonction pousse la séquence au-delà du numéro saisi. Elle ne la fait
-- JAMAIS RECULER : une séquence qui recule redistribue des numéros déjà
-- utilisés, et c'est exactement ce qu'un index unique n'arrive pas toujours à
-- rattraper quand une ligne a été supprimée entre-temps.
--
-- Elle lit le dernier groupe de chiffres du numéro : « 2026-0050 » → 50,
-- « NC-2026-007 » → 7. Un numéro sans chiffre ne fait rien plutôt que de
-- lever une erreur — corriger un numéro ne doit pas pouvoir échouer sur un
-- détail de format.

create or replace function public.caler_sequence_lode(p_type text, p_numero text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_seq   text;
  v_n     bigint;
  v_actuel bigint;
begin
  v_seq := case p_type
             when 'devis'       then 'seq_lode_devis_2026'
             when 'note_credit' then 'seq_lode_nc_2026'
             else                    'seq_lode_facture_2026'
           end;
  if to_regclass(v_seq) is null then return null; end if;

  -- Le dernier groupe de chiffres : c'est lui qui porte le rang.
  v_n := nullif(regexp_replace(coalesce(p_numero, ''), '^.*?(\d+)\D*$', '\1'), '')::bigint;
  if v_n is null then return null; end if;

  select last_value into v_actuel from pg_sequences
   where schemaname = 'public' and sequencename = v_seq;

  -- JAMAIS EN ARRIÈRE.
  if v_actuel is not null and v_actuel >= v_n then return v_actuel; end if;

  perform setval(v_seq, v_n, true);
  return v_n;
end $$;

-- `anon` est le rôle d'AVANT connexion, et sa clé est publique. Deux
-- révocations, pas une : PUBLIC et anon tiennent le droit séparément.
revoke execute on function public.caler_sequence_lode(text, text) from public, anon;
grant  execute on function public.caler_sequence_lode(text, text) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.caler_sequence_lode(text,text)', 'execute') then
    raise exception 'anon peut encore exécuter caler_sequence_lode';
  end if;
end $$;
