-- `lpad(n, 3, '0')` TRONQUE au-delà de 999 — et le générateur rendait des
-- numéros déjà pris (14/11/2026)
-- ---------------------------------------------------------------------------
--
-- Constaté en production : la création d'un chantier LODE échouait sur
-- « duplicate key value violates unique constraint "dossiers_numero_uk" ».
--
-- La cause tient en une ligne de documentation Postgres que personne ne lit
-- jusqu'au bout : `lpad(chaine, largeur, remplissage)` **tronque** quand la
-- chaîne est plus longue que la largeur demandée. Ce n'est pas un
-- remplissage conditionnel, c'est un calibrage à largeur fixe.
--
--     lpad('7',    3, '0')  →  '007'    ← ce qu'on attendait
--     lpad('1008', 3, '0')  →  '100'    ← ce qu'on n'attendait pas
--
-- Enchaînement exact, mesuré :
--
--   1. un dossier a été numéroté `DOS-2026-999` à la main ;
--   2. `caler_numero` a donc poussé le compteur à 999 ;
--   3. les créations suivantes l'ont mené à 1000, 1001 … 1007 — chaque
--      tentative consomme un numéro, même quand l'insertion échoue ;
--   4. à partir de 1000, `lpad` a rogné trois caractères : 1000 → '100',
--      1001 → '100'… et `DOS-2026-100` existait déjà depuis le 08/11.
--
-- Le générateur rendait donc un numéro déjà pris, et l'écran affichait une
-- violation de contrainte d'unicité — un message exact, mais qui ne désigne
-- pas le coupable. On accuse la table ; la faute est dans la fonction.
--
-- ── Correctif 1 : ne jamais raccourcir ────────────────────────────────────
--
-- `greatest(3, length(v_seq::text))` garde le remplissage sur trois chiffres
-- tant qu'on est en dessous de 1000, et laisse passer la valeur entière
-- au-delà. 7 → 007, 999 → 999, 1008 → 1008.
--
-- ── Correctif 2 : un générateur ne doit JAMAIS rendre un numéro pris ──────
--
-- Corriger `lpad` ne suffit pas, et c'est le vrai enseignement du jour. Le
-- compteur et la table sont deux sources qui peuvent diverger : il suffit
-- qu'un numéro soit saisi à la main au-dessus du compteur (ce que l'écran
-- autorise désormais, le temps de la remise en ordre) pour que la collision
-- revienne — avec le même message illisible.
--
-- La fonction avance donc jusqu'à trouver un numéro libre. Vérifié : les
-- **deux** seuls appelants du dépôt visent `dossiers`
-- (`LodeDossiers.creerDossier` et `LodeDevisFactures.creerDossierDepuisDevis`),
-- la vérification est donc écrite en dur sur cette table — pas de SQL
-- dynamique, donc pas de nom d'objet venu du client, donc pas d'injection
-- possible dans une fonction `security definer`.
--
-- ⚠️ Un futur type de numéro n'héritera PAS de cette protection : il sortira
-- du `if` sans contrôle. C'est délibéré — mieux vaut une protection étroite
-- et lisible qu'une protection large qui ouvrirait du SQL dynamique ici.
-- Tout nouveau type doit ajouter sa branche.
--
-- La boucle est bornée à 1 000 tours : un générateur qui tourne sans fin est
-- pire qu'un générateur qui échoue, parce qu'il bloque la connexion sans rien
-- dire.

create or replace function public.prochain_numero(
  p_type text, p_societe text, p_prefixe text, p_annee integer default null
) returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_annee  int := coalesce(p_annee, extract(year from current_date)::int);
  v_seq    int;
  v_numero text;
  v_tours  int := 0;
begin
  loop
    insert into numeros_sequences (type, societe, annee, dernier)
    values (p_type, upper(p_societe), v_annee, 1)
    on conflict (type, societe, annee) do update set dernier = numeros_sequences.dernier + 1
    returning dernier into v_seq;

    -- greatest() : remplir sans jamais raccourcir.
    v_numero := p_prefixe || '-' || v_annee || '-'
             || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');

    -- Le seul type dont on connaisse la table de destination.
    if p_type <> 'dossier' then
      return v_numero;
    end if;
    if not exists (
      select 1 from dossiers
      where numero = v_numero and societe = upper(p_societe)
    ) then
      return v_numero;
    end if;

    v_tours := v_tours + 1;
    if v_tours > 1000 then
      raise exception
        'prochain_numero : 1000 numéros consécutifs déjà pris pour %/%/%. '
        'Le compteur est très en retard sur la table — le recaler avec caler_numero().',
        p_type, p_societe, v_annee;
    end if;
  end loop;
