# Muscle Primary/Secondary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter `primary_muscles` et `secondary_muscles` sur `coach_program_template_exercises`, exposer ces données sur `program_exercises` à l'assignation, afficher 3 états visuels sur le BodyMap (primaire vert plein / secondaire vert pâle / inactif gris), et permettre au coach d'éditer les muscles inline dans le `ProgramTemplateBuilder`.

**Architecture:** Migration DB → propagation API save/assign → mise à jour `muscleDetection.ts` pour retourner primaire+secondaire → BodyMap reçoit deux Sets → UI coach inline dans chaque ligne d'exercice du builder.

**Tech Stack:** Supabase SQL migrations, Next.js App Router API routes, TypeScript strict, React client components, SVG inline DS v2.0.

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `supabase/migrations/20260416_exercise_muscles.sql` | Créer | Ajouter `primary_muscles text[]` + `secondary_muscles text[]` sur les deux tables |
| `lib/client/muscleDetection.ts` | Modifier | Retourner `{ primary: Set<MuscleGroup>, secondary: Set<MuscleGroup> }` |
| `components/client/BodyMap.tsx` | Modifier | Accepter `primaryGroups` + `secondaryGroups`, 3 états visuels |
| `app/client/programme/page.tsx` | Modifier | Passer `primaryGroups`+`secondaryGroups` au BodyMap |
| `app/client/programme/recap/[sessionLogId]/page.tsx` | Modifier | Idem si BodyMap utilisé |
| `components/programs/ProgramTemplateBuilder.tsx` | Modifier | Interface `Exercise` + inline muscle pickers + `updateExercise` |
| `app/api/program-templates/route.ts` | Modifier | Inclure `primary_muscles` + `secondary_muscles` dans l'insert |
| `app/api/program-templates/[templateId]/route.ts` | Modifier | Inclure les deux colonnes dans GET select + PUT insert |

---

## Task 1 : Migration DB

**Files:**
- Create: `supabase/migrations/20260416_exercise_muscles.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================
-- EXERCISE MUSCLES — primary_muscles + secondary_muscles
--
-- Ajout sur coach_program_template_exercises (templates coach)
-- et program_exercises (programmes assignés aux clients)
-- ============================================================

-- 1. Templates
alter table public.coach_program_template_exercises
  add column if not exists primary_muscles   text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}';

comment on column public.coach_program_template_exercises.primary_muscles is
  'Muscles principaux sollicités. Valeurs : chest | shoulders | biceps | triceps | abs | quads | hamstrings | glutes | calves | back_upper | back_lower | traps';

comment on column public.coach_program_template_exercises.secondary_muscles is
  'Muscles secondaires sollicités (même enum que primary_muscles)';

-- 2. Programmes assignés
alter table public.program_exercises
  add column if not exists primary_muscles   text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}';

comment on column public.program_exercises.primary_muscles is
  'Copié depuis coach_program_template_exercises à l''assignation. Même enum.';

comment on column public.program_exercises.secondary_muscles is
  'Copié depuis coach_program_template_exercises à l''assignation. Même enum.';
```

- [ ] **Step 2 : Appliquer la migration**

```bash
npx supabase db push
# OU via MCP :
# mcp__supabase__apply_migration avec le contenu ci-dessus
```

Résultat attendu : 0 erreur, les 4 nouvelles colonnes apparaissent dans Supabase Studio.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260416_exercise_muscles.sql
git commit -m "schema: add primary_muscles + secondary_muscles to template and program exercises"
```

---

## Task 2 : Mettre à jour `muscleDetection.ts`

**Files:**
- Modify: `lib/client/muscleDetection.ts`

- [ ] **Step 1 : Réécrire le module**

Remplacer le contenu entier de `lib/client/muscleDetection.ts` par :

```typescript
// Logique pure — pas de 'use client', utilisable dans les Server Components

export type MuscleGroup =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'back_upper'
  | 'back_lower'
  | 'traps'

export interface MuscleActivation {
  primary: Set<MuscleGroup>
  secondary: Set<MuscleGroup>
}

