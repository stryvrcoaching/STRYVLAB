---
name: exercise-taxonomy
description: Taxonomy and classification system for exercises in the STRYVR catalog
---

## Classification axes

Every exercise in STRYVR is classified along multiple axes — all via relational tables, not enums.

### Movement pattern (`MovementPattern`)

| Slug | Description |
|------|-------------|
| `horizontal-push` | Bench press, push-up variants |
| `vertical-push` | Overhead press, dips (triceps-dominant) |
| `horizontal-pull` | Row variants |
| `vertical-pull` | Pull-up, lat pulldown |
| `hip-hinge` | Deadlift, RDL, good morning |
| `squat` | Back squat, front squat, goblet squat |
| `lunge` | Reverse lunge, Bulgarian split squat |
| `carry` | Farmer carry, suitcase carry |
| `isolation` | Curl, extension, lateral raise |
| `core` | Plank, ab wheel, pallof press |

### Difficulty (`difficultySlug` — string, validated at app layer)

| Slug | Meaning |
|------|---------|
| `beginner` | Minimal technique required, safe for untrained |
| `intermediate` | Some technique required, 3-6 months training |
| `advanced` | Significant technique, 1+ year training |
| `elite` | High technical demand, not for general population |

### Exercise roles in `ExerciseTargetContribution`

| Role | Meaning |
|------|---------|
| `PRIMARY` | Main target — highest stimulus |
| `SECONDARY` | Significant secondary involvement |
| `STABILIZER` | Stabilization only, minimal stimulus |

Each exercise MUST have at least one PRIMARY contribution.

## Substitution quality score

`ExerciseSubstitution.qualityScore` ∈ [0.0, 1.0]:

| Score | Meaning |
|-------|---------|
| 0.9–1.0 | Near-identical substitution (same pattern, similar load) |
| 0.7–0.89 | Good substitution (same pattern, different equipment) |
| 0.5–0.69 | Acceptable (different pattern, similar target) |
| < 0.5 | Poor substitution — use only if no better option |

## Contraindications (`ExerciseConstraint`)

Catalog-level contraindications — applies to everyone with that condition.

Distinct from `ClientConstraint` which is per-client (injury history, pathology).

When selecting exercises for a program:
- Check `ExerciseConstraint` against `ClientConstraint`
- Exclude any exercise where constraints overlap

## i18n

Exercise names are stored in `name` (English, for internal use).
Display names go in `ExerciseTranslation` with `lang: FR | ES | EN`.

When adding a new exercise, add at minimum:
- EN translation (required)
- FR translation (recommended — primary market)
