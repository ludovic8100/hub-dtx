-- Ce qu'un relevé de compte producteur porte, et qu'on jetait.
--
-- Mesuré le 10/11/2026 en lisant un RCP VIVIUM 05-2026 : le document donne
-- une COMMUNICATION STRUCTURÉE (« ***410/1065/61088*** »), et 462 transactions
-- bancaires en portent une. C'est la clé de rapprochement la plus sûre qui
-- existe — un montant peut coïncider par hasard, une communication non.
alter table bordereaux
  add column if not exists communication text,
  add column if not exists total_debit  numeric,
  add column if not exists total_credit numeric;

comment on column bordereaux.communication is
  'Communication structurée imprimée sur le relevé (« 410/1065/61088 »), chiffres seuls. Clé de rapprochement prioritaire avec transactions.information_paiement.';
comment on column bordereaux.total_debit is
  'Totaux hors report, colonne débit : les primes dues à la compagnie.';
comment on column bordereaux.total_credit is
  'Totaux hors report, colonne crédit : commissions et encaissements portés au compte.';
comment on column bordereaux.paiement_precedent is
  'Report de solde en tête de relevé (solde de la période précédente).';
comment on column bordereaux.net is
  'Solde final du relevé, SIGNÉ : positif = en faveur du courtier (Dynassur reçoit), négatif = en faveur de la compagnie (Dynassur paie). Un RCP est normalement positif.';
comment on column bordereaux.commission is
  'Cumul des commissions de la période, tel qu''imprimé.';

create index if not exists idx_bordereaux_communication
  on bordereaux (communication) where communication is not null;

-- Un nouveau job sans entrée ici est un job qu'on ne verra pas tomber.
insert into jobs_attendus (job, libelle, plateforme, frequence_attendue, tolerance, actif, commentaire)
values (
  'bordereaux-lecture',
  'Lecture des montants dans les bordereaux PDF',
  'github',
  '1 day',
  '06:00:00',
  true,
  'GitHub Action bordereaux-lecture.yml (06:12 UTC), après le scan de 05:52. '
  'Lit les totaux du PDF : report de solde, débit, crédit, solde net signé, '
  'commissions et communication structurée. Priorité 2026 puis 2025 — les relevés '
  'bancaires commencent au 01/01/2025, avant il n''y a rien à rapprocher.'
)
on conflict (job) do update set
  libelle = excluded.libelle,
  plateforme = excluded.plateforme,
  frequence_attendue = excluded.frequence_attendue,
  tolerance = excluded.tolerance,
  actif = excluded.actif,
  commentaire = excluded.commentaire;
