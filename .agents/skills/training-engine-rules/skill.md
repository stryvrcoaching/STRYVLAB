---
name: training-engine-rules
description: Rules and invariants for the STRYVR volume allocation and program generation engine
---

## Engine location

`src/modules/training-engine/`

## Core concepts

### Volume allocation

The engine allocates **weekly sets** to `TrainableTarget` entities (not to muscles directly).

Input:
- `ClientTargetPriority[]` — MAINTENANCE | MODERATE | PRIORITY per target
- `ClientIntake` — anthropometry, lifestyle, recovery capacity
- `ClientConstraint[]` — injuries, pathologies

Output:
- `ProgramTargetAllocation[]` — `{ targetId, weeklySetMin, weeklySetMax }`

### Volume ranges by priority

| Priority | Weekly sets (hypertrophy) |
|----------|--------------------------|
| MAINTENANCE | 6–8 sets |
| MODERATE | 10–14 sets |
| PRIORITY | 16–22 sets |

These are starting ranges. Adjust based on:
- Training age (beginner → lower end)
- Recovery capacity (poor sleep/stress → lower end)
- Compound overlap (target already heavily worked by compound exercises)

### Exercise selection

After volume allocation, the selector "spends" the weekly set budget using exercises:

```
weekly_sets_used += sets × volumeCreditCoefficient
```

Selection constraints:
1. Equipment available (`ClientIntake.availableEquipmentIds`)
2. Environment (`ClientIntake.preferredEnvironmentId`)
3. No contraindicated exercises (`ExerciseConstraint`, `ClientConstraint`)
4. Substitution quality considered (`ExerciseSubstitution.qualityScore`)

### Invariants (never violate)

1. `stimulusCoefficient` and `volumeCreditCoefficient` are always ∈ [0.0, 1.0]
2. Every exercise must have at least one PRIMARY `ExerciseTargetContribution`
3. `weeklySetMin` ≤ `weeklySetMax` in `ProgramTargetAllocation`
4. An exercise with `ExerciseConstraint` matching a `ClientConstraint` MUST be excluded
5. Volume budget can be exceeded by at most 10% before triggering a warning
6. Compound exercises credit volume to MULTIPLE targets (via multiple `ExerciseTargetContribution` rows)

## Unit testing requirements

The training engine is the most critical business logic in STRYVR. Every allocation function MUST have unit tests:

```typescript
// tests/training-engine/allocator.test.ts
describe("volume allocator", () => {
  it("allocates correct sets for PRIORITY target", () => { ... })
  it("respects volume ceiling with compound overlap", () => { ... })
  it("reduces volume for poor recovery", () => { ... })
})
```

## Module public API

```typescript
// src/modules/training-engine/index.ts
export { allocateVolume } from "./allocator"
export { selectExercises } from "./selector"
export type { AllocationInput, AllocationOutput, SelectionInput, SelectionOutput } from "./types"
```

Never import internals directly — always through `index.ts`.

## No LLM in the engine

The training engine is **fully deterministic**. No LLM calls, no n8n calls. Pure TypeScript functions.

If AI-assisted exercise suggestions are added in the future, they go in a separate module outside the engine.
