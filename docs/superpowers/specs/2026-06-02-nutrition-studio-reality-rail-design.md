# Nutrition Studio Reality Rail — Design Spec
**Date:** 2026-06-02
**Status:** Draft for review

---

## Vue d'ensemble

Ajouter dans `Nutrition Studio` un résumé compact de la réalité nutritionnelle du client, placé en haut de la colonne droite, au-dessus du `Protocol Canvas`.

Objectif produit :
- aider le coach à ajuster le protocole à partir du réel
- réutiliser le pattern déjà adopté avec `Workout Studio` + `Performance`
- éviter de dupliquer tout le hub `Data > Nutrition` dans le studio

Cette phase 2 ne remplace pas le hub complet.
Elle ajoute un `rail` décisionnel compact dans le studio, avec un lien clair vers la page `Data > Nutrition`.

---

## Positionnement

### Principe UX

Le studio garde sa fonction principale :
- colonne gauche : intelligence client
- colonne centrale : moteur de calcul
- colonne droite : exécution / projection du protocole

La colonne droite devient :

1. `Nutrition Reality Rail`
2. `Protocol Canvas`

Le rail ne doit pas transformer la colonne droite en dashboard analytique.
Il sert uniquement de contexte coach rapide avant ou pendant l'édition du protocole.

### Référence produit

Le pattern visé est l'équivalent nutritionnel de l'intégration `Performance` visible dans `Workout Studio` :
- lecture terrain compacte
- intégrée au bon endroit
- sans casser la hiérarchie principale de l'écran

---

## Ce qui existe déjà

### Base déjà disponible

- hub coach `Data > Nutrition` déjà construit
- endpoint agrégé `GET /api/clients/[clientId]/nutrition-hub?window=7`
- composants du hub dans `components/clients/nutrition-hub`
- structure du studio dans [components/nutrition/studio/NutritionStudio.tsx](/Users/user/Desktop/STRYVLAB/components/nutrition/studio/NutritionStudio.tsx)

### Contrainte d'architecture

Le rail du studio doit consommer la même vérité que le hub.

Il ne faut pas :
- recalculer une autre logique nutritionnelle parallèle
- re-fabriquer des insights spécifiques au studio
- ouvrir une nouvelle source de divergence entre `Data > Nutrition` et `Nutrition Studio`

Le rail doit donc être alimenté par le même endpoint coach déjà en place.

---

## Objectifs fonctionnels V1

Dans `Nutrition Studio`, le coach doit pouvoir voir immédiatement :

- le niveau global d'adhérence nutrition
- le ou les signaux principaux qui décrochent
- les 3 dernières journées pertinentes
- la fenêtre courte la plus utile pour décider (`3j` ou `7j`)
- un accès direct au hub complet s'il veut investiguer

Le coach ne doit pas avoir besoin de quitter mentalement le studio pour comprendre si le protocole actuel colle ou non à la réalité observée.

---

## Architecture UI

### Placement

Dans la colonne droite, insérer un bloc en haut :

- `NutritionRealityRail`
- puis `ProtocolCanvas`

### Hauteur et densité

Le rail doit rester compact.

Cibles UX :
- lecture en moins de 5 secondes
- pas de gros graphique
- pas de scroll dédié lourd
- pas plus de 3 insights

Le `Protocol Canvas` doit rester visuellement dominant.

### Comportement scroll

Le rail reste dans le flux naturel de la colonne droite.
Il ne devient pas une layer flottante indépendante dans cette phase.

Motif :
- simplicité
- respect du layout existant
- coût d'intégration plus faible

---

## Contenu du rail

### 1. Header

Bloc d'en-tête avec :
- label `Nutrition Reality`
- micro-sous-texte du type `Réalité observée`
- bouton secondaire `Ouvrir le hub`

Le bouton ouvre :

`/coach/clients/[clientId]/data/nutrition`

### 2. Score principal

Afficher :
- `Score global nutrition`
- valeur en `%`
- fenêtre active visible (`3j` ou `7j`)

La fenêtre par défaut est `7j`.

### 3. Mini toggle de fenêtre

Le rail ne propose que :
- `3j`
- `7j`

Raison :
- garder le bloc compact
- éviter une logique analytique trop lourde dans le studio
- réserver `14j / 30j` au hub complet

