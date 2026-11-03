-- Lien virement ↔ relevé de compte producteur (01/11/2026).
--
-- Même principe que les factures d'achat : le PDF reste sur SharePoint, la base
-- ne garde que le lien (bordereaux.url_sharepoint, déjà rempli pour les 4 687
-- documents). On ajoute ici de quoi RATTACHER un relevé au virement qui lui
-- correspond, et de quoi voir ce qui n'a pas de relevé.
--
-- La clé du rattachement est le MONTANT, pas la période. Vérifié sur AG :
-- le RCP au 31/05/2026 annonce « Solde de votre compte 40.181,66 EUR », et le
-- virement du 04/06/2026 fait 40 181,66 € — au centime. La période lue dans le
-- document remplace donc la période devinée à partir de la date du virement,
-- qui était fausse pour la moitié des montants encaissés.

alter table public.bordereaux
  add column if not exists solde_releve       numeric,
  add column if not exists paiement_precedent numeric,
  add column if not exists date_cloture       date,
  add column if not exists transaction_id     uuid references public.transactions(id) on delete set null,
  add column if not exists extrait_le         timestamptz;

comment on column public.bordereaux.solde_releve is
  'Solde annoncé par le relevé = montant que la compagnie va verser. Clé de rapprochement avec le virement.';
comment on column public.bordereaux.paiement_precedent is
  'Ligne « notre paiement » du relevé : le virement du mois précédent. Sert de contrôle croisé.';
comment on column public.bordereaux.date_cloture is
  'Date de clôture lue dans le document (ex. « Relevé au 31/05/2026 »), pas déduite du nom de fichier.';

alter table public.transactions
  add column if not exists bordereau_id bigint references public.bordereaux(id) on delete set null;

comment on column public.transactions.bordereau_id is
  'Relevé de compte producteur rattaché à ce virement. Écrire TOUJOURS les deux côtés (voir CLAUDE.md).';

create index if not exists idx_bordereaux_solde       on public.bordereaux (solde_releve) where solde_releve is not null;
create index if not exists idx_bordereaux_transaction on public.bordereaux (transaction_id) where transaction_id is not null;
create index if not exists idx_transactions_bordereau on public.transactions (bordereau_id) where bordereau_id is not null;
