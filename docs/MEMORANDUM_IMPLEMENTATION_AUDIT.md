# MÉMORANDUM INTERNE — Validation & Implémentation de l'Audit Technique

**FROM:** Product Leadership
**TO:** Development Team
**DATE:** 5 avril 2026
**PRIORITY:** 🔴 CRITICAL — Blocage sur tout développement visuel jusqu'à complétion

---

## CONTEXTE : Vision Validée

L'audit technique révèle un **problème architectural fondamental** : les composants calculatrices fonctionnent en silos isolés (**Component as Island pattern**), sans synchronisation inter-composants.

**REJET CATÉGORIQUE :** Ce pattern n'est pas acceptable pour STRYVR.

> **VIRTUS n'est pas un agrégateur de widgets. C'est un moteur d'intelligence interconnectée.**

L'isolation actuelle bloque :

- ❌ Synchronisation temps-réel (modification poids → recalcul automatique 1RM, Macros, Body Fat)
- ❌ Persistance de données inter-modules
- ❌ Réactivité instantanée
- ❌ Évolutivité vers les 11 modules interconnectés

---

## PLAN D'ACTION VALIDÉ

### ✅ SEMAINE 1 : REFONTE DATA (GO STRICT)

**Responsabilité :** Backend / Data Architecture
**Deadline :** Fin semaine 1 (9 avril 2026)
**Blocage :** Aucun nouveau composant jusqu'à complétion

#### Phase 1.1 : Table `calculator_results` (Jour 1-2)

**Objectif :** Sortir du stockage JSON brut. Créer une table typée pour tous les résultats de calcul.

**Action immédiate :**

1. Créer migration Supabase : `supabase/migrations/20260405_calculator_results.sql`

```sql
CREATE TABLE calculator_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  calculator_type TEXT NOT NULL CHECK (
    calculator_type IN (
      'oneRM', 'hrZones', 'macros', 'bodyFat', 'water', 'karvonen', 'bmi'
    )
  ),
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  formula_version TEXT NOT NULL DEFAULT 'v1.0',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calculator_results_client ON calculator_results(client_id);
CREATE INDEX idx_calculator_results_type ON calculator_results(calculator_type);
CREATE INDEX idx_calculator_results_created ON calculator_results(created_at DESC);

ALTER TABLE calculator_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY calculator_results_select ON calculator_results
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM clients WHERE id = client_id));

CREATE POLICY calculator_results_insert ON calculator_results
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM clients WHERE id = client_id));
```

2. Appliquer via Supabase dashboard
3. Vérifier RLS policies actives
4. ✅ Point de validation : `npx tsc --noEmit` = 0 erreurs

**Fichiers à créer/modifier :**

- `supabase/migrations/20260405_calculator_results.sql` (NEW)
- `types/calculator.ts` (NEW) — TypeScript interfaces pour CalculatorResult
- `lib/db/calculator-results.ts` (NEW) — Service layer CRUD

---

#### Phase 1.2 : Centralisation Formules (Jour 3-4)

**Objectif :** Toute logique métier mathématique = `lib/formulas/`. Zéro logique métier en composants UI.

**Structure à créer :**

```
lib/formulas/
├─ index.ts                     (barrel export)
├─ types.ts                     (CalculationResult, ConfidenceMargin)
├─ validators.ts                (InputValidator, validateBrzycki1RM)
├─ brzycki.ts                   (1RM calculation)
├─ karvonen.ts                  (HR zones)
├─ katch-mcardle.ts             (macros, BMR, TDEE)
├─ body-composition.ts          (body fat, LBM)
├─ water-intake.ts              (daily hydration)
└─ bmi.ts                       (BMI + category)
```

**Pattern obligatoire pour chaque formule :**

