-- Les deux seules fonctions qui portaient l'adresse du Hub en dur, dans le HTML
-- des mails de tickets : le lien « Ouvrir le ticket ».
--
-- Le Hub est passe de hub-dtx.vercel.app a hub.dtx-group.be le 07/11. Le reste
-- de l'application n'a PAS eu besoin d'etre touche : `VITE_HUB_URL` et
-- `HUB_URL` n'etaient definies nulle part sur Vercel, donc le code retombait
-- sur sa valeur par defaut. Poser les deux variables a suffi, et la valeur en
-- dur de src/config/env.js reste comme filet de securite.
--
-- On reecrit chaque fonction a partir de SA PROPRE definition, en remplacant
-- l'adresse : pg_get_functiondef rend un CREATE OR REPLACE complet, donc le
-- corps reste identique au caractere pres. Pas de copier-coller, pas de risque
-- de perdre une ligne en recopiant 80 lignes de plpgsql.
--
-- Rejouable : sur une base ou l'adresse est deja la bonne, le replace ne
-- trouve rien et la fonction est simplement redefinie a l'identique.
--
-- DETTE ASSUMEE : une URL en dur dans du HTML de mail oblige a rouvrir une
-- fonction Postgres a chaque changement d'adresse. La bonne forme serait de la
-- lire depuis un reglage. On a change l'adresse d'abord, on nettoiera ensuite.

do $$
declare f text; def text;
begin
  foreach f in array array['creer_ticket_depuis_mail', 'tickets_rappels_echeance'] loop
    select replace(pg_get_functiondef(p.oid),
                   'https://hub-dtx.vercel.app',
                   'https://hub.dtx-group.be')
      into def
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.proname = f and p.prokind = 'f';
    if def is null then
      raise exception 'fonction introuvable : %', f;
    end if;
    execute def;
  end loop;
end $$;

-- VERIFIE APRES APPLICATION :
--   creer_ticket_depuis_mail  ancienne URL : non | nouvelle : oui
--   tickets_rappels_echeance  ancienne URL : non | nouvelle : oui
