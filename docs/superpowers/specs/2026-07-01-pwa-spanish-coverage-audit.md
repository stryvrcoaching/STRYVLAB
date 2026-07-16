# PWA Spanish Coverage Audit

**Date:** 2026-07-01  
**Scope audited:** root client PWA (`app/client/*`, `components/client/*`, `app/api/client/*`, `lib/client/*`)  
**Goal:** identify every major French/English leakage path before broad Spanish implementation

## Executive Summary

The client PWA already has a substantial translation dictionary, but Spanish is not yet a strict end-to-end mode.

The current gap is structural, not cosmetic:

- The client translation layer exists, but startup still defaults to French.
- Server-rendered pages resolve language inconsistently.
- Many user-visible runtime strings still live outside `clientTranslations.ts`.
- Dynamic business content is partially localized for foods, but still leaks French in labels, taxonomy, check-ins, alerts, and workout flows.
- Newer flows, especially flex workout and smart nutrition extensions, introduced additional hardcoded French strings.

## Surface Area Inventory

- `app/client/*`: 40 files
- `components/client/*`: 104 files
- `app/api/client/*`: 90 files
- `lib/client/*`: 46 files
- Client files already using i18n helpers/hooks: 67
- Client/API/lib files with visible hardcoded non-English text hits: 100

## Architecture Findings

### 1. Client i18n boot still starts in French

In [ClientI18nProvider.tsx](/Users/user/Desktop/STRYVLAB/components/client/ClientI18nProvider.tsx), the context defaults to `fr`, then rehydrates from local storage, then from `/api/client/preferences`.

Implications:

- first paint can still be French
- Spanish is not strict from initial render
- untranslated areas are visually masked by the French default

### 2. Preferences API still defaults language to French

In [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/preferences/route.ts), missing preferences return `language: 'fr'`.

Implications:

- brand-new clients default to French unless explicitly changed
- server and client can disagree temporarily during hydration

### 3. Language resolution is duplicated across server pages

Several server pages manually fetch `client_preferences.language`, including:

- [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/programme/page.tsx)
- [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/programme/recap/[sessionLogId]/page.tsx)
- [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/flex-workout/recap/[sessionId]/page.tsx)
- [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/bilans/page.tsx)
- [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/page.tsx)

Implications:

- inconsistent language source of truth
- higher risk of one page rendering in Spanish while adjacent flows fall back to French

### 4. Translation helper has no missing-key guardrail

In [clientTranslations.ts](/Users/user/Desktop/STRYVLAB/lib/i18n/clientTranslations.ts), `ct()` directly reads `entry[lang]`.

Implications:

- missing keys are not surfaced in a structured way
- hardcoded strings remain the practical fallback path
- no audit signal exists when new client-visible text bypasses the dictionary

### 5. Dynamic content remains distributed outside the translation layer

Large parts of the user-facing copy live in:

- `lib/client/checkin/*`
- `lib/client/ai-coach/*`
- `lib/client/smart/*`
- `app/api/client/*`

Implications:

- full Spanish coverage cannot be achieved by editing `clientTranslations.ts` alone
- dynamic runtime copy requires a second localization track

## Coverage Matrix

| Domain | Current state | Main leakage sources | Risk |
|---|---|---|---|
| Shell / Nav | Partially localized | remaining labels and some top bar strings | Medium |
| Home / Dashboard | Partially localized | chat-adjacent cards, dynamic status copy | High |
| Programme / Session | Partially localized | recap/session variants, dynamic exercise/workout strings | High |
| Flex Workout | Weak coverage | free-session labels, errors, placeholders, route errors | Critical |
| Nutrition | Broad but incomplete | food taxonomy labels, meal flow add-ons, smoothing/photo flows | Critical |
| Chat / Check-ins | Incomplete | input bar, check-in prompts, deferred messages, route-generated summaries | Critical |
| Metrics | Incomplete | tab labels, top bar labels, body entry flows | High |
| Profile / Preferences | Mostly wired | some inline labels/options still hardcoded | Medium |
| Onboarding / Access / Auth | Partially localized | language setup, action errors, access states | Medium |
| AI Coach runtime | Not fully localized end-to-end | tone, rule tips, check-in summaries, system-derived copy | Critical |
| DB-backed food content | Partial support exists | taxonomy labels and fallback display still French-heavy | High |
| DB-backed exercise/program content | Not fully wired | names/descriptions/program text still leak French | Critical |

