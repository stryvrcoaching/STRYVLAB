# PHASE 1 DEPLOYMENT — QUICK START

**Démarrage Phase 1 (Semaine 1) : Refonte Data**
**Date:** 5 avril 2026
**Durée estimée:** 4 jours (Days 1-2: Migration + Types, Days 3-4: API testing)

---

## 🎯 OBJECTIVE

Sortir du stockage JSON brut. Créer une table typée `calculator_results` pour persister tous les résultats de calculatrices avec audit trail et versioning de formules.

**Outcome:** Calculs de toutes les calculatrices sont queryables, versionés, audit-tracés.

---

## 📥 WHAT'S BEEN CREATED

| File                                                  | Purpose                                    |
| ----------------------------------------------------- | ------------------------------------------ |
| `supabase/migrations/20260405_calculator_results.sql` | DB schema + RLS policies                   |
| `types/calculator.ts`                                 | TypeScript interfaces (8 calculator types) |
| `lib/formulas/types.ts`                               | Formula base types + confidence margins    |
| `lib/formulas/validators.ts`                          | Input validation for all calculators       |
| `lib/db/calculator-results.ts`                        | Service layer (CRUD)                       |
| `app/api/calculator-results/store/route.ts`           | POST endpoint (persist results)            |
| `app/api/calculator-results/query/route.ts`           | GET endpoint (retrieve + CSV export)       |
| `CHANGELOG.md`                                        | Updated with Phase 1 entries               |
| `docs/PHASE_1_CHECKPOINT.md`                          | Detailed validation checklist              |

---

## ⚡ DEPLOYMENT STEPS

### STEP 1: Apply Migration (5 minutes)

**Via Supabase Dashboard (RECOMMENDED):**

1. Go to: https://app.supabase.com → Select your project
2. Click: **SQL Editor** (left sidebar)
3. Click: **New Query**
4. Copy entire content from: `supabase/migrations/20260405_calculator_results.sql`
5. Paste into editor
6. Click: **RUN**

**Expected result:**

```
Query executed successfully
```

**Verify:**

- Go to **Tables** (left sidebar) → Should see `calculator_results` table
- Click on it → Should see 4 columns: `id`, `client_id`, `calculator_type`, `input`, `output`, `formula_version`, `metadata`, `created_at`, `updated_at`

### STEP 2: Verify TypeScript (2 minutes)

```bash
cd /Users/user/Desktop/VIRTUS

# Run TypeScript compiler
npx tsc --noEmit

# Should output: (nothing, 0 errors)
# If you see errors, they're related to types/calculator.ts or lib/formulas/
```

**Troubleshooting:**

- If errors: Run `npm install` first (ensure dependencies)
- If still errors: Send output to engineering lead

### STEP 3: Start Dev Server (1 minute)

```bash
npm run dev

# Should output:
# ▲ Next.js 15.1.3
# Local: http://localhost:3000
```

**Keep this terminal open for Step 4**

### STEP 4: Test API Endpoints (3 minutes)

**Open NEW terminal window** (keep dev server running):

```bash
# TEST 1: Health check
echo "=== Health Check ==="
curl -s http://localhost:3000/api/calculator-results/store | jq .

# Expected: { "status": "healthy", "message": "..." }

# TEST 2: Store a result
echo "=== Store Result ==="
curl -s -X POST http://localhost:3000/api/calculator-results/store \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "calculatorType": "oneRM",
    "input": {"weight": 100, "reps": 5},
    "output": {"oneRM": 113.6, "zones": [], "formula": "Brzycki"},
    "formulaVersion": "v1.0"
  }' | jq .

# Expected:
# {
#   "success": true,
#   "result": {
#     "id": "...",
#     "clientId": "550e8400-e29b-41d4-a716-446655440000",
#     ...
#   }
# }

# TEST 3: Query results
echo "=== Query Results ==="
curl -s "http://localhost:3000/api/calculator-results/query?clientId=550e8400-e29b-41d4-a716-446655440000" | jq .

# Expected: results array with 1 item

# TEST 4: CSV export
echo "=== CSV Export ==="
curl -s "http://localhost:3000/api/calculator-results/query?clientId=550e8400-e29b-41d4-a716-446655440000&format=csv" -o /tmp/test.csv
head /tmp/test.csv
```

**All tests must pass** ✅

---

## ✅ VALIDATION CHECKLIST

After deployment, verify:

- [ ] Migration applied in Supabase
- [ ] `calculator_results` table visible in Supabase dashboard
- [ ] RLS policies active (5 policies in Supabase UI)
- [ ] `npx tsc --noEmit` = 0 errors
- [ ] `npm run dev` runs without console errors
- [ ] API store endpoint returns 201 on POST
- [ ] API query endpoint returns 200 on GET
- [ ] CSV export returns text/csv MIME type
- [ ] Can insert & retrieve records from DB

**Once all ✅:** Phase 1 is COMPLETE. Ready for Phase 2.

---

## 📋 PHASE 1 BLOCKERS

**If any of these fail, STOP and resolve before proceeding:**

| Issue                                 | Solution                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Migration fails in Supabase           | Check SQL syntax, ensure you have admin role                              |
| TypeScript errors after `npm install` | Run `npm run build` to check for deeper issues                            |
| API returns 500                       | Check `.env.local` for Supabase credentials                               |
| Tests fail                            | Run each curl command individually, check response JSON for error details |

---

## 🧠 WHAT'S HAPPENING UNDER THE HOOD

### Before Phase 1

```
OneRMCalculator → state: { weight, reps } → calculates inline → stores in JSON responses[]
                                                                   (generic, non-queryable)
```

### After Phase 1

```
OneRMCalculator → calculate1RMBrzycki() from lib/formulas
                → { oneRM, zones, formula, formulaVersion, confidence }
                → POST /api/calculator-results/store
                → Stored in calculator_results table (typed, queryable, versioned)
                → Can query: GET /api/calculator-results/query?...
```

---

## 🚀 NEXT: Phase 2 Preparation

Once Phase 1 validation ✅ is complete:

**Semaine 2 (Phase 2):** Implement Zustand store

- Create `lib/stores/useClientStore.ts`
- Refactor OneRM, Macros, BodyFat, HRZones to use store
- Remove isolated `useState` hooks
- Enable cross-component reactivity

---

## 🆘 SUPPORT

If you get stuck:

1. **Check:** `docs/PHASE_1_CHECKPOINT.md` (detailed validation)
2. **Check:** `docs/MEMORANDUM_IMPLEMENTATION_AUDIT.md` (full context)
3. **Check:** `CHANGELOG.md` (what changed)
4. **Ask:** Lead developer

---

**Status:** 🟢 Ready to Deploy
**Estimated Time:** 15-20 minutes
**Risk Level:** 🟢 LOW (Backward-compatible, no breaking changes)

Go! 🚀