// Fallback regex sur le nom — utilisé uniquement si primary_muscles est vide
const MUSCLE_KEYWORDS: Record<MuscleGroup, RegExp> = {
  chest:      /pectoral|pec deck|développé couché|développé incliné|développé haltères|dips pecto|écarté|chest/i,
  shoulders:  /militaire|épaule|élévation|shoulder|delt|développé nuque|oiseau|reverse fly/i,
  biceps:     /curl|bicep|marteau|hammer/i,
  triceps:    /tricep|extension (aux |à la |poulie)|dips/i,
  abs:        /crunch|planche|dead bug|abdomi|core|lombaire/i,
  quads:      /squat|leg press|leg extension|presse à cuisses|hack squat/i,
  hamstrings: /leg curl|ischio|soulevé de terre|roumain|jambes tendues/i,
  glutes:     /hip thrust|fessier|glute|soulevé roumain/i,
  calves:     /mollet|calf|calf raise/i,
  back_upper: /tirage|rowing|traction|pulldown|dos|trapèze supérieur|poulie haute/i,
  back_lower: /extension lombaire|hyperextension|soulevé de terre/i,
  traps:      /trapèze|shrug/i,
}

// Exercice avec métadonnées DB (optionnelles)
export interface ExerciseInput {
  name: string
  primary_muscles?: string[]
  secondary_muscles?: string[]
}

/**
 * Détecte les groupes musculaires actifs depuis une liste d'exercices.
 * Priorité : colonnes DB (primary_muscles / secondary_muscles) → fallback regex sur le nom.
 * Un muscle ne peut pas être à la fois primaire ET secondaire : primaire gagne.
 */
export function detectMuscleGroups(exercises: ExerciseInput[]): MuscleActivation {
  const primary = new Set<MuscleGroup>()
  const secondary = new Set<MuscleGroup>()

  for (const ex of exercises) {
    const hasPrimary = ex.primary_muscles && ex.primary_muscles.length > 0
    const hasSecondary = ex.secondary_muscles && ex.secondary_muscles.length > 0

    if (hasPrimary || hasSecondary) {
      // Source DB — fiable
      for (const m of (ex.primary_muscles ?? [])) {
        if (isValidMuscleGroup(m)) primary.add(m as MuscleGroup)
      }
      for (const m of (ex.secondary_muscles ?? [])) {
        if (isValidMuscleGroup(m) && !primary.has(m as MuscleGroup)) {
          secondary.add(m as MuscleGroup)
        }
      }
    } else {
      // Fallback regex — tous mis en primaire (comportement legacy)
      for (const [group, regex] of Object.entries(MUSCLE_KEYWORDS) as [MuscleGroup, RegExp][]) {
        if (regex.test(ex.name)) primary.add(group)
      }
    }
  }

  // Garantie : si un muscle est primaire dans un exercice et secondaire dans un autre,
  // il reste primaire (déjà géré par le `!primary.has` ci-dessus, mais on nettoie ici)
  for (const m of primary) secondary.delete(m)

  return { primary, secondary }
}

const VALID_MUSCLE_GROUPS = new Set<string>([
  'chest','shoulders','biceps','triceps','abs',
  'quads','hamstrings','glutes','calves','back_upper','back_lower','traps'
])

