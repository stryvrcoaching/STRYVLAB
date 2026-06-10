# PLAN D'EXÉCUTION LUNDI 9 AVRIL 2026

**Objectif:** Phase 1 Data Layer validation → Zustand injection (conditionnel)

**Statut Pre-Lundi:** ✅ Tous les fichiers prêts. Zéro déviation acceptée.

**Responsabilité:** Tester exactement comme spécifié. Go/No-Go décidé à chaque étape.

---

## TIMELINE LUNDI MATIN

### 09:00–09:15 — TypeScript Compilation

**Commande:**

```bash
cd /Users/user/Desktop/VIRTUS
npx tsc --noEmit
```

**Critère de succès:**

- Exit code: `0`
- Sortie: `0 errors` (aucun message d'erreur)

**Go/No-Go:**

- ✅ **GO**: Zéro erreur → Passer à l'étape suivante
- 🛑 **NO-GO**: Erreur détectée → Arrêter, déboguer, re-compiler

**Si erreur:** Copier la sortie complète, la comparer avec `lib/formulas/brzycki.ts` ligne 83 et `karvonen.ts` lignes 94-122. Si différent de la fix appliquée, elle a été écrasée.

---

### 09:15–09:30 — Supabase Migration Deployment

**Préparation:**

1. Ouvrir Supabase Dashboard: https://app.supabase.com
2. Sélectionner le projet VIRTUS
3. Aller à **SQL Editor** (menu gauche)
4. Cliquer **New Query**

**Fichier à déployer:**

```
supabase/migrations/20260405_calculator_results.sql
```

**Contenu que tu dois patcher (copier-coller entièrement):**

- 210 lignes
- CREATE TABLE calculator_results
- 5 RLS policies (SELECT, INSERT, UPDATE, user INSERT only, super admin)
- 4 indexes (client_id, calculator_type, created_at, formula_version)

**Exécution dans SQL Editor:**

1. Coller contenu migration
2. Cliquer **RUN** (en haut à droite)
3. Vérifier: Pas d'erreur SQL (success message: "Executed successfully")

**Critère de succès:**

- ✅ Table `calculator_results` visible dans **Tables** (menu gauche, refresh si nécessaire)
- ✅ 5 RLS policies visibles dans **Security → Policies**
- ✅ 4 indexes visibles dans table detail

**Go/No-Go:**

- ✅ **GO**: Table + RLS + indexes visibles → Passer à l'étape suivante
- 🛑 **NO-GO**: SQL error ou table n'existe pas → Vérifier la syntaxe, re-run query

**Si erreur SQL:** Copier le message d'erreur exactement. Vérifier:

- Pas de caractères de contrôle cachés
- Pas d'accents malformés dans les commentaires
- Vérifier que clients(id) table existe (dépendance FK)

---

### 09:30–09:45 — API Test: POST /api/calculator-results/store

**Paramètres de test:**

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "calculator_type": "oneRM",
  "input": {
    "weight_kg": 100,
    "reps": 5
  },
  "output": {
    "result_kg": 112.5,
    "confidence_margin": 0.08,
    "formula_used": "Brzycki"
  },
  "formula_version": "v1.0",
  "metadata": {
    "equipment": "barbell",
    "test_date": "2026-04-09"
  }
}
```

**Commande (Terminal):**

```bash
curl -X POST http://localhost:3000/api/calculator-results/store \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "550e8400-e29b-41d4-a716-446655440000",
    "calculator_type": "oneRM",
    "input": {"weight_kg": 100, "reps": 5},
    "output": {"result_kg": 112.5, "confidence_margin": 0.08, "formula_used": "Brzycki"},
    "formula_version": "v1.0",
    "metadata": {"equipment": "barbell", "test_date": "2026-04-09"}
  }'
