# STRYVR — Project State Archive

> Sessions avant 2026-04-28. Lire **sur demande uniquement** — ne pas auto-charger.
> Détails complets : `git log` ou demander à Claude de chercher dans le code.

---

## Chronologie compressée

| Date | Feature | Fichiers clés |
|------|---------|---------------|
| 2026-04-27 | Client Onboarding — page unique `/client/onboarding`, PKCE + implicit flow, 0 redirect, timeout 15s | `app/client/onboarding/page.tsx`, `app/api/clients/[clientId]/invite/route.ts` |
| 2026-04-26 | Nutrition Studio 3 colonnes + 11 tâches UX (TopBar actions, ParameterAdjustmentPanel, step indicator) | `components/nutrition/studio/NutritionStudio.tsx`, `useNutritionStudio.ts`, `CalculationEngine.tsx`, `ProtocolCanvas.tsx`, `ClientIntelligencePanel.tsx` |
| 2026-04-26 | Protocoles nutritionnels — tables `nutrition_protocols` + `nutrition_protocol_days`, API CRUD, page client | `supabase/migrations/20260425_nutrition_protocols.sql`, `lib/nutrition/types.ts`, `components/nutrition/NutritionProtocolTool.tsx` |
| 2026-04-25 | Volume Coverage MEV/MAV/MRV (Israetel/RP) — scoring + barres UI par sous-groupe | `lib/programs/intelligence/volume-targets.ts`, `components/programs/ProgramIntelligencePanel.tsx` |
| 2026-04-25 | Performance Feedback Loops — analyzer, recommendations, proposals table, Inngest morpho wiring | `lib/performance/analyzer.ts`, `lib/performance/recommendations.ts`, `supabase/migrations/20260424_program_adjustment_proposals.sql`, `components/clients/PerformanceFeedbackPanel.tsx` |
| 2026-04-24 | Biomech Enrichment Phase 2 — 17 colonnes biomech, CustomExerciseModal 6 étapes, upload media | `supabase/migrations/20260423_coach_custom_exercises_biomech.sql`, `components/programs/CustomExerciseModal.tsx` |
| 2026-04-24 | Session Logger Live Save + PWA — upsert idempotent, draft localStorage, SW network-first | `supabase/migrations/20260423_set_logs_unique.sql`, `app/api/session-logs/[logId]/sets/route.ts`, `public/sw.js` |
| 2026-04-20 | Coach UX Phase 2A — ClientContext, multi-routes coach, DockLeft + DockBottom | `lib/client-context.tsx`, `components/layout/DockLeft.tsx`, `components/layout/DockBottom.tsx`, `app/coach/clients/[clientId]/layout.tsx` |
| 2026-04-19 | Session & Exercise Reordering — DnD PointerSensor, mode Jour/Cycle, intra+inter-session | `components/programs/ProgramTemplateBuilder.tsx`, `components/programs/studio/EditorPane.tsx` |
| 2026-04-19 | Biomechanics Engine Phase 2 — SRA Heatmap 4 semaines, Lab Overrides sliders, alertes enrichies | `lib/programs/intelligence/scoring.ts`, `components/programs/studio/LabModeSection.tsx` |
| 2026-04-19 | Studio-Lab UI Phase 1 — dual-pane react-resizable-panels v4, Navigator + Editor + IntelligencePanelShell | `components/programs/studio/NavigatorPane.tsx`, `components/programs/studio/IntelligencePanelShell.tsx` |
| 2026-04-18 | MorphoPro Bridge Phase 0 — table `morpho_analyses`, OpenAI Vision gpt-4o, Inngest job x3 retry | `supabase/migrations/20260418_morpho_analyses.sql`, `lib/morpho/`, `jobs/morpho/analyzeMorphoJob.ts` |
| 2026-04-18 | Alternatives Scoring — back sub-groups par movementPattern, dédup prefix, max 6 résultats | `lib/programs/intelligence/alternatives.ts`, `lib/programs/intelligence/catalog-utils.ts` |
| 2026-04-18 | Client Alternatives Système A — pre-config coach (max 3), bottom sheet client (swap temporaire) | `supabase/migrations/20260418_template_exercise_alternatives.sql`, `components/client/ClientAlternativesSheet.tsx` |
| 2026-04-18 | Program Intelligence Phase 2B — custom exercises DB, swap mobile, alert → scroll highlight | `supabase/migrations/20260418_coach_custom_exercises.sql`, `app/api/exercises/custom/route.ts` |
| 2026-04-18 | Program Intelligence Phase 2A — profil client (blessures + équipement), RestrictionsWidget | `supabase/migrations/20260418_intelligence_profile.sql`, `components/clients/RestrictionsWidget.tsx` |
| 2026-04-18 | Program Intelligence Phase 1 — 6 sous-moteurs scoring, panel sticky 280px, alertes inline | `lib/programs/intelligence/scoring.ts`, `lib/programs/intelligence/index.ts`, `components/programs/ProgramIntelligencePanel.tsx` |
| 2026-04-17 | i18n client app FR/EN/ES — dictionnaire complet, ClientI18nProvider, localStorage + API sync | `lib/i18n/clientTranslations.ts`, `components/client/ClientI18nProvider.tsx` |
| 2026-04-16 | Muscles primaires/secondaires — colonnes DB, BodyMap 3 états (primaire/secondaire/inactif) | `supabase/migrations/20260416_exercise_muscles.sql`, `lib/client/muscleDetection.ts`, `components/client/BodyMap.tsx` |
| 2026-04-14 | BioNorms — valeur de vérité par métrique, badge "Mesuré le JJ/MM" vs "Calculé" | `lib/health/useBiometrics.ts`, `components/health/BioNormsGauge.tsx` |
| 2026-04-14 | SessionLogger V2 — unilatéral L/R, RIR ressenti, chrono repos plein écran, notes JSONB | `supabase/migrations/20260414_session_logger_v2.sql`, `app/client/programme/session/[sessionId]/SessionLogger.tsx` |
| 2026-04-13 | Système accès client unifié — invite/suspend/restore via Supabase ban (plus de token system) | `app/api/clients/[clientId]/invite/route.ts`, `app/api/clients/[clientId]/access/route.ts` |
| 2026-04-13 | Coach Dashboard — MRR, alertes, segmentation clients actifs/stagnants, sparklines SVG | `app/api/dashboard/coach/route.ts`, `components/dashboard/` |
| 2026-04-12 | Cron expiration abonnements — daily 00:00 UTC, Vercel Cron, cascade status inactive | `app/api/cron/expire-subscriptions/route.ts`, `vercel.json` |

---

## Gotchas encore pertinents

- **Supabase ban** : suspension = `ban_duration: '87600h'`, réactivation = `ban_duration: 'none'`
- **react-resizable-panels v4** : prop `orientation` (pas `direction`), exports `Group/Panel/Separator`
- **Client alternatives** : swap temporaire, jamais persisté — réinitialisé au reload
- **Morpho** : utilise `gpt-4o` (pas `gpt-4-vision`, déprécié Dec 2024)
- **`dos_large`** : marker "même groupe large" — overlap uniquement `dos_large` = 8 pts (partiel), pas 30
- **`is_compound: undefined`** = tri-état intentionnel dans Program Intelligence (auto-dérivé depuis muscles)
- **`equipment` PATCH** : champ `'equipment'` doit être dans l'allowlist de `/api/clients/[clientId]/route.ts`
