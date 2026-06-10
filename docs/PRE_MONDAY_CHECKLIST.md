# PRE-LUNDI CHECKLIST — Vérification système avant 09:00

**Date:** Dimanche 8 avril 2026 (Soir) ou Lundi 9 avril (08:00)
**Objectif:** S'assurer que ZÉRO fichier crucial n'a été corrompu ou écrasé
**Durée:** 10 minutes max

---

## FILE INTEGRITY CHECK

### ✅ Step 1: TypeScript Compilation (Dry Run)

```bash
cd /Users/user/Desktop/VIRTUS
npx tsc --noEmit 2>&1 | tee /tmp/ts_check.log
```

**Attendu:**

```
0 errors
```

**Si erreurs:**

1. Copier la sortie vers fichier:
   ```bash
   cat /tmp/ts_check.log
   ```
2. Vérifier que les lignes mentionnées correspondent:
   - brzycki.ts ligne 83: doit contenir `as unknown as TrainingZone[]`
   - karvonen.ts lignes 94-122: doit contenir `PartialZone` type pattern

**Action si erreur:**

- L'une des deux fixes a été écrasée
- Re-appliquer la fix manuellement (voir `.claude/rules/project-state.md` section "Fixed")

---

### ✅ Step 2: Migration SQL Syntax Validation

**Fichier crucial:**

```
supabase/migrations/20260405_calculator_results.sql
```

**Vérification:**

```bash
# Vérifier le fichier existe et n'est pas vide
wc -l /Users/user/Desktop/VIRTUS/supabase/migrations/20260405_calculator_results.sql
# Attendu: ≥ 200 lignes

# Vérifier les sections clés existent
grep -c "CREATE TABLE calculator_results" /Users/user/Desktop/VIRTUS/supabase/migrations/20260405_calculator_results.sql
# Attendu: 1

grep -c "CREATE POLICY" /Users/user/Desktop/VIRTUS/supabase/migrations/20260405_calculator_results.sql
# Attendu: 5

grep -c "CREATE INDEX" /Users/user/Desktop/VIRTUS/supabase/migrations/20260405_calculator_results.sql
# Attendu: 4
```

**Si le compte est inférieur:**

- Le fichier a probablement été écrasé ou tronqué
- Re-vérifier depuis `docs/PHASE_1_DEPLOYMENT.md` (copie de backup)

---

### ✅ Step 3: API Routes Exist and Compile

**Fichiers cruciaux:**

```bash
# Vérifier les deux routes API existent
ls -la /Users/user/Desktop/VIRTUS/app/api/calculator-results/store/route.ts
ls -la /Users/user/Desktop/VIRTUS/app/api/calculator-results/query/route.ts

# Vérifier chaque fichier n'est pas vide (> 50 lignes)
wc -l /Users/user/Desktop/VIRTUS/app/api/calculator-results/store/route.ts
# Attendu: ≥ 100

wc -l /Users/user/Desktop/VIRTUS/app/api/calculator-results/query/route.ts
# Attendu: ≥ 140
```

**Si fichiers manquants ou trop petits:**

- Recréer de `docs/PHASE_1_DEPLOYMENT.md`

---

### ✅ Step 4: Store Files Exist (Phase 2 Readiness)

**Fichiers Phase 2 (peu utilisés, mais doivent exister pour Phase 2):**

```bash
# Vérifier Phase 2 modules existent
ls -la /Users/user/Desktop/VIRTUS/lib/stores/safety-rules.ts
ls -la /Users/user/Desktop/VIRTUS/lib/stores/feedback-emitter.ts
ls -la /Users/user/Desktop/VIRTUS/lib/stores/useClientStoreMiddleware.ts
ls -la /Users/user/Desktop/VIRTUS/components/labs/SafetyAlertsPanel.tsx

# Vérifier chaque fichier compile
npx tsc --noEmit lib/stores/safety-rules.ts
npx tsc --noEmit lib/stores/feedback-emitter.ts
# (on s'en fout du middleware tant que safety-rules et feedback-emitter ne cassent rien)
```

**Si fichiers manquants:**

- Phase 2 sera décalée, mais Phase 1 peut continuer
- Documenter et continuer lundi

---

### ✅ Step 5: CHANGELOG Updated