function isValidMuscleGroup(m: string): boolean {
  return VALID_MUSCLE_GROUPS.has(m)
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "muscleDetection"
```

Résultat attendu : aucune ligne (0 erreur dans ce fichier).

- [ ] **Step 3 : Commit**

```bash
git add lib/client/muscleDetection.ts
git commit -m "refactor(muscleDetection): primary/secondary split, DB source priority over regex fallback"
```

---

## Task 3 : Mettre à jour `BodyMap.tsx`

**Files:**
- Modify: `components/client/BodyMap.tsx`

- [ ] **Step 1 : Modifier les props et les helpers de couleur**

Remplacer le bloc de constantes + interface + début du composant (lignes 1–33 environ) :

```typescript
'use client'

import type { MuscleGroup } from '@/lib/client/muscleDetection'

// DS v2.0 — 3 états visuels
const PRIMARY_COLOR   = '#1f8a65'                    // vert plein — muscle principal
const SECONDARY_COLOR = 'rgba(31,138,101,0.28)'      // vert pâle — muscle secondaire
const INACTIVE_FILL   = 'rgba(255,255,255,0.08)'     // gris neutre — inactif
const STROKE_PRIMARY   = 'rgba(31,138,101,0.35)'
const STROKE_SECONDARY = 'rgba(31,138,101,0.18)'
const STROKE_INACTIVE  = 'rgba(255,255,255,0.10)'
const OUTLINE_COLOR    = 'rgba(255,255,255,0.12)'
const NEUTRAL_FILL     = 'rgba(255,255,255,0.07)'

interface Props {
  primaryGroups:   Set<MuscleGroup>
  secondaryGroups: Set<MuscleGroup>
  className?: string
}

export default function BodyMap({ primaryGroups, secondaryGroups, className = '' }: Props) {
  function f(group: MuscleGroup): string {
    if (primaryGroups.has(group))   return PRIMARY_COLOR
    if (secondaryGroups.has(group)) return SECONDARY_COLOR
    return INACTIVE_FILL
  }
  function s(group: MuscleGroup): string {
    if (primaryGroups.has(group))   return STROKE_PRIMARY
    if (secondaryGroups.has(group)) return STROKE_SECONDARY
    return STROKE_INACTIVE
  }
  function sw(group: MuscleGroup): string {
    if (primaryGroups.has(group))   return '1.5'
    if (secondaryGroups.has(group)) return '1.0'
    return '0.6'
  }
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "BodyMap"
```

Résultat attendu : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add components/client/BodyMap.tsx
git commit -m "feat(BodyMap): 3-state visual — primary green / secondary pale green / inactive grey"
```

---

## Task 4 : Mettre à jour les pages client qui utilisent BodyMap

**Files:**
- Modify: `app/client/programme/page.tsx`
- Modify: `app/client/programme/recap/[sessionLogId]/page.tsx` (si BodyMap présent)

- [ ] **Step 1 : Mettre à jour `app/client/programme/page.tsx`**

1a. Dans la requête Supabase, ajouter `primary_muscles, secondary_muscles` dans le select des `program_exercises` :

```typescript
program_exercises (
  id, name, sets, reps, rest_sec, rir, notes, position,
  primary_muscles, secondary_muscles
)
```

1b. Remplacer l'appel à `detectMuscleGroups` :

```typescript
// AVANT
const activeGroups = detectMuscleGroups(todayExercises.map((e: any) => e.name))

// APRÈS
const { primary: primaryGroups, secondary: secondaryGroups } = detectMuscleGroups(
  todayExercises.map((e: any) => ({
    name: e.name,
    primary_muscles:   e.primary_muscles   ?? [],
    secondary_muscles: e.secondary_muscles ?? [],
  }))
)
```

1c. Mettre à jour le JSX du `<BodyMap>` :

```tsx
<BodyMap primaryGroups={primaryGroups} secondaryGroups={secondaryGroups} />
```

- [ ] **Step 2 : Vérifier si BodyMap est utilisé dans le récap**

```bash
grep -r "BodyMap" /Users/user/Desktop/VIRTUS/app/client/programme/recap/
```

Si présent, appliquer le même pattern (select + detectMuscleGroups + props).

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "programme/page\|recap"
```

Résultat attendu : 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add app/client/programme/page.tsx
git commit -m "feat(programme): pass primary/secondary muscle groups to BodyMap"
```

---

## Task 5 : UI coach inline dans `ProgramTemplateBuilder`

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 1 : Mettre à jour l'interface `Exercise`**

Ajouter les deux champs à l'interface existante (ligne ~106) :

```typescript
interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_sec: number | null;
  rir: number | null;
  notes: string;
  image_url: string | null;
  movement_pattern: string | null;
  equipment_required: string[];
  primary_muscles: string[];    // ← nouveau
  secondary_muscles: string[];  // ← nouveau
}
```

- [ ] **Step 2 : Mettre à jour `emptyExercise()`**

```typescript
function emptyExercise(): Exercise {
  return {
    name: "",
    sets: 3,
    reps: "8-12",
    rest_sec: 90,
    rir: 2,
    notes: "",
    image_url: null,
    movement_pattern: null,
    equipment_required: [],
    primary_muscles: [],    // ← nouveau
    secondary_muscles: [],  // ← nouveau
  }
}
```

- [ ] **Step 3 : Mettre à jour le mapping `initial` → `sessions`**

Dans le `useEffect` ou mapping initial (ligne ~203), ajouter les deux champs :

```typescript
exercises: (s.coach_program_template_exercises ?? [])
  .sort((a: any, b: any) => a.position - b.position)
  .map((e: any) => ({
    name:               e.name ?? '',
    sets:               e.sets ?? 3,
    reps:               e.reps ?? '8-12',
    rest_sec:           e.rest_sec ?? null,
    rir:                e.rir ?? null,
    notes:              e.notes ?? '',
    image_url:          e.image_url ?? null,
    movement_pattern:   e.movement_pattern ?? null,
    equipment_required: e.equipment_required ?? [],
    primary_muscles:    e.primary_muscles   ?? [],  // ← nouveau
    secondary_muscles:  e.secondary_muscles ?? [],  // ← nouveau
  }))
```

- [ ] **Step 4 : Ajouter la constante des groupes musculaires disponibles**

En haut du fichier (après les imports) :

```typescript
const MUSCLE_GROUPS: { slug: string; label: string }[] = [
  { slug: 'chest',      label: 'Pectoraux' },
  { slug: 'shoulders',  label: 'Épaules' },
  { slug: 'biceps',     label: 'Biceps' },
  { slug: 'triceps',    label: 'Triceps' },
  { slug: 'abs',        label: 'Abdos' },
  { slug: 'back_upper', label: 'Dos (haut)' },
  { slug: 'back_lower', label: 'Lombaires' },
  { slug: 'traps',      label: 'Trapèzes' },
  { slug: 'quads',      label: 'Quadriceps' },
  { slug: 'hamstrings', label: 'Ischios' },
  { slug: 'glutes',     label: 'Fessiers' },
  { slug: 'calves',     label: 'Mollets' },
]
```

- [ ] **Step 5 : Ajouter le muscle picker inline dans chaque ligne d'exercice**

Dans le JSX de chaque exercice (après la grille sets/reps/repos/rir, avant la section image), insérer :

```tsx
{/* ── Muscles ── */}
<div className="border-t border-white/[0.06] pt-2 flex flex-col gap-1.5">
  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">
    Muscles principaux
  </p>
  <div className="flex flex-wrap gap-1">
    {MUSCLE_GROUPS.map(({ slug, label }) => {
      const active = ex.primary_muscles.includes(slug)
      return (
        <button
          key={slug}
          type="button"
          onClick={() => {
            const next = active
              ? ex.primary_muscles.filter((m) => m !== slug)
              : [...ex.primary_muscles, slug]
            // Si on ajoute en primaire, retirer des secondaires
            const sec = ex.secondary_muscles.filter((m) => m !== slug)
            updateExercise(si, ei, { primary_muscles: next, secondary_muscles: sec })
          }}
          className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
            active
              ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
              : 'bg-white/[0.04] text-white/35 hover:text-white/60 hover:bg-white/[0.07]'
          }`}
        >
          {label}
        </button>
      )
    })}
  </div>

  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mt-0.5">
    Muscles secondaires
  </p>
  <div className="flex flex-wrap gap-1">
    {MUSCLE_GROUPS.map(({ slug, label }) => {
      const isPrimary   = ex.primary_muscles.includes(slug)
      const isSecondary = ex.secondary_muscles.includes(slug)
      return (
        <button
          key={slug}
          type="button"
          disabled={isPrimary}
          onClick={() => {
            const next = isSecondary
              ? ex.secondary_muscles.filter((m) => m !== slug)
              : [...ex.secondary_muscles, slug]
            updateExercise(si, ei, { secondary_muscles: next })
          }}
          className={`px-2 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
            isPrimary
              ? 'opacity-20 cursor-not-allowed bg-white/[0.02] text-white/20'
              : isSecondary
              ? 'bg-[#1f8a65]/10 text-[#1f8a65]/60 border border-[#1f8a65]/20'
              : 'bg-white/[0.04] text-white/35 hover:text-white/60 hover:bg-white/[0.07]'
          }`}
        >
          {label}
        </button>
      )
    })}
  </div>
