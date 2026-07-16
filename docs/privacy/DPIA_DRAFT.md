# AIPD — brouillon de cadrage

Statut : obligatoire à instruire avant commercialisation des traitements à risque élevé. Ce document ne constitue pas une AIPD validée.

## Périmètre

Traitements réguliers et longitudinaux de données de santé et de bien-être, nutrition, cycle, sommeil, blessures, performances, mensurations, photos corporelles, voix, échanges avec le coach et analyses assistées par IA.

## Nécessité d'une AIPD

Les facteurs de risque observés se cumulent : catégories particulières de données, suivi systématique, volume longitudinal, personnes potentiellement vulnérables, images corporelles, profilage, IA, multi-tenant et recours à plusieurs sous-traitants. La décision finale et son propriétaire doivent être consignés.

## Finalités à valider

- Permettre au coach de centraliser le dossier de son client.
- Prescrire et ajuster entraînement et nutrition.
- Restituer au client ses programmes et tendances.
- Assister le coach avec des analyses automatisées non décisionnelles.
- Sécuriser la plateforme et traiter les incidents.

Toute réutilisation pour entraînement de modèles, recherche, benchmark ou marketing est hors périmètre tant qu'elle n'a pas une finalité, une base, une information et des garanties propres.

## Risques principaux

| Risque | Impact possible | Mesures présentes | Mesures restantes |
|---|---|---|---|
| Accès d'un coach aux données d'un autre | divulgation de santé et atteinte à la confidentialité | RLS, contrôles serveur, tests inter-tenant | couverture exhaustive et audit externe |
| Lien ou objet Storage exposé | accès à une photo ou un bilan | buckets privés, URL courtes, validation de chemin | inventaire complet et purge automatique |
| Suppression partielle | données résiduelles ou compte encore actif | file de purge idempotente, manifeste Storage, cascade Auth, retries et alerte de revue légale | tests en environnement réel, extension fournisseur et procédure sauvegardes |
| Réutilisation IA non maîtrisée | transfert, rétention ou entraînement non attendu | appels serveur, fournisseurs identifiés | DPA, réglages ZDR/rétention, information et contrôle d'activation |
| Inférence erronée | recommandation inadaptée ou stigmatisation | coach humain dans la boucle | afficher incertitude, contestation et limites d'usage |
| Journal contenant des données médicales | fuite secondaire | événements de sécurité séparés | règle de redaction, tests et revue des logs |
| Compromission d'un compte coach | accès à plusieurs clients | sessions, MFA interne, événements | MFA coach, alertes et révocation centralisée |
| Conservation excessive | exposition prolongée | fenêtre J+90, file automatique et preuve minimale de purge | valider les durées financières, fournisseurs et sauvegardes |
| Données de mineurs | capacité/consentement insuffisants | attestation coach, identité de contact du représentant légal, horodatage et blocage de l'invitation | revue juridique du parcours, information adaptée à l'âge et retrait d'autorisation |

## Questions bloquantes

1. Valider juridiquement le parcours mineur désormais implémenté et préparer l'information adaptée à l'âge ainsi que le retrait d'autorisation.
2. Qui est responsable du traitement pour chaque offre directe historique ?
3. Quelle condition de l'article 9 est retenue par les coachs et comment STRYV lab en reçoit-il la preuve ?
4. Quels fournisseurs IA sont réellement actifs en production et avec quels réglages ?
5. Quelles régions, sauvegardes, durées de logs et mesures de transfert sont contractuellement garanties ?
6. Quelles décisions ou recommandations peuvent produire un effet significatif sur la personne ?
7. Quels destinataires internes ont besoin d'accéder aux données de santé et comment cet accès est-il revu ?

## Validation

- Propriétaire métier : à nommer.
- Référent sécurité : à nommer.
- Conseil protection des données : à nommer.
- Avis des coachs et clients représentatifs : à organiser.
- Risques résiduels acceptés : aucun à ce stade.
