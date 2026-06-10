---
name: gym-profile-modeling
description: How to model gym environments and equipment availability in STRYVR
---

## Core principle

Equipment and environments are **relational tables**, not enums or hardcoded strings.

Adding a new gym type or equipment piece = one `INSERT` via seed, no migration required.

## Tables involved

```
Environment ← ClientIntake.preferredEnvironmentId
Equipment   ← ExerciseEquipmentRequirement.equipmentId
            ← ClientIntake.availableEquipmentIds (many-to-many)
```

## Environment examples

| Slug | Description |
|------|-------------|
| `commercial-gym` | Full equipment gym (Basic Fit, Fitness Park, etc.) |
| `home-gym` | Limited home setup |
| `bodyweight-only` | No equipment |
| `outdoor` | Parks, outdoor fitness stations |
| `powerlifting-gym` | Specialized S/B/D focus |

## Equipment examples

| Slug | Category |
|------|----------|
| `barbell` | Free weights |
| `dumbbell` | Free weights |
| `cable-machine` | Machine |
| `smith-machine` | Machine |
| `pull-up-bar` | Bodyweight support |
| `resistance-band` | Accessory |
| `kettlebell` | Free weights |
| `leg-press` | Machine |
| `hack-squat` | Machine |

## Exercise equipment requirements

`ExerciseEquipmentRequirement` links exercises to their required equipment.

An exercise can have multiple equipment options (one row per option):

```typescript
// Barbell squat requires a barbell
{ exerciseId: "...", equipmentId: "barbell", isOptional: false }

// RDL can use barbell OR dumbbells
{ exerciseId: "...", equipmentId: "barbell", isOptional: false }
{ exerciseId: "...", equipmentId: "dumbbell", isOptional: false }
// (Two separate requirement rows — client needs at least one)
```

## Exercise selection filtering

When filtering exercises by client's available equipment:

```typescript
// Include exercise if client has at least one required equipment option
const availableExercises = exercises.filter(exercise => {
  const requirements = exercise.equipmentRequirements
  if (requirements.length === 0) return true // bodyweight, no equipment needed
  return requirements.some(req => clientAvailableIds.includes(req.equipmentId))
})
```

## Adding a new gym type

1. Add row to `Environment` seed:
```typescript
await prisma.environment.upsert({
  where: { slug: "garage-gym" },
  update: { name: "Garage Gym" },
  create: { slug: "garage-gym", name: "Garage Gym" }
})
```

2. Add translations in `EnvironmentTranslation`
3. No migration needed — this is a data change, not a schema change
