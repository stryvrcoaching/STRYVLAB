# Baseline sécurité, données et conformité — STRYV lab

**Statut :** audit initial à traiter avant une commercialisation large  
**Date :** 15 juillet 2026  
**Périmètre :** revue statique du dépôt et de la configuration versionnée. Aucun test d'intrusion, accès à la production, audit de configuration des prestataires ou avis juridique n'a été réalisé.

> Ce document est un plan de travail technique et opérationnel. Les qualifications juridiques, bases légales, contrats et textes publics doivent être validés par un conseil compétent en droit belge/européen de la protection des données et, le cas échéant, en droit de la santé.

## Conclusion

STRYV lab traite des données à haut niveau de sensibilité : identité, données de santé et de bien-être, nutrition, mensurations, performances, photos corporelles, cycle, échanges avec le coach et données de paiement. Le produit comporte déjà plusieurs contrôles utiles (RLS, événements de sécurité, vérification de signature Stripe, cookies de session Supabase, en-têtes HTTP). Cependant, il n'est pas encore prêt à être présenté comme une plateforme pleinement sécurisée ou conforme sans une phase de durcissement et de gouvernance.

Les priorités immédiates sont :

1. supprimer ou verrouiller les chemins d'inscription et d'accès public non maîtrisés ;
2. durcir les liens publics de bilan et les téléversements de photos ;
3. mettre à jour les dépendances vulnérables ;
4. cadrer l'envoi d'images et de données biométriques aux services d'IA ;
5. construire le socle RGPD contractuel et opérationnel, avant les pages publiques.

## Données et flux à documenter

| Domaine | Données observées | Services impliqués | Point à valider |
| --- | --- | --- | --- |
| Comptes et accès | e-mail, identité, sessions, IP, événements de sécurité | Supabase Auth, Supabase DB | Politique de session, MFA, conservation des logs |
| Coaching et santé | objectifs, blessures, sommeil, cycle, poids, mesures, nutrition, entraînement, check-ins | Supabase DB et Storage | Qualification par traitement, finalité et condition de l'article 9 RGPD |
| Images | photos de repas, profil, bilan et morphologie | Supabase Storage, services d'IA | Durée, accès, suppression, métadonnées EXIF, contrôle de fichiers |
| Analyses IA | photos corporelles, âge, sexe, mesures, blessures, contexte nutritionnel | OpenAI observé ; autres usages IA à confirmer | DPA, localisation et transferts, paramétrage d'absence d'entraînement, information et consentement explicite |
| Paiements | client, facture, montant, statut et références Stripe | Stripe | Rôle de chaque partie, conservation comptable et webhooks idempotents |
| Communications | e-mails transactionnels, notifications, push | Resend, SMTP, Web Push | Sous-traitants, durées, opt-in marketing et preuves de consentement |
| Produit et acquisition | attribution et événements d'usage | tracker interne observé, Vercel Speed Insights | Cookies/traceurs réellement déposés et mécanisme de consentement |
| Hébergement et automatisation | données applicatives et déclencheurs | Vercel, Supabase, n8n | Régions, DPA, liste des sous-traitants et mesures de transfert |

## Constats techniques prioritaires

### Critique — à traiter avant toute campagne d'acquisition

#### SEC-01 — Création de compte anonyme avec privilège serveur

**État au 15 juillet 2026 : remédié dans le Lot 0.** La route historique renvoie désormais `410 Gone` et le parcours de finalisation utilise l'e-mail magique avec vérification de l'adresse.

L'audit initial avait identifié que `app/api/auth/signup/route.ts` exposait une route de création d'utilisateur utilisant la clé de service Supabase avec `email_confirm: true`, sans preuve d'e-mail, sans validation structurée, sans limitation de requêtes et sans contrôle d'éligibilité côté serveur.

**Risque :** création abusive de comptes, contournement du parcours de vérification, pollution de données et risque de liaison indue à des sessions ou achats historiques.

**Remédiation :** retirer cette route si elle est obsolète ou la réserver à un flux serveur signé et idempotent. Utiliser le parcours d'invitation/confirmation Supabase, ajouter une validation Zod stricte, une limitation distribuée et des tests automatisés. Ne jamais auto-confirmer une adresse dans un endpoint public.

#### SEC-02 — Dépendances présentant des vulnérabilités critiques ou élevées

**État au 15 juillet 2026 : critiques directes remédiées, suivi transitoire requis.** Le projet déclare désormais `next@15.5.20`, `jspdf@4.2.1` et `nodemailer@9.0.1`. Les alertes directes associées à ces trois paquets ne ressortent plus. Des alertes élevées transitives subsistent notamment via Fabric et Inngest et doivent être traitées dans une mise à niveau testée séparément.

