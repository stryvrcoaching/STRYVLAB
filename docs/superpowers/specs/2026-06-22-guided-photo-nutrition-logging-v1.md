# Guided Photo Nutrition Logging V1

**Date:** 2026-06-22  
**Status:** Approved  
**Scope:** Client PWA - nutrition logging V1 for one plated home meal with guided photo capture

## Understanding Summary

- Build a V1 nutrition logging flow specialized for a single plated meal or bowl at home.
- Keep the full experience inside the PWA; no external ChatGPT or manual copy/paste step.
- Use at least two guided photos: one top-down and one side/profile view.
- Treat visible scale weight as the primary signal when readable, but interpret it intelligently before converting to macros.
- Auto-log the meal after analysis; the user should not need a line-by-line review in the happy path.
- Use targeted micro-questions only when they materially improve accuracy.
- Handle the biggest error sources explicitly: oils, sauces, cooking method, cooked vs raw ambiguity, edible vs non-edible mass, bones/shells/rests.
- Include an optional leftovers mode in V1 to improve accuracy for meals with non-edible parts or partial consumption.

## Assumptions

- Mobile-first PWA flow for client users.
- One meal per session, one plate or one bowl per session.
- User is cooperative and willing to follow short capture guidance if the value is obvious.
- The V1 should optimize for the at-home weighed meal use case and explicitly exclude restaurant/general-purpose coverage.
- The system should never block logging entirely; when uncertainty remains, it should log the best estimate available.

## Non-Goals

- Restaurant meals
- Barcode scanning
- Packaged food logging
- Single-photo “magic” estimation
- Multi-plate or tray-wide logging
- Mandatory manual review before saving

## Decision Log

1. **Decision:** Specialize V1 to one plated home meal.  
   **Alternatives considered:** broad meal logging V1.  
   **Why chosen:** stronger accuracy, lower implementation risk, clearer product differentiation.

2. **Decision:** Use guided capture rather than generic upload.  
   **Alternatives considered:** passive image upload, text-first logging.  
   **Why chosen:** improves image quality, scale readability, and model reliability.

3. **Decision:** Make visible scale weight the highest-priority signal.  
   **Alternatives considered:** vision-only estimation, equal-weight signal fusion.  
   **Why chosen:** measured weight is the strongest accuracy lever when available.

4. **Decision:** Interpret weight before converting to nutrition.  
   **Alternatives considered:** using displayed grams as direct edible grams.  
   **Why chosen:** cooked/raw ambiguity and non-edible mass would create large systematic errors.

5. **Decision:** Ask targeted micro-questions before auto-log when needed.  
   **Alternatives considered:** no questions, full review form, post-log corrections only.  
   **Why chosen:** best tradeoff between trust and friction.

6. **Decision:** Auto-log immediately after capture and clarifications.  
   **Alternatives considered:** required manual review before save.  
   **Why chosen:** preserves flow and reduces abandonment.

7. **Decision:** Include leftovers mode in V1.  
   **Alternatives considered:** postpone to V2.  
   **Why chosen:** materially improves precision for bone-in or partially consumed meals.

## Recommended Approach

### Recommended option: Guided Capture + Intelligent Clarification + Auto-Log

This V1 should be built as a guided capture system, not as a generic AI nutrition analyzer. The product should ask for the two most valuable visual angles, extract the most reliable measurable signals, identify high-impact ambiguity, ask only the shortest useful clarifications, and then save the meal automatically.

### Rejected option: Photo -> Estimate -> Quick Confirm

This is simpler, but too fragile for the promised trust level. It fails hardest on oils, sauces, cooked/raw ambiguity, and edible yield.

### Rejected option: Semi-manual structured logger

This would likely be more precise than vision-only flows, but too slow and too close to traditional logging friction.

## Final Design

### 1. Product Entry Point

Add a dedicated CTA on the client nutrition surface:

- Primary CTA: `Scanner mon assiette`
- Supporting copy: `2 photos + quelques précisions si nécessaire`

This should feel like a new first-class logging mode, not a hidden variation of text or voice logging.

### 2. Capture Flow

The V1 flow should guide the user through a strict capture sequence:

1. Top-down photo
2. Side/profile photo
3. Optional third capture only if the scale reading is not confidently readable

Live capture guidance should be simple and visual:

- frame the whole plate or bowl
- include the scale display if possible
- avoid occlusions from utensils
- keep the plate centered
- ensure the side photo shows height and thickness

If scale OCR confidence is too low after the two required views, the app should offer:

- `Ajouter une photo zoom sur la balance`
- `Saisir le poids`

This keeps the flow resilient without silently degrading quality.

### 3. Estimation Engine

