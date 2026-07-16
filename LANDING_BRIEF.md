# STRYV lab — Landing Brief

**Statut :** approuvé pour implémentation  
**Périmètre :** landing principale `/` uniquement  
**Date :** 2026-07-10

## 1. Contexte

### Produit

**STRYV lab** est la plateforme de travail du coach. Elle centralise les profils clients, les bilans, les données de suivi, les prescriptions, les programmes, les métriques et les outils d’aide à la décision.

La plateforme comprend également une PWA client complète appelée **STRYVR**. Elle peut être montrée comme l’expérience client connectée au travail du coach, mais son dossier de landing `/stryvr` est explicitement hors périmètre de ce brief.

### Type de SaaS

Le positionnement retenu est **demo-led B2B / early-stage** : la conversion principale est une réservation de démonstration personnalisée, et non une inscription self-serve immédiate.

### Maturité

Le produit est suffisamment avancé pour présenter une plateforme et une PWA complètes. La présence de coachs en bêta est envisagée, mais le nombre exact et les résultats associés restent à confirmer avant publication.

### Références du repo

- Landing actuelle : [app/page.tsx](/Users/user/Desktop/STRYVLAB/app/page.tsx) et [components/landing/SaasLanding.tsx](/Users/user/Desktop/STRYVLAB/components/landing/SaasLanding.tsx). [components/landing/CoachWorkflowLanding.tsx](/Users/user/Desktop/STRYVLAB/components/landing/CoachWorkflowLanding.tsx) reste une ancienne implémentation de référence.
- Référence produit et contenu : [LANDING_GOLD_STANDARD_BRIEF.md](/Users/user/Desktop/STRYVLAB/LANDING_GOLD_STANDARD_BRIEF.md).
- Tokens d’interface : [tailwind.config.ts](/Users/user/Desktop/STRYVLAB/tailwind.config.ts) et [app/globals.css](/Users/user/Desktop/STRYVLAB/app/globals.css). La palette et les règles visuelles spécifiques à la landing sont définies dans ce brief.
- Les règles applicables sont documentées dans [AGENTS.md](/Users/user/Desktop/STRYVLAB/AGENTS.md).

## 2. Utilisateur cible

### ICP principal

Coach sportif en premier, notamment coach indépendant ou coach qui gère plusieurs clients et veut structurer son suivi autour d’une méthode plus précise.

### ICP secondaires

- Préparateur physique.
- Coach nutrition.
- Studio ou organisation de coaching.
- Équipe de plusieurs coachs.

### Niveau de sophistication

Utilisateur métier, expert de l’accompagnement mais pas nécessairement technique. Il doit comprendre rapidement la valeur pour son quotidien : moins de dispersion, meilleure lecture du contexte client, décisions plus faciles à justifier.

## 3. Problème

### Douleur principale

Le suivi client est dispersé entre plusieurs outils, documents, messages, feuilles de calcul et applications. Le coach perd du temps à retrouver et recroiser l’information au lieu de décider et d’accompagner.

### Workflow actuel observé

La landing actuelle cite notamment Excel, WhatsApp, Google Forms, une application d’entraînement, le journal alimentaire et les notes personnelles comme fragments du suivi.

### Coût de l’inaction

À ne pas exprimer par une métrique inventée. Le coût à démontrer est qualitatif : perte de contexte, relances manuelles, prescriptions moins contextualisées, lecture tardive des signaux et continuité insuffisante entre le coach et le client.

### Déclencheur

Le coach atteint un volume ou une complexité de suivi où ses outils séparés ne permettent plus de garder une lecture fiable de chaque client.

## 4. Résultat recherché

### Résultat fonctionnel

Le coach dispose d’une boucle de travail continue : profil → bilan → prescription → expérience client → métriques → ajustement.

### Résultat métier

Il peut consacrer davantage de temps à son raisonnement et à son accompagnement, avec une information client réunie dans un même système.

### Résultat émotionnel

Passer d’un suivi fragmenté et réactif à une pratique plus claire, maîtrisée et cohérente.

### Résultat mesurable

Aucun chiffre public ne doit être utilisé tant qu’il n’est pas confirmé par des données réelles de bêta ou des cas clients documentés.

## 5. Positionnement

### Proposition de valeur de travail

**STRYV lab transforme le travail quotidien du coach en un système connecté où chaque donnée client peut soutenir une meilleure décision.**

### Différenciateur

La continuité du raisonnement coach : les données ne sont pas seulement stockées ou affichées ; elles relient le profil, la prescription, l’expérience client et l’ajustement suivant.

### Catégorie

Plateforme de pilotage du coaching personnalisé, avec espace coach et expérience client connectée.

### Formule de marque

**STRYV lab pense avec le coach. STRYVR accompagne le client. Les données font le lien.**

Cette formule devra rester subordonnée au message principal destiné au coach.

## 6. CTA strategy

### CTA primaire

**Réserver une démo de 40 min**

### Destination

