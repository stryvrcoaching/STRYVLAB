# Client Access Email Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split first access, reconnection, and reactivation so each client receives the correct STRYVR access email and coach UI copy reflects the real action.

**Architecture:** Keep the existing `/api/clients/[clientId]/invite` entrypoint, but add an explicit account-state resolver inside it. Extend the email layer with a dedicated reconnection template and update the coach access card so labels and success states map to the server branch returned.

**Tech Stack:** Next.js App Router, Supabase Auth Admin API, Resend email templates, React client components.

---

### Task 1: Harden access-branch resolution in the invite route

**Files:**
- Modify: `app/api/clients/[clientId]/invite/route.ts`

- [ ] Add a helper that classifies the auth user as activated or not using a hybrid rule.
- [ ] Keep `suspended` as highest-priority branch.
- [ ] Route activated users to reconnection email generation instead of first-access onboarding.
- [ ] Keep never-activated users on the onboarding flow.
- [ ] Preserve backward-compatible JSON response modes where possible.

### Task 2: Add dedicated reconnection email content and improve first-access copy

**Files:**
- Modify: `lib/email/mailer.ts`

- [ ] Extend the email API with a reconnection template that accepts both login and password reset/setup links.
- [ ] Update the existing magic-link email copy to a premium reconnection tone and add the secondary password CTA.
- [ ] Improve the first-access email wording so it sells the STRYVR client space more accurately than “bilans et programme”.
- [ ] Lightly align the reactivation copy with the new tone.

### Task 3: Update coach-facing labels to match the actual action

**Files:**
- Modify: `components/clients/ClientAccessToken.tsx`

- [ ] Replace generic “Renvoyer l’invitation” wording for active clients with a reconnection label.
- [ ] Adjust inactive and suspended helper text to match the new server branching.
- [ ] Use the returned mode to display a more accurate transient success state when useful.

### Task 4: Validate behavior

**Files:**
- Modify if needed: `app/api/clients/[clientId]/invite/route.ts`
- Modify if needed: `lib/email/mailer.ts`
- Modify if needed: `components/clients/ClientAccessToken.tsx`

- [ ] Run lint.
- [ ] Run production build.
- [ ] Review the three branch outcomes in code to ensure existing active users can no longer fall back to first-access email unless they are truly unactivated.
