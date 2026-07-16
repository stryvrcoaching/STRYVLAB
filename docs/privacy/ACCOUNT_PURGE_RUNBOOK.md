# Runbook — purge des comptes après résiliation

Dernière validation technique : 16 juillet 2026  
Propriétaire opérationnel : HB Solution  
Contact vie privée : `contact@stryvlab.com`

## Objet

Ce runbook encadre la suppression des comptes coach arrivés au terme de leur fenêtre de restitution de 90 jours. La purge couvre le compte Auth, les données métier supprimées par cascade, les comptes Auth clients devenus orphelins et les préfixes Storage inventoriés.

Les factures, paiements, commissions et comptes commerciaux bloquent toute suppression automatique. Stripe, Resend, Vercel et les sauvegardes Supabase restent soumis à une revue fournisseur séparée.

## Garde-fous

- `ACCOUNT_PURGE_ENABLED=false` empêche toute réclamation de dossier par le cron.
- Le cron traite cinq dossiers maximum par passage.
- Un dossier ne peut être réclamé que par une exécution grâce à `FOR UPDATE SKIP LOCKED`.
- Trois tentatives maximum sont lancées automatiquement, avec délai croissant.
- Une réactivation annule les dossiers non terminés.
- Les dossiers financiers passent au statut `legal_review` et ouvrent un incident interne.
- La preuve de purge ne dépend pas de `auth.users` et survit à la suppression du compte.

## Validation réalisée

Test synthétique en production du 16 juillet 2026 :

- preuve : `account_purge_jobs.id = 15a3144b-a7f9-4250-a4c9-ea9297cd8665` ;
- un coach et un client Auth fictifs ;
- deux fichiers fictifs dans `coach-assets` et `profile-photos` ;
- aperçu éligible avec un client et un compte Auth client candidat ;
- issue `completed`, deux fichiers supprimés ;
- contre-vérification : zéro profil, zéro client, comptes Auth absents et aucune alerte ouverte.

## Activation progressive

1. Déployer le code avec `ACCOUNT_PURGE_ENABLED=false`.
2. Vérifier que `/api/admin/privacy/purge-jobs` ne contient aucun dossier inattendu.
3. Utiliser `/api/admin/privacy/purge-preview?coachId=...` pour chaque premier candidat réel.
4. Faire valider tout blocage financier par le comptable ou le conseil juridique.
5. Définir `ACCOUNT_PURGE_ENABLED=true` dans l'environnement Production Vercel.
6. Redéployer pour appliquer la variable.
7. Surveiller le premier passage du cron et les incidents `account_purge:*`.
8. Vérifier le statut `completed` et le manifeste avant d'élargir la surveillance normale.

## Arrêt d'urgence

1. Remettre immédiatement `ACCOUNT_PURGE_ENABLED=false`.
2. Redéployer l'environnement Production.
3. Examiner les dossiers `processing` et `failed` sans les relancer manuellement.
4. Conserver les preuves et qualifier tout effacement imprévu comme incident de disponibilité/intégrité.
5. Ne jamais restaurer globalement une sauvegarde sans analyser le risque de réintroduire des données déjà effacées.

## Revue des dossiers bloqués

Pour un statut `legal_review` :

1. identifier précisément la catégorie financière signalée ;
2. confirmer la durée et le périmètre légalement nécessaires ;
3. isoler ou minimiser les données qui doivent être conservées ;
4. documenter la décision dans la demande RGPD et le dossier de purge ;
5. ne relancer la suppression qu'après validation formelle.
