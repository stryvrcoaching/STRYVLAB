---
name: refactor-safe
description: Safe refactoring checklist for STRYVR — no behavior change, no regression
---

## Principle

A refactor changes **how** code is written, not **what** it does. If behavior changes, it's a feature or bug fix, not a refactor.

## Before starting

1. **Run existing tests** — establish baseline: `npm test`
2. **Read the code fully** before changing anything
3. **Identify the scope** — what is in / out of scope
4. **Do not mix** refactor + feature + bug fix in one PR

## Safe refactor types

### Module extraction

Moving logic from a route handler into a module:

```typescript
// BEFORE — logic in route
export async function POST(req) {
  const sets = req.body.targets.map(t => {
    const priority = t.priority === "PRIORITY" ? 20 : 10
    return { targetId: t.id, weeklySetMin: priority - 4, weeklySetMax: priority }
  })
  // ...
}

// AFTER — logic in module
import { allocateVolume } from "@/modules/training-engine/allocator"

export async function POST(req) {
  const sets = allocateVolume(req.body.targets)
  // ...
}
```

Rule: the module function MUST produce identical output for identical input.

### Type extraction

Moving inline types to a `types.ts` file — no behavior change, just organization.

### Rename refactor

Rename a function/variable for clarity. Use TypeScript's rename symbol to catch all usages.

### Dead code removal

Only remove code that is:
- Not exported AND not imported anywhere (verify with Grep)
- Not referenced in seeds or fixtures
- Not part of a planned feature (check `project-state.md` next steps)

## During refactor

- Commit in small, atomic steps (see `git-atomic-commits` skill)
- Run `npx tsc --noEmit` after each step
- Run `npm test` after each step
- If tests break, revert immediately — don't pile on fixes

## After refactor

- [ ] `npm test` — all tests pass
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Manual smoke test of the refactored feature
- [ ] CHANGELOG.md updated: `REFACTOR: [description]`
- [ ] PR description explains: "No behavior change — [what moved where and why]"

## Forbidden during refactor

- Changing function signatures (that's an API change)
- Adding new business logic
- Modifying DB queries (unless for equivalent behavior)
- Changing error messages (clients may depend on them)
