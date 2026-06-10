# TDEE Adaptatif — Design Spec

**Date :** 2026-05-19
**Objectif :** Adapter automatiquement le TDEE du protocole nutritionnel client à sa dépense réelle, calculée depuis la courbe de poids hebdomadaire (méthode delta poids — MacroFactor).
**Stack :** Next.js App Router, Supabase, TypeScript strict, Inngest, DS v3.0 client + DS v2.0 coach

---

## Contexte

Le TDEE actuel est calculé une seule fois depuis les données biométriques statiques du bilan (`lib/formulas/macros.ts` — Katch-McArdle + NEAT + EAT). Il ne s'adapte pas si le client perd ou prend du poids différemment des prédictions. Le protocole partagé devient donc désynchronisé de la réalité metabolique après quelques semaines.

---

## Section 1 — Architecture globale

**Pipeline adaptatif (Inngest CRON, lundi 06:00 UTC) :**

```
Pour chaque client avec nutrition_protocols.status = 'shared'
  → Fetch pesées des 14 derniers jours (assessment_responses.weight_kg)
  → Gate : < 2 pesées → skip
  → Fetch moyenne calories ingérées (nutrition_meals sur 14j)
    → Si aucun log nutrition : utiliser calories jour 1 du protocole (source = 'protocol')
  → calcAdaptiveTdee(pesées, avgIntakeKcal)
  → Gate : |tdee_adaptive - tdee_formula| < 150 kcal → skip
  → Rescaler macros de chaque jour du protocole (ratio P/L/G conservé)
  → UPDATE nutrition_protocols (tdee_adaptive, tdee_adaptive_at, tdee_data_source)
  → INSERT nutrition_tdee_history
  → Notif client (type = 'tdee_updated')
  → Notif coach (type = 'tdee_coach_alert')
```

**Formule delta poids (MacroFactor method) :**
```
tdee_reel = avg_intake_kcal + (pente_kg_par_jour × 7700)
```
- `pente_kg_par_jour` = régression linéaire sur les pesées (pas simple dernière - première)
- Arrondi à 10 kcal
- `confidence = 'low'` si source = 'protocol' OU si < 4 pesées

**Recalcul macros (si delta > 150 kcal) :**
```
ratio = tdee_adaptive / tdee_formula
new_calories_jour = old_calories_jour × ratio
protein_g, fat_g, carbs_g rescalés depuis new_calories_jour + ratios P/L/G conservés
```

Le coach peut aussi déclencher un recalcul immédiat hors cron via bouton dans Nutrition Studio (POST `/apply-adaptive-tdee`).

---

## Section 2 — Data Model

**`nutrition_protocols` — 3 colonnes ajoutées :**
```sql
tdee_adaptive        integer        -- TDEE réel calculé (kcal), null avant premier calcul
tdee_adaptive_at     timestamptz    -- date du dernier calcul réussi
tdee_data_source     text           -- 'weight_delta' | 'formula_proxy'
                                    -- formula_proxy = pas de logs nutrition, calories protocole utilisées
```

**Nouvelle table `nutrition_tdee_history` :**
```sql
id                  uuid primary key default gen_random_uuid()
protocol_id         uuid not null references nutrition_protocols(id) on delete cascade
client_id           uuid not null references coach_clients(id) on delete cascade
calculated_at       timestamptz not null default now()
tdee_formula        integer not null   -- TDEE formule statique au moment du calcul
tdee_adaptive       integer not null   -- TDEE réel calculé
delta_kcal          integer not null   -- tdee_adaptive - tdee_formula
weight_samples      integer not null   -- nb pesées utilisées
calories_source     text not null      -- 'logs' | 'protocol'
avg_intake_kcal     integer not null
weight_delta_kg     numeric(5,2) not null  -- variation de poids sur la fenêtre
protocol_updated    boolean not null default false  -- protocole mis à jour ce run ?
```

**RLS :**
- `nutrition_tdee_history` : coach SELECT/INSERT via `coach_clients.coach_id`, client SELECT via `coach_clients.user_id`
- `nutrition_protocols` colonnes existantes : RLS inchangée

**Indexes :**
```sql
CREATE INDEX ON nutrition_tdee_history (protocol_id, calculated_at DESC);
CREATE INDEX ON nutrition_tdee_history (client_id, calculated_at DESC);
```

---

## Section 3 — Lib pure

**`lib/nutrition/adaptiveTdee.ts`**

