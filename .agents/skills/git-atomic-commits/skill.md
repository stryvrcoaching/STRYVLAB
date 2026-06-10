---
name: git-atomic-commits
description: Write atomic, meaningful git commits for STRYVR
---

## Principle

One commit = one intention. A reviewer should understand the change from the commit message alone.

## Commit message format

```
<type>(<scope>): <short description>

[optional body — for context or reasoning]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature or behavior |
| `fix` | Bug fix |
| `schema` | Prisma schema or migration change |
| `seed` | Seed data change |
| `refactor` | Code reorganization, no behavior change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Dependencies, tooling, config |

### Scopes (STRYVR-specific)

| Scope | Area |
|-------|------|
| `training` | Training engine logic |
| `morpho` | Morphology bridge |
| `program` | Program CRUD |
| `session` | Session/WorkingSet |
| `client` | Client profile |
| `coach` | Coach dashboard |
| `auth` | Authentication |
| `seed` | Catalog data |
| `db` | DB layer |
| `ui` | UI components |

### Examples

```
feat(training): add volume allocator for PRIORITY targets
fix(seed): resolve idempotency issue on ExerciseSubstitution
schema: add ClientTargetPriority table
refactor(program): extract allocation logic into training-engine module
test(training): add invariant tests for volume ceiling
docs: update data-model.md with ClientTargetPriority
chore: update prisma client after schema migration
```

## What makes a commit atomic

A commit is atomic when:
1. It compiles — `npx tsc --noEmit` passes
2. Tests pass — `npm test` passes
3. It does one thing — the diff is coherent
4. It can be reverted cleanly — `git revert` works without side effects

## What to avoid

- Commits mixing feature + refactor + docs
- "WIP", "fix", "update" as full commit messages
- Committing generated files that should be gitignored
- Committing `.env` or secrets

## Committing a schema change

Schema changes always need two commits:

```bash
# 1. Schema + migration
git add prisma/schema.prisma prisma/migrations/
git commit -m "schema: add ClientTargetPriority table"

# 2. Generated client (after prisma generate)
git add prisma/client/ node_modules/.prisma/
git commit -m "chore: regenerate prisma client after schema migration"
```

Or combine if project keeps generated client in git:

```bash
git add prisma/
git commit -m "schema: add ClientTargetPriority table and regenerate client"
```

## Branch naming

```
feat/training-volume-allocator
fix/seed-idempotency
schema/client-target-priority
refactor/extract-training-engine
```
