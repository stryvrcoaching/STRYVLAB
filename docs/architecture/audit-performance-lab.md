# Audit d'Architecture STRYVR — "The Performance Lab"

> **Visibilité technique complète sur les 4 domaines critiques d'interconnectivité des 11 modules**
>
> Audit généré : 5 avril 2026
> Portée : Database Schema, State Management, Business Logic, Reporting Flow

---

## 📊 1. SCHÉMA DE DONNÉES (Database Schema)

### Structure du Client — Champs actuels

```
Client Object (Supabase):
├─ id (UUID)
├─ email
├─ name
├─ age
├─ weight (kg)
├─ height (cm)
├─ gender
├─ activity_level
├─ bodyfat_pct (%)
└─ metadata (JSON)
```

### Stockage des 7 outils — CRITIQUE : Pattern hybride non optimisé

| Outil            | Stockage                         | Modèle    | Problème               |
| ---------------- | -------------------------------- | --------- | ---------------------- |
| **OneRM**        | `AssessmentResponse` (JSON)      | Générique | Pas de requête typée   |
| **HR Zones**     | `AssessmentResponse` (JSON)      | Générique | Pas de requête typée   |
| **Water Intake** | État local uniquement            | Éphémère  | Aucune persistance     |
| **Macros**       | `IPTSubmission.responses` (JSON) | Générique | Champ JSON brut        |
| **Body Fat**     | `AssessmentResponse` (JSON)      | Générique | Pas de requête typée   |
| **Karvonen**     | Dérivé de HR Zones               | Computed  | Pas stocké directement |
| **BMI**          | État local uniquement            | Éphémère  | Aucune persistance     |

### GAP MAJEUR

**Aucune table dédiée `calculator_results`** → les résultats vivent dans des champs JSON génériques `responses[key]`.

Requête pour "tous les OneRM du client" = requête JSON + parsing applicatif (inefficace et non-typée).

### Fichiers impliqués

- `types/02_types.ts` — IPTSubmission, IPTScore interfaces
- `types/assessment.ts` — AssessmentSubmission, AssessmentResponse types
- `app/api/assessments/` — API routes CRUD

### Solution Recommandée

```sql
CREATE TABLE calculator_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  calculator_type TEXT NOT NULL, -- 'oneRM' | 'hrZones' | 'macros' | 'bodyFat' | 'water' | 'karvonen' | 'bmi'
  input JSON NOT NULL,           -- { weight, reps, age, ... }
  output JSON NOT NULL,          -- { result, confidence_margin, unit, timestamp }
  formula_version TEXT,          -- v1.0, v1.1, etc pour audit trail
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calculator_results_client ON calculator_results(client_id);
CREATE INDEX idx_calculator_results_type ON calculator_results(calculator_type);
CREATE INDEX idx_calculator_results_date ON calculator_results(created_at DESC);
```

---

## 🎮 2. GESTION D'ÉTAT (State Management)

### Technology Stack Détecté

```
├─ React Hooks (useState)             ← PRIMARY (dominant)
├─ Context API (LanguageContext)      ← i18n seulement
├─ Supabase Client (fetch calls)      ← Data layer
├─ Redux / Zustand / Mobx             ← ❌ NOT DETECTED
└─ LocalStorage / SessionStorage      ← ❌ NOT USED
```

### Pattern Actuel : Isolement des Calculatrices

```
OneRMCalculator                    HRZonesCalculator
├─ [weight, setWeight]            ├─ [age, setAge]
├─ [reps, setReps]                ├─ [restingHR, setRestingHR]
├─ Calculate button               ├─ Calculate button
└─ Local state only               └─ Local state only
     ↓                                 ↓
    NO shared context             NO cross-communication
```

### Réactivité Inter-Composants : ❌ NON IMPLÉMENTÉE

**Scénario réel problématique :**

Un utilisateur change son poids dans le profil client.

- ✓ Body Fat calculator DEVRAIT se recalculer
- ✓ Macros calculator DEVRAIT se recalculer
- ✓ BMI calculator DEVRAIT se recalculer
- ✗ **Actuellement :** Rien ne se recalcule — l'utilisateur doit re-saisir manuellement

**Architecturalement :** Chaque calculatrice est une **silo isolée** (pattern "Component as Island").

### Flux Actuel de Sauvegarde

