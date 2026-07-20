# Assistant WhatsApp STRYV lab

Cette première livraison utilise l’API Cloud officielle de Meta et met en service un assistant volontairement **lecture seule**. Elle sécurise l’entrée WhatsApp, rattache un numéro au coach et journalise chaque traitement. Les modifications de macros, programmes, objectifs ou messages client ne sont pas exécutées par ce flux.

## Mise en service

1. Créez l’application Meta et ajoutez WhatsApp Cloud API.
2. Renseignez les variables `WHATSAPP_*` de `env.production.example` dans l’environnement de déploiement, y compris la version Graph API actuellement proposée par Meta dans votre tableau de bord.
3. Appliquez la migration `20260719090000_whatsapp_coach_agent_foundation.sql`.
4. Dans Meta, déclarez `https://votre-domaine/api/webhooks/whatsapp` et utilisez la valeur de `WHATSAPP_VERIFY_TOKEN` lors de la vérification.
5. Dans STRYV lab, enregistrez le numéro du coach au format international dans **Mon compte → Profil pro**, activez l’IA Coach, puis activez l’assistant WhatsApp dans **IA Coach**.

Chaque requête Meta est contrôlée avec `x-hub-signature-256`. Les messages sont dédupliqués par leur identifiant fournisseur et le contenu brut reste accessible au service uniquement, afin de limiter l’exposition de données sensibles.

## Garde-fous actifs

- Numéro de coach explicitement lié et activation explicite.
- Réponses limitées au contexte minimal des clients actifs.
- Toute formulation de modification est refusée sans action sur les données.
- Messages vocaux explicitement différés : aucune transcription n’est lancée par défaut.
- Audit de réception, réponse et échec dans `whatsapp_agent_audit_logs`.

## Étape suivante avant les actions d’écriture

Avant d’ajouter les outils de prescription, il faut livrer une table de propositions d’action structurées, une confirmation WhatsApp liée à une proposition unique, des validations métier par outil, et un journal d’annulation. L’autonomie et la tarification restent des décisions produit à confirmer ; elles ne sont pas supposées par cette livraison.