```typescript
// lib/formulas/brzycki.ts
import { CalculationResult, ConfidenceMargin } from "./types";

export interface Brzycki1RMInput {
  weight: number; // kg
  reps: number;
  equipment?: string; // 'barbell' | 'dumbbell'
}

export interface Brzycki1RMOutput extends CalculationResult {
  oneRM: number; // kg
  zones: {
    zone: string; // 'Zone 1', 'Zone 2', etc
    percentageOfMax: number;
    repsRange: number[];
  }[];
  confidence: ConfidenceMargin;
}

export const FORMULA_VERSION = "v1.0";

export function validateBrzycki1RMInput(input: Brzycki1RMInput): void {
  if (input.weight <= 0) throw new Error("Weight must be positive");
  if (input.reps <= 0 || input.reps > 37) throw new Error("Reps must be 1-37");
  // Brzycki loses accuracy beyond 37 reps
}

export function calculate1RMBrzycki(input: Brzycki1RMInput): Brzycki1RMOutput {
  validateBrzycki1RMInput(input);

  const oneRM = input.weight / (1.0278 - 0.0278 * input.reps);
  const confidenceMargin = calculateConfidenceMargin(input.reps);

  return {
    oneRM: Math.round(oneRM * 10) / 10,
    zones: [
      { zone: "Strength (90%)", percentageOfMax: 90, repsRange: [1, 3] },
      { zone: "Hypertrophy (80%)", percentageOfMax: 80, repsRange: [6, 12] },
      { zone: "Endurance (60%)", percentageOfMax: 60, repsRange: [15, 20] },
    ],
    confidence: confidenceMargin,
    formula: "Brzycki",
    formulaVersion: FORMULA_VERSION,
    calculatedAt: new Date().toISOString(),
  };
}

function calculateConfidenceMargin(reps: number): ConfidenceMargin {
  // Brzycki accuracy ±15% for 1-10 reps, degrades beyond
  const margin = reps <= 10 ? 15 : 15 + (reps - 10) * 1.5;
  return {
    percentageRange: Math.round(margin),
    absoluteKgRange: 5, // example
  };
}
```

**Migrer depuis composants :**

```typescript
// ✗ BEFORE (components/OneRMCalculator.tsx)
const handleCalculate = () => {
  const result = weightNum / (1.0278 - 0.0278 * repsNum);
  setResult(result);
};

// ✓ AFTER
import { calculate1RMBrzycki } from "@/lib/formulas/brzycki";

const handleCalculate = () => {
  try {
    const output = calculate1RMBrzycki({ weight: weightNum, reps: repsNum });
    setResult(output);
  } catch (error) {
    setError(error.message);
  }
};
```

**Fichiers à créer/modifier :**

- `lib/formulas/index.ts` (NEW)
- `lib/formulas/types.ts` (NEW)
- `lib/formulas/validators.ts` (NEW)
- `lib/formulas/brzycki.ts` (NEW)
- `lib/formulas/karvonen.ts` (NEW)
- `lib/formulas/katch-mcardle.ts` (NEW)
- `lib/formulas/body-composition.ts` (NEW)
- `utils/macroCalculator.js` → REFACTOR to use `lib/formulas/katch-mcardle.ts`
- `components/OneRMCalculator.tsx` → UPDATE imports
- `components/HRZonesCalculator.tsx` → UPDATE imports

---

#### Phase 1.3 : Checkpoint Validation (Fin semaine 1)

**Validation obligatoire avant passage à Semaine 2 :**

- ✅ `npx tsc --noEmit` = **0 erreurs TypeScript**
- ✅ Table `calculator_results` créée et accessible via Supabase
- ✅ Toutes les formules migrées dans `lib/formulas/`
- ✅ Aucune formule mathématique ne reste en composant
- ✅ Unit tests sur chaque formule (vitest)
  ```bash
  npm run test -- lib/formulas
  ```
- ✅ `CHANGELOG.md` mis à jour :
  ```
  SCHEMA: Add calculator_results table with RLS policies
  REFACTOR: Migrate all formulas to lib/formulas/ (centralized, pure functions)
  CHORE: Remove inline math from components
  ```

**Blocage critique :** Si ces validations échouent, **gel du développement jusqu'à résolution**.

---

### ✅ SEMAINE 2 : CERVEAU CENTRAL (GO STRICT)

**Responsabilité :** Frontend / State Architecture
**Deadline :** Fin semaine 2 (16 avril 2026)
**Vision :** Un client, une source de vérité. Réactivité instantanée inter-modules.

#### Phase 2.1 : Store Zustand Centralisé (Jour 1-2)