Le contrôle initial des dépendances de production relevait notamment des alertes critiques pour `next` et `jspdf`, ainsi que des alertes élevées pour `next`, `jspdf`, `nodemailer`, `fabric`, `tar`, `path-to-regexp` et `undici`.

**Risque :** les vulnérabilités concernent notamment des contournements d'autorisation/middleware, du déni de service, du rendu PDF et certaines bibliothèques transitive.

**Remédiation :** créer une branche dédiée de mise à niveau, mettre à jour vers des versions corrigées, exécuter les tests applicatifs et conserver un audit de dépendances bloquant les sévérités critique/élevée en CI.

### Élevé — à traiter dans le premier lot de durcissement

#### SEC-03 — Liens publics de bilan trop permissifs

**État au 15 juillet 2026 : partiellement remédié.** Les routes imposent désormais un format de jeton strict, une limitation distribuée par IP et jeton, des corps JSON bornés, un schéma de réponses dérivé du modèle figé et des réponses sans cache. Le stockage du seul condensat du jeton et la réduction de sa durée de validité restent à réaliser.

Les routes `app/api/assessments/public/[token]/*` utilisent un jeton présent dans l'URL pour lire, modifier et téléverser des données de bilan. Un jeton valide retourne notamment le nom du client, le modèle de bilan et les réponses déjà saisies. Aucun mécanisme commun de limitation de requêtes n'est observé sur ces routes.

**Risque :** le lien est un secret porteur : tout tiers qui l'obtient peut consulter ou altérer le bilan jusqu'à expiration. Les liens sont également plus susceptibles d'être copiés, transférés ou journalisés.

**Remédiation :**

- conserver uniquement un condensat du jeton côté base ;
- réduire la durée de validité et permettre une révocation immédiate ;
- ajouter une limitation distribuée par IP et par jeton ;
- minimiser les données renvoyées avant soumission ;
- imposer un schéma de réponses dérivé du modèle de bilan ;
- tracer les accès et téléversements sans enregistrer de données de santé dans les logs.

#### SEC-04 — Téléversements de fichiers insuffisamment contraints

**État au 15 juillet 2026 : partiellement remédié.** Les nouveaux uploads de profil, repas, suivi nutritionnel photo et Morpho Pro contrôlent taille, type déclaré et signature réelle JPEG/PNG/WebP, utilisent des noms serveur et des chemins privés. Les nouvelles photos de profil sont servies par une route autorisée, les URL de repas expirent après dix minutes et les URL du suivi nutritionnel photo ne sont plus persistées. La migration SQL efface les anciennes URL de ce dernier parcours. La suppression des métadonnées, l'analyse antimalware et le traitement des autres buckets restent à réaliser.

Les routes publiques de bilan et certaines routes de photos acceptent des extensions et types déclarés par le navigateur. Des contrôles explicites de taille, MIME réel, liste blanche d'extensions, quotas, analyse antimalware et suppression des métadonnées ne sont pas visibles. Les routes `app/api/client/meals/upload-photo/route.ts` et `app/api/client/profile/photo/route.ts` créent en outre des URL signées de plusieurs années, dont la dernière est enregistrée dans la base.

**Risque :** stockage de contenu non attendu, exposition prolongée d'images, dépassement de coûts et propagation de liens d'accès.

**Remédiation :** accepter uniquement des formats image précis, contrôler taille et signature de fichier côté serveur, générer des noms serveur, appliquer des quotas, supprimer les métadonnées, prévoir une analyse de fichiers et délivrer des URL de lecture courtes à la demande. Ne pas persister une URL signée ; persister uniquement le chemin d'objet.

#### SEC-05 — Traitements IA de photos et données de santé à formaliser

`app/api/morpho/analyze/route.ts` transmet à OpenAI des URL de photos corporelles temporaires ainsi que de l'âge, du sexe, des mesures et des blessures. D'autres parcours d'analyse alimentaire/voix utilisent aussi des modèles IA.

**Risque :** données de santé et images très identifiantes confiées à un sous-traitant externe sans éléments vérifiables dans le dépôt sur le cadre contractuel, la localisation, les transferts, la réutilisation pour entraînement, la durée et le retrait du consentement.

**Remédiation :** bloquer l'analyse IA par défaut tant que la personne n'a pas donné un consentement distinct, spécifique et traçable ; proposer une alternative sans IA lorsque possible ; conclure et archiver les DPA applicables ; vérifier les paramètres de non-entraînement/rétention ; documenter les transferts et mettre à jour l'AIPD.

