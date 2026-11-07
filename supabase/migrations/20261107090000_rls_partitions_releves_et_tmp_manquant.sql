-- DEUX TROUS OUVERTS A INTERNET, constates le 07/11/2026.
--
-- 1) LES 15 PARTITIONS DE releves_producteur
-- RLS est active sur la table PARENTE, mais pas sur les partitions. Or Postgres
-- applique la securite PAR RELATION : interroger releves_producteur_2026
-- DIRECTEMENT n'applique pas la politique du parent. Et PostgREST expose chaque
-- partition sous son propre nom. `anon` y avait SELECT *et INSERT* : n'importe
-- qui sur Internet pouvait lire, et surtout ECRIRE, des lignes de commission.
-- La table est vide aujourd'hui — c'est de la chance, pas de la conception :
-- les chantiers prod-p3-* consistent justement a la remplir.
--
-- 2) tmp_manquant
-- Politique tmp_ins : FOR INSERT TO anon WITH CHECK (true) — aucune condition.
-- C'etait la seule ecriture publique de la base. La table est morte (aucun
-- usage dans le code, seulement sa creation dans la migration d'origine) mais
-- elle n'est PAS supprimee ici : une suppression ne se defait pas.

do $$
declare t record;
begin
  for t in
    select c.oid::regclass as rel
    from pg_class c
    join pg_inherits i on i.inhrelid = c.oid
    join pg_class p on p.oid = i.inhparent
    where p.relname = 'releves_producteur' and c.relkind in ('r','p')
  loop
    execute format('alter table %s enable row level security', t.rel);
    execute format('revoke all on %s from anon', t.rel);
  end loop;
end $$;

revoke all on public.releves_producteur from anon;
revoke all on public.releves_producteur_controle from anon;
revoke all on public.releves_producteur_rejets from anon;
revoke all on sequence public.releves_producteur_id_seq from anon;
revoke all on sequence public.releves_producteur_rejets_id_seq from anon;

drop policy if exists tmp_ins on public.tmp_manquant;
revoke all on public.tmp_manquant from anon;

-- VERIFIE APRES COUP, en se faisant passer pour chaque role :
--   connecte -> lecture par le PARENT      : OK (l'application marche toujours)
--   anon     -> partition en direct        : REFUSE
--   anon     -> parent                     : REFUSE
