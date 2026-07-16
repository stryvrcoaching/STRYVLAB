# Écosystème d’encaissement coach — plan d’implémentation

> **Pour les intervenants :** exécuter ce plan par lots, en vérifiant chaque lot avant de continuer.

**Objectif :** faire évoluer le paiement coaching vers Stripe Connect Standard et installer le socle de facturation, de configuration coach, d’automatisation et de sécurité validé dans la conception du 14 juillet 2026.

**Architecture :** conserver les domaines existants `coach_formulas`, `client_subscriptions` et `subscription_payments` pour la compatibilité, mais introduire la facture comme objet de cycle de vie et une configuration d’encaissement par coach. Tous les nouveaux objets Stripe sont créés dans le compte connecté du coach. Les webhooks Connect deviennent l’unique confirmation financière.

**Pré-requis externes avant l’activation réelle :** Stripe Connect est activé sur le compte plateforme, l’identifiant client Connect et l’URL de retour sont configurés, et l’endpoint de webhook Connect est enregistré. Les clés restent absentes de l’interface et ne sont jamais journalisées.

## Lot 1 — socle fiable et configuration coach

### Tâche 1 : migration de données et règles d’accès

**Fichiers :**
- Créer : `supabase/migrations/<timestamp>_coach_payment_ecosystem.sql`
- Mettre à jour si nécessaire : types Supabase générés ou modèles TypeScript concernés.

- [x] Créer `coach_payment_settings` avec état Connect, moyens de paiement, préférences d’automatisation et coordonnées de virement direct chiffrées.
- [x] Créer `coach_invoices`, `invoice_payment_attempts`, `payment_notification_deliveries`, `payment_audit_events` et `stripe_webhook_events`.
- [x] Ajouter statuts contrôlés, contraintes de propriété coach/client, index de recherche et RLS strictes.
- [x] Préserver le fonctionnement des tableaux CRM fondés sur `subscription_payments` pendant la migration.
- [x] Ajouter une stratégie d’idempotence et une référence de rapprochement pour les virements directs.

**Vérification :** migration appliquable sur une base vide et sur le schéma existant ; chaque table est isolée par `coach_id`.

### Tâche 2 : couche Stripe Connect et configuration sécurisée

**Fichiers :**
- Créer : `lib/stripe/connect.ts`
- Créer : `app/api/stripe/connect/onboard/route.ts`
- Créer : `app/api/stripe/connect/refresh/route.ts`
- Créer : `app/api/stripe/connect/status/route.ts`
- Mettre à jour : documentation d’environnement.

- [x] Ajouter une couche qui expose un état de compte connecté prêt à être exigé par les nouveaux encaissements du lot 2.
- [x] Créer le parcours de connexion/retour Stripe Standard, avec état anti-CSRF et vérification du propriétaire coach.
- [x] Retourner un état produit lisible : non connecté, informations à compléter, prêt, restreint.
- [x] Ne jamais retourner de secrets ou de coordonnées bancaires brutes à un client non autorisé.
- [x] Ajouter les garde-fous de configuration et des erreurs actionnables quand les variables Connect sont absentes.

**Vérification :** tests unitaires des états et des permissions ; routes non authentifiées refusées.

### Tâche 3 : nouvelle zone Encaissements clients dans les réglages coach

**Fichiers :**
- Modifier : `app/coach/settings/page.tsx`
- Créer : `components/coach/settings/CoachPaymentSettingsSection.tsx`
- Créer : `components/coach/settings/PaymentMethodGuide.tsx`
- Créer : `app/api/coach/payment-settings/route.ts`

- [x] Séparer « Mon abonnement STRYVLAB » et « Encaissements de mes clients ».
- [x] Afficher l’état Stripe Connect, les méthodes disponibles avec leurs icônes et une aide déroulante.
- [x] Permettre les réglages d’automatisation ; le virement direct reste verrouillé jusqu’à la livraison du chiffrement applicatif et de la réauthentification renforcée.
- [x] Garder le virement direct indisponible tant que la réauthentification renforcée n’est pas livrée au lot 3.
- [x] Ajouter un guide contextuel orienté coach, sans jargon « PWA ».