</div>
```

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramTemplateBuilder"
```

Résultat attendu : 0 erreur.

- [ ] **Step 7 : Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(builder): inline muscle picker (primary/secondary) per exercise"
```

---

## Task 6 : Propager dans les API routes de sauvegarde

**Files:**
- Modify: `app/api/program-templates/route.ts` (POST — création)
- Modify: `app/api/program-templates/[templateId]/route.ts` (GET select + PUT update)

- [ ] **Step 1 : `route.ts` POST — ajouter les colonnes dans l'insert**

Dans le `.insert()` de `coach_program_template_exercises` (ligne ~84) :

```typescript
s.exercises.map((e: any, ei: number) => ({
  session_id:         session.id,
  name:               e.name,
  sets:               e.sets ?? 3,
  reps:               e.reps ?? '8-12',
  rest_sec:           e.rest_sec ?? null,
  rir:                e.rir ?? null,
  notes:              e.notes ?? null,
  position:           ei,
  image_url:          e.image_url ?? null,
  movement_pattern:   e.movement_pattern ?? null,
  equipment_required: e.equipment_required ?? [],
  primary_muscles:    e.primary_muscles   ?? [],  // ← nouveau
  secondary_muscles:  e.secondary_muscles ?? [],  // ← nouveau
}))
```

- [ ] **Step 2 : `[templateId]/route.ts` GET — ajouter dans le select**

Dans la requête `.select()` initiale, ajouter `primary_muscles, secondary_muscles` dans `coach_program_template_exercises (...)`.

- [ ] **Step 3 : `[templateId]/route.ts` PUT — ajouter dans l'insert des exercices**

Même pattern que Step 1, dans le bloc d'upsert/insert des exercices de la route PUT.

- [ ] **Step 4 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "program-templates"
```

