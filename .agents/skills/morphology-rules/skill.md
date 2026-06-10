---
name: morphology-rules
description: Rules for the morphological analysis system in STRYVR (OpenAI Vision + Inngest, no n8n)
---

## Architecture actuelle (v2 — 2026-04-25)

Le système MorphoPro est entièrement backend Next.js + Inngest. Il n'y a pas de n8n.

### Flow complet

```
Coach action (UI)
  → POST /api/clients/[clientId]/morpho/analyze
    → validate auth + client ownership
    → create morpho_analyses row (status: 'pending')
    → await inngest.send({ name: 'morpho/analyze.requested', data: { morphoAnalysisId } })
    → return { morphoAnalysisId }

Inngest job (lib/inngest/functions/morpho-analyze.ts)
  → retry x3, timeout 5min
  → calls analyzeMorphoJob(morphoAnalysisId)
    → getPhotoUrlsFromSubmission() — Supabase Storage signed URLs
    → analyzePhotoWithOpenAI() — gpt-4o Vision
    → parseMorphoResponses() — lib/morpho/parse.ts
    → calculateStimulusAdjustments() — lib/morpho/adjustments.ts
    → UPDATE morpho_analyses SET status='completed', body_composition=..., stimulus_adjustments=...
```

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `lib/morpho/parse.ts` | Parse réponses OpenAI Vision → métriques structurées |
| `lib/morpho/adjustments.ts` | Calcule stimulus_adjustments (0.8–1.2) depuis les asymétries |
| `lib/morpho/analyze.ts` | Orchestrateur : photos → Vision → parse → DB |
| `jobs/morpho/analyzeMorphoJob.ts` | Job principal appelé par Inngest |
| `lib/inngest/functions/morpho-analyze.ts` | Définition Inngest (retry, timeout, event) |
| `app/api/clients/[clientId]/morpho/analyze/route.ts` | Trigger API |
| `app/api/clients/[clientId]/morpho/latest/route.ts` | Fetch dernière analyse |

## Status lifecycle

```
pending → (Inngest job) → completed
                        → failed (après 3 retries)
```

## Stimulus adjustments — règles

- Asymétrie bras >2cm → `unilateral_push/pull = 1.15`
- Déséquilibre épaule >2cm → `horizontal_push = 0.90`, `horizontal_pull = 1.10`
- Bras longs (ratio >0.40) → `vertical_pull ≥ 1.12`, `horizontal_pull ≥ 1.05`
- Bras courts (ratio <0.36) → `horizontal_push ≥ 1.10`, `vertical_push ≥ 1.08`
- Tous coefficients clampés [0.8, 1.2]
- Multiple règles : `Math.max()` (prend le plus élevé)

## Ce qu'il NE faut PAS faire

- Ne PAS utiliser `setImmediate` pour le job — toujours `inngest.send()`
- Ne PAS parser `raw_payload` directement — utiliser `lib/morpho/parse.ts`
- Ne PAS afficher les données morpho sans passer par l'endpoint `/morpho/latest`
- Ne PAS stocker les URLs photos en clair — toujours signed URLs Supabase Storage

## Privacy

Client photos sont du PII sensible :
- URLs signées Supabase Storage avec TTL court
- Jamais de stockage d'URL publique
- Accès logué via RLS + auth check dans chaque route API