**Vérification :** rendu responsive, navigation clavier, textes client compréhensibles et absence de données sensibles dans le HTML initial.

## Lot 2 — encaissement, factures et synchronisation

### Tâche 4 : émettre les factures et sessions de paiement dans le compte du coach

**Fichiers :**
- Créer : routes/services de facturation Connect.
- Modifier : `app/api/stripe/coaching/checkout/route.ts` ou le remplacer progressivement.
- Modifier : les parcours formule/abonnement qui lancent le checkout.

- [ ] Créer les clients, produits, prix, factures et Checkout Sessions dans le compte Stripe connecté.
- [ ] Gérer paiement ponctuel, abonnement, acompte et échéancier avec une facture source unique.
- [ ] N’exposer au client que des liens Stripe ou STRYVLAB signés et révocables.
- [ ] Conserver le flux historique sur le compte plateforme jusqu’à migration explicite, sans mélange de comptes Stripe.

**Vérification :** scénarios Stripe sandbox pour carte, wallet, SEPA et facture ponctuelle ; un coach ne peut jamais encaisser sur le compte d’un autre coach.

### Tâche 5 : webhooks Connect, rapprochement et historique

**Fichiers :**
- Créer ou modifier : endpoint webhook Connect dédié.
- Créer : services de synchronisation de facture et d’audit.
- Adapter : `subscription_payments` et la comptabilité existante par projection compatible.

- [ ] Vérifier la signature, l’ID d’événement, le compte Connect source et l’idempotence avant chaque écriture.
- [ ] Synchroniser succès, échec, remboursement, litige et évolution d’abonnement vers la facture et les projections existantes.
- [ ] Gérer le virement Stripe selon ses capacités ; le virement direct reste en attente jusqu’à confirmation coach tracée.
- [ ] Prévoir la détection et la visualisation des erreurs de synchronisation.

**Vérification :** mêmes webhooks rejoués sans doublon ; double paiement, paiement partiel et remboursement ne corrompent pas les états.

## Lot 3 — parcours client, automatisation et sécurité renforcée

### Tâche 6 : expérience client et communications automatiques

**Fichiers :**
- Créer : routes/pages de facture client sécurisées.
- Modifier : application STRYVR, mailer et tâches planifiées de rappel.
- Créer : documentation coach dédiée aux paiements.

- [ ] Afficher les factures dans l’application STRYVR et envoyer les liens e-mail selon les préférences du client.
- [ ] Automatiser factures, confirmations, reçus, échecs et rappels avec journal de livraison.
- [ ] Respecter les choix de canal tout en envoyant les documents contractuels nécessaires.
- [ ] Employer « application STRYVR » dans tous les textes client.

**Vérification :** un scénario complet confirme que le client ne reçoit ni doublon ni canal non autorisé ; les messages essentiels sont toujours délivrés.

### Tâche 7 : réauthentification, audit et durcissement

**Fichiers :**
- Créer : mécanisme de réauthentification ponctuelle et contrôles de rôle.
- Modifier : routes de remboursement, exports et configuration bancaire.

- [ ] Obliger une authentification renforcée avant l’activation réelle et les opérations sensibles validées.
- [ ] Enregistrer les actions financières immuables avec auteur, cible et contexte.
- [ ] Ajouter limites de débit, révocation de liens, masquage, chiffrement de champs et alertes de changements sensibles.
- [ ] Définir rétention, export et suppression conformes au cadre de protection des données retenu.

**Vérification :** tentative d’accès croisé, session expirée, lien révoqué, modification d’IBAN et remboursement sont tous refusés ou journalisés selon le cas.

### Tâche 8 : couverture de tests et mise en production contrôlée

- [ ] Ajouter tests de domaine, routes, composants et flux Stripe sandbox.
- [ ] Exécuter lint, vérification TypeScript et build de production.
- [ ] Préparer une checklist Stripe Connect, migration de coach pilote, rollback et monitoring.
- [ ] Lancer d’abord pour un groupe pilote sans migration automatique des paiements historiques.

**Vérification :** aucune régression sur l’abonnement STRYVLAB ; toutes les vérifications du plan sont vertes avant l’activation pilote.
