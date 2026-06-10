---
name: test-first
description: Write tests before or alongside implementation for STRYVR critical logic
---

## When to use

When implementing training engine logic, volume allocation, exercise selection, or any other deterministic business logic.

## Test framework

- **Unit tests**: Vitest (`tests/unit/`)
- **Integration tests**: Vitest + Prisma test DB (`tests/integration/`)
- **E2E**: Playwright (`tests/e2e/`) — for critical coach flows

## Running tests

```bash
npm test                    # all tests
npm test -- --watch         # watch mode
npm test tests/unit/        # unit only
```

## Unit test pattern

```typescript
// tests/unit/training-engine/allocator.test.ts
import { describe, it, expect } from "vitest"
import { allocateVolume } from "@/modules/training-engine/allocator"

describe("allocateVolume", () => {
  it("allocates minimum sets for MAINTENANCE target", () => {
    const result = allocateVolume({
      targets: [{ id: "t1", priority: "MAINTENANCE" }],
      clientProfile: mockClientProfile()
    })
    expect(result[0].weeklySetMin).toBe(6)
    expect(result[0].weeklySetMax).toBe(8)
  })

  it("allocates maximum sets for PRIORITY target", () => {
    const result = allocateVolume({
      targets: [{ id: "t1", priority: "PRIORITY" }],
      clientProfile: mockClientProfile()
    })
    expect(result[0].weeklySetMin).toBeGreaterThanOrEqual(16)
  })

  it("reduces volume when recovery is poor", () => {
    const normal = allocateVolume({ ..., weeklyFeedback: { energyLevel: 5 } })
    const tired = allocateVolume({ ..., weeklyFeedback: { energyLevel: 1 } })
    expect(tired[0].weeklySetMax).toBeLessThan(normal[0].weeklySetMax)
  })

  it("respects volume ceiling invariant (min ≤ max)", () => {
    const result = allocateVolume({ targets: [...], clientProfile: mockClientProfile() })
    result.forEach(alloc => {
      expect(alloc.weeklySetMin).toBeLessThanOrEqual(alloc.weeklySetMax)
    })
  })
})
```

## What MUST have unit tests

| Module | Why |
|--------|-----|
| `training-engine/allocator` | Core business logic |
| `training-engine/selector` | Core business logic |
| Any function touching coefficients | High numeric sensitivity |
| Seed idempotency logic | Data integrity |

## Integration test pattern

```typescript
// tests/integration/api/programs.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

beforeAll(async () => {
  // seed minimal test data
})

afterAll(async () => {
  // cleanup
  await prisma.$disconnect()
})

it("POST /api/programs creates a program with correct allocations", async () => {
  const res = await fetch("/api/programs", {
    method: "POST",
    body: JSON.stringify({ clientId: "test-client", ... })
  })
  expect(res.status).toBe(201)
  const body = await res.json()
  expect(body.allocations.length).toBeGreaterThan(0)
})
```

## Test file location convention

```
tests/
  unit/
    training-engine/
      allocator.test.ts
      selector.test.ts
  integration/
    api/
      programs.test.ts
      sessions.test.ts
  e2e/
    coach-creates-program.spec.ts
```

## Invariant tests

For critical invariants, add dedicated invariant tests:

```typescript
describe("training engine invariants", () => {
  it("never produces weeklySetMin > weeklySetMax", ...)
  it("never allocates more than 30 sets/week per target", ...)
  it("always excludes contraindicated exercises", ...)
})
```
