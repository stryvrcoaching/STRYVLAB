# Client TDEE Engine

## Objectif

Construire un moteur TDEE :

- centré client, pas protocole
- peu bruité
- défendable scientifiquement
- exploitable rapidement par un coach

## Principes

- Le `TDEE` est un état physiologique du client.
- Un protocole consomme un snapshot de TDEE, mais ne porte pas la vérité.
- Le moteur doit distinguer :
  - `observation brute`
  - `TDEE client stable`
  - `snapshot protocole`

## Source de vérité

La source de vérité produit est `client_tdee_state.current_tdee`.

Elle est alimentée par :

- poids lissé
- apports observés
- densité des pesées
- densité du logging nutritionnel
- fenêtre d'observation
- corrections physiologiques déjà gérées par le moteur

## Trois couches

### 1. Observation

Chaque recalcul produit une observation historisée dans `nutrition_tdee_history`.

Cette couche garde :

- estimation observée
- confiance
- fenêtre
- pesées
- jours suivis
- corrections appliquées

### 2. Stabilisation

Le moteur produit un `TDEE client stable` avec :

- seuil anti-bruit
- état `stable | watch | action`
- confirmation multi-runs
- lissage avant promotion

### 3. Application protocole

Le protocole garde :

- `tdee_reference`
- `tdee_snapshot_source`
- `tdee_snapshot_used_at`

Le protocole n'est jamais la vérité primaire.

## Règles métier

### Anti-bruit

- variation `< 50 kcal` : ignorée
- variation `50–99 kcal` : surveillance
- variation `>= 100 kcal` sur 2 runs cohérents : promotion
- variation `>= 150 kcal` avec confiance haute : promotion accélérée

### Fenêtre d'observation & Calibrage

- Le calcul de TDEE s'ancre sur le protocole actuel uniquement s'il a au moins **14 jours** de données (`MIN_WINDOW_DAYS` défini dans [weightSamples.ts](file:///Users/user/Desktop/STRYVLAB/lib/nutrition/weightSamples.ts#L4)).
- En deçà de 14 jours, le système bascule sur une fenêtre glissante de 14 jours par défaut (incluant les données pré-protocole) pour assurer la stabilité statistique.
- Une alerte visuelle de calibrage est affichée au coach dans le Nutrition Studio durant les 14 premiers jours d'un protocole afin de prévenir des variations d'eau/glycogène transitoires pouvant fausser le calcul brute.

### Stabilité

- le recalcul peut être quotidien
- la vérité stable ne change pas à chaque run
- la valeur promue est lissée avant mise en production

### Exécution

- le nightly reste le moteur principal
- le bouton manuel force un recalcul observable
- l’ouverture du studio ne doit jamais recalculer silencieusement

## UX coach

Le coach doit voir :

- `TDEE client stable`
- confiance
- tendance
- dernier recalcul réussi
- dernier skip / dernière erreur

Le coach ne doit pas travailler sur la valeur brute.

## Flux cible

1. Un run calcule un `TDEE observé`
2. Le moteur l’évalue contre l’état client
3. Il décide :
   - `stable`
   - `watch`
   - `action`
4. Il met à jour `client_tdee_state`
5. Les protocoles lisent cette vérité et peuvent capturer un snapshot

## Consommateurs

Doivent lire en priorité `client_tdee_state` :

- Nutrition Studio
- Nutrition Hub
- vue client nutrition
- historique TDEE
- futurs assistants / moteurs décisionnels
