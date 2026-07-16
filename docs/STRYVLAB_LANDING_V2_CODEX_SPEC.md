# STRYVLAB — Landing Page V2
## Source de vérité produit, contenu, design et exécution Codex

**Statut :** spécification d'exécution  
**Objectif :** reconstruire la landing STRYVLAB comme une démonstration narrative du système de pilotage, et non comme une succession de cartes fonctionnelles.  
**Langue :** français  
**Cible principale :** coachs sportifs indépendants et structures de coaching  
**Conversion principale :** voir le produit en action, puis réserver une démonstration  
**Règle :** aucun témoignage, chiffre, prix, logo client ou résultat ne doit être inventé.

---

# 1. Mission

La landing actuelle sous-vend le produit. Elle présente une plateforme structurée, mais ne rend pas visible sa différence centrale : STRYVLAB relie la prescription, l'exécution, les signaux terrain et la prochaine décision du coach.

La V2 doit faire comprendre en moins de 15 secondes :

1. ce qu'est STRYVLAB ;
2. à qui la plateforme s'adresse ;
3. pourquoi elle est différente d'un simple logiciel « tout-en-un » ;
4. comment STRYVR ferme la boucle côté coaché ;
5. pourquoi le visiteur doit voir le produit en action.

## Positionnement à respecter

**Catégorie**  
Plateforme de pilotage pour coachs sportifs.

**Promesse**  
Relier chaque prescription à ce qui se passe réellement.

**Différenciation**  
STRYVLAB conserve les relations entre le programme, l'exécution, les signaux terrain, les performances et la décision suivante.

**Doctrine produit**  
Le système ne remplace pas le coach. Il structure le contexte, fait apparaître les incohérences et rend la prochaine action plus explicite.

---

# 2. Principes non négociables

## À faire

- Montrer le produit dès le hero.
- Construire la narration autour d'une boucle continue : **Prescrire → Exécuter → Observer → Décider → Ajuster**.
- Utiliser les interfaces réelles comme preuve centrale.
- Faire de la motion un outil d'explication, pas une décoration.
- Garder la direction sombre, précise et technique du produit.
- Utiliser le verre uniquement comme couche de contrôle flottante.
- Donner à chaque section une seule idée principale.
- Utiliser des cadrages de captures lisibles, propres et focalisés.
- Préserver la performance et l'accessibilité.

## Interdictions

- Pas de faux témoignages.
- Pas de faux logos clients.
- Pas de métriques de croissance inventées.
- Pas de prix provisoires ou non validés.
- Pas de « AI-powered », « révolutionnaire », « ultime » ou superlatifs sans preuve.
- Pas de glassmorphism appliqué à toutes les cartes.
- Pas de halos permanents suivant le curseur.
- Pas de scroll-jacking.
- Pas de parallax gratuit.
- Pas de cartes qui flottent en continu.
- Pas de vidéo ou de WebGL lourd au-dessus de la ligne de flottaison sans fallback statique.
- Pas de reprise brute de captures contenant des éléments internes, fictifs ou de démonstration visibles.

---

# 3. Architecture de marque

Utiliser partout les noms suivants :

- **STRYVLAB** : plateforme coach.
- **STRYVR** : application coaché.
- **STRYV** : uniquement si une marque mère est réellement utilisée dans le produit.

Ne jamais écrire « STRYV lab ».

Hiérarchie fonctionnelle publique :

1. **Studios** — construire et prescrire ;
2. **Intelligence** — lire, croiser et prioriser ;
3. **STRYVR** — exécuter et remonter les données ;
4. **Business** — organiser l'activité.

Les appellations comme Smart Fit, Morpho Pro, Score de transformation ou Optimisation de phase restent des fonctionnalités. Elles ne doivent pas devenir quatre marques concurrentes dans la même page.

---

# 4. Architecture exacte de la page

## Navigation

### Contenu

- Logo STRYVLAB
- Produit
- Méthode
- STRYVR
- Accès
- CTA secondaire : **Voir la plateforme**
- CTA principal : **Réserver une démonstration**

### Comportement

