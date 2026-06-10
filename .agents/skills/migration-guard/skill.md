---
name: migration-guard
description: Checklist and review process before applying any Prisma migration in STRYVR
---

## When to use

Before running `npx prisma migrate dev` or `npx prisma migrate deploy` — especially for migrations that modify existing tables.

## Pre-migration checklist

### 1. Read the generated SQL

```bash
# Review what the migration will do
cat prisma/migrations/[timestamp]_[name]/migration.sql
```

Look for:
- `DROP COLUMN` — data loss risk
- `ALTER COLUMN ... NOT NULL` — will fail if existing rows have NULLs
- `DROP TABLE` — irreversible
- Missing `CREATE INDEX` for FK columns

### 2. Classify the risk

| SQL operation | Risk | Action required |
|--------------|------|-----------------|
| `CREATE TABLE` | None | Safe to apply |
| `ADD COLUMN` nullable | None | Safe to apply |
| `ADD COLUMN` not null | Medium | Ensure default value or backfill first |
| `ALTER COLUMN` type | High | Verify cast is safe |
| `DROP COLUMN` | High | Confirm data is backed up or unused |
| `DROP TABLE` | Critical | Explicit user confirmation required |
| `RENAME` | High | Will break existing code until updated |

### 3. Check for missing indices

Every foreign key column should have an index:

```sql
-- Should be in migration if adding FK
CREATE INDEX "Session_programId_idx" ON "Session"("programId");
```

Prisma does NOT automatically create indices for FK columns. Add them manually.

### 4. Verify no business logic in migration

Migrations should only contain DDL. No:
- Complex UPDATE statements computing values
- Stored procedures
- Triggers

If you need a data backfill, do it as a separate script after the migration.

## Post-migration checklist

- [ ] `npx prisma generate` — regenerate client
- [ ] `npx tsc --noEmit` — 0 TypeScript errors
- [ ] Seed re-run if reference data changed
- [ ] `data-model.md` updated
- [ ] CHANGELOG.md updated with `SCHEMA:` entry
- [ ] Test the affected feature locally

## Rollback strategy

Prisma does not auto-rollback. For each risky migration, document:

```markdown
## Rollback for [migration name]

If migration fails or causes issues:
1. [SQL to reverse the change]
2. [Data restoration steps if needed]
```

For DROP operations: always take a DB snapshot before applying in production.
