# Guided Photo Nutrition Logging V1 - Implementation Plan

**Date:** 2026-06-22  
**Status:** Ready for implementation  
**Depends on:** [2026-06-22-guided-photo-nutrition-logging-v1.md](/Users/user/Desktop/STRYVLAB/docs/superpowers/specs/2026-06-22-guided-photo-nutrition-logging-v1.md)

# Plan

Implement V1 as a parallel photo-guided logging track inside the existing client nutrition hub rather than replacing the current text/voice logger. Keep the existing `MealLogSheet` and `NutritionLogContent` intact, add a dedicated `PhotoMealLogSheet` flow, and reuse the current `nutrition_meals` persistence path for final writes.

## Scope

- In:
  - guided photo capture for one plated meal
  - scale-weight-first analysis
  - pre-log micro-clarifications
  - auto-log into existing nutrition tables
  - leftovers refinement flow
  - audit trail for image-driven assumptions

- Out:
  - replacing current manual logger
  - restaurant flows
  - barcode
  - multi-plate analysis
  - coach-side tooling beyond passive visibility through existing meal data

## Slice 1 - Data Model and Contracts

- [ ] Add a migration file under [supabase/migrations](/Users/user/Desktop/STRYVLAB/supabase/migrations) for a new `client_photo_meal_logs` table.
  - Purpose: track one guided photo analysis session from capture to final meal creation.
  - Suggested fields:
    - `id`
    - `client_id`
    - `physiological_date`
    - `status` (`capturing`, `analyzing`, `clarifying`, `logged`, `refined`, `failed`)
    - `meal_id` nullable FK to `nutrition_meals`
    - `source_context` (`plate_home_v1`)
    - `scale_weight_g`
    - `scale_weight_confidence`
    - `analysis_summary` JSONB
    - `clarification_answers` JSONB
    - `leftovers_weight_g`
    - `leftovers_applied_at`
    - timestamps

- [ ] Add a second table `client_photo_meal_log_photos`.
  - Purpose: store the ordered image set for a session.
  - Suggested fields:
    - `id`
    - `photo_meal_log_id`
    - `kind` (`top`, `side`, `scale_zoom`, `leftovers`)
    - `storage_path`
    - `signed_url` or derived URL field depending on existing storage strategy
    - `vision_metadata` JSONB
    - `position_index`
    - timestamps

- [ ] Extend `nutrition_meals.meal_source` constraint with `photo_guided`.
  - Existing reference: [20260601_nutrition_meal_source.sql](/Users/user/Desktop/STRYVLAB/supabase/migrations/20260601_nutrition_meal_source.sql:1)

- [ ] Extend `nutrition_entries.input_mode` constraint with `photo_guided` if you want entry-level traceability distinct from `photo_ai`.
  - Existing reference: [20260520_voice_input_mode.sql](/Users/user/Desktop/STRYVLAB/supabase/migrations/20260520_voice_input_mode.sql:1)

## Slice 2 - Shared Types and Domain Modules

- [ ] Add `lib/nutrition/photo-log-types.ts`.
  - Define:
    - session status enums
    - photo kinds
    - analysis output shape
    - clarification question schema
    - leftovers refinement payload

- [ ] Add `lib/nutrition/photo-log-weight.ts`.
  - Implement the weight interpretation layer:
    - directly usable edible weight
    - cooked/raw ambiguity
    - edible/non-edible ambiguity
    - hidden-fat-dependent ambiguity
    - partial/uncertain weight

- [ ] Add `lib/nutrition/photo-log-clarifications.ts`.
  - Implement the rule engine that chooses:
    - whether to ask a question
    - which question to ask
    - whether leftovers should be suggested

- [ ] Add `lib/nutrition/photo-log-entries.ts`.
  - Transform final interpreted analysis into `entries[]` consumable by the current meals API.

- [ ] Add `lib/nutrition/photo-log-copy.ts`.
  - Centralize the trust/status copy shown to users:
    - `Analyse prête`
    - `Analyse affinée avec ton poids`
    - `Tu peux encore améliorer la précision avec les restes`

## Slice 3 - Upload and Session APIs

- [ ] Add `app/api/client/nutrition/photo-log/route.ts`.
  - `POST` creates a new session.
  - `GET` fetches an in-progress or completed session.

- [ ] Add `app/api/client/nutrition/photo-log/upload-photo/route.ts`.
  - Reuse the upload pattern from [app/api/client/meals/upload-photo/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/meals/upload-photo/route.ts:1)
  - Accept one image at a time with `kind`.
  - Store under a dedicated nutrition bucket/path convention.

- [ ] Add `app/api/client/nutrition/photo-log/analyze/route.ts`.
  - Input: session id.
  - Reads uploaded photo set.
  - Runs OCR/vision extraction.
  - Produces initial analysis and suggested clarifications.

- [ ] Add `app/api/client/nutrition/photo-log/clarify/route.ts`.
  - Accept one or more chip answers.
  - Re-run interpretation only, not full capture.
  - Return either another question or final loggable result.

- [ ] Add `app/api/client/nutrition/photo-log/log/route.ts`.
  - Convert final analysis into `nutrition_meals` + `nutrition_entries`.
  - Prefer calling shared persistence logic rather than duplicating the route body in [app/api/client/nutrition/meals/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/meals/route.ts:36)

- [ ] Add `app/api/client/nutrition/photo-log/refine-leftovers/route.ts`.
  - Apply a leftovers weight to an already logged session.
  - Adjust the existing meal instead of creating a new one.

## Slice 4 - Shared Meal Persistence Refactor

- [ ] Extract meal creation logic from [app/api/client/nutrition/meals/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/meals/route.ts:36) into a shared server module, for example:
  - `lib/nutrition/meal-persistence.ts`