- Navigation transparente dans le hero.
- Après 48 px de scroll : surface Liquid Glass compacte.
- Hauteur cible : 64 px desktop, 56 px mobile.
- Pas de menu surchargé.
- Sur mobile : logo, CTA principal court, menu.

---

## Section 1 — Hero

### Eyebrow

**Plateforme de pilotage pour coachs sportifs**

### H1

**Reliez chaque prescription à ce qui se passe réellement.**

### Texte

**STRYVLAB transforme votre méthode en un système continu : vous prescrivez, STRYVR guide l'exécution, les données reviennent contextualisées, vous ajustez avec une vision complète.**

### CTA

- Principal : **Voir STRYVLAB en action**
- Secondaire : **Réserver une démonstration**

### Micro-réassurance

**Plateforme coach + application coaché · Produit fonctionnel · Accès anticipé**

### Visuel

Créer une composition produit, pas une simple capture centrée :

- fenêtre principale : profil coaché / score de transformation ;
- fenêtre secondaire gauche : Nutrition Studio ;
- fenêtre secondaire droite : analyse des performances ;
- profondeur légère entre les fenêtres ;
- lignes de données discrètes reliant les vues ;
- aucun texte intégré illisible ;
- aucun mockup générique de navigateur si le produit peut être montré directement.

### Motion

Au chargement :

1. la navigation apparaît ;
2. le H1 et le texte se révèlent sans translation excessive ;
3. le cockpit produit passe de `scale: 0.96` à `1`, `opacity: 0` à `1` ;
4. les deux fenêtres secondaires se positionnent ;
5. une seule impulsion lumineuse parcourt les relations entre les vues.

Durée totale maximale : 900 ms.  
Pas de boucle automatique continue.

### Mobile

- H1 sur 4 à 6 lignes maximum.
- Visuel sous les CTA.
- Une seule fenêtre principale et deux fragments secondaires.
- Aucun texte produit inférieur à une taille lisible : préférer des crops rapprochés.

---

## Section 2 — Le coût de la fragmentation

### Eyebrow

**Le problème réel**

### H2

**Le problème n'est pas le manque de données. C'est leur fragmentation.**

### Corps

**Le programme est dans un outil. La nutrition dans un autre. Le vécu du coaché dans les messages. Les progrès dans plusieurs tableaux. Avant chaque ajustement, le coach doit reconstruire lui-même le contexte.**

### Conséquences

- Décisions retardées
- Signaux contradictoires
- Temps administratif
- Prescriptions déconnectées du terrain
- Qualité de suivi plus difficile à maintenir quand le portefeuille augmente

### Visuel et motion

Départ : plusieurs fragments d'interface séparés et légèrement désalignés.  
Au scroll : les fragments se rapprochent et se connectent dans une seule structure STRYVLAB.

La motion doit expliquer la convergence. Aucun flottement décoratif.

---

## Section 3 — La boucle propriétaire

### Eyebrow

**Un système continu**

### H2

**Du premier bilan à la prochaine décision.**

### Introduction

**STRYVLAB ne juxtapose pas des fonctionnalités. La plateforme conserve le lien entre ce que le coach prescrit, ce que le coaché exécute et ce que les données permettent ensuite de comprendre.**

### Étapes exactes

#### 01 — Prescrire

**Construire l'entraînement et la nutrition à partir du dossier, de l'objectif et du contexte du coaché.**

#### 02 — Exécuter

**STRYVR transforme la prescription en expérience quotidienne : séances, nutrition, check-ins et suivi.**

#### 03 — Observer

**Les données d'adhérence, de récupération, de progression et de performance reviennent dans le même dossier.**

#### 04 — Décider

**Les signaux sont croisés pour faire ressortir ce qui mérite réellement l'attention du coach.**

#### 05 — Ajuster

**Le coach modifie le protocole avec le contexte complet, puis relance la boucle.**

### Interaction

Créer une section sticky desktop :

- rail vertical ou horizontal des cinq étapes ;
- à chaque étape, le contenu central se transforme ;
- progression pilotée par le scroll natif ;
- aucune prise de contrôle du scroll ;
- hauteur totale cible : 260–320 vh ;
- version mobile : cartes successives sans sticky complexe.

---

## Section 4 — Les Studios

### Eyebrow

**Construire la méthode**