```

**S'assurer que `npm run dev` tourne en parallèle** (voir Terminal 1).

**Critère de succès:**

HTTP Status: **201 Created**

Response body (exemple):

```json
{
  "id": "uuid-here",
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "calculator_type": "oneRM",
  "created_at": "2026-04-09T09:35:00.000Z"
}
```

**Go/No-Go:**

- ✅ **GO**: 201 + response structure OK → Passer au GET
- 🛑 **NO-GO**: 400, 500, ou malformed response → Vérifier `app/api/calculator-results/store/route.ts`

**Si erreur 400:** JSON validation error. Vérifier types dans `types/calculator.ts` et validateurs dans `lib/formulas/validators.ts`.

---

### 09:45–10:00 — API Test: GET /api/calculator-results/query

**Paramètres de test:**

```bash
curl "http://localhost:3000/api/calculator-results/query?client_id=550e8400-e29b-41d4-a716-446655440000&calculator_type=oneRM"
```

**Critère de succès:**

HTTP Status: **200 OK**

Response body (exemple):

```json
{
  "results": [
    {
      "id": "uuid",
      "client_id": "550e8400-e29b-41d4-a716-446655440000",
      "calculator_type": "oneRM",
      "input": { "weight_kg": 100, "reps": 5 },
      "output": { "result_kg": 112.5, ... },
      "created_at": "2026-04-09T09:35:00.000Z"
    }
  ],
  "total": 1,
  "timestamp": "2026-04-09T09:45:00.000Z"
}
```

**Go/No-Go:**

- ✅ **GO**: 200 + results array populated → Passer au CSV test
- 🛑 **NO-GO**: 400, 500, ou empty results → Vérifier query builder dans `app/api/calculator-results/query/route.ts`

---

### 10:00–10:10 — CSV Export Validation

**Test:**

```bash
curl "http://localhost:3000/api/calculator-results/query?client_id=550e8400-e29b-41d4-a716-446655440000&format=csv" \
  -H "Accept: text/csv" > /tmp/export_test.csv

# Vérifier le fichier
cat /tmp/export_test.csv
```

**Critère de succès:**

- ✅ Fichier CSV créé (non-vide)
- ✅ Headers: `id,client_id,calculator_type,input,output,created_at`
- ✅ Au moins 1 ligne de data
- ✅ Content-Type header: `text/csv`

**Go/No-Go:**

- ✅ **GO**: CSV valide → Passer aux vérifications finales
- 🛑 **NO-GO**: Fichier vide ou malformé → Vérifier CSV formatter dans route query

---

## PHASE 1 VALIDATION GATE: 5 ITEMS À COCHER

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] Migration Supabase déployée (table visible + RLS actif)
- [ ] POST /store retourne 201 (au moins 1 row inséré)
- [ ] GET /query retourne 200 (rows récupérées)
- [ ] CSV export valide (format correct, colonnes présentes)

**Si les 5 items ✅ → PHASE 1 VALIDÉE. Passer à Phase 2.**

**Si un item 🛑 → BLOQUÉ. Déboguer, puis retry l'étape.**

---

## 💾 PERSISTANCE LOCALSTORAGE vs TABLE

### Stratégie d'Injection Zustand (APRÈS Phase 1 ✅)

**Règle critique:** LocalStorage ne doit PAS entrer en conflit avec la table `calculator_results`.

**Architecture:**

```
User input
  ↓
useState → Zustand store (+ localStorage sync)
  ↓