```
User Input
    ↓ (instant)
setState()
    ↓ (instant)
Calculate Button
    ↓ (manual click)
POST /api/assessments
    ↓ (async, network latency)
DB
    ↓ (async)
Manual Page Refresh
```

**Manques identifiés :**

- ❌ Optimistic updates (UI ne reflect pas immédiatement)
- ❌ Debouncing (chaque keystroke relance le calcul)
- ❌ Persistence de brouillon (refresh = perte de données)
- ❌ Real-time sync quand données source changent

### Composants avec État Local

- `components/OneRMCalculator.tsx` — `[weight, setWeight]`, `[reps, setReps]`, `[showResults, setShowResults]`
- `components/HRZonesCalculator.tsx` — `[age, setAge]`, `[restingHR, setRestingHR]`
- `app/coach/comptabilite/page.tsx` — `[kpis, setKpis]`, `[payments, setPayments]`, `[filterStatus, setFilterStatus]`

### État Global (Context API)

- `lib/context/LanguageContext.tsx` — `useTranslation()` hook pour i18n (FR/EN)

### Solution Recommandée : Zustand Store Centralisé

```typescript
// lib/stores/calculatorStore.ts
import { create } from "zustand";

export const useCalculatorStore = create((set) => ({
  // Global client data
  clientData: { age: null, weight: null, height: null, bodyFat: null },
  setClientData: (data) => set({ clientData: data }),

  // Cached calculator results
  results: {},
  setResult: (calculatorType, output) =>
    set((state) => ({
      results: { ...state.results, [calculatorType]: output },
    })),

  // Trigger recalculation when client data changes
  recalculateAll: () =>
    set((state) => ({
      // invalidate all cached results
      results: {},
    })),
}));
```

**Utilisation dans calculatrice :**

```typescript
// components/OneRMCalculator.tsx
const { clientData, results, setResult } = useCalculatorStore();

useEffect(() => {
  // Re-run calculation if client data changed
  if (clientData.weight || clientData.age) {
    handleCalculate();
  }
}, [clientData]);
```

---

## 📐 3. LOGIQUE DE CALCUL (Business Logic)

### Localisation des Formules — MIXTE

| Formule               | Fichier                            | Pattern                                   | État                |
| --------------------- | ---------------------------------- | ----------------------------------------- | ------------------- |
| **Epley 1RM**         | `components/OneRMCalculator.tsx`   | Inline dans component                     | 🔴 Retest difficile |
| **Karvonen HR**       | `components/HRZonesCalculator.tsx` | Inline dans component                     | 🔴 Retest difficile |
| **Katch-McArdle BMR** | `utils/macroCalculator.js`         | Centralisé (pure function)                | 🟢 Bon              |
| **TDEE Forensic**     | `utils/macroCalculator.js`         | Centralisé                                | 🟢 Bon              |
| **Boer LBM**          | `utils/macroCalculator.js`         | Centralisé avec fallback                  | 🟢 Bon              |
| **Brzycki 1RM**       | `components/OneRMCalculator.tsx`   | `weightNum / (1.0278 - 0.0278 * repsNum)` | 🟡 Inline           |

### Pattern Recommandé vs Actuel

**✗ ACTUEL (OneRMCalculator.tsx)**

```typescript
const handleCalculate = () => {
  const result = weightNum / (1.0278 - 0.0278 * repsNum); // ← Hard-codé
  setResult(result);
};
```

**✓ RECOMMANDÉ (lib/formulas/brzycki.ts)**

```typescript
export const calculate1RMBrzycki = (weight: number, reps: number): number => {
  if (weight <= 0 || reps <= 0) throw new Error("Invalid input");
  if (reps > 37) throw new Error("Reps must be ≤ 37 for Brzycki accuracy");
  return weight / (1.0278 - 0.0278 * reps);
};
```

### Problèmes Identifiés

#### 1. Pas de versions de formule

- Si vous mettez à jour les coefficients Katch-McArdle, les anciens résultats ne correspondent plus
- Pas de `formula_version` dans les submissions → audit trail manquant

#### 2. Pas d'intervalle de confiance

- Actuellement : "1RM = 142.5 kg" (exact, faux)
- Recommandé : "1RM = 142.5 kg ±12 kg" (réaliste — Brzycki ~±15%)

