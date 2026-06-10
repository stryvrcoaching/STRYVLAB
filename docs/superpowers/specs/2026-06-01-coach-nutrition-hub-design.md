# Coach Nutrition Hub — Design Spec
**Date:** 2026-06-01
**Status:** Draft for review

---

## Vue d'ensemble

Créer une nouvelle page coach `Data > Nutrition` au niveau client, pensée comme l'équivalent nutritionnel de `Performance`.

Objectif produit :
- donner au coach une vision en temps réel de la réalité nutritionnelle du client
- rendre visible l'écart entre protocole théorique et comportement réel
- permettre une lecture immédiate des tendances courtes (`3j / 7j / 14j / 30j`)
- aider la prise de décision sur l'ajustement du protocole nutritionnel

Cette V1 ne fusionne pas encore `Nutrition Studio` et `Data > Nutrition`.
Le hub nutrition existe d'abord comme page data autonome. Une intégration résumée dans `Nutrition Studio` pourra venir en phase 2.

---

## Positionnement dans le système

### Navigation coach

Dans la zone `Data` d'un client, ajouter une nouvelle entrée :

- `Metrics`
- `Check-ins`
- `Bilans`
- `Performance`
- `Nutrition`
- `MorphoPro`

La page cible suit le même principe de hiérarchie que `Performance` :
- page data dédiée
- lecture coach d'abord
- composants analytiques et opérationnels
- aucun langage visuel divergent du design system existant

---

## Ce qui existe déjà (à réutiliser)

### Sources de données déjà présentes

- `nutrition_meals` : repas consommés, macros, calories, dates physiologiques
- `nutrition_entries` : granularité aliments par repas
- `client_water_logs` : hydratation réelle
- `nutrition_protocols` + `nutrition_protocol_days` + `nutrition_protocol_schedule_slots` : cibles journalières
- `client_nutrition_preps` : préparations planifiées
- `client_daily_checkins` : signaux croisés utiles au contexte

### Logique existante à capitaliser

- agrégation nutrition journalière côté client dans [app/client/nutrition/page.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/page.tsx)
- progression journalière dans [app/api/client/nutrition/today-progress/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/today-progress/route.ts)
- tendance 7 jours dans [app/api/client/nutrition/weekly-trend/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/weekly-trend/route.ts)
- structure de la page coach performance dans [app/coach/clients/[clientId]/data/performances/page.tsx](/Users/user/Desktop/STRYVLAB/app/coach/clients/[clientId]/data/performances/page.tsx)
- logique de date physiologique déjà utilisée par le système nutrition

### Contrainte majeure

Ne pas recréer une logique parallèle différente de la page client. Le hub coach doit réutiliser les mêmes notions métier :
- journée physiologique
- cible issue du protocole actif du jour
- consommé réel agrégé à partir des repas loggés
- hydratation mesurée à part

---

## Objectifs fonctionnels V1

Le coach doit pouvoir répondre instantanément à ces questions :

- le client respecte-t-il globalement ses calories ?
- le client atteint-il réellement ses protéines ?
- est-ce l'hydratation qui décroche le plus souvent ?
- y a-t-il un pattern sur `3j / 7j / 14j / 30j` ?
- les jours d'entraînement sont-ils mieux ou moins bien alimentés que les jours off ?
- les écarts viennent-ils d'un sous-apport, d'un dépassement, ou d'une donnée incomplète ?
- quelles journées méritent d'être ouvertes en détail ?

---

## Architecture de la page

### Route

Nouvelle page coach :

`/coach/clients/[clientId]/data/nutrition`

### Structure visuelle V1

1. `KPI Dashboard` en haut de page
2. `Trend Zone` au milieu
3. `Coach Insights` sous les graphiques
4. `Nutrition Agenda` en bas
5. `Data Quality` en support de lecture

### Layout

Le layout doit rester aligné avec `Performance` :
- fond `#121212`
- cartes `rounded-2xl`
- bordures faibles `border-white/[0.06]`
- hiérarchie textuelle identique
- usage des composants utilitaires déjà présents quand possible

Pas de nouveau langage visuel autonome. La page doit être perçue comme une soeur native de `Performance`, pas comme un micro-produit séparé.

---

## Composants V1

### 1. KPI Dashboard

Bloc supérieur avec lecture synthétique immédiate.

KPIs recommandés :
- `Adhérence calories`
- `Adhérence protéines`
- `Adhérence glucides`
- `Adhérence lipides`
- `Adhérence hydratation`
- `Score global nutrition`

Règle d'affichage :
- valeur principale en `%`
- micro-texte secondaire `moyenne 7j` ou `fenêtre active`
- code couleur cohérent avec les seuils existants

Seuils V1 :
- `>= 90%` : bon
- `75% à 89%` : moyen / à surveiller
- `< 75%` : en alerte

Le `Score global nutrition` est un score composite simple, explicable, non opaque :
- calories : 25%
- protéines : 30%
- glucides : 15%
- lipides : 10%
- hydratation : 20%

