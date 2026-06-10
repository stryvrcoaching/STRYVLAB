# Nutrition Data Governance

Date: 2026-05-30
Statut: Référence active
Périmètre: Nutrition Studio coach, agrégation `nutrition-data`, calcul nutritionnel

## Objectif

Formaliser, par variable, quelles données peuvent:
- venir d'un bilan
- venir du temps réel
- être enrichies par une fenêtre ancrée autour d'un bilan
- rester strictement structurelles

La source de vérité code est:
- [lib/nutrition/dataGovernance.ts](/Users/user/Desktop/STRYVLAB/lib/nutrition/dataGovernance.ts)

## Règle fondatrice

Le moteur nutritionnel ne doit jamais mélanger une donnée structurelle ancienne avec une donnée temps réel récente sans règle explicite d'ancrage.

## Familles

### Structurelles

Variables lentes, attachées à un bilan ou à une mesure explicite:
- `height_cm`
- `body_fat_pct`
- `lean_mass_kg`
- `muscle_mass_kg`
- `visceral_fat_level`
- `bmr_kcal_measured`

Règle:
- pas de temps réel
- pas de moyenne glissante
- fallback permis uniquement via `manual_override` ou `derived` selon le champ

### Dynamiques

Variables vivantes, destinées à des moyennes glissantes:
- `daily_steps`
- `sleep_duration_h`
- `sleep_quality`
- `stress_level`
- `energy_level`

Règle:
- mode `realtime`: moyenne glissante sur 7 jours
- mode `bilan`: overlay temps réel autorisé seulement si la fenêtre est ancrée à la date du bilan

### Hybrides

Variables pouvant exister dans un bilan mais être rafraîchies sous contraintes:
- `weight_kg`
- `weekly_frequency`
- `session_duration_min`
- `training_calories_weekly`
- `cardio_frequency`
- `cardio_duration_min`
- `caffeine_daily_mg`
- `alcohol_weekly`
- `work_hours_per_week`
- `occupation_multiplier`

Règle:
- `weight_kg` peut être rafraîchi par check-in
- les autres restent pour l'instant ancrées au bilan, au profil ou au manual override

## Décision actuelle

Fenêtre temps réel standard:
- `7 jours`

Ancrage:
- mode `realtime` -> journée physiologique courante du client
- mode `bilan` -> date du bilan sélectionné

## Impact produit

Cette matrice doit piloter:
- `app/api/clients/[clientId]/nutrition-data/route.ts`
- les labels de provenance dans Nutrition Studio
- les futurs garde-fous du moteur de calcul
- les validations coach avant partage d'un protocole