**Objectif :** Super-remplacer tous les `useState` isolés. Créer un "cerveau central" pour les données client.

**Structure :**

```typescript
// lib/stores/useClientStore.ts (NEW)
import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";

interface ClientState {
  // === CLIENT DATA (source of truth) ===
  client: {
    id: string;
    name: string;
    email: string;
    age: number | null;
    weight: number | null; // kg (DRIVING FIELD)
    height: number | null; // cm (DRIVING FIELD)
    gender: "M" | "F" | null;
    bodyFat: number | null; // % (DRIVING FIELD)
    activityLevel: "sedentary" | "light" | "moderate" | "active" | null;
  };

  // === CALCULATION CACHE (derived from client data) ===
  calculations: {
    oneRM: Brzycki1RMOutput | null;
    hrZones: KarvonenOutput | null;
    macros: MacrosOutput | null;
    bodyComposition: BodyCompositionOutput | null;
    bmi: BMIOutput | null;
  };

  // === UI STATE ===
  loading: boolean;
  errors: Record<string, string>;

  // === ACTIONS ===
  setClientData: (
    field: keyof ClientState["client"],
    value: any,
  ) => Promise<void>;
  setClientDataBatch: (data: Partial<ClientState["client"]>) => Promise<void>;
  recalculateAll: () => void;
  clearCalculationCache: () => void;
  setError: (calculationType: string, message: string) => void;
  clearError: (calculationType: string) => void;
}

export const useClientStore = create<ClientState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      client: {
        id: "",
        name: "",
        email: "",
        age: null,
        weight: null,
        height: null,
        gender: null,
        bodyFat: null,
        activityLevel: null,
      },

      calculations: {
        oneRM: null,
        hrZones: null,
        macros: null,
        bodyComposition: null,
        bmi: null,
      },

      loading: false,
      errors: {},

      // When any client field changes, recalculate dependent calculations
      setClientData: async (field, value) => {
        set((state) => ({
          client: { ...state.client, [field]: value },
          loading: true,
        }));

        // Persist to Supabase
        try {
          await fetch(`/api/clients/${get().client.id}`, {
            method: "PATCH",
            body: JSON.stringify({ [field]: value }),
          });

          // Auto-recalculate all dependent calculations
          get().recalculateAll();

          set({ loading: false });
        } catch (error) {
          set({ loading: false });
          set((state) => ({
            errors: { ...state.errors, [field]: error.message },
          }));
        }
      },

      setClientDataBatch: async (data) => {
        set((state) => ({
          client: { ...state.client, ...data },
          loading: true,
        }));

        try {
          await fetch(`/api/clients/${get().client.id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
          });

          get().recalculateAll();
          set({ loading: false });
        } catch (error) {
          set({ loading: false });
          set((state) => ({
            errors: { ...state.errors, batch: error.message },
          }));
        }
      },

      recalculateAll: () => {
        const { client } = get();

        try {
          // Recalculate each based on current client data
          const oneRM =
            client.weight && client.age
              ? calculate1RMBrzycki({ weight: client.weight, reps: 5 })
              : null;

          const hrZones = client.age
            ? calculateKarvonenZones({ age: client.age, restingHR: 60 })
            : null;

          const macros =
            client.weight && client.height
              ? calculateOptimalMacros({
                  weight: client.weight,
                  height: client.height,
                  age: client.age,
                  bodyFat: client.bodyFat,
                  gender: client.gender,
                })
              : null;

          set({
            calculations: {
              oneRM,
              hrZones,
              macros,
              bodyComposition: null,
              bmi: null,
            },
            errors: (e) => ({ ...e, calculation: "" }),
          });
        } catch (error) {
          set((state) => ({
            errors: { ...state.errors, calculation: error.message },
          }));
        }
      },

      clearCalculationCache: () => {
        set({
          calculations: {
            oneRM: null,
            hrZones: null,
            macros: null,
            bodyComposition: null,
            bmi: null,
          },
        });
      },

      setError: (calculationType, message) => {
        set((state) => ({
          errors: { ...state.errors, [calculationType]: message },
        }));
      },

      clearError: (calculationType) => {
        set((state) => {
          const { [calculationType]: _, ...rest } = state.errors;
          return { errors: rest };
        });
      },
    })),
  ),
  { name: "ClientStore" },
);

