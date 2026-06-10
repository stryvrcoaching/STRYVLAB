---
name: database-review
description: Run a database review pass on a feature branch — schema, queries, seeds, and patterns
---

## When to use

Before merging any branch that touches DB code: schema, queries, seeds, or migrations.

## Review scope

### Schema review

Use the `db-reviewer` agent for a structured schema review.

Manual checks:
1. All models follow naming conventions (see `database-patterns.md`)
2. No Prisma enum used where a relational table should be
3. No `Json` field used for structured data that deserves its own model
4. `organizationId` path exists for all operational entities

### Query review

Search for anti-patterns:

```bash
# Missing pagination (large result sets)
grep -r "findMany" src/app/api/ --include="*.ts"
# Each findMany should have take/skip or cursor pagination

# N+1 queries
grep -r "prisma\." src/ --include="*.ts" -l
# Check for prisma calls inside loops
```

Pattern to avoid:

```typescript
// BAD — N+1
const programs = await prisma.program.findMany(...)
for (const p of programs) {
  p.sessions = await prisma.session.findMany({ where: { programId: p.id } }) // N queries!
}

// GOOD — single query with include
const programs = await prisma.program.findMany({
  include: { sessions: true }
})
```

### Transaction review

Operations that modify multiple tables MUST use `prisma.$transaction`:

```typescript
// BAD — two separate writes, not atomic
await prisma.program.create(...)
await prisma.programTargetAllocation.createMany(...)

// GOOD
await prisma.$transaction(async (tx) => {
  const prog = await tx.program.create(...)
  await tx.programTargetAllocation.createMany(...)
  return prog
})
```

### Coefficient validation review

Any code path that sets `stimulusCoefficient` or `volumeCreditCoefficient`:

```typescript
// Must validate range
if (coeff < 0 || coeff > 1) throw new Error(`Coefficient out of range: ${coeff}`)
```

## Output

Produce a structured review report:
- Blocking issues (must fix before merge)
- Warnings (should fix soon)
- Approved patterns
- Performance risks
