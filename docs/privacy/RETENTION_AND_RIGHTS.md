# Conservation, suppression et droits RGPD

Dernière revue technique : 15 juillet 2026  
Statut : politique opérationnelle proposée. Les durées doivent être validées au regard du droit belge, des obligations comptables, des contrats et des sauvegardes fournisseurs.

## Principes

1. Aucune conservation illimitée par défaut.
2. Une durée est attachée à chaque finalité, pas seulement à chaque table.
3. Une demande d'effacement n'entraîne pas la suppression des éléments soumis à une obligation légale ; ceux-ci sont isolés et leur usage est limité.
4. Une suppression couvre la base, le Storage, les index, les tâches différées, les exports temporaires et, selon le cycle fournisseur, les sauvegardes.
5. Les preuves de traitement d'une demande RGPD ne contiennent pas les données de santé concernées.

## Calendrier proposé à valider

| Catégorie | Déclencheur | Durée proposée | Action | État technique |
|---|---|---:|---|---|
| Session et jetons temporaires | expiration ou révocation | durée technique minimale | expiration/révocation | Partiel |
| Limitation de débit | fin de fenêtre | fenêtre + marge opérationnelle courte | purge automatique | À automatiser |
| Photos temporaires d'analyse | analyse terminée | 24 h à 30 jours selon le besoin métier validé | suppression Storage + référence DB | À décider et automatiser |
| Photos de suivi conservées | fin de relation coach-client | 90 jours proposés, sauf instruction/obligation différente | suppression ou restitution | À valider |
| Données actives de coaching | relation active | durée du contrat | accès normal | En place |
| Données de coaching après fin | fin de contrat | 90 jours pour restitution, puis effacement | restriction puis purge | Fenêtre, restriction et file de purge en place |
| Compte coach après résiliation | fin effective de l'abonnement | 90 jours d'accès à l'export, puis purge métier | lecture/export puis purge | Automatisé hors données financières et revue fournisseur |
| Factures et pièces comptables | date de pièce | durée légale belge à confirmer par comptable/juriste | archivage restreint | À valider |
| Journaux de sécurité | création | 6 à 12 mois proposés selon criticité | purge automatique | À implémenter |
| Analytics consentis | collecte | 13 mois maximum proposé, à réduire si possible | agrégation/purge | À implémenter |
| Demandes RGPD et preuve | clôture | durée de prescription à confirmer | accès restreint puis purge | Registre créé |
| Sauvegardes | création | cycle fournisseur le plus court compatible avec la reprise | expiration automatique | À documenter |

## Procédure de demande

### Réception

- Canal authentifié : `/api/privacy/requests` depuis les paramètres du compte.
- Canal externe : `contact@stryvlab.com`, objet `Demande RGPD`.
- Enregistrer la date de réception, le type de droit, l'identité, le statut et l'échéance.
- Ne jamais demander une copie complète d'un document d'identité si une méthode moins intrusive suffit.

### Vérification de l'identité

- Une session authentifiée valide constitue la preuve par défaut pour le compte concerné.
- Pour un demandeur non connecté, comparer uniquement les éléments nécessaires et utiliser un lien à usage unique si possible.
- En cas de doute raisonnable, demander une preuve proportionnée et supprimer cette preuve dès la vérification terminée.

### Instruction

1. Identifier si STRYV lab agit comme responsable ou comme sous-traitant du coach.
2. Si STRYV lab est sous-traitant, avertir et assister le coach responsable selon le DPA, sans ignorer la demande.
3. Geler les suppressions concurrentes et les tâches asynchrones susceptibles de recréer les données.
4. Recenser les données en base, Storage, Auth, paiement, e-mail, IA, logs, exports et sauvegardes.
5. Protéger les données de tiers dans toute copie d'accès.
6. Documenter les exceptions et restrictions appliquées.

### Délai et réponse

- Répondre sans retard injustifié et en principe dans un délai d'un mois à compter de la réception.
- Une prolongation maximale de deux mois supplémentaires peut être envisagée pour une demande complexe ; informer la personne dans le premier mois et motiver la prolongation.
- Si la demande est refusée ou partiellement refusée, expliquer les motifs, les recours et le droit de saisir l'Autorité de protection des données.

### Clôture

- Enregistrer la date, l'opérateur, les systèmes traités et un résumé sans données sensibles.
- Vérifier que les liens d'export ont expiré et que les fichiers temporaires ont été supprimés.
- Conserver uniquement la preuve minimale nécessaire.

## Exigences d'implémentation restantes

- Étendre l'export structuré aux fichiers Storage et fournir un export autonome au client final.
- Renforcer la lecture seule post-résiliation au niveau base pour les accès directs hors application.
- Valider la purge en environnement réel et compléter tout bucket ou dépendance découvert par ce test.
- Mise en attente des événements Inngest/n8n lors d'une demande d'effacement.
- Jobs de purge pour photos temporaires, rate limits, logs, analytics et demandes clôturées.
- Tableau interne des demandes avec alertes à J-7 et dépassement.

## Contrôles désormais disponibles

- À la résiliation Stripe, le système enregistre la fin de facturation, la fin de fenêtre d'export à J+90 et la date de revue de suppression.
- Les mutations applicatives du coach sont bloquées pendant le mode lecture seule, hors export, demande RGPD et réactivation de l'abonnement.
- Le coach peut télécharger depuis ses réglages une archive JSON paginée de son compte, de son CRM, des bilans, des programmes et des protocoles nutritionnels principaux.
- Les jetons publics de bilan et les empreintes de liens de facture sont retirés de l'archive.
- À J+90, une file service-only réclame les dossiers de façon atomique, prépare un manifeste, supprime le compte Auth et les données en cascade, puis nettoie les préfixes Storage connus avec reprise sur erreur.
- La présence de factures, paiements, commissions ou d'un rôle commercial interdit la purge automatique et crée une alerte de revue légale dans le dispositif sécurité interne.
- Les journaux conservés sont minimisés avant la suppression du compte ; la preuve de demande RGPD devient pseudonyme.
- Stripe, Resend, Vercel et les sauvegardes Supabase restent dans une liste de revue fournisseur : le cron ne prétend pas les effacer directement.
- L'exécution destructive reste désactivée par défaut avec `ACCOUNT_PURGE_ENABLED=false` jusqu'à validation d'un test de préproduction.
- Une route interne protégée produit un aperçu non destructif : blocages, comptes clients Auth candidats et nombre de fichiers par bucket, sans révéler leurs chemins.
- Le test synthétique en production du 16 juillet 2026 a supprimé un coach, un client Auth et deux fichiers factices ; la contre-vérification confirme l'absence de résidus et une preuve `completed` (`15a3144b-a7f9-4250-a4c9-ea9297cd8665`).
- Le protocole d'activation, de revue légale et d'arrêt d'urgence est documenté dans `docs/privacy/ACCOUNT_PURGE_RUNBOOK.md`.
- Tests de restauration et preuve que les sauvegardes expirent selon le calendrier.