```ts
export interface WeightSample {
  date: string       // ISO date 'YYYY-MM-DD'
  weight_kg: number
}

export interface AdaptiveTdeeInput {
  weightSamples: WeightSample[]       // ≥2 requis
  avgIntakeKcal: number               // moyenne calories ingérées sur la fenêtre
  caloriesSource: 'logs' | 'protocol' // 'protocol' = proxy, moins précis
  windowDays: number                  // nb jours de la fenêtre (14)
}

export interface AdaptiveTdeeResult {
  tdeeAdaptive: number          // kcal arrondi à 10
  weightDeltaKg: number         // variation totale estimée sur windowDays (pente × windowDays)
  slopeKgPerDay: number         // pente régression linéaire
  confidence: 'high' | 'low'   // low si source='protocol' OU weightSamples < 4
}

export function calcAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult
// Régression linéaire moindres carrés sur weightSamples (x = jours depuis début, y = poids)
// tdee = avgIntakeKcal + (slopeKgPerDay × 7700)
// Arrondi résultat à 10 kcal
// confidence = 'low' si input.caloriesSource === 'protocol' OU input.weightSamples.length < 4

export function linearRegression(samples: WeightSample[]): { slope: number; intercept: number }
// Moindres carrés : x = nb jours depuis premier sample, y = weight_kg
```

**Tests (`tests/lib/nutrition/adaptiveTdee.test.ts`) — ~12 cas :**
- Perte de poids → TDEE supérieur aux apports
- Prise de poids → TDEE inférieur aux apports
- Poids stable → TDEE ≈ apports
- Moins de 2 samples → throw Error
- Source 'protocol' → confidence 'low'
- < 4 samples → confidence 'low'
- ≥ 4 samples + source 'logs' → confidence 'high'
- Régression linéaire correcte sur données connues
- Arrondi à 10 kcal vérifié
- Valeurs extrêmes (perte rapide 1kg/sem)
- weightDeltaKg correct (pente × windowDays)
- Samples non triés → résultat identique aux samples triés

---

## Section 4 — Inngest Job

**`lib/inngest/functions/adaptive-tdee.ts`**

```
Event : 'nutrition/adaptive-tdee.weekly'
Schedule : '0 6 * * 1' (lundi 06:00 UTC)
Retry : 2
Timeout : 10min
```

**Steps (fan-out par protocole) :**

```
step 1 : fetch-active-protocols
  → SELECT id, client_id, coach_id, tdee_formula (depuis nutrition_data API), days
    FROM nutrition_protocols WHERE status = 'shared'

step 2 (par protocole) : fetch-weight-samples
  → SELECT value_number as weight_kg, submitted_at as date
    FROM assessment_responses ar
    JOIN assessment_submissions as ON as.id = ar.assessment_submission_id
    WHERE ar.field_key = 'weight_kg'
    AND as.client_id = $client_id
    AND as.submitted_at >= now() - interval '14 days'
    ORDER BY as.submitted_at ASC

step 3 : gate-samples
  → < 2 samples → log skipped, continue next protocol

step 4 : fetch-intake
  → SELECT avg(total_calories) FROM nutrition_meals
    WHERE client_id = $client_id
    AND physiological_date >= now() - interval '14 days'
  → Si count = 0 → avgIntakeKcal = calories du jour 1 du protocole, source = 'protocol'
  → Sinon source = 'logs'

step 5 : calc-tdee
  → calcAdaptiveTdee({ weightSamples, avgIntakeKcal, caloriesSource: source, windowDays: 14 })

step 6 : gate-delta
  → fetch tdee_formula : recalculate via nutrition-data API pour ce client
  → |tdeeAdaptive - tdee_formula| < 150 → log skipped, INSERT history (protocol_updated=false), continue

step 7 : update-protocol-days
  → ratio = tdeeAdaptive / tdee_formula
  → Pour chaque jour du protocole :
    new_cal = round(old_cal × ratio)
    new_protein_g = round(old_protein_g × ratio)
    new_fat_g = round(old_fat_g × ratio)
    new_carbs_g = round(old_carbs_g × ratio)
  → UPDATE nutrition_protocol_days SET calories=new_cal, protein_g=..., fat_g=..., carbs_g=...

step 8 : update-protocol-meta
  → UPDATE nutrition_protocols SET
    tdee_adaptive = tdeeAdaptive,
    tdee_adaptive_at = now(),
    tdee_data_source = source === 'protocol' ? 'formula_proxy' : 'weight_delta'

step 9 : save-history
  → INSERT nutrition_tdee_history (...)

step 10 : notify-client
  → INSERT coach_client_notifications
    type = 'tdee_updated', client_id, title = 'Objectifs nutritionnels ajustés',
    body = 'Ton programme reflète maintenant ta dépense réelle.',
    action_url = '/client/nutrition'

step 11 : notify-coach
  → INSERT coach_client_notifications
    type = 'tdee_coach_alert', coach_id, client_id,
    title = 'TDEE [Prénom] recalculé',
    body = 'TDEE : ${tdee_formula} → ${tdeeAdaptive} kcal (${delta > 0 ? '+' : ''}${delta})'
    action_url = '/coach/clients/${clientId}/protocoles/nutrition'
```

**Enregistrement dans `app/api/inngest/route.ts` :**
```ts
import { adaptiveTdeeFunction } from '@/lib/inngest/functions/adaptive-tdee'
// Ajouter à functions: [...]
```

---

## Section 5 — API Routes