Un événement Cal.com de 40 minutes permettant de choisir une date et un créneau pour une démonstration. La destination actuelle `/auth/login` n’est pas adaptée au CTA principal de la landing et ne doit pas être conservée comme conversion primaire. L’événement retenu est `https://cal.com/stryvlab/demo-stryvlab`.

### Données minimales à prévoir

- Prénom et nom.
- Email professionnel.
- Date et créneau souhaités.
- Fuseau horaire si nécessaire.
- Contexte ou taille de l’activité, si utile à la préparation de la démo.

Les champs définitifs, la disponibilité réelle et le système de calendrier devront être confirmés avant implémentation.

### CTA secondaire

Un CTA secondaire peut permettre de **voir le workflow coach** ou de regarder une courte vidéo produit. Il ne doit pas concurrencer la réservation de démo.

### Microcopy

À prévoir autour du formulaire : durée de 40 minutes, contenu de la démonstration, absence de promesse non vérifiée, et confirmation de la prise de rendez-vous.

### Risque de conversion

Un formulaire trop long ou une disponibilité non claire peut créer une friction importante. La page doit montrer assez de produit avant la réservation pour que le visiteur comprenne la valeur de la démo.

## 7. Accès et pricing

### Ce que le repo confirme

Le modèle de plans existe dans [lib/billing/plans.ts](/Users/user/Desktop/STRYVLAB/lib/billing/plans.ts) :

- `Solo` : jusqu’à 5 clients, sans accès à l’application client STRYVR.
- `Pro` : jusqu’à 30 clients, avec accès STRYVR et fonctionnalités de suivi client avancé.
- `Studio` : clients et sièges d’équipe non limités dans le modèle actuel, avec fonctionnalités d’équipe.

Les mêmes niveaux sont affichés dans les réglages coach via [app/coach/settings/page.tsx](/Users/user/Desktop/STRYVLAB/app/coach/settings/page.tsx).

### Ce qui reste inconnu

Les prix publics en euros, la durée éventuelle d’essai, les conditions de bêta et la politique commerciale ne sont pas suffisamment établis dans les sources inspectées.

### Décision de brief

Ne pas publier de prix ni de promesse d’essai dans la première implémentation sans validation. La démo doit expliquer les niveaux d’accès et permettre de qualifier le besoin avant présentation commerciale.

## 8. Preuve

### Preuve disponible ou exploitable après validation

- Captures réelles de STRYV lab.
- Captures réelles de la PWA STRYVR.
- Vidéo produit ou extrait de démonstration.
- Témoignages de coachs en bêta.
- Nombre réel de coachs en bêta, si autorisé.
- Cas d’usage documentés avec résultats vérifiables.

### Crédibilité honnête disponible maintenant

- Produit fonctionnel dans le repo.
- Workflow coach déjà matérialisé dans la landing actuelle.
- Modèle de plans et de capacités déjà présent dans le produit.
- Plateforme et PWA client développées dans le même écosystème.

### Preuve manquante

- Nombre confirmé de coachs en bêta.
- Témoignages publiables.
- Logos ou marques clientes autorisées.
- Résultats quantifiés attribuables au produit.
- Vidéo finale de démo.

### Preuves interdites sans validation

- Faux témoignages, avatars ou logos.
- Compteurs de coachs non vérifiés.
- Pourcentages de gain de temps ou de résultats.
- Garanties de performance.
- Certifications, conformité ou sécurité non documentées.

## 9. Structure de page recommandée

1. **Navigation** — logo STRYV lab, ancres utiles, CTA “Réserver une démo de 40 min”.
2. **Hero** — résultat pour le coach, sous-titre concret, CTA de réservation et visual produit réel ou clairement identifié comme aperçu.
3. **Problème** — suivi fragmenté et coût de la dispersion.
4. **Workflow central** — ajouter, paramétrer, inviter, questionner, comprendre, piloter.
5. **Preuve produit** — captures ou vidéo réelle, avec un cas client cohérent de bout en bout.
6. **Boucle coach-client** — comment les actions et signaux circulent entre STRYV lab et STRYVR.
7. **Studios** — Workout Studio, Nutrition Studio, Transformation / Phase, en langage de bénéfices.
8. **Plans et accès** — niveaux Solo, Pro et Studio sans tarifs tant qu’ils ne sont pas validés ; renvoi vers la démo.
9. **Preuve bêta** — témoignages, coachs et vidéo uniquement après validation.
10. **FAQ** — durée de la démo, mise en place, données, PWA client, plans, maturité et prochaines étapes.
11. **CTA final** — réservation de démo de 40 minutes.
12. **Footer** — contact, confidentialité, mentions légales et accès coach si nécessaire.

## 10. Direction visuelle

### Base à conserver

La plateforme actuelle sert de référence visuelle principale. L’audit montre une direction sombre, premium et orientée produit : fond `#0d0d0d`, surfaces translucides, gradients subtils, bordures fines, grands titres condensés, cartes arrondies et hiérarchie par opacités.