// === SUBSCRIBE TO CHANGES (auto-recalculate when key fields change) ===
useClientStore.subscribe(
  (state) => state.client.weight,
  (weight) => useClientStore.getState().recalculateAll(),
);

useClientStore.subscribe(
  (state) => state.client.age,
  (age) => useClientStore.getState().recalculateAll(),
);

useClientStore.subscribe(
  (state) => state.client.bodyFat,
  (bodyFat) => useClientStore.getState().recalculateAll(),
);
```

**Utilisation dans les composants :**

```typescript
// ✓ AFTER (components/OneRMCalculator.tsx)
import { useClientStore } from '@/lib/stores/useClientStore'

export function OneRMCalculator() {
  const { client, calculations: { oneRM }, loading, errors } = useClientStore()
  const setClientData = useClientStore((s) => s.setClientData)

  return (
    <div>
      <input
        type="number"
        value={client.weight || ''}
        onChange={(e) => setClientData('weight', parseFloat(e.target.value))}
        placeholder="Weight (kg)"
        disabled={loading}
      />

      {oneRM && (
        <div>
          <strong>Your 1RM: {oneRM.oneRM} kg</strong>
          <p>±{oneRM.confidence.percentageRange}%</p>
        </div>
      )}

      {errors.calculation && <p className="error">{errors.calculation}</p>}
    </div>
  )
}
```

**Cascading reactivity :**

```
Coach modifie "Poids" dans CRM
    ↓
setClientData('weight', 85)
    ↓
Store persiste à Supabase + recalculeAll()
    ↓
✓ OneRMCalculator voit weight change → oneRM recalculé
✓ MacrosCalculator voit weight change → macros recalculé
✓ BMICalculator voit weight + height → BMI recalculé
    ↓
All components re-render with new calculations
(NO PAGE RELOAD, fully instantaneous)
```

**Fichiers à créer/modifier :**

- `lib/stores/useClientStore.ts` (NEW)
- `lib/hooks/useRecalculateOnClientChange.ts` (NEW) — Custom hook pour subscribe
- `components/OneRMCalculator.tsx` → REFACTOR to use store
- `components/HRZonesCalculator.tsx` → REFACTOR to use store
- `components/MacrosCalculator.tsx` → REFACTOR to use store
- `components/BodyFatCalculator.tsx` → REFACTOR to use store
- `components/BMICalculator.tsx` → REFACTOR to use store
- `app/coach/clients/[clientId]/page.tsx` → Initialize store on mount

---

#### Phase 2.2 : Destruction des useState Isolés (Jour 3)

**Règle absolue :** Aucun `useState` pour des données client ou calculs.

**AVANT :**

```typescript
// ✗ FORBIDDEN (isolated state)
const [weight, setWeight] = useState(null);
const [reps, setReps] = useState(null);
const [oneRM, setOneRM] = useState(null);
```

**APRÈS :**

```typescript
// ✓ REQUIRED (read from store)
const weight = useClientStore((s) => s.client.weight);
const calculation = useClientStore((s) => s.calculations.oneRM);
```

**Audit requis :**

```bash
grep -r "useState.*weight\|useState.*reps\|useState.*bodyFat" components/
# Should return 0 matches in calculator components
```

---

#### Phase 2.3 : Checkpoint Validation (Fin semaine 2)

**Validation obligatoire avant passage à Semaine 3 :**

- ✅ `npx tsc --noEmit` = **0 erreurs TypeScript**
- ✅ `npm run dev` = **Pas de erreurs Console**
- ✅ Scénario test : Modifier poids dans CRM → macros/1RM/BMI recalculés instantanément (NO RELOAD)
- ✅ Zustand store persiste données client à Supabase
- ✅ Tout `useState` dans calculatrices éliminé (grep audit)
- ✅ Unit tests sur store subscriptions
  ```bash
  npm run test -- lib/stores
  ```
- ✅ `CHANGELOG.md` mis à jour :
  ```
  REFACTOR: Implement Zustand store for unified client data management
  REFACTOR: Remove isolated useState from all calculator components
  FEATURE: Cross-component reactivity — weight change triggers all calculations
  CHORE: Migrate calculator components to useClientStore
  ```

---

### ✅ SEMAINE 3 : LIVRABLE (GO STRICT)

**Responsabilité :** Backend / Reporting
**Deadline :** Fin semaine 3 (23 avril 2026)
**Objectif :** Export professionnel, typé, auditable.

#### Phase 3.1 : API Reporting Typée (Jour 1-2)

**Route :** `app/api/reports/calculator-results/route.ts`

```typescript
// app/api/reports/calculator-results/route.ts (NEW)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const querySchema = z.object({
  clientId: z.string().uuid(),
  calculatorType: z
    .enum(["oneRM", "hrZones", "macros", "bodyFat", "water", "karvonen", "bmi"])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