- [ ] Expose helpers such as:
  - `createMealFromResolvedEntries(...)`
  - `appendEntriesToMeal(...)`
  - `recomputeMealTotals(...)`

- [ ] Update the current meals route to use the shared helper with no behavior change.

- [ ] Reuse the helper from the new photo-log auto-log route.

## Slice 5 - Vision and OCR Service Layer

- [ ] Add `lib/nutrition/photo-log-analyze.ts`.
  - This is the orchestrator for:
    - image preparation
    - OCR extraction of scale display
    - food identification
    - high-level plating interpretation
    - ambiguity tagging

- [ ] Reuse prompt and OpenAI calling patterns from:
  - [app/api/client/nutrition/voice-parse/route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/nutrition/voice-parse/route.ts:54)
  - [lib/inngest/functions/meal-analyze.ts](/Users/user/Desktop/STRYVLAB/lib/inngest/functions/meal-analyze.ts:16)

- [ ] Keep the vision output structured and conservative.
  - Required extracted fields:
    - probable food components
    - visible scale value and confidence
    - likely cooked/raw ambiguity
    - likely non-edible parts
    - hidden-fat probability
    - leftovers recommendation flag

- [ ] Add OCR fallback logic.
  - If scale display cannot be read confidently:
    - request extra scale zoom photo
    - fallback to manual weight entry

## Slice 6 - Client Capture UI

- [ ] Add `components/client/smart/PhotoMealLogSheet.tsx`.
  - New guided flow component opened from the nutrition page.
  - Suggested steps:
    - intro
    - top photo capture
    - side photo capture
    - optional scale recovery
    - analyzing
    - clarifications
    - success

- [ ] Add `components/client/smart/PhotoMealCaptureStep.tsx`.
  - Encapsulate camera/file capture UI for one required angle.

- [ ] Add `components/client/smart/PhotoMealGuidanceOverlay.tsx`.
  - Overlay text and framing hints:
    - include whole plate
    - include scale if possible
    - avoid occlusion

- [ ] Add `components/client/smart/PhotoMealClarificationStep.tsx`.
  - One-question-at-a-time chip UI.

- [ ] Add `components/client/smart/PhotoMealSuccessStep.tsx`.
  - Show concise status and CTA to leftovers refinement when applicable.

- [ ] Add `components/client/smart/PhotoMealLeftoversCard.tsx`.
  - Optional prompt surfaced after log on the nutrition page.

## Slice 7 - Integration into Existing Nutrition Hub

- [ ] Update [app/client/nutrition/NutritionClientPage.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/NutritionClientPage.tsx:93)
  - Add state to open `PhotoMealLogSheet`.
  - Keep `MealLogSheet` and `VoiceLogSheet` intact.
  - Wire a new CTA `Scanner mon assiette`.

- [ ] Update [components/client/smart/NutritionMealsList.tsx](/Users/user/Desktop/STRYVLAB/components/client/smart/NutritionMealsList.tsx:944)
  - Add access to the new photo-guided flow near the existing meal actions if needed.

- [ ] Optionally update [components/client/QuickLogSheet.tsx](/Users/user/Desktop/STRYVLAB/components/client/QuickLogSheet.tsx:27)
  - Add a `photo-guided` quick action if the product wants it globally accessible.

- [ ] Ensure successful logs still refresh the current nutrition surface via existing page refresh patterns.

## Slice 8 - Leftovers Refinement UX

- [ ] Add a session-aware leftovers CTA on the success step when the backend flags it.

- [ ] Add a lightweight leftovers flow:
  - capture leftovers scale photo or manual leftovers weight
  - submit to refinement endpoint
  - update existing `nutrition_meals` totals

- [ ] Surface a post-refinement status:
  - `Repas affiné avec les restes`

## Slice 9 - i18n and Product Copy

- [ ] Add translation keys in [lib/i18n/clientTranslations.ts](/Users/user/Desktop/STRYVLAB/lib/i18n/clientTranslations.ts:1) for:
  - entry point
  - capture guidance
  - clarifications
  - success copy
  - leftovers prompts
  - OCR fallback/manual weight copy

- [ ] Keep copy concrete and operational, not “AI magic”.

## Slice 10 - Testing and Validation

- [ ] Add unit tests for:
  - `lib/nutrition/photo-log-weight.ts`
  - `lib/nutrition/photo-log-clarifications.ts`
  - `lib/nutrition/photo-log-entries.ts`

- [ ] Add API tests similar in style to existing nutrition tests for:
  - session creation
  - analyze route
  - clarification progression
  - auto-log route
  - leftovers refinement route

- [ ] Add manual QA scenarios:
  - readable scale + simple meal
  - unreadable scale
  - cooked starch ambiguity
  - chicken with bones
  - visible sauce/oil
  - leftovers refinement

## Recommended Delivery Order

- [ ] Phase 1: migrations + shared types + upload endpoint
- [ ] Phase 2: guided capture UI + session creation
- [ ] Phase 3: analysis route + conservative structured output
- [ ] Phase 4: clarification engine + auto-log persistence
- [ ] Phase 5: leftovers refinement
- [ ] Phase 6: test hardening + UX polish

## Open Questions

- Should photo-log sessions be visible anywhere in coach tools before they become meals, or remain fully client-internal in V1?
- Should the leftovers refinement mutate existing entries proportionally, or store an adjustment layer for auditability?
- Should manual weight entry be inline inside the flow, or a dedicated fallback step?

## Default Decisions If Unblocked

- Keep photo-log sessions client-internal in V1.
- Mutate meal totals through a traceable session record plus stored refinement metadata.
- Use a dedicated fallback step for manual weight so the main capture flow stays clean.