## Priority Leak Map

### P0 — blocks true Spanish mode

1. **Chat and check-in runtime copy**
   - [ChatInputBar.tsx](/Users/user/Desktop/STRYVLAB/components/client/ChatInputBar.tsx)
   - [flows.ts](/Users/user/Desktop/STRYVLAB/lib/client/checkin/flows.ts)
   - [resolveClientTimezone.ts](/Users/user/Desktop/STRYVLAB/lib/client/checkin/resolveClientTimezone.ts)
   - [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/checkin/route.ts)
   - [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/checkin/respond/route.ts)
   - [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/chat/checkin-action/route.ts)

2. **Nutrition dynamic flows**
   - [NutritionLogContent.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/log/NutritionLogContent.tsx)
   - [CalorieSmoothingPanel.tsx](/Users/user/Desktop/STRYVLAB/components/client/nutrition/CalorieSmoothingPanel.tsx)
   - [RemainingNutritionSummary.tsx](/Users/user/Desktop/STRYVLAB/components/client/nutrition/RemainingNutritionSummary.tsx)
   - [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/timeline/today/route.ts)
   - [nutritionAlerts.ts](/Users/user/Desktop/STRYVLAB/lib/client/smart/nutritionAlerts.ts)
   - [recoveryAlerts.ts](/Users/user/Desktop/STRYVLAB/lib/client/smart/recoveryAlerts.ts)

3. **Flex workout**
   - [FlexSessionLogger.tsx](/Users/user/Desktop/STRYVLAB/app/client/flex-workout/FlexSessionLogger.tsx)
   - [page.tsx](/Users/user/Desktop/STRYVLAB/app/client/flex-workout/recap/[sessionId]/page.tsx)
   - `app/api/client/flex-workouts/*`

4. **AI coach generated language**
   - [buildSystemPrompt.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/buildSystemPrompt.ts)
   - [resolveTone.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/resolveTone.ts)
   - [adviceRules.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/adviceRules.ts)
   - [messageComposer.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/messageComposer.ts)

### P1 — highly visible daily leakage

1. **Metrics shell and labels**
   - [MetricsClientPage.tsx](/Users/user/Desktop/STRYVLAB/components/client/MetricsClientPage.tsx)
   - [MeasurementsEntrySheet.tsx](/Users/user/Desktop/STRYVLAB/components/client/metrics/MeasurementsEntrySheet.tsx)

2. **Programme/session adjunct UI**
   - [SessionLogger.tsx](/Users/user/Desktop/STRYVLAB/app/client/programme/session/[sessionId]/SessionLogger.tsx)
   - [ExerciseSwapSheet.tsx](/Users/user/Desktop/STRYVLAB/app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx)
   - [RecapNavButtons.tsx](/Users/user/Desktop/STRYVLAB/app/client/programme/recap/[sessionLogId]/RecapNavButtons.tsx)

3. **Nutrition category and prep labels**
   - [NutritionClientPage.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/NutritionClientPage.tsx)
   - [SmartNutritionPrepList.tsx](/Users/user/Desktop/STRYVLAB/components/client/smart/SmartNutritionPrepList.tsx)
   - [TodayPrepsSection.tsx](/Users/user/Desktop/STRYVLAB/components/client/smart/TodayPrepsSection.tsx)

### P2 — supporting but non-blocking

