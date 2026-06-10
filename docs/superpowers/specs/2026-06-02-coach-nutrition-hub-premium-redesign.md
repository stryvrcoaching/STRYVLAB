# Coach Nutrition Hub Premium Redesign — Design Spec
**Date:** 2026-06-02
**Status:** Draft for review

---

## Vue d'ensemble

Refondre complètement la page `Coach > Client > Data > Nutrition` pour la hisser au même niveau de finition, de densité premium et de valeur perçue que `Performance`.

Objectif produit :
- faire de `Nutrition` une page premium coach de même rang que `Performance`
- conserver la logique métier nutrition déjà mise en place
- améliorer fortement la qualité perçue, la hiérarchie visuelle et la lecture coach

Cette refonte est d'abord une refonte UI/UX premium.
Le moteur métier existant est réutilisé au maximum.

---

## Intention produit

Aujourd'hui, la page `Nutrition` est utile fonctionnellement, mais elle n'a pas encore le même niveau de sophistication visuelle et analytique que `Performance`.

La cible n'est pas juste :
- plus joli
- plus propre

La cible est :
- même niveau de finition que `Performance`
- même sensation de produit premium coach
- même confiance perçue à l'ouverture
- même qualité de hiérarchie et de densité informationnelle

En pratique, un coach doit ressentir que `Nutrition` et `Performance` appartiennent au même niveau de maturité produit.

---

## Référence directe

La référence principale est la page `Performance`, notamment :
- sa structure analytique premium
- son hero de haut niveau
- ses panneaux riches
- sa qualité de composition
- sa densité maîtrisée
- son sentiment de "console coach haut de gamme"

La page `Nutrition` ne doit pas être une copie stricte de `Performance`, mais une soeur premium :
- même ambition
- même niveau de polish
- logique métier nutritionnelle propre

---

## Ce qui existe déjà

### Existant à conserver

- route `Data > Nutrition`
- endpoint coach `GET /api/clients/[clientId]/nutrition-hub`
- moteur métier dans [lib/coach/nutritionHub.ts](/Users/user/Desktop/STRYVLAB/lib/coach/nutritionHub.ts)
- structure de données déjà utile : `summary`, `trend`, `insights`, `agenda`, `dataQuality`

### Existant à refondre

- [components/clients/NutritionHub.tsx](/Users/user/Desktop/STRYVLAB/components/clients/NutritionHub.tsx)
- les composants `nutrition-hub` déjà créés doivent être réévalués
- la hiérarchie visuelle actuelle est trop simple par rapport à `Performance`

### Intention technique

Le redesign doit privilégier :
- refonte de la couche UI
- enrichissement léger du payload si nécessaire
- zéro duplication de logique métier

---

## Objectifs fonctionnels

Le coach doit pouvoir, dès l'ouverture :

- comprendre l'état global de l'exécution nutritionnelle
- identifier le principal point de friction
- voir si le problème est court terme ou structurel
- distinguer rapidement les journées à auditer
- lire la nutrition avec un confort et une confiance équivalents à `Performance`

---

## Nouvelle architecture de page

La page est restructurée en 4 étages premium.

### 1. Hero premium

Bloc d'ouverture fort, signature de la page.

Contenu :
- `score global nutrition`
- statut coach dominant
- synthèse très courte de la situation
- fenêtre active
- dimensions dominantes ou fragiles

Le hero doit offrir une lecture immédiate :
- est-ce que ça va ?
- faut-il intervenir ?
- sur quoi ?

Le hero doit assumer une vraie présence visuelle, comme sur `Performance`.

### 2. Zone analytique principale

Bloc central de tendances et de lecture quantitative.

Panneaux recommandés :
- calories consommées vs cible
- protéines consommées vs cible
- hydratation réelle vs cible
- lecture `training vs off`

Cette zone doit être visuellement premium :
- panneaux plus construits
- meilleurs contrastes
- meilleure respiration
- composition cohérente

### 3. Coach insights premium

Bloc d'interprétation haut de gamme.

Fonction :
- rendre les signaux immédiatement exploitables
- montrer les priorités coach
- ne pas ressembler à une simple liste plate

Le bloc doit donner le sentiment d'un moteur d'analyse premium, même s'il reste rule-based.

### 4. Agenda nutritionnel premium

Bloc historique / opérationnel refondu.

L'agenda reste central, mais doit devenir :
- plus lisible
- plus scannable
- plus haut de gamme
- moins “tableau utilitaire brut”

Il doit être agréable à lire même avant de cliquer sur une journée.

---

## Hero premium — détail

### Contenu

Le hero doit contenir :
- `Score global nutrition`
- un statut dominant
- un micro-résumé coach
- 3 KPI satellites maximum

Exemples de statut :
- `Sous contrôle`
- `À corriger`
- `Lecture fragile`

Exemples de résumé :
- `Adhérence correcte mais protéines trop souvent sous cible.`
- `Hydratation instable, surtout en fin de semaine.`
- `Exécution partielle, plusieurs journées restent peu fiables.`

### Structure visuelle

