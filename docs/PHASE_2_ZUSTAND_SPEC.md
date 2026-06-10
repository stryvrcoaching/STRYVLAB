# Phase 2 — Zustand Integration & Safety Rules (Lundi matin)

**Date:** 9 avril 2026
**Phase:** Réactivité Inter-Composants (Semaine 2)
**Status:** 🚀 Ready for Implementation

---

## 📋 PHASE 2 DELIVERABLES

### 1. Zustand Store with Middleware

**File:** `lib/stores/useClientStore.ts` (existing - extended)

- [x] Profile-based state
- [x] Auto-recalculation on profile change
- [x] Support for all 6 calculators (oneRM, hrZones, macros, bodyFat, water, BMI)
- [x] Integration with new Middleware layer

**New Middleware Files:**

- [x] `lib/stores/useClientStoreMiddleware.ts` — High-level hooks for integration
- [x] `lib/stores/safety-rules.ts` — 10 metabolic + performance rules
- [x] `lib/stores/feedback-emitter.ts` — Haptic + audio + visual feedback

### 2. 10 Metabolic & Performance Safety Rules

**Rules Implemented:**

| ID                     | Level       | Trigger                             | Action                    |
| ---------------------- | ----------- | ----------------------------------- | ------------------------- |
| METABOLIC_SAFETY_01    | 🔴 CRITICAL | Calories < BMR                      | Adjust to +10%            |
| PROTEIN_LEAN_MASS_01   | 🟡 WARNING  | Protein < 1.8g/kg LBM               | Adjust to 2.2g/kg         |
| CYCLE_LUTEAL_CARBS_01  | 🔵 ADVICE   | Luteal phase + low carbs            | Add +30g carbs            |
| PERF_INJURY_OVULATION  | 🟡 WARNING  | Female, ovulatory, high volume      | Cap intensity at 85%      |
| PERF_VOLUME_OVERLOAD   | 🔴 CRITICAL | High volume + poor recovery         | Apply -30% deload         |
| HYDRATION_PROTEIN_LINK | 🔵 ADVICE   | High protein + low water            | Increase to 4L/day        |
| BF_INCOHERENCE         | 🟡 WARNING  | Fast weight loss + no BF monitoring | Add skinfold measurements |
| SUPP_CREATINE_MISSING  | 🔵 ADVICE   | Hypertrophy goal, no creatine       | Add creatine protocol     |
| HR_KARVONEN_PRECISION  | 🔵 ADVICE   | RHR available, 220-age method       | Switch to Karvonen        |
| RECOVERY_SLEEP_DEBT    | 🟡 WARNING  | High volume + poor sleep            | Prioritize complex carbs  |

### 3. Feedback System

**Triggers on ALL rule changes:**

1. **Haptic Feedback** (mobile)
   - CRITICAL: `[200, 100, 200, 100, 200]` ms patterns
   - WARNING: `[100, 50, 100]`
   - ADVICE: `[50, 50, 50]`

2. **Audio Cues** (Web Audio API)
   - CRITICAL: 800 Hz sine wave (0.2s)
   - WARNING: 600 Hz (0.15s)
   - ADVICE: 400 Hz (0.1s)

3. **Card Flashing** (CSS animations)
   - `animate-flash-critical` — Red glow (600ms)
   - `animate-flash-warning` — Amber glow (500ms)
   - `animate-flash-advice` — Blue glow (400ms)

### 4. UI Components

**File:** `components/labs/SafetyAlertsPanel.tsx`

- Displays all active alerts grouped by level
- Shows rule ID, message, action button
- Auto-flashing on new alert activation
- Dismissal + action application UI

---

## 🔌 INTEGRATION POINTS

### In a Layout (e.g., app/layout.tsx)

```tsx
"use client";

import { useClientStoreMiddleware } from "@/lib/stores/useClientStoreMiddleware";

export function RootLayout({ children }: { children: React.ReactNode }) {
  // Initialize middleware (runs safety rule evaluation on every state change)
  useClientStoreMiddleware();

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

### In Calculator Components

**OLD (Phase 1) — Isolated state:**

```tsx
function OneRMCalculator() {
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);
  const [result, setResult] = useState<OneRMResult | null>(null);

  const calculate = () => {
    const res = calculate1RMBrzycki({ weight, reps });
    setResult(res);
  };

  return (
    <div>
      <input value={weight} onChange={(e) => setWeight(+e.target.value)} />
      <input value={reps} onChange={(e) => setReps(+e.target.value)} />
      <button onClick={calculate}>Calculate</button>
      {result && <div>{result.oneRM.toFixed(1)} kg</div>}
    </div>
  );
}
```

**NEW (Phase 2) — Connected to store:**

```tsx
import { useClientStore } from "@/lib/stores/useClientStore";
import { useClientProfileUpdate } from "@/lib/stores/useClientStoreMiddleware";