### H2

**Votre méthode devient un protocole exploitable.**

### Texte

**Workout Studio et Nutrition Studio structurent la prescription sans séparer le programme de son contexte.**

### Sous-section Workout Studio

#### Titre

**Programmer avec une vision immédiate de la cohérence.**

#### Texte

**Construisez chaque séance, contrôlez le volume, l'intensité et la répartition, puis identifiez les redondances ou les points d'attention avant publication.**

#### Preuves visibles

- structure des séances ;
- prescriptions par série ;
- volume programmé ;
- recommandations contextualisées ;
- publication vers l'expérience coaché.

### Sous-section Nutrition Studio

#### Titre

**Piloter un protocole nutritionnel relié au terrain.**

#### Texte

**Organisez calories, macros, repas, hydratation, jours d'entraînement et jours de repos dans un protocole cohérent, lisible et ajustable.**

#### Preuves visibles

- jours types ;
- planning sur plusieurs semaines ;
- repas et aliments ;
- calories et macros ;
- cohérence du protocole.

### Présentation

Desktop : grande scène produit avec sélecteur Workout / Nutrition placé dans une barre de contrôle en verre.  
Mobile : deux blocs séparés, sans tabs cachant du contenu important.

### Motion

- transition entre les deux studios par crossfade et déplacement de 12–20 px maximum ;
- surbrillance ponctuelle d'une donnée utile ;
- aucun zoom permanent.

---

## Section 5 — Intelligence et décision

### Eyebrow

**Du signal à l'action**

### H2

**Les données n'ont de valeur que lorsqu'elles changent la prochaine décision.**

### Texte

**Progression, adhérence, récupération, nutrition et charge utile sont recroisées pour faire ressortir ce qui mérite votre attention — avec les signaux qui expliquent pourquoi.**

### Trois preuves principales

#### Score de transformation

**Une lecture synthétique de la dynamique du coaché, reliée à ses composantes : adhérence, récupération, évolution corporelle et performance.**

#### Optimisation de phase

**Une lecture de la cohérence entre la phase active, les données observées et l'horizon de décision.**

#### Prochaine action

**Une recommandation contextualisée, accompagnée des signaux qui l'ont déclenchée.**

### Phrase de contrôle

**STRYVLAB ne remplace pas le coach. Il rend le contexte plus lisible et la décision plus explicite.**

### Visuel

Utiliser le profil coaché comme scène principale. Faire apparaître successivement :

1. score de transformation ;
2. optimisation de phase ;
3. analyse nutritionnelle ;
4. prochaine action performance.

### Motion

- une donnée source s'allume ;
- la relation vers le score devient visible ;
- le score se met à jour ;
- la prochaine action apparaît ;
- le visiteur comprend la chaîne causale.

La motion ne doit jamais suggérer une décision autonome ou une certitude médicale.

---

## Section 6 — STRYVR

### Eyebrow

**L'expérience coaché**

### H2

**La prescription continue en dehors du rendez-vous.**

### Texte

**Le coaché retrouve ses entraînements, son plan nutritionnel, ses check-ins et ses données quotidiennes dans STRYVR. L'exécution alimente ensuite le suivi du coach.**

### Points de preuve

- programme d'entraînement ;
- suivi des séries et performances ;
- journal nutritionnel ;
- check-ins matin et soir ;
- rappels et notifications ;
- progression visible.

### Dépendance d'asset

Cette section ne doit pas être finalisée avec un téléphone générique ou des écrans inventés.  
Elle exige de vraies captures propres de STRYVR. Si elles ne sont pas disponibles dans le dépôt, signaler le blocage et utiliser temporairement une composition statique explicitement marquée comme provisoire dans la branche de travail uniquement.

### Visuel

- téléphone principal ;
- fragments de données qui partent du studio vers STRYVR ;
- check-in et performance qui reviennent vers le cockpit coach.

---

## Section 7 — Pilotage business

### Eyebrow

**Le cockpit opérationnel**

### H2

**Pilotez les coachés et l'activité depuis le même système de travail.**

### Texte

**Portefeuille, paiements, tâches, agenda et alertes restent réunis autour du même contexte opérationnel.**

### Preuves visibles