### 4. Insights prioritaires

Afficher maximum 3 insights :
- issus du même endpoint
- triés comme dans le hub
- format court

Exemples :
- `Protéines insuffisantes`
- `Hydratation instable`
- `Données incomplètes`

Chaque insight garde :
- son titre
- son ton
- un message très court

### 5. 3 dernières journées

Afficher une mini-liste des 3 journées les plus récentes :
- date
- statut global
- calories consommées / cible
- protéines consommées / cible
- hydratation consommée / cible

But :
- donner un aperçu concret de la réalité récente
- compléter le score global par du terrain lisible

---

## Interaction avec le Protocol Canvas

### Niveau d'intégration V1

Cette phase ne force pas une synchronisation complexe entre journées réelles et jours du protocole.

Le rail et le canvas restent séparés en responsabilité :
- rail = lecture du réel
- canvas = conception du protocole

### Option légère autorisée

Si simple à brancher proprement :
- clic sur une journée du rail
- met en évidence un jour du protocole proche ou conceptuellement lié

Mais ce comportement est optionnel pour cette phase.
Il ne doit pas créer de couplage fragile ou d'ambiguïté calendrier/protocole.

---

## Flux de données

### Source

Le rail appelle :

`GET /api/clients/[clientId]/nutrition-hub?window=3`
ou
`GET /api/clients/[clientId]/nutrition-hub?window=7`

### Transformation locale

Le composant studio dérive seulement :
- `summary`
- `topInsights = insights.slice(0, 3)`
- `recentDays = agenda.slice(-3)` ou équivalent selon l'ordre réel de l'agenda

Le studio ne doit pas recalculer :
- score
- adhérences
- insights
- statuts journaliers

### États à gérer

- `loading`
- `error`
- `empty`
- `ready`

L'état vide doit rester utile :
- message court
- rappel que les logs réels apparaîtront ici
- lien vers le hub complet conservé si pertinent

---

## Composants recommandés

### Nouveaux composants

- `components/nutrition/studio/NutritionRealityRail.tsx`
- `components/nutrition/studio/NutritionRealityMiniDay.tsx`

### Hook optionnel

Si cela simplifie proprement le code :

- `components/nutrition/studio/useNutritionReality.ts`

Ce hook peut gérer :
- fetch
- fenêtre active `3j / 7j`
- extraction des sous-ensembles utiles au rail

### Fichier à modifier

- [components/nutrition/studio/NutritionStudio.tsx](/Users/user/Desktop/STRYVLAB/components/nutrition/studio/NutritionStudio.tsx)

Le `ProtocolCanvas` ne doit pas absorber la logique du rail.

---

## Design system

### Alignement obligatoire

Le rail doit reprendre le langage visuel du studio existant :
- cartes sombres
- bordures faibles
- labels uppercase déjà présents
- hiérarchie typographique cohérente

### Priorité visuelle

Le rail doit être important mais secondaire par rapport au canvas :
- plus compact
- moins dense
- moins “lourd” visuellement que les panneaux principaux du hub

### À éviter

- gros graphiques
- tabs complexes
- animations lourdes
- nouvelle grammaire visuelle

---

## Cas limites

### Pas assez de données

Le rail affiche :
- état vide ou faible confiance
- message court
- pas de faux signal fort

### Pas de protocole actif

Le rail reste affichable si le hub renvoie des données réelles mais peu de cible.
Il reprend l'interprétation du hub sans couche spéciale studio.

### Erreur réseau

Le rail doit échouer proprement :
- message discret
- ne pas casser le `Protocol Canvas`
- ne pas bloquer l'édition du protocole

---

## Hors scope

- duplication complète du hub dans le studio
- graphiques complets Recharts dans la colonne droite
- synchronisation intelligente complexe jour réel → jour protocole
- recommandations automatiques de modification de protocole
- module compléments dans ce rail

---

## Validation attendue

Cette phase est réussie si, dans `Nutrition Studio`, un coach peut :

- voir en quelques secondes si le réel colle au protocole
- identifier le principal point de friction nutritionnel
- consulter les 3 dernières journées utiles
- ouvrir le hub complet si une analyse plus profonde est nécessaire

Sans alourdir la colonne droite ni casser la logique de conception du studio.