end; $$;

-- Même troncature, même correctif, sur le générateur des documents LODE.
-- Elle ne s'est pas encore manifestée (devis sur 4 chiffres, factures sur 3),
-- mais la facture 2026-999 existera un jour et rendrait '100' au suivant.
create or replace function public.next_lode_numero(p_type text)
returns text language plpgsql as $$
declare
  v_an text := to_char(current_date, 'YYYY');
  v_seq integer;
  v_large int;
begin
  if p_type = 'devis' then
    v_seq := nextval('seq_lode_devis_2026'); v_large := 4;
    return v_an || '-' || lpad(v_seq::text, greatest(v_large, length(v_seq::text)), '0');
  elsif p_type = 'note_credit' then
    v_seq := nextval('seq_lode_nc_2026'); v_large := 3;
    return 'NC-' || v_an || '-' || lpad(v_seq::text, greatest(v_large, length(v_seq::text)), '0');
  else
    v_seq := nextval('seq_lode_facture_2026'); v_large := 3;
    return v_an || '-' || lpad(v_seq::text, greatest(v_large, length(v_seq::text)), '0');
  end if;
end; $$;

-- ── Et un APERÇU, qui ne consomme rien ───────────────────────────────────
--
-- La fenêtre « Nouveau dossier » affiche désormais le numéro et le laisse
-- modifier, le temps que Ludovic remette les chantiers LODE dans l'ordre.
--
-- ⚠️ Elle ne peut PAS appeler `prochain_numero` pour l'afficher : cette
-- fonction incrémente. Ouvrir la fenêtre puis annuler brûlerait un numéro à
-- chaque fois — et c'est précisément ce qui a mené le compteur à 1007 pour
-- huit dossiers réels, donc au-delà de 999, donc à la troncature ci-dessus.
-- Le défaut s'alimentait lui-même.
--
-- `apercu_numero` est donc `stable` : elle lit le compteur, saute les numéros
-- déjà pris et rend le premier libre, sans rien écrire. Le compteur n'est
-- recalé qu'après une insertion réussie, par `caler_numero`.
create or replace function public.apercu_numero(
  p_type text, p_societe text, p_prefixe text, p_annee integer default null
) returns text
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_annee int := coalesce(p_annee, extract(year from current_date)::int);
  v_seq int; v_numero text; v_tours int := 0;
begin
  select dernier into v_seq from numeros_sequences
   where type = p_type and societe = upper(p_societe) and annee = v_annee;
  v_seq := coalesce(v_seq, 0);
  loop
    v_seq := v_seq + 1;
    v_numero := p_prefixe || '-' || v_annee || '-'
             || lpad(v_seq::text, greatest(3, length(v_seq::text)), '0');
    if p_type <> 'dossier' then return v_numero; end if;
    if not exists (
      select 1 from dossiers where numero = v_numero and societe = upper(p_societe)
    ) then return v_numero; end if;
    v_tours := v_tours + 1;
    -- Un aperçu qui n'aboutit pas rend null : l'écran laisse alors le champ
    -- vide plutôt que d'afficher un numéro faux.
    if v_tours > 1000 then return null; end if;
  end loop;
end $$;

-- ⚠️ `create or replace function` réarme les privilèges par défaut de
-- Supabase : sans ces deux lignes, `anon` retrouve le droit d'exécution
-- qu'on lui a retiré. Même mécanisme que pour les vues, documenté dans
-- CLAUDE.md. Les deux révocations sont nécessaires : `PUBLIC` et `anon`
-- tiennent le droit séparément.
revoke execute on function public.prochain_numero(text, text, text, integer) from public, anon;
revoke execute on function public.next_lode_numero(text) from public, anon;
revoke execute on function public.apercu_numero(text, text, text, integer)   from public, anon;
grant  execute on function public.prochain_numero(text, text, text, integer) to authenticated;
grant  execute on function public.next_lode_numero(text) to authenticated;
grant  execute on function public.apercu_numero(text, text, text, integer)   to authenticated;

-- Revérifier, parce qu'un correctif de sécurité non revérifié rassure sans
-- protéger : la révocation a déjà échoué deux fois le 06/11 faute de couper
-- les DEUX sources du droit.
do $$
begin
  if has_function_privilege('anon', 'public.prochain_numero(text,text,text,integer)', 'execute')
  or has_function_privilege('anon', 'public.apercu_numero(text,text,text,integer)',   'execute')
  or has_function_privilege('anon', 'public.next_lode_numero(text)',                  'execute') then
    raise exception 'anon peut encore exécuter un générateur de numéros';
  end if;
end $$;
