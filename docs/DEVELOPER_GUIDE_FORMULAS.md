# GUIDE D'INTÉGRATION — Phase 1 → Phase 2

**Pour développeurs:** Comment utiliser les nouvelles formules + API de persistence

---

## 📌 QUICK REFERENCE

### Import Formulas

```typescript
// OLD (inline calculation)
const oneRM = weight / (1.0278 - 0.0278 * reps);

// NEW (from lib/formulas/)
import { calculateOneRM } from "@/lib/formulas/oneRM";

const result = calculateOneRM({ weight: 100, reps: 5 });
// result = {
//   oneRM: 113.6,
//   brzycki: 113.6,
//   epley: 116.5,
//   lombardi: 119.2,
//   confidence: '±2.5%',
//   warnings: []
// }
```

### Store Calculator Result

```typescript
// NEW: Persist result to DB
import { storeCalculatorResult } from "@/lib/db/calculator-results";

await storeCalculatorResult(
  clientId,
  "oneRM", // calculatorType
  { weight: 100, reps: 5 }, // input
  result, // output (from calculateOneRM)
  "v1.0", // formulaVersion
);
```

### Query Results

```typescript
// NEW: Retrieve from DB
import { getClientCalculatorResults } from "@/lib/db/calculator-results";

const results = await getClientCalculatorResults(
  clientId,
  "oneRM", // optional: filter by type
  undefined, // startDate
  undefined, // endDate
  50, // limit
  0, // offset
);
```

---

## 🔄 MIGRATION PATH: Component → Formula Module

### Example: OneRMCalculator

**BEFORE (Phase 0):**

```typescript
export function OneRMCalculator() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  const calculate1RM = () => {
    if (repsNum < 2 || repsNum > 12) return null
    return weightNum / (1.0278 - 0.0278 * repsNum)  // ← Inline formula
  }

  const oneRM = calculate1RM()

  return <div>{oneRM}</div>
}
```

**AFTER (Phase 1 - Immediate):**

```typescript
import { calculateOneRM } from '@/lib/formulas/oneRM'
import { storeCalculatorResult } from '@/lib/db/calculator-results'

export function OneRMCalculator() {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCalculate = async () => {
    const result = calculateOneRM({ weight: Number(weight), reps: Number(reps) })

    // Persist to DB
    setSaving(true)
    await storeCalculatorResult(
      clientId,
      'oneRM',
      { weight: Number(weight), reps: Number(reps) },
      result,
      'v1.0'
    )
    setSaving(false)
  }

  return <div>{result?.oneRM}</div>
}
```

**AFTER (Phase 2+ - With Zustand):**

```typescript
import { useClientStore } from '@/lib/stores/useClientStore'

export function OneRMCalculator() {
  const { client, calculations: { oneRM }, loading } = useClientStore()

  // ✨ AUTOMATIC:
  // - Modify client.weight anywhere
  // - Component re-renders with new oneRM
  // - Result auto-persisted to DB
  // - ZERO useState, ZERO manual saves

  return <div>{oneRM?.oneRM}</div>
}
```

---

## 📦 ALL AVAILABLE FORMULAS

### 1. OneRM (Strength)

**Module:** `lib/formulas/oneRM.ts`

```typescript
import { calculateOneRM } from "@/lib/formulas";

const result = calculateOneRM(
  { weight: 100, reps: 5 },
  "average", // or 'brzycki' | 'epley' | 'lombardi'
);

result.oneRM; // Single 1RM value
result.brzycki; // Brzycki estimate
result.epley; // Epley estimate
result.lombardi; // Lombardi estimate
result.warnings; // Array of warnings
result.confidence; // '±2.5%' | '±5%' | '±10-15%' | '±15%+'
```

### 2. HR Zones (Cardio)

**Module:** `lib/formulas/hrZones.ts`

```typescript
import { calculateHRZones } from "@/lib/formulas";

const result = calculateHRZones({
  age: 35,
  restingHR: 60,
  trainingAge: "years",
});

result.maxHR; // 185 bpm
result.reserve; // 125 bpm
result.zones; // 5 zones with min/max HR
```

### 3. Macros (Nutrition)

**Module:** `lib/formulas/macros.ts`

```typescript
import { calculateMacros } from "@/lib/formulas";

const result = calculateMacros({
  weight: 80, // kg
  height: 180, // cm
  age: 35,
  gender: "M",
  bodyFat: 15, // % (optional)
  dailySteps: 8000, // optional
  weeklyWorkouts: 4, // optional
  goal: "surplus", // or 'maintenance' | 'deficit'
});

result.bmr; // Basal Metabolic Rate
result.tdee; // Total Daily Energy Expenditure
result.macros; // { protein, fat, carbs }
result.leanMass; // kg
result.estimatedBodyFat; // %
```

### 4. Body Fat (Composition)

**Module:** `lib/formulas/bodyFat.ts`

```typescript
import {
  navyBodyFat,
  skinfoldBodyFat,
  getBodyFatCategory,
} from "@/lib/formulas";

// Navy method (age + waist + abdomen for male)
const navyBF = navyBodyFat({ age: 35, waist: 85, abdomen: 90, gender: "M" });

// Skinfold method (3 or 7 measurements)
const skinfoldBF = skinfoldBodyFat({
  gender: "M",
  age: 35,
  chest: 10,
  abdominal: 15,
  thigh: 12,
});

// Get category
const category = getBodyFatCategory(navyBF, "M");
// 'Essential' | 'Athletes' | 'Fitness' | 'Average' | 'Obese'
```

