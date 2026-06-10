---
name: docs-sync
description: Sync documentation after a significant feature — project-state, data-model, CHANGELOG
---

## When to use

After delivering a significant feature or architectural change.

## Files to update

| File | When |
|------|------|
| `CHANGELOG.md` | After EVERY code change |
| `.Codex/rules/project-state.md` | After significant feature or bug |
| `docs/architecture/data-model.md` | After any schema change |
| `docs/architecture/n8n-boundary.md` | After any n8n workflow change |
| `docs/biomech/` | After biomechanics decisions |
| `docs/ux/` | After UX flow decisions |
| `docs/workflows/` | After workflow changes |

## CHANGELOG.md format

```markdown
## YYYY-MM-DD

FEATURE: [What was added]
FIX: [What was fixed]
SCHEMA: [What schema changed]
REFACTOR: [What was cleaned up]
CHORE: [Maintenance]
```

## project-state.md update

Add a dated section:

```markdown
## YYYY-MM-DD — [Feature Name]

**Ce qui a été fait :**

1. **`path/to/file.ts`**
   - What changed and why

**Points de vigilance :**
- [New gotcha or pattern to remember]
```

Update:
- "Statut global" table if module status changed
- "Next Steps" — check off completed items, add new ones

## data-model.md update

If schema changed:
1. Update the relevant domain section
2. Update "Key Enums" table if enums changed
3. Update "Deferred" section if something was implemented

## Checklist

- [ ] CHANGELOG.md updated (with today's date section)
- [ ] project-state.md — "Dernières avancées" section added
- [ ] project-state.md — "Statut global" table updated if needed
- [ ] project-state.md — "Next Steps" updated
- [ ] data-model.md updated if schema changed
- [ ] `npx tsc --noEmit` — 0 errors confirmed