1. **Profile/preferences option labels**
   - [PreferencesForm.tsx](/Users/user/Desktop/STRYVLAB/components/client/profile/PreferencesForm.tsx)
   - [ProfilAccordion.tsx](/Users/user/Desktop/STRYVLAB/components/client/profile/ProfilAccordion.tsx)

2. **Cycle-specific explanatory content**
   - [phaseContent.ts](/Users/user/Desktop/STRYVLAB/lib/client/cycle/phaseContent.ts)
   - [CycleSyncBanner.tsx](/Users/user/Desktop/STRYVLAB/components/client/nutrition/CycleSyncBanner.tsx)

## Representative Leakage Examples

### Static UI leakage

- [ChatInputBar.tsx](/Users/user/Desktop/STRYVLAB/components/client/ChatInputBar.tsx): `"Mode édition"`, `"Annuler"`, `"Saisie vocale"`, `"Écrire un message..."`, `"Envoyer"`
- [MetricsClientPage.tsx](/Users/user/Desktop/STRYVLAB/components/client/MetricsClientPage.tsx): `"Données corporelles"`, `"Mensurations"`, `"Vitalité"`, `"Métriques"`, `"Paramètres"`
- [offline/page.tsx](/Users/user/Desktop/STRYVLAB/app/client/offline/page.tsx): retry copy still hardcoded

### Runtime configuration leakage

- [flows.ts](/Users/user/Desktop/STRYVLAB/lib/client/checkin/flows.ts): all check-in greetings, questions, helper text, and chip labels are hardcoded in French
- [fieldRegistry.ts](/Users/user/Desktop/STRYVLAB/lib/client/checkin/fieldRegistry.ts): field labels are French natural-language prompts

### API payload leakage

- [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/checkin/route.ts): titles, summaries, and confirmation messages are French
- [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/checkin/respond/route.ts): energy/stress labels and confirmation strings are French
- [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/timeline/today/route.ts): meal labels and timeline titles are French

### Nutrition taxonomy leakage

- [route.ts](/Users/user/Desktop/STRYVLAB/app/api/client/food-items/route.ts): translated names exist, but category labels and storage vocabulary remain French-centric
- [NutritionLogContent.tsx](/Users/user/Desktop/STRYVLAB/app/client/nutrition/log/NutritionLogContent.tsx): many visible food group labels remain hardcoded in French

### AI/generative leakage

- [buildSystemPrompt.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/buildSystemPrompt.ts): support copy, meal labels, status summaries, and guardrail text remain French-heavy
- [resolveTone.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/resolveTone.ts): tone openers/closers are hardcoded in French
- [adviceRules.ts](/Users/user/Desktop/STRYVLAB/lib/client/ai-coach/adviceRules.ts): generated advice tips are French

## Domain Notes

### Nutrition

This is the largest translation surface. It combines:

- dictionary-based UI
- localized food names from DB
- hardcoded category labels
- smart recommendation copy
- photo/voice logging branches
- smoothing and prep-specific add-on modules

The food translation table is already a useful asset, but it does not solve the surrounding UI and computed copy.

### Check-ins and Chat

This domain is the second biggest risk because it mixes:

- component UI
- check-in flow definitions
- server-generated confirmations
- proactive message scaffolding
- AI coach tone/runtime generation

Spanish quality will fail visibly if only the shell is translated.

### Workout

Classic programme/session flows are partially localized, but the newer flex workout branch introduced many fresh French strings in UI, placeholders, errors, and recap states.

## Recommended Next Implementation Slice

The next batch should focus on strict infrastructure and the highest-leak runtime path:

1. make Spanish strict in the client translation layer
2. centralize language resolution for server pages
3. translate chat input + check-in flow definitions + check-in route-generated copy

This will eliminate the most obvious French leakage from the daily-use path before moving into nutrition and flex workout.

## Batch 1 Exit Criteria

This audit batch is complete when:

- the surface area is inventoried
- the i18n architecture risks are documented
- the coverage matrix is documented
- the critical leak map is prioritized for implementation

All four conditions are now satisfied.