#### SEC-06 — Autorisations dispersées malgré l'usage massif de la clé de service

**État au 15 juillet 2026 : remédiation en cours.** Un contrôle partagé distingue désormais coach propriétaire, client lié et tiers, et protège notamment les photos de profil, Morpho Pro, annotations, phases, aliments, check-ins et tags. Un test statique bloque toute nouvelle route `service_role` sous `/api/clients` qui accepterait un `clientId` sans garde explicite. La revue complète des 239 routes utilisant la clé de service reste à poursuivre hors des routes client prioritaires.

De nombreuses routes créent des clients Supabase avec `SUPABASE_SERVICE_ROLE_KEY`, ce qui contourne les règles RLS. Le dépôt comporte des migrations RLS et des contrôles de propriété utiles, mais chaque endpoint privilégié doit alors démontrer son autorisation objet par objet.

**Risque :** une régression sur un `clientId`, un `submissionId` ou un identifiant de photo peut devenir une fuite inter-coachs ou inter-clients.

**Remédiation :** centraliser `requireCoach`, `requireClient`, `requireCoachOwnsClient` et les autorisations de ressource ; réduire l'usage de la clé de service ; tester systématiquement les accès croisés coach A/coach B/client A/client B sur les routes sensibles.

#### SEC-07 — Limitation de requêtes non généralisée et non distribuée

**État au 15 juillet 2026 : largement remédié sur les parcours prioritaires.** Le limiteur Supabase atomique protège les bilans publics, la transcription et l'analyse vocale, les analyses nutritionnelles photo, Morpho Pro et les principaux uploads client. Il échoue en mode fermé si le stockage distribué est indisponible. Les autres appels IA et endpoints coûteux doivent encore être inventoriés et alignés.

La limitation observée sur certaines fonctionnalités IA repose sur une `Map` mémoire. Elle ne résiste pas aux redémarrages, aux multiples instances ni aux requêtes distribuées. Les parcours d'authentification, liens publics, téléversements et IA doivent tous recevoir une politique cohérente.

**Remédiation :** mettre en place un limiteur partagé et persistant (par IP, compte, jeton et action), avec quotas, délais progressifs et événements de sécurité.

#### SEC-08 — Paiements et administration privilégiée

**État au 15 juillet 2026 : remédiation prioritaire réalisée, migration vérifiée en production et lot technique clôturé.** Les statistiques Genesis exigent désormais l'accès interne avec allowlist, MFA, audit et limitation. Les créations de paiements vérifient le propriétaire du client et de l'abonnement. Tous les checkouts B2C historiques et leurs endpoints de paiement renvoient désormais `410 Gone` ou redirigent vers les conditions B2B. Les trois webhooks Stripe actifs — coaching, abonnement plateforme et Connect — vérifient leur signature et utilisent le registre d'idempotence commun. Les webhooks IPT et Genesis historiques vérifient encore la signature pour répondre proprement aux éventuelles livraisons Stripe, mais sont explicitement retirés et n'effectuent plus aucune écriture.

L'audit initial en lecture seule des tables de paiement avait confirmé RLS active, mais aussi des politiques historiques attribuées au rôle `public` et des privilèges SQL `anon` inutiles. Après application de la migration `20260715184000_payment_rls_and_webhook_lockdown.sql`, la vérification post-migration confirme RLS active sur les cinq tables concernées, quatre politiques réservées au rôle `authenticated`, l'absence de droits `anon` et l'absence de droits client sur `stripe_webhook_events`, désormais réservée à la clé de service.

**Risque résiduel :** les offres historiques désactivées ne doivent être réactivées qu'avec prix validés, parcours contractuel, journal transactionnel et tests de bout en bout. La configuration Stripe déployée doit conserver un secret distinct par destination active et limiter chaque destination aux types d'événements réellement nécessaires.

## Protections déjà présentes

- Session Supabase gérée par cookies côté serveur et middleware de rafraîchissement.
- En-têtes CSP, HSTS, anti-clickjacking, anti-sniffing et politique de permissions dans `next.config.js`.
- RLS activée dans de nombreuses migrations Supabase.
- Audit en lecture seule de la base déployée le 15 juillet 2026 : RLS active sur les principales tables de bilans, santé, cycle, morphologie et nutrition. Les trois tables d'assignation/priorité initialement exposées ont été verrouillées avec la migration `20260715183000_assignment_and_priority_rls.sql`. La vérification post-migration confirme RLS active, les cinq politiques attendues et l'absence de tout droit `anon` sur ces tables.
- Vérification de signature Stripe dans le webhook principal observé.
- Tables et helpers d'événements/incidents de sécurité pour les opérations internes.
- Liens de bilan à forte entropie et avec expiration.