#### 3. Validation d'entrée manquante

```
Age > 120 ?          → Pas de warning
Body fat > 100% ?    → Pas de rejet
Poids = 500 kg ?     → Accepté silencieusement
Reps > 37 ?          → Brzycki perd précision au-delà de 35-37 reps
```

### Formules Correctement Centralisées (Modèle)

**`utils/macroCalculator.js` (RÉFÉRENCE POSITIVE)**

```javascript
export function calculateOptimalMacros(data) {
  const { weight, height, age, bodyFat, gender, steps, workouts } = data;

  // Step 1: LBM via Katch-McArdle ou Boer
  let lbm;
  if (bodyFat) {
    lbm = weight * (1 - bodyFat / 100); // Katch-McArdle
  } else {
    // Boer fallback
    if (gender === "male") {
      lbm = 0.407 * weight + 0.267 * height - 19.2;
    } else {
      lbm = 0.252 * weight + 0.473 * height - 48.8;
    }
  }

  // Step 2: BMR
  const bmr = 370 + 21.6 * lbm;

  // Step 3: Age correction (conservative)
  let adjustedBMR = bmr;
  if (age > 30) {
    const ageDecrement = Math.floor((age - 30) / 10) * 0.02;
    adjustedBMR = bmr * (1 - ageDecrement);
  }

  // Step 4: TDEE = BMR + NEAT + EAT + TEF
  // où TEF ≈ 10% du reste (approximation conservative)
  const tdee = adjustedBMR * 1.1;

  // Step 5: Macros (PRO-first allocation)
  return {
    bmr: Math.round(adjustedBMR),
    tdee: Math.round(tdee),
    protein: Math.round(lbm * 2.2), // 2.2g/kg LBM
    fat: Math.round((tdee * 0.25) / 9), // 25% cals
    carbs: Math.round((tdee - protein * 4 - fat * 9) / 4),
  };
}
```

### Solution : Centraliser Toutes les Formules

```
lib/formulas/
├─ index.ts                    (barrel export)
├─ brzycki.ts                  // 1RM Brzycki
├─ karvonen.ts                 // Karvonen HR zones
├─ katch-mcardle.ts            // BMR + macros
├─ body-composition.ts         // Body fat, LBM
├─ types.ts                    // CalculationResult, ConfidenceMargin
└─ validators.ts               // Input validation
```

**lib/formulas/index.ts**

```typescript
export { calculate1RMBrzycki } from "./brzycki";
export { calculateKarvonenZones } from "./karvonen";
export { calculateOptimalMacros } from "./katch-mcardle";
export { validateBrzycki1RMInput } from "./validators";
```

---

## 📊 4. FLUX DE RESTITUTION (Reporting Flow)

### Engine d'Export — État Actuel

**Fichier :** `app/coach/comptabilite/page.tsx`

#### Implémenté ✓

```typescript
export to CSV: payments (Date, Client, Amount, Status)
filename: "paiements_YYYY-MM-DD.csv"
```

#### Manquant ✗

```typescript
export calculator results to CSV  ← MISSING
export to PDF                     ← MISSING
export to Excel                   ← MISSING
scheduled/email delivery          ← MISSING
```

### Flux Calcul → Stockage → Historique

```
Calculatrice (OneRM)
    ↓
[Save Button]
    ↓
POST /api/assessments/submissions
    {
      clientId,
      module: "ipt",
      responses: {
        oneRM: 142.5,
        trainingZones: [...]
      }
    }
    ↓
Supabase Insert into assessment_submissions
    (colonne "responses" = JSON)
    ↓
Query Historique
    SELECT * FROM assessment_submissions WHERE client_id = X

    // ← Manque d'agrégation typée
    // ← Parsing JSON nécessaire côté app
    // ← Requête inefficace sur gros volumes
```

### Lien entre Résultat Calculé et Historique Bilan

**État Actuel :** ✓ Faiblement établi

- `AssessmentSubmission` a `client_id`, `timestamp`, `responses` (JSON)
- Peut reconstruire timeline : "Client X, le Y, a soumis Z"
- **Mais :** Pour extraire uniquement les 1RM → requête + parse JSON applicatif

### Gaps Majeurs d'Export

