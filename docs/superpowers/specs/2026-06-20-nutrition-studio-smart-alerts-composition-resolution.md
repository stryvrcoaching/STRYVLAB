# Nutrition Studio — Smart Alerts Composition Resolution

## Summary

- `Corriger cette donnée` opens only the inline resolver in the left column.
- The right-side `Ajuster les paramètres` sheet remains a separate global tool.
- In `Temps réel`, missing body composition should reduce confidence lightly, not critically.
- The inline resolver can propose estimation or manual entry depending on available inputs.

## Decisions

- Keep the CTA label generic: `Corriger cette donnée`.
- Support multiple estimation methods for `% masse grasse`.
- Derive `masse maigre` and `masse musculaire` after a valid `% masse grasse` estimate.
- Surface estimated values distinctly in the current UI session.

## Scope Implemented

- Fix Smart Alert focus flow so it does not open the right sheet.
- Add composition estimation resolver with conditional methods.
- Recalibrate realtime data quality scoring for missing composition signals.
- Show estimated provenance in the studio UI for the active session.