Résultat attendu : 0 erreur liée à ce fichier.

- [ ] **Step 5 : Commit**

```bash
git add app/api/program-templates/route.ts app/api/program-templates/\[templateId\]/route.ts
git commit -m "feat(api): persist primary_muscles + secondary_muscles in template exercises"
```

---

## Task 7 : Propagation à l'assignation (programs assignés)

**Files:**
- Modify: `app/api/program-templates/[templateId]/assign/route.ts` (ou équivalent)

- [ ] **Step 1 : Trouver la route d'assignation**

```bash
find /Users/user/Desktop/VIRTUS/app/api -name "*.ts" | xargs grep -l "program_exercises" 2>/dev/null
```

- [ ] **Step 2 : Ajouter les colonnes dans l'insert vers `program_exercises`**

Dans le mapping qui copie les exercices du template vers `program_exercises`, ajouter :

```typescript
{
  // ... colonnes existantes ...
  primary_muscles:    e.primary_muscles   ?? [],
  secondary_muscles:  e.secondary_muscles ?? [],
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "assign"
```

- [ ] **Step 4 : Commit**

```bash
git add app/api/program-templates/\[templateId\]/assign/route.ts
git commit -m "feat(assign): propagate primary_muscles + secondary_muscles to program_exercises on assignment"
```

---

## Task 8 : CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1 : Mettre à jour CHANGELOG.md**

Ajouter sous `## 2026-04-16` :

```
SCHEMA: coach_program_template_exercises + program_exercises — add primary_muscles text[] + secondary_muscles text[]
FEATURE: muscleDetection — primary/secondary split, DB columns priority over regex fallback
FEATURE: BodyMap — 3-state visual: primary (#1f8a65 full) / secondary (#1f8a65 28% opacity) / inactive (grey)
FEATURE: ProgramTemplateBuilder — inline muscle picker chips per exercise (primary + secondary rows)
FEATURE: api/program-templates — persist + propagate primary_muscles + secondary_muscles
```

- [ ] **Step 2 : Mettre à jour project-state.md**

Ajouter une section datée `## 2026-04-16 — Muscles primaires/secondaires` avec les fichiers modifiés, le comportement (fallback regex si colonnes vides), et les next steps (UI coach sur programmes assignés directs, pas seulement templates).

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for primary/secondary muscles feature"
```

---

## Self-Review

**Spec coverage :**
- ✅ Migration DB sur les deux tables
- ✅ `muscleDetection` retourne `{ primary, secondary }` avec fallback regex
- ✅ `BodyMap` 3 états visuels
- ✅ Pages client mises à jour
- ✅ UI coach inline (chips primary/secondary)
- ✅ API save (POST + PUT) persiste les deux colonnes
- ✅ Propagation à l'assignation

**Points de vigilance :**
- Un muscle grisé dans la row "secondaires" quand il est déjà primaire (disabled + opacité) — UX claire
- Le fallback regex met tout en primaire (comportement legacy préservé)
- La contrainte "primaire prime sur secondaire" est appliquée dans `detectMuscleGroups` ET dans le picker coach
- Les exercices des programmes assignés existants auront `primary_muscles = []` → fallback regex automatique (rétrocompatible)
