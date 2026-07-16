## Understanding Summary

- The `Data Performance` page needs a structural refactor comparable in quality and rhythm to the recent `Data Nutrition` redesign.
- The target user is the coach, who needs a fast decision-oriented reading before drilling into raw history.
- The current page mixes verdict, controls, analytics, and session management in one visual flow.
- Several analytic cards are poorly proportioned or visually noisy, especially the volume timeline, muscle-group distribution, and analyst radar area.
- The redesign should preserve the dark product language and existing business data while significantly improving hierarchy, density, and clarity.
- Historical and operational components remain useful, but they must be visually separated from the coach-reading layer.

## Assumptions

- Existing API contracts for performance, metrics, and performance-summary remain unchanged.
- The redesign is primarily a presentation and interaction refactor, not a business-logic rewrite.
- The time-range selector should move to the top bar and stay visible like on `Data Nutrition`.
- The page should become continuous rather than tab-driven, to align with the nutrition ecosystem.
- `Essentiel / Analyste` can remain as a lightweight mode switch if it enriches details without fragmenting navigation.

## Final Design

### Structure

1. Top bar with persistent time-range control.
2. Compact hero focused on verdict, next action, and a few key signals.
3. Stable analytical grid with four core cards:
   - `Tendance de charge`
   - `Volume par séance`
   - `Répartition musculaire`
   - `Intensité / fatigue`
4. Focus section for coach actions:
   - exercises under watch
   - program recommendations
   - quick access to latest session
5. Separate management/history section for logs, drafts, and detailed technical history.

### Graph and Tooltip Behavior

- Unified tooltip style across major charts.
- Stable chart proportions with no exaggerated stretching.
- Hover behavior must feel precise and consistent.
- Analyst mode adds depth to cards instead of creating a separate navigation model.

### Card Principles

- Same visual grammar across the analytics layer: short eyebrow, strong title, one main metric, clear chart, compact footer.
- Muscle-group distribution should become an ordered, readable comparative view rather than a crude chart block.
- The old analyst radar is replaced by more actionable comparative detail.

## Decision Log

1. Decision: align `Data Performance` with the continuous reading model used on `Data Nutrition`.
   - Alternatives considered: keep tabs; hybrid page with partial tabs.
   - Why chosen: stronger UX continuity, less hidden information, better coach-first reading.

2. Decision: move the time-range selector to the top bar.
   - Alternatives considered: keep controls inside the page.
   - Why chosen: persistent visibility and closer parity with nutrition.

3. Decision: remove the current tabbed `summary / volume / intensity / exercises` layout as the primary structure.
   - Alternatives considered: redesign tabs only.
   - Why chosen: tabs fragment the reading and hide useful information behind navigation.

4. Decision: replace the current volume-area cards with a four-card analytical grid.
   - Alternatives considered: keep existing cards with lighter restyling.
   - Why chosen: the current blocks have structural problems, not just cosmetic ones.

5. Decision: downgrade session management into a separate operational section.
   - Alternatives considered: keep analytics and management in a single uniform flow.
   - Why chosen: operational tools should not pollute strategic reading.