| Capacité                           | État         | Impact                           |
| ---------------------------------- | ------------ | -------------------------------- |
| Agrégation sur 12 mois             | ❌ Manquante | Pas de tendances 1RM             |
| Comparaison cohort                 | ❌ Manquante | Pas de benchmarking client       |
| Format PDF avec branding           | ❌ Manquant  | Pas de deliverable pro           |
| Email automatique résultats        | ❌ Manquant  | Pas d'engagement client          |
| Audit trail (qui a exporté, quand) | ❌ Manquant  | Risque de conformité             |
| Templates de rapport               | ❌ Manquants | Chaque export = hardcodé         |
| Confidence intervals               | ❌ Manquants | Résultats présentés comme exacts |

### Solution : API de Reporting Typée

```typescript
// app/api/reports/calculator-results/route.ts

export async function GET(req: Request) {
  const { clientId, calculatorType, startDate, endDate } = req.query;

  // Query with proper typing
  const results = await db.calculatorResults.findMany({
    where: {
      clientId,
      calculatorType,
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    orderBy: { createdAt: "desc" },
  });

  // Format for export
  const csv = results.map((r) => ({
    date: r.createdAt.toISOString(),
    calculator: r.calculatorType,
    input: JSON.stringify(r.input),
    output: JSON.stringify(r.output),
    confidence: r.output.confidence_margin,
    formula_version: r.formula_version,
  }));

  return Response.json({ csv });
}
```

---

## 🔗 CARTOGRAPHIE INTERCONNECTIVITÉ DES 11 MODULES

Pour aligner les 11 modules + 7 calculatrices sur une architecture commune :

```
┌─────────────────────────────────────────────────────────────┐
│  UNIFIED DATA LAYER (nouvelle table)                        │
│  calculator_results (id, client_id, calculator_type,        │
│                      input, output, formula_version,        │
│                      created_at)                            │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────┐  ┌────────────────┐  ┌──────────────────┐
│ Coach Dashboard  │  │ Client App PWA │  │ Reporting Engine │
│ ├─ Dossier       │  │ ├─ Calculatrices
│  ├─ Historique   │  │ ├─ Results view │  │ ├─ Export CSV/PDF│
│ ├─ Analytics     │  │ ├─ Progress     │  │ ├─ Email delivery│
└──────────────────┘  └────────────────┘  └──────────────────┘
         ↓                    ↓                    ↓
    [Zustand Store]    [Zustand Store]    [Prisma ORM]
    (Client context)   (Client context)   (Queries typed)
```

### Modules d'Intégration

1. **IPT (Initial Performance Test)** — Module 1
   - Consomme : OneRM, HR Zones, Body Fat, Macros
   - Produit : IPTScore, IPTSubmission → calculator_results

2. **Genesis Assistant** — Module 2
   - Consomme : Toutes les calculatrices
   - Produit : Recommandations personnalisées

3. **Bilan Client (Check-in)** — Module 3
   - Consomme : Résultats historiques
   - Produit : Progress tracking

4. **Coach Dashboard** — Module 4
   - Consomme : calculator_results (TBD)
   - Produit : KPI cards, charts, trends

5. **Client Mini-App** — Module 5
   - Consomme : calculator_results historiques
   - Produit : Calculatrices + résultats sauvegardés

6. **Programs** — Module 6
   - Consomme : OneRM pour prescription poids
   - Produit : Poids initial des séries

7. **Performance Analytics** — Module 7
   - Consomme : calculator_results.output.progression
   - Produit : Graphiques tendances

8. **CRM** — Module 8
   - Consomme : Body composition trends
   - Produit : Client segments, cohorts

9. **Export/Reporting** — Module 9
   - Consomme : calculator_results (typed)
   - Produit : CSV, PDF, email

10. **Morphology Bridge (n8n)** — Module 10
    - Consomme : Body Fat, Weight trends
    - Produit : MorphoAnalysis

11. **Historical Analytics** — Module 11
    - Consomme : calculator_results temps-série
    - Produit : Insights long-terme

---

## ✅ PROCHAINES ACTIONS (Priorité)

### CRITICAL (Semaine 1) — Architecture Blocking Issues

- [ ] **Créer table `calculator_results`** → migration Supabase
  - Impact : Unlocks typed queries, audit trail, performance
  - Effort : 1 jour
  - Files : `supabase/migrations/20260405_calculator_results.sql`

