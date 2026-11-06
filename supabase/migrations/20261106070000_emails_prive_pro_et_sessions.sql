-- Emails prive / pro, et lecture des appareils connectes.
--
-- Demande de Ludovic le 06/11 : « L'utilisateur doit toujours avoir : Email
-- prive et Email pro. D'ailleurs dans la fiche client ca doit etre le cas. »
--
-- La refonte de l'ecran Parametres qui devait s'appuyer dessus a ete MISE EN
-- PAUSE a sa demande (il fournit une maquette). Ces colonnes et cette
-- fonction sont deja en production : ce fichier existe pour que le depot ne
-- mente pas sur l'etat de la base.
--
-- ── COLLABORATEURS : on n'ajoute QUE le prive ──────────────────────────
--
-- `collaborateurs.email` EST l'adresse professionnelle : c'est elle qui sert
-- a se connecter via Microsoft, et c'est par elle que le Hub rapproche un
-- collaborateur de son compte. Ajouter un `email_pro` a cote creerait deux
-- sources pour la meme chose, et un jour les deux differeraient sans qu'on
-- sache laquelle fait foi.
alter table public.collaborateurs
  add column if not exists email_prive text;

comment on column public.collaborateurs.email is
  'Adresse PROFESSIONNELLE, et identifiant de connexion Microsoft. Ne pas la '
  'dupliquer dans un email_pro : elle est la seule source.';
comment on column public.collaborateurs.email_prive is
  'Adresse personnelle. Sert a joindre quelqu''un hors du Hub (depart, perte '
  'd''acces). N''est JAMAIS une adresse de connexion.';

-- ── CLIENTS : les deux, parce qu'on ne sait pas ce que Brio envoie ──────
--
-- `clients.email` vient de Qlik et est reecrit a chaque synchronisation.
-- Rien ne dit si l'adresse qu'il porte est privee ou professionnelle — la
-- renommer en « pro » serait une affirmation invérifiable.
--
-- CES COLONNES SURVIVENT A LA SYNCHRO : scripts/qlik_clients.py fait un
-- upsert qui n'envoie que les quinze colonnes de son mapping ; une colonne
-- absente du mapping n'est pas touchee. Verifie dans le script.
alter table public.clients
  add column if not exists email_pro   text,
  add column if not exists email_prive text;

comment on column public.clients.email is
  'Adresse venue de Brio/Qlik, REECRITE a chaque synchronisation. Nature '
  'inconnue (privee ou pro). Ne rien y ecrire depuis le Hub : ce serait perdu.';
comment on column public.clients.email_pro is
  'Adresse professionnelle, saisie dans le Hub. Survit a la synchro Qlik.';
comment on column public.clients.email_prive is
  'Adresse privee, saisie dans le Hub. Survit a la synchro Qlik.';

-- ── LES APPAREILS CONNECTES ────────────────────────────────────────────
--
-- `auth.sessions` porte une ligne par session ouverte, avec le navigateur,
-- l'adresse IP, la date d'ouverture et le dernier rafraichissement.
--
-- SECURITY DEFINER, parce que le schema `auth` est ferme aux roles
-- applicatifs. Donc une seule garde, et elle vient en premier : RESERVE AUX
-- ADMINS. Sans elle, n'importe quel collaborateur lirait l'IP et le
-- navigateur de tous les autres.
--
-- ⚠️ DEFAUT CONNU, A CORRIGER QUAND LA REFONTE REPRENDRA : cette fonction
-- prend un uuid, en supposant que `collaborateurs.user_id` soit
-- l'identifiant du compte de connexion. IL NE L'EST PAS — cette colonne
-- contient le NUMERO DE PRODUCTEUR (001, 002, 003…). Le nom de la colonne
-- ment. Le seul rapprochement qui marche est l'EMAIL, et c'est deja ce que
-- fait src/lib/auth.jsx. La fonction doit donc etre reecrite avec un
-- parametre email. Sans appelant aujourd'hui, elle ne nuit pas.
create or replace function public.admin_sessions_utilisateur(p_user_id uuid)
returns table (
  session_id   uuid,
  ouverte_le   timestamptz,
  vue_le       timestamptz,
  expire_le    timestamptz,
  navigateur   text,
  adresse_ip   text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;
  return query
    select s.id, s.created_at, coalesce(s.refreshed_at, s.updated_at),
           s.not_after, s.user_agent, host(s.ip)
    from auth.sessions s
    where s.user_id = p_user_id
    order by coalesce(s.refreshed_at, s.updated_at) desc nulls last;
end $$;

-- La lecon du 06/11 : revoquer PUBLIC **et** anon, puis reverifier.
revoke execute on function public.admin_sessions_utilisateur(uuid) from public, anon;
grant  execute on function public.admin_sessions_utilisateur(uuid) to authenticated;