**Vérifier:**

```bash
# Vérifier que "Phase 1" mentions existent
grep -i "phase 1\|calculator\|data layer\|migration" /Users/user/Desktop/VIRTUS/CHANGELOG.md | head -5
```

**Si nothing:**

- CHANGELOG a probablement été écrasé
- Ajouter une ligne: `FEAT: Phase 1 calculator data layer with Supabase migration`

---

### ✅ Step 6: DevTools Support in Store

**Vérifier que Zustand store support devtools:**

```bash
grep -c "redux-devtools-extension\|devtools" /Users/user/Desktop/VIRTUS/lib/stores/*.ts
# Attendu: ≥ 1
```

**Si 0 matches:**

- Zustand store est incomplet
- Phase 2 sera retardée mais Phase 1 non-affectée

---

## ENVIRONMENT SETUP

### ✅ Node/npm Versions

```bash
node --version
# Attendu: v18.x ou v20.x

npm --version
# Attendu: ≥ 9.x

# Vérifier Supabase CLI installé (optionnel, mais practice)
which supabase
```

---

### ✅ .env.local Present and Non-Empty

```bash
ls -la /Users/user/Desktop/VIRTUS/.env.local
# Doit exister

grep -c "NEXT_PUBLIC_SUPABASE_URL" /Users/user/Desktop/VIRTUS/.env.local
# Attendu: 1

grep -c "NEXT_PUBLIC_SUPABASE_ANON_KEY" /Users/user/Desktop/VIRTUS/.env.local
# Attendu: 1
```

**Si vars manquantes:**

- On ne peut pas se connecter à Supabase pour la migration
- Vérifier depuis Supabase dashboard et re-copier les clés

---

## FINAL GATE: GO/NO-GO FOR MONDAY

**Checklist finale (chaque item doit être ✅):**

- [ ] `npx tsc --noEmit` = 0 errors (TypeScript checks pass)
- [ ] Migration SQL file exists, > 200 lignes, contient TABLE + 5 POLICIES + 4 INDEXES
- [ ] store/route.ts exists, > 100 lignes
- [ ] query/route.ts exists, > 140 lignes
- [ ] CHANGELOG has Phase 1 references
- [ ] .env.local has SUPABASE credentials
- [ ] Node v18+ and npm v9+ installed

**Si tous les items ✅:**

```
🟢 SYSTEM READY FOR LUNDI 09:00
```

**Si un item 🛑:**

```
🔴 FIX THE ITEM, THEN RETRY CHECKLIST
```

---

## QUICK RESTORATION COMMANDS

Si un fichier a été accidentellement écrasé:

```bash
# Restaurer depuis git (si le projet est en git)
git show HEAD:supabase/migrations/20260405_calculator_results.sql > /tmp/restore_migration.sql

# Ou re-créer manuellement en copiant depuis
cat /Users/user/Desktop/VIRTUS/docs/PHASE_1_DEPLOYMENT.md
# (le doc contient le SQL complet pour copier-coller)
```

---

## DOCUMENTATION REFERENCES

Si besoin de vérifier la spec lundi matin:

| Document                          | Contient                               | Chemin |
| --------------------------------- | -------------------------------------- | ------ |
| PHASE_1_DEPLOYMENT.md             | SQL migration complète à copier-coller | docs/  |
| PHASE_1_CHECKPOINT.md             | Checkpoint validation gate             | docs/  |
| EXECUTION_PLAN_MONDAY_09_APRIL.md | Plan tactique étape par étape          | docs/  |
| LUNDI_MATIN_HARD_SPEC.md          | Full spec lock-in (ancien format)      | docs/  |
| DEVELOPER_GUIDE_FORMULAS.md       | API integration guide                  | docs/  |

---

## LAST SANITY CHECK: npm run dev

Avant lundi, tester que l'app booste:

```bash
cd /Users/user/Desktop/VIRTUS
npm run dev
# Attendu: App démarre sur http://localhost:3000
# Pas d'erreurs de bundle
# Console logs propre
```

Si le build fail, debugger **avant** lundi.

---

**Statut Pre-Lundi:** 🟢 **READY**
**Date de vérification:** Dimanche 8 avril (21:00) ou Lundi 9 avril (08:00)