- clients actifs ;
- revenus et paiements ;
- tâches ;
- agenda ;
- alertes actives ;
- clients à suivre.

### Positionnement

Cette section doit rester secondaire. Elle montre que STRYVLAB structure l'activité, mais ne doit pas faire basculer la page vers le territoire d'un CRM générique.

---

## Section 8 — Différenciation

### Eyebrow

**Pourquoi STRYVLAB**

### H2

**Centraliser ne suffit pas. Il faut conserver les relations.**

### Comparaison

| Outils fragmentés | STRYVLAB |
|---|---|
| Les informations vivent séparément | Les données restent reliées au dossier et au protocole |
| Le coach reconstruit la situation | Le contexte est directement lisible |
| Les chiffres sont consultés | Les signaux aboutissent à une prochaine action |
| L'application coaché est isolée | STRYVR ferme la boucle d'exécution |
| La croissance ajoute de la dispersion | Le système conserve une méthode de travail cohérente |

### Design

Pas de tableau HTML dense visuellement. Utiliser cinq lignes larges, avec transformation gauche → droite. Sur mobile, empiler chaque paire.

---

## Section 9 — Preuve et maturité

### H2

**Un produit fonctionnel, présenté sans promesses artificielles.**

### Éléments autorisés

- captures réelles du produit ;
- démonstration sur un cas cohérent ;
- plateforme coach + application coaché ;
- accès anticipé ;
- accompagnement à l'onboarding ;
- sécurité et confidentialité si les éléments sont réellement documentés.

### Éléments interdits

- faux témoignages ;
- chiffres d'utilisation inventés ;
- « approuvé par » sans preuve ;
- badges de sécurité fictifs ;
- résultats clients de démonstration présentés comme réels.

### Asset recommandé

Vidéo produit courte de 60 à 90 secondes avec :

1. profil coaché ;
2. prescription ;
3. exécution ;
4. retour des données ;
5. prochaine décision.

---

## Section 10 — Accès anticipé

### Eyebrow

**Accès STRYVLAB**

### H2

**Construisez votre système de coaching avant d'augmenter votre volume.**

### Texte

**STRYVLAB ouvre progressivement la plateforme à une première cohorte de coachs. La démonstration permet de vérifier l'adéquation avec votre méthode, votre portefeuille et votre organisation.**

### CTA

- Principal : **Réserver une démonstration**
- Secondaire : **Voir la plateforme**

### Règle tarifs

- Si les prix sont validés : les afficher clairement avec limites et fonctionnalités.
- Si les prix ne sont pas validés : ne pas afficher de cartes Solo / Pro / Studio vides.
- Ne jamais publier une phrase expliquant que les prix ne sont pas validés.

---

## Section 11 — FAQ

### À qui s'adresse STRYVLAB ?

**STRYVLAB s'adresse en priorité aux coachs sportifs indépendants, préparateurs physiques et structures de coaching qui veulent relier prescription, suivi et pilotage dans un seul système de travail.**

### Quelle est la différence entre STRYVLAB et STRYVR ?

**STRYVLAB est la plateforme du coach. STRYVR est l'application utilisée par le coaché pour suivre ses entraînements, sa nutrition, ses check-ins et sa progression.**

### STRYVLAB remplace-t-il les décisions du coach ?

**Non. La plateforme structure les données, met en évidence les signaux utiles et rend les recommandations explicables. Le coach garde la décision finale.**

### Puis-je utiliser uniquement les studios de prescription ?

**Le périmètre disponible dépend du niveau d'accès retenu. La démonstration permet de vérifier la configuration adaptée à votre activité.**

### Comment se déroule la démonstration ?

**La démonstration suit un cas coaché complet : dossier, prescription, exécution, données, performances et ajustements.**

### Les données des coachés sont-elles protégées ?

**Ne publier une réponse détaillée que si l'architecture, les responsabilités, l'hébergement et les mécanismes de protection ont été validés juridiquement et techniquement. À défaut, conserver une réponse factuelle et non spéculative.**

---

## Section 12 — CTA final

### Eyebrow

**Votre prochain système de travail**

### H2

**Votre méthode mérite un système capable de la suivre.**

### Texte

