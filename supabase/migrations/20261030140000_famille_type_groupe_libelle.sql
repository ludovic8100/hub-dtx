-- Appliquée en production le 30/10/2026 (Supabase MCP apply_migration « famille_type_groupe_libelle »).
-- Colonne « Type de groupe - Libellé » du rapport Brio « Preneur avec relation »
-- (Famille, Entreprise, Association, Autres, Groupe personnalisé). Facultative.
alter table public.famille add column if not exists type_groupe_libelle text;
comment on column public.famille.type_groupe_libelle is 'Type de groupe Brio (Famille, Entreprise, Association, Autres, Groupe personnalisé) — import Excel Preneur_Avec_Relation';
comment on column public.famille.numero_brio is 'Numéro Brio de la relation ; préfixe XLS-<hash> pour les lignes importées depuis le rapport Excel sans numéro';
