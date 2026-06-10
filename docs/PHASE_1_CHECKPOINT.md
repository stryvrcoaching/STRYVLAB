# PHASE 1 — CHECKPOINT VALIDATION & DEPLOYMENT

**Date:** 5 avril 2026
**Phase:** Refonte Data (Semaine 1)
**Status:** ✅ Implementation Complete — Ready for Deployment & Validation

---

## 📋 CHECKLIST PRÉ-DÉPLOIEMENT

### Step 1: Apply Migration to Supabase

**Action:** Appliquer la migration calculator_results à Supabase

```bash
# Option A: Via Supabase Dashboard (RECOMMENDED for Phase 1)
# 1. Go to: https://app.supabase.com → Your Project → SQL Editor
# 2. Create new query
# 3. Copy entire content from: supabase/migrations/20260405_calculator_results.sql
# 4. Click "RUN"
# 5. Verify: "calculator_results" table appears in Tables list

# Option B: Via CLI (if configured)
npx supabase db push
```

**Expected Output:**

```
✓ Table "calculator_results" created
✓ Indexes created (client, type, date)
✓ RLS enabled
✓ Policies created (select_coach, select_client, insert, update)
✓ Trigger created (update_timestamp)
```

**Validation:**

- [ ] Table exists in Supabase dashboard
- [ ] RLS is ENABLED (check in "Authentication" → "Policies")
- [ ] All 5 policies are active (can view in Policies tab)

---

### Step 2: TS Compilation Check

```bash
cd /Users/user/Desktop/VIRTUS

# Run TypeScript compiler
npx tsc --noEmit

# Expected: 0 errors
# If errors exist:
# - Check lib/formulas/*.ts for type issues
# - Check types/calculator.ts for interface conflicts
# - Fix and re-run
```

**Validation:**

- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] `npm run dev` starts without console errors

---

### Step 3: Test Database Connection

```bash
# Create test file temporarily
cat > test-db-connection.ts << 'EOF'
import { createClient } from '@/lib/supabase/client'

async function test() {
  const supabase = createClient()
  const { data, error } = await supabase.from('calculator_results').select('count(*)').single()
  if (error) console.error('❌ Connection failed:', error)
  else console.log('✅ Connection successful')
}

test()
EOF

# Run via Node.js or integrate into test suite
# Then delete test file
```

**Validation:**

- [ ] Can query calculator_results table
- [ ] RLS policies allow auth'd coach/client reads

---

### Step 4: API Endpoints Health Check

```bash
# Start dev server (if not already running)
npm run dev

# In separate terminal, test endpoints:

# Test 1: Store endpoint (should accept POST)
curl -X POST http://localhost:3000/api/calculator-results/store \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "calculatorType": "oneRM",
    "input": {"weight": 100, "reps": 5},
    "output": {"oneRM": 113.6, "zones": []},
    "formulaVersion": "v1.0"
  }'

# Expected:
# - 201 status (created)
# - success: true
# - result object with id, createdAt

# Test 2: Query endpoint (should accept GET)
curl "http://localhost:3000/api/calculator-results/query?clientId=550e8400-e29b-41d4-a716-446655440000"

# Expected:
# - 200 status
# - success: true
# - results array (empty if no data yet)
```

**Validation:**

- [ ] POST /api/calculator-results/store returns 201 on valid input
- [ ] GET /api/calculator-results/query returns 200 with results
- [ ] Invalid input returns 400 with validation errors
- [ ] CSV export works: `?format=csv` returns text/csv MIME type

---

### Step 5: Formula Imports Check

```bash
# Verify lib/formulas imports work
npm run dev

# In browser console or Node.js:
import { calculate1RMBrzycki, calculateKarvonenZones } from '@/lib/formulas'

calculate1RMBrzycki({ weight: 100, reps: 5 })
// Should return: { oneRM: 113.6, zones: [...], formula: 'Brzycki', ... }
```

**Validation:**

- [ ] Formulas are importable from lib/formulas/index.ts
- [ ] Formula outputs include confidence intervals
- [ ] Formula outputs include formulaVersion

---

### Step 6: Schema Integrity Audit

```bash
# Verify types/calculator.ts exports are correct
npx tsc --noEmit types/calculator.ts

# Expected: 0 errors for types/calculator.ts
```

**Validation:**

- [ ] types/calculator.ts compiles without errors
- [ ] All 8 calculator types defined (OneRM, Karvonen, Macros, BodyFat, Water, BMI, etc.)
- [ ] CalculatorResultRecord interface matches DB schema

---

## ✅ PHASE 1 VALIDATION GATE

**Before proceeding to Phase 2, ALL of the following must be true:**

- [ ] **TypeScript strict mode:** `npx tsc --noEmit` = **0 ERRORS**
- [ ] **Migration applied:** Table appears in Supabase dashboard
- [ ] **RLS active:** 5 policies visible in Supabase Policies tab
- [ ] **Formulas centralized:** All math in lib/formulas/, zero formulas in components
- [ ] **API endpoints healthy:** POST & GET work, CSV export works
- [ ] **Database queryable:** Can insert → query → get results
- [ ] **CHANGELOG.md updated:** SCHEMA + REFACTOR entries present
- [ ] **No unused useState:** Original calculators still work, prep for refactoring

---

## 📊 PHASE 1 DELIVERABLES (COMPLETED)

| Component                  | File                                                  | Status     |
| -------------------------- | ----------------------------------------------------- | ---------- |
| **Migration**              | `supabase/migrations/20260405_calculator_results.sql` | ✅ Created |
| **Types**                  | `types/calculator.ts`                                 | ✅ Created |
| **Formula Types**          | `lib/formulas/types.ts`                               | ✅ Created |
| **Formula Validators**     | `lib/formulas/validators.ts`                          | ✅ Created |
| **Service Layer**          | `lib/db/calculator-results.ts`                        | ✅ Created |
| **API Store**              | `app/api/calculator-results/store/route.ts`           | ✅ Created |
| **API Query**              | `app/api/calculator-results/query/route.ts`           | ✅ Created |
| **Formulas Already Exist** | `lib/formulas/{oneRM,karvonen,macros,etc}.ts`         | ✅ Present |
| **CHANGELOG**              | `CHANGELOG.md`                                        | ✅ Updated |
| **Documentation**          | This checkpoint                                       | ✅ Created |

---

## 🚨 BLOCKING ISSUES (If Any)

**If TypeScript errors exist:**
→ Check file paths, types/calculator.ts exports, lib/formulas/index.ts imports

**If migration fails:**
→ Ensure RLS key has permissions, check syntax in Supabase SQL Editor

**If API returns 500:**
→ Check Supabase credentials in .env.local, verify table permissions, check browser console

---

## 📞 NEXT STEP

Once **ALL** validation items ✅ are complete:

**PROCEED TO PHASE 2 (Semaine 2)**

- [ ] Implement Zustand store (`lib/stores/useClientStore.ts`)
- [ ] Refactor components to use store (OneRM, Macros, BodyFat, HRZones, BMI)
- [ ] Remove isolated useState hooks
- [ ] Implement cross-component reactivity

---

## 📝 DEPLOYMENT NOTES

- **Environment:** All changes are backward-compatible
- **Rollback:** If issues arise, table can be dropped: `DROP TABLE calculator_results;`
- **Data Migration:** No migration from old JSON storage needed yet (Phase 2 will wire it)
- **Zero Breaking Changes:** Existing components continue to work

---

**Validation Date:** [To be filled on deployment]
**Validator:** [Team member name]
**Status:** ⏳ Awaiting deployment