Ces éléments sont une base utile, mais ils ne remplacent pas les contrôles d'autorisation serveur et la gouvernance de l'information décrits ci-dessus.

## Écart documentaire et légal

### RGPD-01 — Demandes de droits et transparence publique

**État au 15 juillet 2026 : fondation opérationnelle créée et migration vérifiée en production.** Le faux parcours de suppression du compte coach, qui se contentait de déconnecter l'utilisateur, crée désormais une demande d'effacement authentifiée, datée, suivie avec une échéance d'un mois et protégée contre les doublons. La vérification post-migration de `20260715185000_privacy_requests.sql` confirme RLS active, l'absence de droits `anon` et `authenticated`, l'absence de politiques d'accès direct, les quatre colonnes de suivi attendues et les trois index opérationnels. Le registre reste accessible uniquement aux workflows serveur de confiance. Les procédures de droits, conservation, incident, registre de traitement et brouillon d'AIPD sont documentées dans `docs/privacy/`.

Les pages confidentialité, cookies, mentions légales et conditions commerciales ont été réécrites pour supprimer les anciens prix, SLA, durées, régions et affirmations de conformité non vérifiées. Le tracker interne n'enregistre plus l'attribution avant le consentement ; le choix expire après six mois et sa réinitialisation efface les identifiants analytics.

**Éléments confirmés par l'exploitant :** HB Solution — Boukelmoune Kévin, Boulevard Président Kennedy 69, 7000 Mons, Belgique, +32 472 23 86 12, `contact@stryvlab.com`, BCE 0745.797.168, TVA BE0745797168 ; modèle commercial B2B ; mineurs admis sous la responsabilité du coach ; Vercel, Supabase, Stripe, OpenAI, Anthropic, Resend, Inngest, Cal.com et Calendly actifs ; n8n inactif. Les offres codées sont Solo 29 €/mois, Pro 79 €/mois et Studio 129 €/mois, avec un premier essai de 14 jours.

**Blocages avant publication commerciale :** valider juridiquement les rôles responsable/sous-traitant, la condition de l'article 9, le calendrier de conservation, les transferts, les DPA et les contrats. Le parcours mineur enregistre désormais l'attestation du coach, le représentant légal, l'auteur et l'horodatage, puis bloque l'invitation sans preuve complète. La résiliation crée une fenêtre de lecture/export de 90 jours et un export JSON coach. Une file idempotente supprime ensuite Auth, les cascades métier et les préfixes Storage connus ; les dossiers financiers passent en revue légale et les fournisseurs/sauvegardes restent à traiter selon leurs procédures. Le verrouillage base hors application et la validation réelle de la purge restent nécessaires avant garantie contractuelle.

**Validation réelle de la purge — 16 juillet 2026 :** un scénario synthétique exécuté contre Supabase production a créé puis supprimé un coach, un client Auth et deux fichiers factices. L'aperçu a inventorié un client, un compte Auth client candidat et deux fichiers. L'issue est `completed` et la contre-vérification indépendante confirme zéro profil, zéro client, les deux comptes Auth absents et aucune alerte ouverte. La preuve minimale est conservée dans `account_purge_jobs` sous l'identifiant `15a3144b-a7f9-4250-a4c9-ea9297cd8665`. L'exécution réelle reste désactivée par défaut jusqu'à activation explicite de `ACCOUNT_PURGE_ENABLED`.

La confirmation du modèle B2B a déclenché la fermeture des trois derniers endpoints historiques de paiement direct (`/api/checkout/init`, `/api/checkout/secure-free`, `/api/create-payment-intent`) et la redirection de toutes les anciennes pages `/checkout/*` et `/checkout-success/*`. Les assistants Anthropic Genesis ne proposent plus IPT, G+ ou OMNI et présentent uniquement les plans coach actifs.

Les brouillons historiques de `/confidentialite`, `/cgv` et `/mentions-legales` ont été remplacés par des versions préparatoires alignées sur l'état technique observé. Elles distinguent le modèle coach/client, signalent les validations manquantes et ne publient plus les anciens prix ou promesses non démontrées. Elles ne doivent toutefois pas être présentées comme juridiquement finalisées avant la revue des documents opérationnels et contrats ci-dessous.

Ne pas les finaliser par simple réécriture éditoriale. D'abord créer les documents opérationnels suivants :