function OneRMCalculator() {
  const updateProfile = useClientProfileUpdate();
  const result = useClientStore((state) => state.results.oneRM);

  return (
    <div>
      <input
        value={useClientStore((state) => state.profile?.weight ?? "")}
        onChange={(e) => updateProfile({ weight: +e.target.value })}
      />
      <input
        value={useClientStore((state) => state.profile?.age ?? "")}
        onChange={(e) => updateProfile({ age: +e.target.value })}
      />
      {result && <div>{result.oneRM.toFixed(1)} kg</div>}
    </div>
  );
}
```

**Key Difference:** No manual recalculation needed. Update profile → store auto-recalculates → rules auto-evaluate → feedback fires

### Display Alerts

```tsx
import { SafetyAlertsPanel } from "@/components/labs/SafetyAlertsPanel";

function PerformanceLab() {
  return (
    <div>
      <h1>Performance Lab</h1>
      <SafetyAlertsPanel /> {/* Auto-updates as profile changes */}
    </div>
  );
}
```

---

## ⚙️ TECHNICAL ARCHITECTURE

### State Flow

```
User Input (weight, age, etc.)
    ↓
updateProfile() hook
    ↓
Zustand store state update
    ↓
Middleware detects change
    ↓
recalculateAll()
    ├→ calculate1RMBrzycki()
    ├→ calculateKarvonenZones()
    ├→ calculateMacros()
    ├→ calculateBodyFat()
    ├→ calculateWaterIntake()
    └→ calculateBMI()
    ↓
Safety rules evaluation
    ├→ METABOLIC_SAFETY_01 ?
    ├→ PROTEIN_LEAN_MASS_01 ?
    ├→ ... (10 rules)
    └→ RECOVERY_SLEEP_DEBT ?
    ↓
New alerts detected
    ├→ Haptic vibration
    ├→ Audio cue
    ├→ Card flash animation
    └→ Event listeners notified
```

### Devtools Integration

Open Redux Devtools in browser to inspect:

- All state mutations
- Full action history
- Time-travel debugging
- Rule evaluation snapshots

### Cooldown System

- Each rule has 3-second cooldown after feedback
- Prevents feedback spam for repeated violations
- Can be cleared via `feedbackEmitter.clearCooldown(ruleId)`

---

## 🧪 TESTING SAFETY RULES

### Scenario 1: Low Calorie Deficit (METABOLIC_SAFETY_01)

```tsx
// In browser console or test file
useClientStore.setState({
  profile: {
    weight: 75,
    age: 30,
    gender: "male",
    height: 180,
    activityLevel: "lightly-active",
    macroGoal: "cut",
    // ... other fields
  },
});

// Result: macros.tdee ~ 1900 cal
// If user sets deficit > BMR, CRITICAL alert fires
```

### Scenario 2: Female Cycle + Performance (PERF_INJURY_OVULATION)

```tsx
useClientStore.setState({
  profile: {
    gender: "female",
    cyclePhase: "ovulatory",
    workouts: 5,
    // ...
  },
});

// Result: WARNING alert with message about ligament laxity
```

### Scenario 3: Creatine + Hypertrophy (SUPP_CREATINE_MISSING)

```tsx
useClientStore.setState({
  profile: {
    macroGoal: "bulk",
    workouts: 4,
    supplements: [], // No creatine
    // ...
  },
});

// Result: ADVICE alert suggesting creatine add
```

---

## 📱 MOBILE EXPERIENCE

### Haptic Feedback

- Android: Native vibration API
- iOS: Requires iOS 13+ + Safari support
- Fallback: Visual feedback only

### Audio

- Works on all modern browsers (Web Audio API)
- Auto-mutes if browser has audio disabled
- Customizable frequencies per alert level

### Card Flash

- Pure CSS animation (no JavaScript jank)
- GPU-accelerated (transform + opacity)
- 400-600ms duration (attention-grabbing without jarring)

---

## ✅ VALIDATION CHECKLIST

- [ ] TypeScript compilation: `npx tsc --noEmit` = 0 errors
- [ ] Zustand middleware loads without errors
- [ ] Safety rules evaluate correctly
- [ ] Feedback fires on rule activation (haptic + audio + visual)
- [ ] useClientProfileUpdate triggers recalculation
- [ ] useClientStoreAlerts returns only active alerts
- [ ] useCardFlash animates cards on events
- [ ] SafetyAlertsPanel displays all alert levels
- [ ] CSS animations don't cause layout shift
- [ ] Devtools shows action history

---

## 🚀 NEXT STEPS (Phase 3)

- [ ] PDF export with alert snapshot
- [ ] Email digest of active alerts
- [ ] Prescription forms auto-filled from store
- [ ] Progress tracking over time
- [ ] Historical alert comparison

---

**Ready to proceed? Merge Phase 2 into main branch and test on staging.**
