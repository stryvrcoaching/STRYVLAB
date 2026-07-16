# PWA Spanish Full Coverage Plan

**Date:** 2026-07-01
**Scope:** Client PWA root app (`app/client/*`) and all client-facing dynamic content
**Status:** Validated design, ready for implementation

## Understanding Summary

- The target is the active client PWA in the root app, not `stryvr/`.
- When a client selects Spanish as the default language, the entire visible experience must be in Spanish.
- This includes static UI, dynamic UI, workout, nutrition, metrics, chat, check-ins, onboarding, profile, and all user-facing state messages.
- This also includes content coming from APIs, database rows, business logic, generated messages, coach-facing content surfaced in the client app, food items, exercises, and program descriptions.
- Success means zero visible French or English leakage anywhere in the client PWA when `es` is active.
- Prioritization must follow user impact and leakage risk, not just file order.

## Assumptions

- Client language is already stored and can drive the entire PWA.
- Current i18n coverage is partial and heterogeneous.
- Some visible content is stored in tables or computed on the fly and is not yet localized.
- The coach app, landing pages, and lab tools are out of scope for this translation pass.
- Existing June 2026 Spanish translation documents are useful references but do not fully cover the now-validated scope.

## Open Questions

- None blocking for planning.

## Decision Log

- **Decision:** Treat this as a full-language coverage project, not a UI-only translation pass.
  **Alternatives considered:** Translate only static UI; translate only top-level pages first.
  **Why chosen:** The product requirement is explicit: every visible word must be Spanish when `es` is active.

- **Decision:** Use one central i18n system for UI strings and a separate strategy for stored/generated business content.
  **Alternatives considered:** Continue page-by-page local fixes.
  **Why chosen:** Stored and generated content have different failure modes and need different controls.

- **Decision:** Prioritize infrastructure and leakage detection before broad string replacement.
  **Alternatives considered:** Translate screens one by one immediately.
  **Why chosen:** Silent fallback and hidden hardcodes would otherwise keep reintroducing French or English.

- **Decision:** Prioritize daily-use client flows first.
  **Alternatives considered:** Start from admin/coach tools or low-traffic pages.
  **Why chosen:** Daily-use flows maximize visible quality fastest and expose most translation leaks.

- **Decision:** Create a new July 2026 plan instead of replacing the earlier June plan/spec.
  **Alternatives considered:** Update the older plan in place.
  **Why chosen:** The approved scope is broader and deserves a clean execution document.

## Recommended Approach

Use a four-layer rollout:

1. Stabilize the translation infrastructure and make Spanish strict.
2. Remove all client-side UI leakage from high-traffic flows.
3. Localize business content coming from storage, API payloads, and runtime composition.
4. Add regression guards so new French or English strings do not slip back in.

This is the only approach that can realistically produce durable full Spanish coverage.

## Scope

- In:
  - `app/client/*`
  - `components/client/*`
  - client-facing text in `lib/client/*`
  - client API payload text that is rendered in the PWA
  - workout, nutrition, metrics, chat, check-ins, onboarding, profile, auth/access states
  - food names, meal labels, exercise names, program descriptions, recommendations, generated status text
- Out:
  - coach workspace
  - landing pages and lab tools
  - wording redesign unrelated to Spanish coverage

## Execution Plan

### Phase 1 — Discovery and Coverage Map

- Inventory all client-facing text sources in the root PWA.
- Classify each text source into:
  - static UI string
  - computed runtime string
  - API response text
  - database-backed business content
  - generated conversation/check-in/coaching text
- Produce a leak map for:
  - hardcoded FR/EN strings
  - missing `es` keys
  - fallback usage
  - untranslated DB-backed domains

### Phase 2 — i18n Infrastructure Hardening

- Audit `lib/i18n/clientTranslations.ts`, `ClientI18nProvider`, and client page wiring.
- Remove silent fallback behavior that hides missing Spanish coverage.
- Add missing-key detection for client rendering paths.
- Standardize all client pages/components on the same translation entry point.

### Phase 3 — Priority Flow Translation

- Translate and verify in this order:
  - navigation and shell
  - dashboard/home
  - workout/program/session/recap
  - nutrition main flows
  - chat and check-ins
  - metrics
  - profile/preferences
  - onboarding and access states

### Phase 4 — Dynamic Business Content Localization

- Localize food taxonomy and visible food search results.
- Localize exercise names, exercise metadata, and session/program descriptions.
- Localize nutrition recommendations, smart alerts, and computed labels.
- Localize chat prompts, check-in prompts, and generated user-facing coaching text.
- Audit all API responses rendered in the client app for embedded FR/EN text.

### Phase 5 — Quality and Consistency Pass

- Normalize Spanish fitness and nutrition terminology.
- Eliminate literal or awkward translations where domain wording matters.
- Ensure consistent wording across tabs, cards, modals, buttons, and generated content.

### Phase 6 — Regression Guarding

- Add static audits for hardcoded FR/EN strings in client code paths.
- Add translation coverage checks for required `es` keys.
- Add a release checklist for full Spanish verification.

## Priority Order

1. Translation infrastructure and leak detection
2. Navigation, dashboard, and language preferences
3. Workout and session flows
4. Nutrition, foods, and smart nutrition widgets
5. Chat, check-ins, and generated client messages
6. Metrics, profile, and onboarding
7. Database-backed business content
8. Regression prevention

## Validation Strategy

- Verify that a Spanish-default account sees no FR/EN text anywhere in the full client journey.
- Verify both empty and populated states.
- Verify both success and error states.
- Verify food search, nutrition logging, workout logging, and chat/check-in flows with real data.
- Verify generated messages and coach-authored client-visible text paths.
- Verify that adding a new client component without i18n support is detectable.

## Implementation Checklist

- [ ] Inventory all client-visible text sources
- [ ] Audit current i18n architecture and fallback behavior
- [ ] Build a translation coverage matrix by domain
- [ ] Fix strict Spanish resolution in the client translation layer
- [ ] Translate shell and daily-use navigation flows
- [ ] Translate workout/session/recap flows
- [ ] Translate nutrition flows and visible food content
- [ ] Translate chat/check-in and generated client messages
- [ ] Translate metrics/profile/onboarding/access states
- [ ] Localize database-backed exercise and program content
- [ ] Add automated leak detection and coverage checks
- [ ] Run end-to-end Spanish validation and close remaining leaks

## Handoff

This document supersedes the narrower June 2026 Spanish translation pass for implementation sequencing. The earlier plan/spec remain useful references for food translations and AI chat language handling, but execution should follow this broader full-coverage plan.
