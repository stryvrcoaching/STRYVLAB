# Registre de traitement — version de travail

Dernière revue technique : 15 juillet 2026  
Propriétaire interne à désigner : direction / référent protection des données  
Statut : inventaire technique initial, à valider avec le métier et le conseil juridique belge.

## Matrice des rôles

| Contexte | Responsable du traitement pressenti | Rôle de STRYV lab | Personnes concernées | Validation requise |
|---|---|---|---|---|
| Compte coach, abonnement, facturation et sécurité de STRYV lab | STRYV lab | Responsable | Coachs, membres d'équipe | Confirmer les bases légales et la durée comptable |
| Prospection et réservation de démonstration | STRYV lab | Responsable | Prospects | Confirmer les outils réellement activés et l'opt-in marketing |
| Dossier de coaching créé et piloté par un coach | Coach ou organisation | Sous-traitant technique pressenti | Clients coachés | DPA obligatoire et instructions documentées |
| Données de santé, nutrition, cycle, photos et performances d'un client coaché | Coach ou organisation | Sous-traitant technique pressenti | Clients coachés | Condition de l'article 9 et AIPD à documenter par traitement |
| Support, sécurité, fraude et incidents de plateforme | STRYV lab, avec articulation contractuelle pour les données client | Responsable ou responsable distinct selon la finalité | Tous les utilisateurs | Délimiter précisément les finalités propres |
| Analyses IA demandées dans le cadre du coaching | Coach ou organisation pour la finalité métier ; STRYV lab pour l'exploitation sécurisée du service | Sous-traitant et donneur d'instructions aux sous-traitants ultérieurs | Clients coachés | Information, base article 9, DPA, transferts et paramètres fournisseur |

## Activités de traitement observées

| Activité | Données principales | Finalité | Base/condition à confirmer | Accès | Systèmes observés | État |
|---|---|---|---|---|---|---|
| Authentification et compte coach | identité, e-mail, session, événements de sécurité | fournir et sécuriser le compte | contrat ; intérêt légitime sécurité | coach, support autorisé | Supabase Auth, Vercel | Technique en place |
| Gestion des clients | identité, coordonnées, notes, objectifs | permettre au coach d'organiser son activité | instructions du coach ; contrat coach-client | coach propriétaire, client concerné | Supabase DB | RLS et contrôles serveur renforcés |
| Bilans et questionnaires | réponses, habitudes, sommeil, stress, blessures | évaluation et suivi personnalisé | article 6 + condition article 9 à documenter | coach propriétaire, client concerné | Supabase DB/Storage | Données sensibles ; AIPD requise |
| Nutrition et repas | repas, macros, photos, voix, commentaires | journal et prescription nutritionnelle | article 6 + condition article 9 à documenter | coach propriétaire, client concerné | Supabase, OpenAI observé | Stockage privé renforcé |
| Morphologie et photos corporelles | images, mensurations, métadonnées | analyse morphologique et suivi | article 6 + condition article 9 à documenter | coach propriétaire, client concerné | Supabase, OpenAI observé | Risque élevé ; consentement/information à valider |
| Entraînement et performances | programmes, séances, charges, douleur, récupération | prescription et adaptation | instructions du coach | coach propriétaire, client concerné | Supabase DB | Contrôles multi-tenant à poursuivre |
| Santé connectée | pas, sommeil, poids, fréquence cardiaque, autorisations | enrichir le suivi client | consentement explicite observé dans le produit ; validité juridique à confirmer | client, coach autorisé | appareil, Supabase | Révocation technique observée |
| Paiements coach et clients | montants, statut, facture, références Stripe | paiement, facturation, comptabilité | contrat ; obligation légale | coach, STRYV lab selon le flux | Stripe, Supabase | RLS et webhooks durcis |
| E-mails et notifications | e-mail, type de notification, statut | communication transactionnelle et sécurité | contrat ; intérêt légitime ; consentement si marketing | destinataire, support limité | Resend, SMTP observé | Séparer transactionnel et marketing |
| Analyses IA | prompts métier, photos, données de contexte | assistance à l'analyse et à la rédaction | rôle/base du traitement source | utilisateurs autorisés, fournisseur IA | OpenAI et Anthropic observés | DPA, transferts, rétention et entraînement à vérifier |
| Analytics produit | identifiant utilisateur ou anonyme, source, page, événement, UTM | mesure produit et acquisition | consentement | équipe interne autorisée | tracker interne, Vercel Speed Insights observé | Consentement préalable présent pour le tracker interne |
| Demandes RGPD | identité, e-mail, type, statut, échéance, issue | traiter et prouver l'exercice des droits | obligation légale | personnel habilité | Supabase DB | Registre technique ajouté |
| Incidents et sécurité | compte, IP hachée ou limitée, action, horodatage | détection, réponse, preuve | intérêt légitime ; obligation de sécurité | personnel habilité | Supabase, e-mail | Ne jamais journaliser le contenu médical |

## Sous-traitants et services observés

La présence dans le code ne prouve ni l'activation en production ni la signature d'un DPA. Chaque ligne doit être vérifiée dans les comptes fournisseurs et les variables d'environnement déployées.

| Service | Usage observé | Données possibles | Contrat/DPA | Région/transfert | Décision avant lancement |
|---|---|---|---|---|---|
| Vercel | hébergement web et fonctions | requêtes, IP, journaux techniques | Actif confirmé | À vérifier sur le projet | Confirmer région, logs et accès support |
| Supabase | Auth, PostgreSQL, Storage | comptes et données produit sensibles | Actif confirmé | À vérifier sur le projet | Confirmer région, sauvegardes et suppression |
| Stripe | paiement, abonnement, Connect | identité, paiement, facture | Actif confirmé | À documenter | Conserver uniquement les références nécessaires |
| OpenAI | voix, nutrition, morphologie, check-ins | données de santé, images, texte, audio | Actif confirmé | À documenter | Vérifier rétention, entraînement, région et ZDR si disponible |
| Anthropic | Genesis et chat | réponses et contexte de conversation | Actif confirmé | À documenter | Limiter les flux aux fonctionnalités maintenues |
| Resend | e-mails transactionnels et sécurité | e-mail, contenu du message | Actif confirmé | À documenter | Interdire les données médicales dans les e-mails |
| Inngest | orchestration asynchrone | identifiants et charges de tâches | Actif confirmé | À documenter | Minimiser les payloads et définir la rétention |
| Cal.com / Calendly | réservation de démonstration | identité, contact, rendez-vous | Actifs confirmés | À documenter | Documenter les deux outils ou en retirer un |
| n8n | référence historique d'automatisation | aucune donnée ne doit y être envoyée | Inactif confirmé | Sans objet tant qu'inactif | Supprimer les références historiques restantes |

## Sources réglementaires de travail

- Autorité belge de protection des données — droits des citoyens : https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/droits-des-citoyens
- Autorité belge de protection des données — toolbox : https://www.autoriteprotectiondonnees.be/index.php/professionnel/premiere-aide/toolbox
- EDPB — droits des personnes : https://www.edpb.europa.eu/topics/key-gdpr-concepts/data-subject-rights_en
- EDPB — concepts de responsable et sous-traitant : https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en