On blur/submit:
  ├→ Validate input via Zod
  ├→ Call lib/formulas/* (pure functions)
  └→ POST to /api/calculator-results/store
      │
      ├→ Insert row en DB
      └→ Response includes ID + timestamp

  ↓
Store state + localStorage = IN SYNC
DB table = Source de vérité pour l'audit trail
```

### LocalStorage Schema (Après Phase 1 ✅)

Ne JAMAIS stocker les calculs complets en localStorage. Stocker UNIQUEMENT:

```json
{
  "profile": {
    "weight_kg": 85,
    "height_cm": 180,
    "rhr": 55,
    "age": 30,
    "sex": "M"
  },
  "lastCalculations": {
    "oneRM": "2026-04-09T10:05:00Z",
    "macros": "2026-04-09T10:05:00Z"
  }
}
```

**Pas de formula_version, pas d'output, pas d'input.** Juste l'état du formulaire.

### Quand Charger depuis DB (Après Phase 1 ✅)

Sur `app/profile/page.tsx` ou `app/results/page.tsx`:

```typescript
// Charger historique depuis DB (NOT localStorage)
const results = await fetch("/api/calculator-results/query?client_id=...").then(
  (r) => r.json(),
);

// Afficher timeline des calculs
results.results.forEach((r) => {
  console.log(`${r.calculator_type} @ ${r.created_at}: ${r.output.result}`);
});
```

### Conflit Prevention (Checklist)

- ✅ localStorage = formulaire input state ONLY
- ✅ localStorage ne stocke JAMAIS formules_version ou output
- ✅ db table = source de vérité pour audit trail
- ✅ Sur "New Calculation": localStorage cleared, fresh POST sent
- ✅ Sur navigation: localStorage restored si < 1 heure old

**Donc aucun conflit attendu.**

---

## POST-PHASE-1 CHECKLIST

Une fois Phase 1 ✅:

**Jeudi 10 avril (Morning):**

- [ ] Refactor OneRM, Macros, BodyFat components (useState → store hooks)
- [ ] Verify each calculator auto-saves to DB on input blur
- [ ] Test localStorage persistence + DB sync

**Jeudi 10 avril (Afternoon):**

- [ ] Inject SafetyAlertsPanel() en top level
- [ ] Test 3 safety rules triggers (calories issue, hydration, sleep)
- [ ] Verify haptic notification fires (mobile)

**Vendredi 11 avril:**

- [ ] Full system test: UI → Store → DB → CSV export
- [ ] Performance check (no N+1 queries, no localStorage bloat)
- [ ] Sign-off for production

---

## FALLBACK SCENARIOS

### Si POST /store échoue (400 ou 500)

**Diagnostic:**

1. Vérifier types dans `types/calculator.ts`
2. Vérifier validateurs dans `lib/formulas/validators.ts` (Zod schemas)
3. Vérifier que client_id UUID est valide (non-null, format correct)

**Fix:**

```typescript
// Si erreur Zod: augmenter les constraints dans validators.ts
// Si erreur DB: vérifier que clients(id) existe
```

---

### Si GET /query retourne vide array

**Diagnostic:**

1. Vérifier que le POST a effectivement inséré la row (check Supabase Table view directement)
2. Vérifier que client_id dans GET query match le POST

**Fix:**

```
SELECT * FROM calculator_results
WHERE client_id = '550e8400-e29b-41d4-a716-446655440000'
```

Via Supabase SQL Editor.

---

### Si CSV export fail

**Diagnostic:**

1. Vérifier que format=csv param est présent dans URL
2. Vérifier Content-Type header dans response est `text/csv`

**Fix:**

```typescript
// Dans app/api/calculator-results/query/route.ts
if (searchParams.get("format") === "csv") {
  response.headers.set("Content-Type", "text/csv");
  return new Response(csvContent);
}
```

---

## DECLARATION DE PRECISION

**STRYVR est un instrument chirurgical de précision. Rien ne devra jamais être approximé.**

Cette exécution lundi valide:

✅ Typage strict TypeScript (0 erreur) → Code correctness
✅ Migration Supabase (table + RLS) → Data integrity
✅ API endpoints (201 + 200) → Service correctness
✅ Persistence (DB + LocalStorage sync) → State consistency
✅ CSV export (format valide) → Reproducibility

**Le produit final sera perçu pour ce qu'il est: précision chirurgicale.**

---

**Date Exécution:** Lundi 9 avril 2026
**Statut:** 🟢 **READY** — Zéro blockers
**Responsable:** Exécution tactique conforme au plan

**Mission: Deploy Phase 1 sans déviation. ✅**
