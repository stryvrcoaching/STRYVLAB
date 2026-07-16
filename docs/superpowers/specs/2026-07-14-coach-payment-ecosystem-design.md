# Écosystème d’encaissement coach — conception validée

**Date :** 14 juillet 2026  
**Statut :** conception validée, prête à être découpée en plan d’implémentation.

## Intention

STRYVLAB devient l’espace de pilotage de l’encaissement du coach. Le coach reste le vendeur, le titulaire de son compte Stripe et le destinataire des fonds. STRYVLAB orchestre les offres, factures, paiements, relances, confirmations et visibilité, sans traiter les données de carte.

La priorité est une expérience à faible friction : un client peut régler depuis l’application STRYVR ou un e-mail sécurisé ; le coach configure une fois ses règles, puis le système automatise le cycle de vie.

## Décisions actées

1. **Stripe Connect Standard avec paiements directs.** Chaque coach relie ou crée son propre compte Stripe. Il porte les frais Stripe, remboursements et litiges ; STRYVLAB reste le logiciel d’orchestration.
2. **Facturation native STRYVLAB au nom du coach.** Les factures, reçus et communications sont produits depuis le contexte du compte Stripe connecté. Les exigences légales par pays devront être validées avant mise en production commerciale.
3. **Périmètre d’encaissement complet.** Abonnements, paiements ponctuels, acomptes et échéanciers sont pris en charge.
4. **Moyens de paiement complets.** Carte, Apple Pay, Google Pay, prélèvement SEPA, virement bancaire Stripe et virement direct au coach, sous réserve de disponibilité par compte, pays, devise et appareil.
5. **Virement Stripe prioritaire.** Il fournit des instructions de virement liées à une facture et peut être rapproché automatiquement. Le virement direct au compte du coach est proposé comme alternative contrôlée et reste en attente jusqu’à confirmation manuelle.
6. **Canaux de communication unifiés.** Le client choisit l’application STRYVR, l’e-mail ou les deux. Les documents et confirmations nécessaires restent envoyés même si les rappels non essentiels sont désactivés.
7. **Automatisation par défaut.** Facture, confirmation, reçu, relances et information d’échec sont envoyés automatiquement selon les réglages du coach ; un journal permet de contrôler et renvoyer une communication.
8. **Sécurité renforcée.** L’authentification renforcée devient obligatoire avant le premier paiement réel et pour connecter Stripe, modifier l’IBAN, rembourser, exporter des données financières ou modifier des droits financiers.

## Expérience coach

Dans `Coach settings → Facturation`, séparer explicitement :

- **Mon abonnement STRYVLAB** : abonnement du coach à la plateforme.
- **Encaissements de mes clients** : espace de configuration des paiements client.

L’espace d’encaissement comporte, dans cet ordre :

1. état du compte Stripe et parcours de connexion ;
2. moyens de paiement disponibles, présentés avec leurs icônes officielles et une explication courte ;
3. coordonnées de virement direct, désactivées par défaut, avec aperçu client ;
4. réglages d’envoi automatique ;
5. aide contextuelle déroulante et lien vers un guide coach orienté actions ;
6. résumé des montants en attente, retards et dernières confirmations.

La documentation emploie un langage métier et non technique : connecter un compte, choisir un moyen, envoyer une première facture, comprendre un virement, gérer un impayé. Côté client, employer uniquement « application STRYVR », jamais « PWA ».

## Parcours client et automatisations

La facture est l’objet unique qui relie l’offre, le client, l’échéance, la tentative, le paiement et les communications. Elle est visible dans STRYVR et peut être ouverte par un lien sécurisé depuis l’e-mail.

Les états sont : brouillon, envoyée, en attente, en cours de traitement, payée, échouée, en retard, remboursée et annulée. Stripe est la source de vérité financière : un écran client ne peut jamais confirmer seul un paiement.

Événements automatiques :

- facture finalisée → facture envoyée ;
- confirmation Stripe → statut mis à jour, reçu client et notification coach ;
- virement direct confirmé par le coach → même séquence ;
- échéance ou retard → rappels configurés ;
- échec → information claire et nouvelle possibilité de règlement ;
- remboursement → confirmation et mise à jour documentaire.

Chaque envoi est tracé avec son canal, sa date et son résultat. Le coach peut appliquer une exception sur une facture sans modifier la règle générale.

## Modèle fonctionnel et sécurité

Le modèle existant de formules, abonnements et paiements évolue autour de nouveaux objets : configuration d’encaissement coach, facture, tentative de paiement, préférences de communication et historique d’audit/automatisation.

Le traitement Stripe est asynchrone, authentifié et idempotent. Les rappels ne dépendent pas de la présence du coach dans l’application. Les données de carte et mandats ne transitent pas par STRYVLAB. Les coordonnées de virement direct du coach sont réduites à l’IBAN, BIC et titulaire, chiffrées au repos, masquées dans l’interface et jamais reproduites intégralement dans un e-mail.

Les liens de facture sont uniques, expirables et révocables. Les actions financières sensibles sont auditées, confirmées et protégées par réauthentification. Les traitements doivent couvrir les doubles paiements, échecs d’envoi, remboursements, virements partiels, litiges et incohérences de synchronisation.

## Hors périmètre initial

- STRYVLAB n’est pas le vendeur légal ni le détenteur des fonds.
- Pas de stockage de carte, de mandat ou de données bancaires client.
- Pas de rapprochement automatique d’un virement direct hors Stripe au lancement.
- Pas de promesse de conformité fiscale multi-pays sans validation juridique et comptable locale.

## Références de décision

- Stripe Connect, paiements directs : https://docs.stripe.com/connect/direct-charges
- Stripe Connect, facturation : https://docs.stripe.com/invoicing/connect
- Stripe, virements bancaires : https://docs.stripe.com/invoicing/bank-transfer
- Stripe, sécurité : https://docs.stripe.com/security