**Voyez comment STRYVLAB relie votre prescription, l'exécution du coaché et la prochaine décision.**

### CTA

**Voir STRYVLAB sur un cas complet**

---

# 5. Direction visuelle

## Concept

**Le cockpit vivant.**

La landing doit donner l'impression d'un système précis dans lequel les informations circulent. Elle ne doit pas ressembler à une galerie de cartes SaaS génériques.

## Palette

Extraire en priorité les tokens du produit existant. Ne pas créer une seconde identité visuelle.

Fallback uniquement si aucun token réutilisable n'existe :

```css
--bg: #070909;
--bg-elevated: #0c100f;
--surface-1: #101513;
--surface-2: #151b18;
--text-primary: #f3f6f4;
--text-secondary: #9ba6a0;
--line: rgba(255, 255, 255, 0.08);
--line-strong: rgba(255, 255, 255, 0.14);
--accent: #58c99a;
--accent-soft: #a7e8ca;
--warning: #d7b55b;
--danger: #df6d5f;
```

## Typographie

- Réutiliser la police produit si elle est maîtrisée.
- Sinon : `Geist Sans` pour l'interface et le marketing.
- `Geist Mono` uniquement pour les valeurs, étiquettes techniques et données.
- Pas de multiplication de polices.
- H1 desktop : `clamp(3.5rem, 7vw, 6.5rem)` selon longueur réelle.
- H2 desktop : `clamp(2.4rem, 4.5vw, 4.5rem)`.
- Corps principal : 18–21 px desktop, 17–18 px mobile.
- Largeur de ligne : 55–70 caractères.
- Éviter les microtextes en majuscules trop espacées sur de longues phrases.

## Grille et rythme

- Max-width principal : 1440 px.
- Grille : 12 colonnes desktop, 8 tablette, 4 mobile.
- Padding horizontal : 32–56 px desktop, 24 px tablette, 16–20 px mobile.
- Espacement vertical entre sections : 144–192 px desktop, 96–128 px tablette, 72–96 px mobile.
- Rayon principal : 20–28 px.
- Ne pas enfermer chaque contenu dans une carte.
- Alterner grandes scènes produit, texte éditorial et surfaces de contrôle.

---

# 6. Système Liquid Glass

Le verre est une couche de contrôle, pas un matériau universel.

## Composants autorisés

- navigation sticky ;
- sélecteurs Workout / Nutrition ;
- commandes de démonstration ;
- annotations flottantes ;
- boutons secondaires ;
- indicateur d'étape dans la boucle.

## Composants interdits

- longs paragraphes ;
- tableaux ;
- toutes les cartes de produit ;
- fonds de section complets ;
- surfaces superposées en cascade.

## Token proposé

```css
.glass-control {
  background:
    linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.035));
  border: 1px solid rgba(255,255,255,.12);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.10),
    0 18px 50px rgba(0,0,0,.32);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}
```

Prévoir un fallback opaque pour les navigateurs ou préférences ne supportant pas la transparence.

---

# 7. Motion system

## Règles

- Framer Motion uniquement si déjà installé ; sinon utiliser la solution existante.
- Ne pas installer plusieurs moteurs d'animation.
- Animer principalement `transform` et `opacity`.
- Une animation doit révéler une relation, une transition ou une hiérarchie.
- Les transitions doivent rester brèves : 180–650 ms pour l'interface, 600–1000 ms pour les scènes narratives.
- Pas de ressort élastique ludique.
- Pas de mouvement perpétuel sauf micro-indicateur essentiel.

## Reduced motion

Pour `prefers-reduced-motion: reduce` :

- désactiver toutes les translations non essentielles ;
- supprimer les parallax ;
- remplacer les morphings par des crossfades ;
- afficher immédiatement les contenus ;
- conserver uniquement les transitions indispensables à la compréhension.

---

# 8. Assets marketing

Créer un dossier dédié, sans utiliser directement les captures brutes de travail :

```text
/public/landing-v2/
  hero/
  studios/
  intelligence/
  stryvr/
  business/
  posters/
```

## Nettoyage obligatoire

Retirer ou recadrer :