1. **Matrice responsable/sous-traitant** : STRYV lab, coach/organisation, client final et chaque traitement.
2. **Registre des activités de traitement** : catégories, personnes, finalités, bases légales, accès, transferts, sous-traitants, conservation et mesures de sécurité.
3. **AIPD** : centrée sur les données de santé, les photos, le suivi longitudinal, les décisions assistées par IA et les accès coach/client.
4. **Politique de conservation et suppression** : durées par table, objet Storage, sauvegarde, logs et facturation ; procédures d'effacement/anonymisation vérifiables.
5. **Procédure de droits RGPD** : identité du demandeur, accès, rectification, export, effacement, opposition, délais, preuves et exceptions légales.
6. **Procédure d'incident** : qualification, confinement, registre, communication, décision de notification et responsables.
7. **Registre des sous-traitants** : DPA, localisation, transferts, mesures contractuelles et dates de revue.
8. **Contrat de sous-traitance (DPA)** à proposer aux coachs/organisations lorsque STRYV lab traite des données pour leur compte.

Les pages à publier après validation sont : mentions légales, politique de confidentialité distincte pour le site et le produit, politique cookies/traceurs, CGU/conditions d'abonnement coach, DPA, liste des sous-traitants et, si le paiement B2C demeure, CGV et parcours de rétractation adaptés.

## Feuille de route

### Lot 0 — Stop-the-line (avant prospection)

- [x] Désactiver l'inscription publique privilégiée historique.
- [~] Mettre à jour `next`, `jspdf` et `nodemailer` ; isoler les alertes transitives restantes.
- [~] Réduire les nouvelles URL signées et arrêter leur stockage pour les nouveaux avatars et journaux photo nutritionnels ; migrer les anciennes données restantes.
- [~] Ajouter la limitation distribuée aux bilans publics, analyses IA prioritaires et uploads sensibles ; terminer l'inventaire des endpoints coûteux secondaires.
- Geler les formulations publiques « conforme RGPD » jusqu'à validation du dossier de conformité.

### Lot 1 — Isolation et données sensibles

- Ajouter un module d'autorisation serveur unique et des tests d'accès inter-tenant.
- Valider l'état réel des politiques RLS dans l'environnement de production.
- Durcir tous les uploads, créer une politique de stockage et prévoir la suppression des métadonnées.
- Mettre en place MFA obligatoire pour les comptes internes et au minimum disponible pour les coachs.
- Centraliser les journaux d'accès aux données très sensibles, avec une rétention limitée et sans contenu médical.

### Lot 2 — RGPD et transparence

- Ateliers de cartographie avec produit, technique et métier.
- Produire registre, AIPD, matrice de rôles, calendrier de conservation et procédures de droits/incidents.
- Vérifier et signer les accords de sous-traitance de Supabase, Vercel, Stripe, OpenAI, Resend, n8n et tout prestataire réellement activé.
- Refaire les pages légales depuis ces sources validées ; ne pas copier-coller des affirmations non vérifiées.

### Lot 3 — Préparation commerciale

- Audit externe ciblé sur authentification, isolation multi-tenant, liens publics et téléversements.
- Revue juridique des contrats et textes publics.
- Guide commercial : ce que l'équipe peut dire sur sécurité, IA, hébergement, rôles RGPD et demandes de droits.
- Exercices de réponse à incident et de restauration de sauvegarde.

## Critères de mise sur le marché

La prospection peut présenter le produit lorsque les critères suivants sont remplis :

- aucun endpoint public ne crée un compte confirmé ou accède à une donnée de santé sans contrôle adapté ;
- les tests d'autorisation inter-tenant couvrent les routes et stockage sensibles ;
- les dépendances critiques/élevées ont été traitées ou font l'objet d'une exception documentée et temporaire ;
- les données IA sont couvertes par un choix explicite, des contrats et une information claire ;
- les sous-traitants, le registre, l'AIPD et la conservation ont été validés ;
- les pages publiques et contrats correspondent aux pratiques réellement appliquées ;
- une personne responsable sait exécuter le plan d'incident et les demandes RGPD.

## Références de travail

- [EDPB — analyse d'impact relative à la protection des données](https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_fr)
- [Autorité belge de protection des données — AIPD](https://www.autoriteprotectiondonnees.be/citoyen/comment-savoir-si-un-traitement-de-donnees-doit-faire-lobjet-dune-aipd)
- [Autorité belge de protection des données — registre des activités de traitement](https://www.autoriteprotectiondonnees.be/professionnel/rgpd-/registre-des-activites-de-traitement/que-doit-contenir-le-registre-)
