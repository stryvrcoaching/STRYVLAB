# Coach Global Organizer Sheet V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent `Organiser` button to the global coach header that opens a right-side sheet and creates an agenda alert, a kanban task, or both for a selected client.

**Architecture:** Introduce a dedicated global organizer component mounted inside `CoachShell`, backed by a new orchestration API route. Reuse current agenda/kanban persistence patterns already used by the client-priority planning flow, but keep this route independent because it is not tied to a `priorityKey`.

**Tech Stack:** Next.js App Router, React client components, TypeScript, existing coach shell/top bar, Supabase service client, Vitest.

## Global Constraints

- The organizer button must be visible on all coach pages.
- The sheet must match the existing coach dark design system.
- Client selection is required.
- Mode defaults to `both`.
- V1 uses default kanban destination resolution.
- The endpoint must create agenda, kanban, or both, with linking when both are created.
- No duplicate local organization model should be introduced.

## File Structure

- Modify: `/Users/user/Desktop/STRYVLAB/components/layout/CoachShell.tsx`
  - Mount the new header control next to `NotificationBell`.
- Create: `/Users/user/Desktop/STRYVLAB/components/layout/GlobalOrganizerButton.tsx`
  - Self-contained header button + side sheet UI.
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/organizer/route.ts`
  - Global orchestration endpoint for header-driven organization.
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-organizer.test.ts`
  - API validation and orchestration coverage.
- Create: `/Users/user/Desktop/STRYVLAB/tests/components/global-organizer-button.test.tsx`
  - Light component behavior coverage.

### Task 1: Add global orchestration API

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/app/api/coach/organizer/route.ts`
- Create: `/Users/user/Desktop/STRYVLAB/tests/api/coach-organizer.test.ts`

- [ ] Validate `clientId`, `mode`, `date`, optional `time`, optional `title`, optional `note`.
- [ ] Resolve a default title if the request omits it.
- [ ] Reuse default kanban target resolution logic.
- [ ] Create agenda event when mode includes agenda.
- [ ] Create kanban task when mode includes kanban.
- [ ] Link the two when mode is `both`.
- [ ] Return created IDs.
- [ ] Add focused tests for unauthenticated access, `both` creation, and invalid payloads.

### Task 2: Build the global header organizer UI

**Files:**
- Create: `/Users/user/Desktop/STRYVLAB/components/layout/GlobalOrganizerButton.tsx`
- Create: `/Users/user/Desktop/STRYVLAB/tests/components/global-organizer-button.test.tsx`

- [ ] Add a compact `Organiser` button matching the top-bar scale.
- [ ] Implement a right-side sheet with:
  - required client picker
  - mode selector
  - title input
  - date input
  - time input
  - note textarea
  - submit CTA
- [ ] Default mode to `both`.
- [ ] Disable submit until client is selected.
- [ ] Prefill a default title suggestion when client changes and title is empty.
- [ ] Add light component coverage for default mode and disabled CTA behavior.

### Task 3: Wire shell integration

**Files:**
- Modify: `/Users/user/Desktop/STRYVLAB/components/layout/CoachShell.tsx`

- [ ] Mount the global organizer button next to `NotificationBell`.
- [ ] Keep the existing top-bar layout stable.
- [ ] Ensure the sheet works regardless of page-specific top-bar content.

### Task 4: Validate the slice

- [ ] Run focused tests:
  - `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/api/coach-organizer.test.ts --run`
  - `pnpm vitest /Users/user/Desktop/STRYVLAB/tests/components/global-organizer-button.test.tsx --run`
- [ ] Run combined validation with any touched related tests.

## Rollout Notes

- This ships as a global coach productivity primitive.
- Keep V1 intentionally fast and constrained.
- If usage is strong, V2 can add presets, board selection, or recent items.