### Palette

- Fond principal : `#0d0d0d`.
- Surfaces : noirs et gris translucides.
- Accent principal : or/beige `#c6b48b`.
- Accent secondaire : bleu-gris `#86aeb8`.
- Accent clair : `#dbe4df`.
- Texte principal : blanc.
- Texte secondaire : blanc à opacité réduite.

### Typographie

Conserver la combinaison existante : Barlow pour les titres, Barlow Condensed pour les labels et navigation, Lufga pour les interfaces et Unbounded pour la marque lorsque pertinent.

### Layout

- Grilles larges et respirées.
- Cartes produit avec profondeurs et états de surface.
- Visualisation du produit prioritaire sur les illustrations abstraites.
- Narration par un cas client unique, sans transformer la page en catalogue de fonctionnalités.

### Motion

Conserver les animations Framer Motion et GSAP/ScrollTrigger comme langage de continuité, mais les subordonner à la lisibilité. Prévoir `prefers-reduced-motion`, une version statique des visualisations et aucune animation indispensable à la compréhension.

### À éviter

- Reprendre le design ou les contenus du dossier `/stryvr`.
- Ajouter un style SaaS générique clair ou une esthétique étrangère à la plateforme actuelle.
- Dépendre d’une illustration abstraite à la place du produit réel.
- Multiplier les CTA concurrents.
- Surcharger la page avec toutes les fonctionnalités du produit.

## 11. Plan technique préliminaire

### Fichiers probablement concernés

- [app/page.tsx](/Users/user/Desktop/STRYVLAB/app/page.tsx).
- [components/landing/SaasLanding.tsx](/Users/user/Desktop/STRYVLAB/components/landing/SaasLanding.tsx).
- [components/landing/CoachWorkflowLanding.tsx](/Users/user/Desktop/STRYVLAB/components/landing/CoachWorkflowLanding.tsx) uniquement comme référence historique.
- Nouveau composant de formulaire de réservation ou adaptation d’un composant de booking existant.
- [app/globals.css](/Users/user/Desktop/STRYVLAB/app/globals.css) uniquement si un token ou style global est réellement nécessaire.
- Éventuelles constantes de contenu séparées pour rendre les sections maintenables.

### Assets validés

- `public/landing-demo/dashboard.png` — pilotage global coach.
- `public/landing-demo/client-profile-desktop.png` — dossier client et signaux de transformation.
- `public/landing-demo/workout-studio-builder-desktop.png` — construction du programme, Smart Fit et volume.
- `public/landing-demo/nutrition-studio-builder-desktop.png` — construction du plan nutritionnel, planning et repas.
- `public/landing-demo/client-metrics-desktop.png` — évolution de la composition corporelle.
- `public/landing-demo/client-performances-desktop.png` — charge, volume, fatigue et recommandations.
- `public/landing-demo/client-nutrition-data-desktop.png` — suivi nutritionnel, TDEE et adhérence.
- `public/landing-demo/morphopro-desktop.png` — analyse biomécanique, asymétries et recommandations.

### Assets encore optionnels

- Captures de la PWA STRYVR, si l’expérience client doit être développée davantage.
- Vidéo courte de démonstration, si disponible.
- Logos et visuels déjà présents, après vérification de leur usage.

### Dépendances

Ne pas ajouter de dépendance par défaut. Réutiliser Next.js, Tailwind, Framer Motion, GSAP/ScrollTrigger et les composants de booking déjà présents si leur flux convient à la réservation de 40 minutes.

### Validation prévue après approbation

- Vérification du formulaire et de la réservation.
- Vérification des CTA et événements analytics.
- Vérification responsive desktop, tablette et mobile.
- Vérification accessibilité clavier, focus, contraste et mouvement réduit.
- Vérification des liens, textes provisoires et preuves publiques.

## 12. Hypothèses

- La landing principale reste en français pour le premier périmètre.
- Le coach sportif est l’audience prioritaire.
- La réservation d’une démo de 40 minutes est le seul objectif de conversion principal.
- Les captures et vidéos seront issues du produit réel, pas de la landing `/stryvr`.
- Les prix seront soit validés avant implémentation, soit volontairement absents de la première version publique.
- Les chiffres présents dans les mockups actuels sont considérés comme illustratifs jusqu’à validation et ne constituent pas une preuve marketing.

## 13. Questions bloquantes restantes

1. Quel outil ou flux doit gérer la sélection de date et de créneau pour la démo de 40 minutes ?
2. Quels créneaux, fuseaux horaires et règles de confirmation doivent être proposés ?
3. Quels prix et conditions exactes correspondent aux plans Solo, Pro et Studio ?
4. Quels coachs bêta, témoignages, captures et vidéos sont autorisés à être publiés ?

## 14. Approval gate

Ce brief doit être validé avant toute modification de la landing. Après validation, le travail pourra passer à la structure de conversion, à la direction visuelle détaillée, puis à l’implémentation et à la QA responsive.
