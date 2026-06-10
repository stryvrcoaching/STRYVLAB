# Nutrition Align Modal — Design Spec
**Date:** 2026-06-03
**Status:** Approved

---

## Problem

When a coach publishes a training program (or switches the active program), the nutrition protocol schedule may no longer match the new training days. Currently the coach must manually go to Nutrition Studio and remap the schedule. This creates friction and risks misaligned protocols.

---

## Solution

Show a `NutritionAlignModal` whenever a program becomes visible to the client. The modal lets the coach map nutrition days to training/rest days, preview the result, optionally recalculate macros, and confirm in one action.

---

## Triggers

Two publication events fire the modal:

| Event | Condition |
|-------|-----------|
| Save from builder | `program.is_client_visible === true` at save time |
| Eye toggle in Workout Studio | `is_client_visible` transitions `false → true` |

Not triggered when hiding a program (`true → false`), or saving a non-visible program.

### Integration points

**Builder save** — `EntrainementPage.onSaved(saved)`: if `saved.is_client_visible === true`, set `alignModalProgram` state instead of immediately closing. Modal close → builder closes + list refreshes.

**Eye toggle** — `ClientProgramsList.toggleVisibility()` intercepted: if activating, raise `onRequestAlign(program)` callback to parent (`EntrainementPage`) instead of firing the API directly. Parent opens modal. API visibility PATCH fires inside modal on confirm or skip.

---

## Data

| Data | Source |
|------|--------|
| Program sessions + days_of_week | Already in `Program` object passed to modal |
| Active nutrition protocol (status = 'shared') + days + schedule_slots | `GET /api/clients/[clientId]/nutrition-protocols` → filter `status === 'shared'` |
| Client data for macro recalc | `GET /api/clients/[clientId]/nutrition-data` |

---

## Modal UI (DS v2.0)

Style: `bg-[#181818] rounded-2xl`. No full-screen.

### Header
`Aligner la nutrition` + subtitle `Programme "[name]" publié`

### Step 1 — Day mapping

Two selects populated with the active protocol's `NutritionProtocolDay` list:
- **Jour entraînement →** [select]
- **Jour repos →** [select]

**Default heuristic** (applied in `lib/programs/nutritionAlign.ts`):
1. Scan day `name`: `/entra[îi]n|training|sport/i` → training ; `/repos|rest/i` → rest
2. Fallback: `carb_cycle_type === 'high'` → training ; `'low'` → rest
3. First match wins. Coach overrides freely.

### Step 2 — Week preview

7-column grid (Mon–Sun). Each cell shows:
- Training days (from `days_of_week` of all sessions): `bg-[#1f8a65]/10`, dumbbell icon, mapped nutrition day name + calories
- Rest days: `bg-white/[0.04]`, moon icon, mapped nutrition day name + calories

Preview updates live as coach changes the selects.

### Step 3 — Macro recalc (optional)

Checkbox: `Recalculer les macros en fonction des séances`

When checked, shows proposed delta before applying:
```
Jour entraînement : 1800 → 2150 kcal (+350)
Jour repos        : 1800 → 1800 kcal (inchangé)
```

**Calculation:**
```
training_day_kcal = rest_day_kcal + (training_calories_weekly / weekly_frequency)
```
Uses `NutritionClientData.training_calories_weekly` and `weekly_frequency`.
If either field is null → checkbox disabled with tooltip "Données client incomplètes".

### Footer

- `Passer` (ghost) — skips alignment, fires visibility API if triggered from eye toggle, closes modal
- `Aligner` (accent `#1f8a65`) — applies schedule_slots, applies macro update if checkbox checked, fires visibility API if triggered from eye toggle, closes modal

### Edge case: no active protocol

If no `status === 'shared'` protocol exists:
- Modal shows: "Aucun protocole nutrition actif" + link `→ Créer un protocole`
- Only action: close/skip. No alignment attempted.

---

## APIs (all existing, no new routes)

| Action | Endpoint | Payload |
|--------|----------|---------|
| Fetch protocols | `GET /api/clients/[clientId]/nutrition-protocols` | — |
| Fetch client data | `GET /api/clients/[clientId]/nutrition-data` | — |
| Write schedule_slots | `PATCH /api/clients/[clientId]/nutrition-protocols/[protocolId]` | `{ schedule_slots: [...] }` |
| Write day macros | `PATCH /api/clients/[clientId]/nutrition-protocols/[protocolId]` | `{ days: [...] }` |
| Activate program visibility | `PATCH /api/programs/[programId]` | `{ is_client_visible: true }` |

The PATCH protocol endpoint already does delete-all + re-insert on `schedule_slots`. No migration needed.

---

## New files

| File | Purpose |
|------|---------|
| `components/programs/NutritionAlignModal.tsx` | Modal UI — fetch, mapping UI, preview, recalc, confirm |
| `lib/programs/nutritionAlign.ts` | Pure logic — heuristic detection, schedule_slots builder, macro delta calc |

## Modified files

| File | Change |
|------|--------|
| `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx` | Add `alignModalProgram` state; `onSaved` triggers modal if visible; handle `onRequestAlign` from list |
| `components/programs/ClientProgramsList.tsx` | Add `onRequestAlign?: (program) => void` prop; intercept `toggleVisibility` when activating |

---

## Schema changes

None. Zero new migrations.

---

## Out of scope (Ticket 2)

- Per-session duration/intensity fields in Nutrition Studio
- More sophisticated TDEE calculation (MET, weight, body composition)
- Multi-type day mapping (beyond training/rest binary)