export async function GET(req: NextRequest) {
  try {
    // Validate query
    const query = querySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    // Build filters
    let dbQuery = supabase
      .from("calculator_results")
      .select("*")
      .eq("client_id", query.clientId)
      .order("created_at", { ascending: false });

    if (query.calculatorType) {
      dbQuery = dbQuery.eq("calculator_type", query.calculatorType);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte("created_at", query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte("created_at", query.endDate);
    }

    const { data: results, error } = await dbQuery;

    if (error) throw error;

    // Format response
    if (query.format === "csv") {
      return formatAsCSV(results);
    }

    return NextResponse.json({
      clientId: query.clientId,
      count: results.length,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatAsCSV(results: any[]): Response {
  const headers = [
    "Date",
    "Calculator",
    "Input",
    "Output",
    "Confidence",
    "Formula Version",
  ];
  const rows = results.map((r) => [
    new Date(r.created_at).toISOString(),
    r.calculator_type,
    JSON.stringify(r.input),
    JSON.stringify(r.output),
    r.output.confidence?.percentageRange || "N/A",
    r.formula_version,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="calculator-results-${new Date().toISOString()}.csv"`,
    },
  });
}
```

**Usage :**

```
GET /api/reports/calculator-results?clientId=xxx&calculatorType=oneRM&format=csv
→ Returns CSV with all 1RM calculations for client
```

**Fichiers à créer/modifier :**

- `app/api/reports/calculator-results/route.ts` (NEW)
- `lib/reports/calculator-formatter.ts` (NEW)
- `types/report.ts` (NEW)

---

#### Phase 3.2 : Moteur PDF (Jour 3-4)

**Route :** `app/api/reports/export-pdf/route.ts`

```typescript
// app/api/reports/export-pdf/route.ts (NEW)
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { clientId, startDate, endDate } = await req.json();

    // Fetch all calculator results
    const { data: results } = await supabase
      .from("calculator_results")
      .select("*")
      .eq("client_id", clientId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    // Fetch client info
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { height } = page.getSize();

    // Title
    page.drawText("Performance Assessment Report", {
      x: 50,
      y: height - 50,
      size: 24,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Client info
    page.drawText(`Client: ${client.name}`, {
      x: 50,
      y: height - 100,
      size: 12,
    });

    page.drawText(`Date Range: ${startDate} to ${endDate}`, {
      x: 50,
      y: height - 130,
      size: 12,
    });

    // Results section
    let yOffset = height - 180;

    for (const result of results) {
      page.drawText(`${result.calculator_type}`, {
        x: 50,
        y: yOffset,
        size: 14,
        color: rgb(1, 0.67, 0), // STRYVR Yellow
      });

      page.drawText(`Result: ${JSON.stringify(result.output)}`, {
        x: 70,
        y: yOffset - 20,
        size: 10,
      });

      yOffset -= 50;

      if (yOffset < 50) {
        // New page
        const newPage = pdfDoc.addPage([595, 842]);
        yOffset = 800;
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bilan-${client.name}-${new Date().toISOString()}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Fichiers à créer/modifier :**

- `app/api/reports/export-pdf/route.ts` (NEW)
- `lib/reports/pdf-generator.ts` (NEW)
- `components/reports/ExportButton.tsx` (NEW)

---

#### Phase 3.3 : Checkpoint Validation (Fin semaine 3)

**Validation obligatoire :**

- ✅ `npx tsc --noEmit` = **0 erreurs TypeScript**
- ✅ API endpoint `GET /api/reports/calculator-results` retourne résultats typés
- ✅ Export CSV fonctionne (can open in Excel)
- ✅ Export PDF généré avec branding STRYVR
- ✅ Audit trail complèt (qui a exporté, format, date)
- ✅ `CHANGELOG.md` mis à jour :
  ```
  FEATURE: Add /api/reports/calculator-results endpoint (typed, queryable)
  FEATURE: CSV export for calculator results
  FEATURE: PDF export with client branding
  CHORE: Implement audit logging for report exports
  ```

---

## 🚫 BLOCAGE STRICT

### **Aucun nouveau composant visuel ne sera développé jusqu'à:**

1. ✅ Semaine 1 complète → Table + Formules centralisées validées
2. ✅ Semaine 2 complète → Zustand store + réactivité instantanée validée
3. ✅ Semaine 3 complète → API Reporting + PDF validée

**Raison :** Construire sur une base fragmentée = dette technique irremontable.

---

## 📋 CHECKLIST EXÉCUTION

### Semaine 1

- [ ] Migration `calculator_results` créée & appliquée
- [ ] `lib/formulas/` structure créée
- [ ] Toutes les formules migrées (Brzycki, Karvonen, Katch-McArdle, etc.)
- [ ] Types TypeScript définis pour tous les résultats
- [ ] Unit tests sur formules (`npm run test -- lib/formulas` = GREEN)
- [ ] `npx tsc --noEmit` = 0 erreurs
- [ ] `CHANGELOG.md` mis à jour (SCHEMA + REFACTOR)
- [ ] Code review checkpoint

### Semaine 2

- [ ] `lib/stores/useClientStore.ts` créé & implémenté
- [ ] Store subscriptions testées
- [ ] Composants calculatrice refactorisés (OneRM, HR Zones, Macros, Body Fat, BMI)
- [ ] Tout `useState` isolé supprimé
- [ ] Scénario test : modifier poids → recalcul instant (5+ calculatrices)
- [ ] `npm run dev` sans erreurs console
- [ ] Unit tests sur store (`npm run test -- lib/stores` = GREEN)
- [ ] `npx tsc --noEmit` = 0 erreurs
- [ ] `CHANGELOG.md` mis à jour (REFACTOR)
- [ ] Code review checkpoint

### Semaine 3

- [ ] API `/api/reports/calculator-results` implémentée
- [ ] Endpoint CSV export fonctionnel
- [ ] Endpoint PDF export fonctionnel
- [ ] Audit logging implémenté
- [ ] Intégration frontend (boutons export, composants)
- [ ] E2E test : export > download > vérifier contenu
- [ ] `CHANGELOG.md` mis à jour (FEATURE)
- [ ] Code review checkpoint + QA signoff

---

## 🎯 DÉFINITION DE "DONE"

**Semaine 1 DONE :**

- Table DB créée, RLS actif
- Zéro logique métier reste dans composants
- TypeScript strict sur formules

**Semaine 2 DONE :**

- Zustand store centralise `clientData`
- Modification champ client → recalcul automatique de TOUS les calculs liés
- ZÉRO rechargement de page
- ZÉRO `useState` pour données client/calculs

**Semaine 3 DONE :**

- Export CSV typée retourne résultats queryables
- PDF généré avec branding
- Coach peut télécharger bilan complet en < 3 secondes

---

## 📞 ESCALADE & SUPPORT

**Questions d'architecture ?** → Consulter `docs/architecture/audit-performance-lab.md`

**Questions formules ?** → Unit tests dans `tests/lib/formulas/` sont source de vérité

**Questions store ?** → Zustand devtools accessible via browser extension

**Bloquants ?** → Escalade immédiate AVANT de contourner le process

---

## SIGNATURE

**Validé par :**
Leadership / Product Direction

**Effectif à partir de :**
5 avril 2026

**Statut :**
🔴 **CRITICAL — EXÉCUTION IMMÉDIATE**

---

_Ce mémorandum établit le contrat d'exécution pour l'interconnectivité STRYVR. Aucune déviation sans approbation explicite._
