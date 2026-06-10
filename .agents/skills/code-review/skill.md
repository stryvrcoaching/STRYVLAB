---
name: code-review
description: Structured code review for STRYVR — TypeScript, API routes, modules, and patterns
---

## When to use

Before merging any feature branch. Run after `db-reviewer` if DB code is involved.

## Review checklist

### TypeScript

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] No `any` types except where explicitly justified with a comment
- [ ] No `as unknown as X` escape hatches without justification
- [ ] Zod schema at all API entry points

### API routes

- [ ] Auth check at the top of every handler
- [ ] `organizationId` scoping — never return data from another org
- [ ] Zod validation on request body and query params
- [ ] Proper HTTP status codes (201 for create, 400 for validation, 401 for auth, 404 for not found)
- [ ] No unhandled promise rejections

### Module boundaries

- [ ] Business logic is in `src/modules/`, not in route handlers
- [ ] Route handlers call module functions, not Prisma directly (except simple CRUD)
- [ ] No cross-module imports except through `index.ts`

### Error handling

- [ ] `try/catch` present where needed
- [ ] Error messages don't expose internal stack traces to clients
- [ ] Errors logged server-side with enough context to debug

### n8n boundary

- [ ] No business logic in n8n webhook handlers
- [ ] `x-webhook-secret` validated on all inbound n8n routes
- [ ] `rawPayload` stored without interpretation

### Performance

- [ ] No `findMany` without pagination (`take`/`skip` or cursor)
- [ ] No Prisma calls inside loops (N+1 queries)
- [ ] Expensive operations are async and non-blocking

## Output format

**Blocking issues** (must fix before merge):
- [File:line] — [Issue] — [Fix]

**Warnings** (should fix, not blocking):
- [File:line] — [Suggestion]

**Approved patterns**:
- [What looks good]

**Summary**: APPROVED / NEEDS CHANGES / BLOCKED