Le hero peut reprendre la logique suivante :
- grande carte principale
- métrique premium
- petites cartes secondaires intégrées

Le hero ne doit pas ressembler à 6 cartes KPI alignées.
Il doit avoir une vraie narration visuelle.

---

## Zone analytique premium — détail

### Panneaux recommandés

1. `Calories`
- consommé vs cible
- tendance fenêtre active
- delta moyen

2. `Protéines`
- lecture d'adhérence
- stabilité
- intensité du déficit

3. `Hydratation`
- conformité
- stabilité de log
- manque récurrent si présent

4. `Training vs Off`
- comparaison qualitative et quantitative
- permet d'identifier les erreurs d'alimentation contextuelles

### Règle clé

Comme pour `Performance`, chaque panneau doit être :
- compréhensible seul
- visuellement fini
- utile sans lire toute la page

---

## Coach insights premium — détail

### Format

Pas une simple liste linéaire.

Recommandation :
- cartes insights ou alertes premium
- ton visuel par sévérité
- titres courts
- messages compacts

### Types d'insights

- `Protéines insuffisantes`
- `Hydratation instable`
- `Surplus les jours off`
- `Glucides trop bas à l'entraînement`
- `Données incomplètes`

### Règle d'affichage

- 3 à 5 insights max visibles
- priorisation forte
- aucun verbiage inutile

---

## Agenda nutritionnel premium — détail

### Objectif

L'agenda doit être beau à scanner avant même l'ouverture d'un détail.

### Éléments visibles

Pour chaque journée :
- date
- statut visuel
- calories consommées / cible
- protéines consommées / cible
- hydratation consommée / cible
- nombre de repas
- type de journée si utile (`training` / `off`)

### Refonte attendue

Par rapport à la version actuelle :
- meilleure composition
- meilleure densité
- meilleur rythme visuel
- distinction plus élégante des statuts

Le résultat doit être plus proche d'une timeline analytique premium que d'une simple liste technique.

---

## Qualité de données

### Positionnement

La qualité de données ne doit plus être perçue comme un simple appendice secondaire.
Elle doit être intégrée proprement à la logique premium de la page.

### Rôle

Elle doit aider à nuancer la lecture :
- journées incomplètes
- hydratation absente
- données trop faibles

### Présentation

Le bloc peut être :
- intégré à un panneau premium
- ou visible dans une carte de support élégante

Mais il ne doit pas paraître administratif ou “debug”.

---

## Architecture composants recommandée

### Shell

- `components/clients/NutritionHub.tsx`

Ce composant devient un orchestrateur premium, comme `PerformanceHub`.

### Sous-composants recommandés

- `components/clients/nutrition-hub/NutritionHeroPanel.tsx`
- `components/clients/nutrition-hub/NutritionTrendGrid.tsx`
- `components/clients/nutrition-hub/NutritionMetricSpotlight.tsx`
- `components/clients/nutrition-hub/NutritionCoachSignalPanel.tsx`
- `components/clients/nutrition-hub/NutritionAgendaPremium.tsx`
- `components/clients/nutrition-hub/NutritionQualityPanel.tsx`

Les composants actuels peuvent être :
- refondus
- renommés
- remplacés

L'important est d'obtenir une structure claire et maintenable.

---

## Payload backend

### Principe

Réutiliser le payload existant autant que possible.

### Enrichissements autorisés

Si nécessaire, on peut ajouter quelques champs calculés côté endpoint pour servir le hero premium, par exemple :
- statut coach dominant
- dimensions les plus faibles
- résumé synthétique court

Mais on ne crée pas un second moteur parallèle.

Le backend reste au service de la nouvelle présentation premium.

---

## Design system et direction visuelle

### Règle centrale

La page doit être :
- premium
- dense
- claire
- coach-first

Sans trahir le design system existant.

### Do

- cartes plus construites
- meilleure hiérarchie
- typographie plus affirmée
- usage intelligent des labels uppercase
- sections bien rythmées
- sentiments de profondeur et de finition

### Don't

- tableau gris générique
- empilement uniforme de cartes plates
- lecture admin tool
- excès de composants standard sans intention

---

## Cas limites

### Peu de données

Même avec peu de données, la page doit rester premium.

Elle doit afficher :
- états élégants
- message de confiance faible
- pas de vide pauvre

### Pas de protocole actif

La page doit continuer à valoriser les données réelles observées.

### Erreur réseau

Les états d'erreur doivent être cohérents avec le niveau de qualité de la page.
Pas de message brutal ou cheap.

---

## Hors scope

- refonte du moteur métier nutrition
- nouvelle logique d'insights IA générative
- redesign de `Nutrition Studio`
- base coach de compléments
- refonte multi-clients

Cette phase est centrée sur la page `Data > Nutrition` uniquement.

---

## Validation attendue

La refonte est réussie si :

- la page `Nutrition` paraît du même niveau de sophistication que `Performance`
- le coach ressent une montée nette de qualité perçue
- la lecture est plus premium sans perdre en clarté
- les signaux clés deviennent plus évidents
- l'agenda paraît enfin digne du niveau global de la plateforme coach
