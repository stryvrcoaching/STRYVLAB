---
name: seed-catalog
description: Guide for adding or updating exercise catalog seeds in STRYVR
---

## When to use

When adding new exercises, equipment, environments, movement patterns, or muscle data to the seed files.

## Seed file location

```
prisma/seeds/training/seed_exercises.ts   — main exercise catalog (135 exercises)
```

## Golden rules

1. **Every seed is idempotent** — use `upsert` with `where: { slug }`
2. **Slugs are stable identifiers** — never change a slug after first deploy
3. **No hardcoded IDs** — always use slugs for cross-references
4. **Coefficients validated** — `stimulusCoefficient` and `volumeCreditCoefficient` ∈ [0.0, 1.0]

## Upsert pattern

```typescript
await prisma.exercise.upsert({
  where: { slug: "barbell-squat" },
  update: {
    name: "Barbell Squat",
    stimulusCoefficient: 0.9,
    // ... update fields that may change
  },
  create: {
    slug: "barbell-squat",
    name: "Barbell Squat",
    difficultySlug: "intermediate",
    stimulusCoefficient: 0.9,
    volumeCreditCoefficient: 1.0,
    // ... all required fields
  }
})
```

## Adding a new exercise — checklist

- [ ] Unique `slug` (kebab-case, stable forever)
- [ ] `name` in English (display names go in `*_translations`)
- [ ] `difficultySlug`: one of `"beginner"` | `"intermediate"` | `"advanced"` | `"elite"`
- [ ] At least one `ExerciseTargetContribution` with `role: "PRIMARY"`
- [ ] `stimulusCoefficient` reviewed (0.0–1.0, EMG-based if available)
- [ ] `volumeCreditCoefficient` reviewed (0.0–1.0, volume budget credit)
- [ ] `ExerciseSubstitution` entries if substitutes exist (with `qualityScore`)
- [ ] Run seed: `npx ts-node prisma/seeds/training/seed_exercises.ts`
- [ ] Verify idempotency: run seed twice, 0 errors

## Coefficient guidelines

| Exercise type | Typical stimulusCoeff | Typical volumeCreditCoeff |
|--------------|----------------------|--------------------------|
| Compound primary (squat, deadlift) | 0.85–1.0 | 1.0 |
| Compound secondary (RDL, lunges) | 0.7–0.9 | 0.9–1.0 |
| Isolation (curl, extension) | 0.6–0.85 | 0.8–1.0 |
| Machine/assisted | 0.5–0.75 | 0.7–0.9 |

## Biomechanical accuracy

Before seeding coefficients, consult:
1. Existing EMG literature for the exercise
2. `biomech-architect` agent for movement analysis
3. `docs/biomech/` reference documents

Never seed coefficients from intuition alone.