- « Donner un retour » ;
- navigation flottante masquant le contenu ;
- emails `demo.stryvlab.local` ;
- « paiement fictif » ;
- « analyse fictive de démonstration » ;
- zones vides inutiles ;
- curseurs et halos de capture ;
- données incohérentes entre écrans ;
- éléments trop petits pour être lus dans la landing.

## Règle de cadrage

Chaque asset doit répondre à une question précise :

- Que regarde-t-on ?
- Pourquoi est-ce important ?
- Quelle relation doit être comprise ?

Ne jamais montrer un écran complet réduit à 700 px si aucun texte produit n'est lisible.

---

# 9. Architecture technique

## Sécurité de déploiement

Ne pas remplacer immédiatement la landing de production.

Implémenter d'abord :

- soit sur `/landing-v2` ;
- soit derrière un feature flag explicite ;
- soit dans une branche dédiée avec preview Vercel.

La bascule production intervient uniquement après validation visuelle, responsive, performance et contenu.

## Structure recommandée

Adapter au dépôt existant, sans forcer les chemins suivants s'ils sont incohérents avec l'architecture :

```text
components/marketing/landing-v2/
  LandingV2.tsx
  LandingNav.tsx
  HeroSystem.tsx
  FragmentationSection.tsx
  SystemLoop.tsx
  StudiosSection.tsx
  DecisionSection.tsx
  StryvrSection.tsx
  BusinessSection.tsx
  DifferentiationSection.tsx
  EarlyAccessSection.tsx
  FaqSection.tsx
  FinalCta.tsx
  ProductFrame.tsx
  GlassControl.tsx
  content.ts
  motion.ts
```

## Règles de code

- Sections data-driven quand cela améliore la maintenance.
- Pas de composant générique abstrait sans usage réel.
- Pas d'immenses composants monolithiques.
- Pas de styles inline dispersés.
- Réutiliser les tokens et primitives du projet.
- `next/image` ou équivalent optimisé pour tous les assets.
- Image hero prioritaire ; assets sous la ligne de flottaison en lazy load.
- Dimensions intrinsèques réservées pour éviter les layout shifts.
- Aucun warning React.
- Aucun log de debug.
- Aucun package lourd ajouté sans justification.

## Analytics

Tracer au minimum :

- clic CTA hero principal ;
- clic CTA démo ;
- lecture vidéo ;
- progression vidéo 25 / 50 / 75 / 100 % ;
- interaction Workout / Nutrition ;
- clic CTA final ;
- soumission ou ouverture de réservation.

Respecter le système analytics existant. Ne pas ajouter un nouveau fournisseur sans nécessité.

---

# 10. Performance et accessibilité

## Objectifs terrain

- LCP ≤ 2,5 s au 75e percentile.
- INP ≤ 200 ms au 75e percentile.
- CLS ≤ 0,1 au 75e percentile.

## Exigences

- Aucun scroll horizontal à 320 px.
- Navigation clavier complète.
- Focus visible.
- Contraste suffisant.
- Hiérarchie H1 → H2 → H3 correcte.
- Boutons et liens clairement distingués.
- Alt text descriptif pour les captures fonctionnelles.
- `aria-expanded` sur FAQ et menus.
- Aucun contenu essentiel accessible uniquement par animation.
- Aucun texte critique intégré uniquement dans une image.
- Support `prefers-reduced-motion`.
- Prévoir un fallback de transparence réduit si nécessaire.

---

# 11. Critères d'acceptation

La tâche n'est terminée que si :

1. le hero explique clairement le produit et la cible sans scroll ;
2. la boucle Prescrire → Exécuter → Observer → Décider → Ajuster est visible et compréhensible ;
3. STRYVR est clairement distingué de STRYVLAB ;
4. les captures sont propres, lisibles et cohérentes ;
5. aucune donnée fictive n'est présentée comme une preuve réelle ;
6. aucune mention de prix non validé n'est visible ;
7. la marque est écrite STRYVLAB partout ;
8. le design n'est pas une simple accumulation de cartes ;
9. Liquid Glass reste limité aux contrôles ;
10. la page fonctionne sur 375, 768, 1440 et 1920 px ;
11. le mode reduced motion est fonctionnel ;
12. aucune erreur console ou hydration mismatch n'est présente ;
13. les objectifs Core Web Vitals sont pris en compte dans l'architecture ;
14. la landing V2 reste isolée de la production jusqu'à validation ;
15. build, lint et tests passent.