But :
- donner une lecture globale
- ne jamais masquer les dimensions individuelles

### 2. Trend Zone

Zone analytique avec filtres de fenêtre :
- `3j`
- `7j`
- `14j`
- `30j`

Graphiques V1 :
- `Calories consommées vs calories cibles`
- `Protéines consommées vs protéines cibles`
- `Hydratation réelle vs hydratation cible`

Option V1 bis si la densité reste lisible :
- un graphique combiné calories
- une vue barres/ligne pour protéines
- une vue hydratation dédiée

Règle clé :
les graphiques doivent privilégier `consommé vs cible`, pas seulement la valeur brute.

### 3. Coach Insights

Bloc de lecture interprétée, rule-based, sans IA générative.

Exemples d'insights V1 :
- `Protéines sous cible 5 jours sur 7`
- `Hydratation conforme seulement 2 jours sur 7`
- `Dépassement calorique surtout les jours off`
- `Glucides trop bas sur les jours d'entraînement`
- `Données incomplètes sur 3 journées, prudence sur l'analyse`

Règle :
- max 3 à 5 insights visibles
- triés par priorité coach
- formulation courte, directement exploitable

### 4. Nutrition Agenda

Zone historique / opérationnelle par jour.

Format recommandé V1 :
- liste de journées type agenda vertical
- une ligne ou carte par journée
- tri décroissant

Chaque journée affiche :
- date physiologique
- statut global (`conforme`, `partiel`, `sous cible`, `dépassement`, `incomplet`)
- calories consommées / cible
- protéines consommées / cible
- glucides consommés / cible
- lipides consommés / cible
- eau consommée / cible
- nombre de repas loggés
- indicateur de prépas planifiées si pertinent

Le clic sur une journée ouvre un détail :
- liste des repas
- horaires
- macros par repas
- éventuelle différence entre log réel et prépas

### 5. Data Quality

Bloc discret mais visible.

Il sert à éviter les mauvaises conclusions lorsque le dataset est faible.

Indicateurs V1 :
- nombre de journées incomplètes sur la fenêtre
- journées sans repas mais avec protocole actif
- journées avec hydratation absente
- faible densité de logs

Règle :
la qualité de donnée ne bloque pas l'analyse, mais module le niveau de confiance perçu.

---

## Logique métier V1

### Unité d'analyse

L'unité canonique est la `journée physiologique`.

Le hub ne doit jamais analyser en date calendrier brute si le reste du système nutrition utilise déjà la journée physiologique.

### Cible journalière

Pour chaque date :
- résoudre le protocole actif
- résoudre le `protocol day` correspondant
- extraire calories, protéines, glucides, lipides, hydratation

Si pas de protocole actif :
- afficher état `pas de cible`
- conserver les données consommées
- exclure ces jours des métriques d'adhérence strictes

### Consommé journalier

Agrégation de :
- `nutrition_meals` pour calories et macros
- `client_water_logs` pour hydratation

Les repas `drinks` doivent suivre la même règle que la page client actuelle.

### Écart à la cible

Pour chaque dimension :

`adherence = min(consumed / target, 1)` si l'objectif est une cible minimale

Mais pour les calories et macros où le dépassement compte analytiquement, il faut aussi calculer :
- `delta_abs = consumed - target`
- `delta_pct = (consumed - target) / target`

On a donc deux lectures simultanées :
- adhérence pour le score et la lecture synthétique
- delta pour l'interprétation coach

### Fenêtres de tendance

Les fenêtres `3j / 7j / 14j / 30j` calculent :
- moyenne consommée
- moyenne cible
- taux d'adhérence moyen
- nombre de jours valides

Une journée sans cible n'entre pas dans l'adhérence, mais peut rester visible dans l'agenda.

### Segmentation entraînement vs off

V1 doit déjà prévoir au moins une segmentation analytique simple :
- jour d'entraînement
- jour off

Source :
- `protocol day`
- ou override de jour si déjà présent dans le système

Utilité :
- détecter un sous-apport spécifique les jours d'entraînement
- éviter une moyenne globale trompeuse

---

## API / agrégations à créer

### Nouveau endpoint coach

Créer un endpoint dédié, côté coach, pour ne pas faire porter la logique d'agrégation à la page :

`GET /api/clients/[clientId]/nutrition-hub`

Réponse V1 :
- `summary`
- `trend`
- `insights`
- `agenda`
- `dataQuality`
- `availableWindows`

### Shape proposée