### 5. Hydration (Water Intake)

**Module:** `lib/formulas/hydration.ts`

```typescript
import { calculateHydration } from "@/lib/formulas";

const result = calculateHydration({
  weight: 80, // kg
  activityLevel: "active", // 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  climate: "temperate", // optional
  workoutsPerWeek: 4, // optional
  workoutDuration: 60, // minutes, optional
});

result.dailyIntakeMl; // e.g., 2500
result.schedule; // [{ time: '09:00', volumeMl: 500 }, ...]
```

### 6. Carb Cycling

**Module:** `lib/formulas/carbCycling.ts`

```typescript
import { calculateCarbCycle } from "@/lib/formulas";

const result = calculateCarbCycle({
  tdee: 2500,
  bodyFat: 15, // %
  workoutDaysPerWeek: 4,
  protocol: "extreme", // 'mild' | 'moderate' | 'extreme'
});

result.carbCycle; // { low: 150, medium: 250, high: 350 }
result.schedule; // [{ day: 'Monday', type: 'high', carbs: 350 }, ...]
```

---

## 🔒 VALIDATION & ERROR HANDLING

### Validate Before Calculating

```typescript
import { validateBrzycki1RM, throwIfInvalid } from "@/lib/formulas";

const input = { weight: 100, reps: 5 };
const validation = validateBrzycki1RM(input);

if (!validation.isValid) {
  console.error("Validation failed:", validation.errors);
  // validation.errors = [
  //   { field: 'weight', message: 'weight must be between 30 and 500' }
  // ]
}

// Or throw immediately:
throwIfInvalid(validation, "Brzycki 1RM");
// Throws: "Brzycki 1RM validation failed: weight must be positive..."
```

### Error Handling in Component

```typescript
const handleCalculate = async () => {
  try {
    const result = calculateOneRM({ weight, reps });

    // Persist
    await storeCalculatorResult(
      clientId,
      "oneRM",
      { weight, reps },
      result,
      "v1.0",
    );

    setResult(result);
  } catch (error) {
    console.error("Calculation failed:", error.message);
    setError(error.message); // Show user-friendly error
  }
};
```

---

## 📊 FORMULA VERSIONING

### Why Versioning?

If you update a formula's coefficients, old results become "stale" (calculated with old formula).

### How It Works

**In DB:**

```json
{
  "id": "abc123",
  "calculatorType": "oneRM",
  "output": { "oneRM": 113.6 },
  "formula_version": "v1.0" // ← Records which version was used
}
```

**When Updating a Formula:**

1. Update `lib/formulas/[module].ts` with new coefficients
2. Update version in `lib/formulas/types.ts`:
   ```typescript
   export const FORMULA_VERSIONS = {
     BRZYCKI_1RM: 'v1.1',  // ← Bump version
     ...
   }
   ```
3. Export function returns new version:
   ```typescript
   return {
     oneRM: 113.6,
     formulaVersion: 'v1.1',  // ← New version recorded
     ...
   }
   ```

### Querying by Formula Version

```typescript
// Get all results with specific formula version
const results = await getClientCalculatorResults(clientId, "oneRM");
// Filter client-side:
const v1_0Results = results.filter((r) => r.formulaVersion === "v1.0");
const v1_1Results = results.filter((r) => r.formulaVersion === "v1.1");
```

---

## 💾 API PERSISTENCE LAYER

### Store Result (POST)

```bash
curl -X POST http://localhost:3000/api/calculator-results/store \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "calculatorType": "oneRM",
    "input": {"weight": 100, "reps": 5},
    "output": {"oneRM": 113.6, "formula": "Brzycki"},
    "formulaVersion": "v1.0",
    "metadata": {"equipment": "barbell"}
  }'

# Response: 201 Created
# {
#   "success": true,
#   "result": {
#     "id": "...",
#     "clientId": "...",
#     "createdAt": "2026-04-05T14:30:00Z",
#     ...
#   }
# }
```

### Query Results (GET)

```bash
# Get all oneRM results for client
curl "http://localhost:3000/api/calculator-results/query?clientId=xxx&calculatorType=oneRM"

# With date range
curl "http://localhost:3000/api/calculator-results/query?clientId=xxx&startDate=2026-04-01T00:00:00Z&endDate=2026-04-05T23:59:59Z"

# CSV export
curl "http://localhost:3000/api/calculator-results/query?clientId=xxx&format=csv" -o results.csv
```

---

## 📝 BEST PRACTICES

### ✅ DO

- ✅ Use formulas from `lib/formulas/`, never inline math
- ✅ Always validate input before calculating
- ✅ Store result to DB after calculating
- ✅ Include formulaVersion in stored result
- ✅ Catch errors and show user-friendly messages

### ❌ DON'T

- ❌ Duplicate formula logic (breaks versioning)
- ❌ Store result without validating
- ❌ Hardcode formula versions (use FORMULA_VERSIONS map)
- ❌ Mix old formula calls with new ones
- ❌ Skip error handling

---

## 🚀 NEXT STEPS

**Phase 1 Complete?** Move to Phase 2:

1. Implement Zustand store
2. Refactor components to use store
3. Enable cross-component reactivity

See: `docs/MEMORANDUM_IMPLEMENTATION_AUDIT.md` for Phase 2 details.