---

# 12. Protocole d'exécution Codex

## Étape 0 — Audit obligatoire

Avant toute modification :

1. inspecter la stack, l'architecture et les dépendances ;
2. identifier la landing actuelle et ses composants ;
3. relever les tokens de design existants ;
4. localiser les captures produit disponibles ;
5. identifier le système analytics ;
6. vérifier Framer Motion ou le moteur d'animation existant ;
7. identifier la stratégie de feature flag ou preview ;
8. produire un plan de fichiers et les risques.

Ne pas proposer une nouvelle stack si l'existante suffit.

## Étape 1 — Fondation

- créer la route ou feature flag V2 ;
- poser tokens, typographie, grille, navigation et structure sémantique ;
- intégrer tout le wording final ;
- ne pas commencer les animations complexes.

## Étape 2 — Product storytelling

- créer le hero cockpit ;
- construire la section fragmentation ;
- implémenter la boucle sticky ;
- intégrer les Studios et l'Intelligence.

## Étape 3 — STRYVR et business

- intégrer les vrais assets STRYVR ;
- construire la boucle coach ↔ coaché ;
- ajouter le cockpit business sans voler la priorité au cœur produit.

## Étape 4 — Motion et verre

- ajouter uniquement les animations qui expliquent les relations ;
- implémenter le système Liquid Glass ;
- vérifier reduced motion et performance.

## Étape 5 — QA

- responsive ;
- accessibilité ;
- performances ;
- analytics ;
- build ;
- lint ;
- tests ;
- capture desktop et mobile de chaque section ;
- rapport des écarts restants.

---

# 13. Prompt maître à donner à Codex

```text
Tu dois reconstruire la landing STRYVLAB V2 à partir du document `STRYVLAB_LANDING_V2_CODEX_SPEC.md`, qui constitue la source de vérité produit, wording, design, motion et QA.

Objectif : faire passer la landing d'une présentation SaaS générique à une démonstration narrative d'un système de pilotage pour coachs sportifs. La page doit rendre immédiatement visible la boucle Prescrire → Exécuter → Observer → Décider → Ajuster, le rôle distinct de STRYVLAB et STRYVR, et la valeur du moteur de contextualisation des données.

Contraintes majeures :
- n'invente aucun témoignage, prix, résultat, logo ou métrique ;
- ne publie aucune mention de prix non validé ;
- utilise STRYVLAB partout, jamais « STRYV lab » ;
- utilise les vraies interfaces comme preuve ;
- nettoie ou recadre les assets marketing ;
- limite Liquid Glass aux contrôles flottants ;
- évite les animations décoratives ;
- protège les performances et le mode reduced motion ;
- ne remplace pas immédiatement la landing de production ;
- implémente d'abord la V2 sur une route, une preview ou un feature flag isolé ;
- réutilise la stack, les tokens, les composants et l'analytics existants ;
- build, lint et tests doivent passer.

Commence par auditer le dépôt. Retourne d'abord :
1. la stack et les dépendances pertinentes ;
2. les fichiers actuels de la landing ;
3. les assets réutilisables et ceux qui manquent ;
4. la stratégie de route/feature flag ;
5. le plan exact des fichiers à créer ou modifier ;
6. les risques de performance et d'accessibilité ;
7. les ambiguïtés bloquantes, sans poser de question sur ce que le document tranche déjà.

Ensuite, exécute l'implémentation par étapes cohérentes et vérifie chaque étape avant de poursuivre. Ne simplifie pas le concept en une succession de cartes avec fade-up. Le produit doit être la scène centrale et la motion doit montrer les relations entre prescription, exécution, données et décision.
```

---

# 14. Références de conception

- Page STRYVLAB actuelle : contenu et architecture existants à remplacer.
- Apple Human Interface Guidelines : Liquid Glass et matériaux.
- W3C WCAG 2.2 : animation déclenchée par interaction et préférences de mouvement réduit.
- web.dev : Core Web Vitals et seuils LCP, INP, CLS.