The core system should be a signal-fusion engine with a strict confidence hierarchy:

1. visible scale weight
2. detected food types and meal structure
3. edible-yield / food-prep heuristics
4. targeted clarification answers
5. vision-based volume estimation

The system should never let a soft visual estimate override a readable measured weight. Vision should primarily help interpret weight, segment the plate, identify likely food classes, and detect ambiguity.

### 4. Weight Interpretation Layer

Before macro calculation, every measured weight should be classified into one of these families:

- directly usable edible weight
- cooked vs raw ambiguous weight
- edible vs non-edible ambiguous weight
- insufficient without cooking-fat clarification
- partial or uncertain weight

Examples:

- rice, pasta, quinoa, semolina: cooked/raw ambiguity
- chicken wings, chicken legs, whole fish, shell-on seafood: edible/non-edible ambiguity
- pan-fried meats, sauteed vegetables, creamy dishes: hidden-fat ambiguity

Rule of thumb for V1:

- plated ready-to-eat starches default to cooked unless strong contrary evidence exists
- bone-in and shell-on foods should trigger edible-yield logic or leftovers recommendation
- high-fat uncertainty should trigger clarification before save

### 5. Clarification System

Clarifications should be conditional, not fixed. The product should ask one question at a time, using fast chip-based answers. Typical flow target:

- 0 questions if the system is already sufficiently reliable
- 1 to 2 questions in normal cases
- 3 questions max in hard cases

High-value question families:

- cooked or raw weight
- cooking fat presence
- fat type
- rough fat quantity
- included non-edible parts
- sauce mixed in vs served separately

Example sequence:

1. `Matière grasse utilisée ?`
   - `Aucune`
   - `Huile`
   - `Beurre`
   - `Sauce / crème`
   - `Je ne sais pas`

2. If fat exists: `Combien environ ?`
   - `Traces`
   - `1 c. à café`
   - `1 c. à soupe`
   - `2+ c. à soupe`
   - `Je ne sais pas`

The system should never open a large freeform form unless all quick paths fail.

### 6. Auto-Log Behavior

After capture and clarifications, the app should automatically save the meal and show a concise success state:

- `Repas analysé et loggé`
- calories
- protein
- carbs
- fat
- compact ingredient summary

No mandatory line-by-line review should exist in the happy path. Post-log correction may remain available as a safety net, but it should not be the main flow.

### 7. Leftovers Mode

Leftovers mode should be included in V1 and positioned as a precision upgrade, not as error recovery.

Trigger examples:

- bone-in poultry
- shell-on seafood
- fish with likely remains
- visible scraps or partial consumption risk

Prompt example:

- `Pour être plus précis, pèse les restes après ton repas`

Flow:

1. present a post-log card or notification
2. user weighs leftovers
3. app captures leftovers weight via photo or manual input
4. original meal log is adjusted automatically

This creates a two-level experience:

- very good immediate logging
- excellent accuracy when leftovers data is available

### 8. Trust UX

Avoid exposing technical confidence scores like percentages. Prefer user-facing status language:

- `Analyse prête`
- `Analyse affinée avec ton poids`
- `Analyse affinée avec tes réponses`
- `Tu peux encore améliorer la précision avec les restes`

This preserves trust without making the AI feel uncertain or unstable.

## UX Sections

### Screen Sequence

1. `Scanner mon assiette`
2. Top photo capture
3. Side photo capture
4. Optional scale recovery step
5. Clarification chips
6. Auto-log success state
7. Optional leftovers precision follow-up

### Interaction Rules

- one decision per screen when possible
- no dense forms
- no nested review panels before save
- no forced keyboard entry unless OCR fails and manual weight is required

## Error Handling

- If OCR cannot read the scale, prompt for extra photo or manual weight.
- If food recognition is weak, use clarifications rather than hallucinating detail.
- If hidden-fat uncertainty is high, ask before save.
- If certainty remains imperfect after the capped clarifications, log with the best prudent estimate and clearly allow post-log refinement.

## Testing Strategy

### Product validation

- simple plated meals with readable scale
- plated starch meals with cooked/raw ambiguity
- bone-in poultry meals
- dishes with visible sauces
- meals without readable scale
- meals with leftovers correction

### Success criteria

- users can complete the flow faster than current off-app workaround
- clarified logs are meaningfully closer to measured truth than current text/voice-only logging
- question count stays low in most sessions
- leftovers mode improves accuracy on eligible meals without meaningfully hurting completion

## Implementation Handoff Notes

Recommended first implementation slice:

1. guided image capture flow
2. OCR for scale weight
3. vision + heuristic interpretation pipeline
4. clarification decision engine
5. auto-log meal creation
6. leftovers refinement path