- [ ] **Centraliser toutes formules** → `lib/formulas/`
  - Impact : Reusable, testable, versionable
  - Effort : 2 jours
  - Files : `lib/formulas/{brzycki,karvonen,katch-mcardle,validators}.ts`

- [ ] **Ajouter validation + error handling**
  - Impact : Data quality, prevents garbage output
  - Effort : 1 jour
  - Files : `lib/formulas/validators.ts`

### HIGH (Semaine 2) — MVP Features

- [ ] **Implémenter Zustand store centralisé**
  - Impact : Cross-component reactivity, client data sync
  - Effort : 2 jours
  - Files : `lib/stores/calculatorStore.ts`

- [ ] **Export PDF + email trigger**
  - Impact : Shareable results, engagement
  - Effort : 3 jours
  - Files : `app/api/reports/export-pdf/route.ts`

- [ ] **Dashboard d'historique calculatrices**
  - Impact : Coach sees trends, client sees progress
  - Effort : 3 jours
  - Files : `app/coach/analytics/calculator-trends/page.tsx`

### MEDIUM (Semaine 3) — Polish & Optimization

- [ ] **Add confidence intervals to all formulas**
  - Impact : Realistic results, better decisions
  - Effort : 2 jours

- [ ] **Implement formula versioning**
  - Impact : Audit trail, reproducibility
  - Effort : 1 jour

- [ ] **Add benchmarking/cohort comparison**
  - Impact : Motivation, data-driven coaching
  - Effort : 4 jours

---

## 📋 SUMMARY TABLE : Architecture Maturity

| Domain         | Technology            | Current Pattern                       | Maturity | Next Priority                                   |
| -------------- | --------------------- | ------------------------------------- | -------- | ----------------------------------------------- |
| **Database**   | Supabase (PostgreSQL) | JSON responses, no calculator table   | 🟡 Good  | Create result table (CRITICAL)                  |
| **State Mgmt** | React hooks + Context | Component-level + Supabase client     | 🟠 Fair  | Add Zustand store, persistence (HIGH)           |
| **Formulas**   | JavaScript utils      | Centralized (macros) + inline (OneRM) | 🟡 Good  | Migrate all to utils, add versioning (CRITICAL) |
| **Reporting**  | Client-side CSV       | Single export view (payments only)    | 🔴 Basic | Multi-format export, PDF, email (HIGH)          |

---

## 🎯 FILES À PRIORISER POUR REFACTORING

1. **`utils/macroCalculator.js`** → Extract into typed TypeScript module
2. **`components/OneRMCalculator.tsx`** → Extract formula to `lib/formulas/brzycki.ts`
3. **`components/HRZonesCalculator.tsx`** → Extract formula to `lib/formulas/karvonen.ts`
4. **`app/api/assessments/submissions/`** → Add calculator result storage logic
5. **`app/coach/comptabilite/page.tsx`** → Refactor to use new calculator_results table
6. **`lib/calculators/`** → Create centralized formula library (currently underutilized)

---

## 📚 APPENDIX : Current Calculator Result Storage Patterns

### Pattern 1 : JSON in responses (Current)

```typescript
AssessmentSubmission {
  id: UUID
  client_id: UUID
  module: "ipt"
  responses: {
    "oneRM": 142.5,
    "hrMax": 185,
    "hrReserve": 135,
    "zones": [
      { name: "Zone 2", min: 109, max: 135 }
    ],
    "macros": {
      "tdee": 2450,
      "protein": 185,
      "fat": 68,
      "carbs": 306
    }
  }
  created_at: Timestamp
}
```

**Problem :** Non-queryable, parsing expensive, no versioning

### Pattern 2 : Proposed (calculator_results table)

```typescript
CalculatorResult {
  id: UUID
  client_id: UUID
  calculator_type: "oneRM" | "hrZones" | "macros" | "bodyFat"
  input: {
    weight: 85,
    reps: 5,
    equipment: "barbell"
  }
  output: {
    result: 142.5,
    unit: "kg",
    confidence_margin: 12,
    formula: "Brzycki",
    calculation_date: ISOString
  }
  formula_version: "v1.0"
  created_at: Timestamp
}
```

**Benefit :** Queryable, typed, versioned, efficient

---

**Document prepared for STRYVR architecture alignment and performance lab interconnectivity setup.**
