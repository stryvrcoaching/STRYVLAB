---
name: prisma-schema
description: Guide for making safe, idiomatic Prisma schema changes in STRYVR
---

## When to use

When adding or modifying models, relations, enums, or fields in `prisma/schema.prisma`.

## Workflow

1. **Read the current schema** — never modify from memory
2. **Check `.Codex/rules/database-patterns.md`** — conventions to follow
3. **Draft the change** with reasoning
4. **Create migration** — `npx prisma migrate dev --name descriptive_name`
5. **Regenerate client** — `npx prisma generate`
6. **Update seed** if new reference data is needed
7. **Update `docs/architecture/data-model.md`** to reflect the change

## Naming conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Model | PascalCase | `TrainableTarget` |
| Field | camelCase | `stimulusCoefficient` |
| Enum | PascalCase + UPPER_SNAKE values | `ProgramStatus.DRAFT` |
| Relation field | camelCase, singular for one, plural for many | `coach`, `sessions` |
| Unique slug | `slug String @unique` | `exercise.slug` |

## Required fields on every model

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

Exception: join tables (pure many-to-many) may omit timestamps.

## Relational tables vs enums

Use a **relational table** (not a Prisma enum) when:
- The set of values may grow over time
- Values need translations
- Values need additional metadata (description, icon, etc.)

Current relational reference tables: `Equipment`, `Environment`, `MovementPattern`, `MuscleGroup`, `Muscle`, `MuscleRegion`.

## Adding a new field

```prisma
// CORRECT — non-breaking, nullable first
model Exercise {
  newField String?   // nullable so existing rows are valid
}

// After migration + backfill, if required:
model Exercise {
  newField String    // make non-nullable only after backfill
}
```

## Relations pattern

```prisma
model Session {
  id        String   @id @default(cuid())
  programId String
  program   Program  @relation(fields: [programId], references: [id], onDelete: Cascade)
  // ...
}
```

Always define `onDelete` explicitly. Default to `Cascade` for child entities, `Restrict` for shared references.

## Checklist before commit

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Migration file reviewed manually
- [ ] `data-model.md` updated
- [ ] CHANGELOG.md updated with `SCHEMA:` entry