```ts
type NutritionHubResponse = {
  summary: {
    adherenceCalories: number | null
    adherenceProtein: number | null
    adherenceCarbs: number | null
    adherenceFat: number | null
    adherenceHydration: number | null
    nutritionScore: number | null
    validDays: number
  }
  trend: {
    window: 3 | 7 | 14 | 30
    points: Array<{
      date: string
      consumed: {
        calories: number
        protein_g: number
        carbs_g: number
        fat_g: number
        hydration_ml: number
      }
      target: {
        calories: number | null
        protein_g: number | null
        carbs_g: number | null
        fat_g: number | null
        hydration_ml: number | null
      }
      dayKind: "training" | "off" | "unknown"
      completeness: "complete" | "partial" | "missing"
    }>
  }
  insights: Array<{
    id: string
    severity: "good" | "watch" | "alert"
    title: string
    message: string
  }>
  agenda: Array<{
    date: string
    dayKind: "training" | "off" | "unknown"
    status: "on_target" | "under" | "over" | "partial" | "no_target"
    mealCount: number
    consumed: {
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
      hydration_ml: number
    }
    target: {
      calories: number | null
      protein_g: number | null
      carbs_g: number | null
      fat_g: number | null
      hydration_ml: number | null
    }
  }>
  dataQuality: {
    validDays: number
    partialDays: number
    missingMealDays: number
    missingHydrationDays: number
  }
}
```

### Pourquoi un endpoint dédié

- éviter de dupliquer les requêtes dans plusieurs composants
- centraliser la logique métier coach
- préparer une future intégration partielle dans `Nutrition Studio`
- rendre testable le calcul des insights

---

## Composants frontend à créer

### Nouvelle page

- `app/coach/clients/[clientId]/data/nutrition/page.tsx`

### Composants recommandés

- `components/clients/NutritionHub.tsx`
- `components/clients/nutrition-hub/NutritionKpiStrip.tsx`
- `components/clients/nutrition-hub/NutritionTrendPanel.tsx`
- `components/clients/nutrition-hub/NutritionInsightsPanel.tsx`
- `components/clients/nutrition-hub/NutritionAgenda.tsx`
- `components/clients/nutrition-hub/NutritionDayDrawer.tsx`
- `components/clients/nutrition-hub/NutritionDataQualityCard.tsx`

Le découpage doit rester proche de l'esprit de `PerformanceHub` :
- shell parent orchestrateur
- sous-composants spécialisés
- calculs lourds hors composants si possible

---

## Design system et UX rules

### Alignement obligatoire

Le design doit reprendre les patterns déjà visibles côté coach :
- top bar identique
- même densité de cartes
- mêmes espacements
- mêmes intensités de bordure
- mêmes conventions de texte uppercase pour labels techniques
- même style de panneaux analytiques

### Interactivité

La page doit être exploitable vite :
- filtre de fenêtre sans rechargement brutal
- agenda scannable
- détails jour ouvrables en un clic

### Priorité de lecture

Le regard du coach doit suivre cet ordre :
- est-ce que ça va globalement ?
- qu'est-ce qui décroche le plus ?
- est-ce ponctuel ou structurel ?
- quelles journées demandent une action ?

---

## Règles d'insights V1

Les insights doivent être purement déterministes.

Exemples de règles :

- si `protein adherence < 0.85` sur au moins `4 jours / 7` :
  `Protéines trop basses sur la majorité de la semaine`

- si `hydration adherence < 0.75` sur au moins `3 jours / 7` :
  `Hydratation insuffisante de façon répétée`

- si `average calories delta > +10%` sur jours off :
  `Surconsommation majoritairement concentrée sur les jours off`

- si `average carbs adherence < 0.8` sur jours training :
  `Glucides trop bas les jours d'entraînement`

- si `partialDays >= 30%` de la fenêtre :
  `Lecture à nuancer : plusieurs journées sont incomplètes`

Ces règles doivent vivre dans une fonction testable dédiée, pas directement dans le composant.

---

## Cas limites

### Aucun protocole actif

La page doit rester utile :
- agenda consommé disponible
- KPIs d'adhérence neutralisés ou affichés en `N/A`
- insight possible : `Aucune cible active pour interpréter l'adhérence`

### Peu de données

Si moins de 3 jours valides :
- conserver la page
- dégrader élégamment les graphiques
- afficher une alerte de faible confiance

### Hydratation non loggée

Ne pas confondre :
- `0 ml consommé`
- `aucune donnée loggée`

Le système doit distinguer absence de log et zéro consommation explicite.

---

## Hors scope V1

- fusion du hub dans `Nutrition Studio`
- vue multi-clients coach
- recommandations automatiques de modification de protocole
- IA générative d'interprétation
- base coach de compléments et scraping produit
- comparaison nutrition / poids / performance multi-signaux avancée

Ces sujets sont compatibles avec l'architecture proposée mais ne doivent pas alourdir la première livraison.

---

## Plan de phase recommandé

### Phase 1

- route coach `Data > Nutrition`
- endpoint agrégé
- KPI strip
- tendance `7j` par défaut avec filtres
- agenda simple
- insights rule-based

### Phase 2

- détail jour enrichi
- segmentation training/off plus visible
- résumé intégré dans `Nutrition Studio`

### Phase 3

- base de compléments coach
- lien entre compléments, protocole et signaux nutritionnels

---

## Validation attendue

La V1 est réussie si un coach peut, en moins de 20 secondes :
- comprendre si le client suit vraiment son protocole nutritionnel
- identifier la dimension qui décroche le plus
- repérer les journées à auditer
- distinguer une vraie dérive d'un simple problème de logs
