-- Déclare le scan SharePoint → factures_achat au garde-fou des synchronisations.
--
-- Sans cette ligne, `v_jobs_sante` ne connaît pas le job et Outils →
-- Synchronisations ne peut pas signaler son arrêt. C'est exactement ce qui
-- s'est passé avec le workflow n8n qu'il remplace : arrêté le 20/10/2026 à
-- 09:45, personne ne l'a vu pendant treize jours.
--
-- Fréquence : une fois par jour (cron 05:37 UTC dans factures-sharepoint.yml).
-- Tolérance : 6 h, comme qlik-sync — un retard d'une matinée n'est pas une panne.

INSERT INTO jobs_attendus (job, libelle, plateforme, frequence_attendue, tolerance, actif, commentaire)
VALUES (
  'factures-sharepoint',
  'Documents SharePoint → factures d''achat',
  'github',
  interval '1 day',
  interval '6 hours',
  true,
  'GitHub Action factures-sharepoint.yml (05:37 UTC) — remplace le workflow n8n « Rapprochement Factures », arrêté le 20/10/2026'
)
ON CONFLICT (job) DO UPDATE SET
  libelle            = EXCLUDED.libelle,
  plateforme         = EXCLUDED.plateforme,
  frequence_attendue = EXCLUDED.frequence_attendue,
  tolerance          = EXCLUDED.tolerance,
  actif              = EXCLUDED.actif,
  commentaire        = EXCLUDED.commentaire;