**`app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts`**
- POST — recalcul à la demande (coach uniquement)
- Ownership check : coach_id = auth.uid() via coach_clients
- Exécute steps 2→11 du job Inngest de manière synchrone (pas de fan-out)
- Retourne `{ tdeeAdaptive, delta, protocolUpdated: true }`

**`app/api/clients/[clientId]/nutrition-data/route.ts`** — modifications :
- Ajouter au SELECT : `nutrition_protocols.tdee_adaptive, nutrition_protocols.tdee_adaptive_at, nutrition_protocols.tdee_data_source`
- Retourner dans la response : `tdeeAdaptive`, `tdeeAdaptiveAt`, `tdeeDataSource`

**`app/api/clients/[clientId]/nutrition-tdee-history/route.ts`** — nouvelle route GET :
- Retourne les 5 derniers `nutrition_tdee_history` pour ce client/protocole
- Coach seulement

---

## Section 6 — UI Coach (Nutrition Studio)

**`components/nutrition/studio/useNutritionStudio.ts`** — ajouts :
```ts
tdeeAdaptive: number | null
tdeeAdaptiveAt: Date | null
tdeeDataSource: 'weight_delta' | 'formula_proxy' | null
tdeeHistory: TdeeHistoryEntry[]
applyAdaptiveTdee: () => Promise<void>  // POST apply-adaptive-tdee
```

**`components/nutrition/studio/CalculationEngine.tsx`** — bloc conditionnel sous le TDEE waterfall :

```
Si tdeeAdaptive !== null :
┌─────────────────────────────────────────────────────┐
│  TDEE ADAPTATIF                         [Appliquer] │
│  2 340 kcal  ↑ +160 vs formule                      │
│  6 pesées · 14 jours · logs réels                   │
│  Mis à jour le lun. 19 mai                          │
│  [Historique ▾]  (collapsible, 5 derniers runs)     │
└─────────────────────────────────────────────────────┘

Si tdeeDataSource = 'formula_proxy' : badge ⚠ Proxy (amber)
Delta ↑ vert (#1f8a65) / ↓ amber
Bouton "Appliquer" → applyAdaptiveTdee() → recalcul immédiat
```

DS v2.0 : surface `bg-white/[0.03]`, border `border-[0.3px] border-white/[0.06]`, `rounded-xl`

**Notification coach dans AlertsFeed (dashboard coach) :**
- Type `tdee_coach_alert` → affiche avec icône `⚡`, lien vers protocole

---

## Section 7 — UI Client

**`app/client/nutrition/page.tsx`** — nouveau bloc entre hero demi-cercle et macros :

```
Si tdeeAdaptive !== null :
┌─────────────────────────────────────────────────────┐
│  DÉPENSE ÉNERGÉTIQUE                                 │
│  2 340 kcal/jour  ↑ ajusté cette semaine            │
│  Basé sur tes pesées des 14 derniers jours          │
└─────────────────────────────────────────────────────┘

Si source = 'formula_proxy' : afficher "Estimation" au lieu du chiffre exact
```

DS v3.0 : `bg-[#161616]`, `border border-white/[0.08]`, `rounded-2xl`

**`components/client/smart/NotificationsBar.tsx`** — gérer type `tdee_updated` :
- Icône `TrendingUp`, lien `/client/nutrition`, dismissible

---

## Section 8 — Fichiers & périmètre

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260519_adaptive_tdee.sql` | Créer |
| `lib/nutrition/adaptiveTdee.ts` | Créer |
| `tests/lib/nutrition/adaptiveTdee.test.ts` | Créer |
| `lib/inngest/functions/adaptive-tdee.ts` | Créer |
| `app/api/inngest/route.ts` | Modifier — enregistrer job |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts` | Créer |
| `app/api/clients/[clientId]/nutrition-data/route.ts` | Modifier — retourner tdee_adaptive |
| `app/api/clients/[clientId]/nutrition-tdee-history/route.ts` | Créer |
| `components/nutrition/studio/useNutritionStudio.ts` | Modifier |
| `components/nutrition/studio/CalculationEngine.tsx` | Modifier |
| `app/client/nutrition/page.tsx` | Modifier |
| `components/client/smart/NotificationsBar.tsx` | Modifier |

**Inchangés :**
- `lib/formulas/macros.ts` — formule statique intacte
- `nutrition_protocol_days` schema (hors valeurs recalculées)
- Tous les autres composants

---

## Contraintes non-négociables

- `lib/nutrition/adaptiveTdee.ts` : zéro import DB — pure function, testable Vitest
- Inngest job : retry x2, timeout 10min, chaque protocole est un step isolé (échec d'un protocole ne bloque pas les autres)
- Gate delta 150 kcal : toujours vérifiée avant toute écriture DB
- Gate ≥2 pesées : toujours vérifiée avant calcul
- DS v2.0 strict dans Nutrition Studio (coach)
- DS v3.0 strict dans app client
- TypeScript strict — 0 erreurs `npx tsc --noEmit`
- CHANGELOG.md mis à jour après chaque changement
