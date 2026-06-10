# Biomechanics Engine Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le moteur de scoring intelligence avec morpho dans `scoreRedundancy`, SRA heatmap 4 semaines, coach overrides de coefficients en Lab Mode, et amélioration de la qualité des alertes.

**Architecture:** Le moteur existe déjà (`lib/programs/intelligence/scoring.ts`, 800 lignes). Phase 2 ajoute 3 nouvelles fonctionnalités : (1) morpho adjustments dans `scoreRedundancy` pour distinguer bilatéral/unilatéral selon les asymétries, (2) SRA heatmap sur 4 semaines exportée de `scoreSRA` et rendue dans `LabModeSection`, (3) un hook `useLabOverrides` permettant au coach de surcharger les coefficients stimulus par pattern dans le Lab Mode. Les alertes existantes sont aussi enrichies avec des valeurs précises et des suggestions concrètes.

**Tech Stack:** TypeScript strict, Vitest, React, Tailwind DS v2.0 (`#121212` bg, `#8b5cf6` Lab accent, `#1f8a65` green accent).

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `lib/programs/intelligence/scoring.ts` | Modifier | `scoreRedundancy` + morpho param, `scoreSRA` + 4-week heatmap export |
| `lib/programs/intelligence/types.ts` | Modifier | Nouveaux types : `SRAHeatmapWeek`, `LabOverrides` |
| `lib/programs/intelligence/index.ts` | Modifier | `useProgramIntelligence` accepte `labOverrides?: LabOverrides` (5e param) |
| `components/programs/studio/LabModeSection.tsx` | Modifier | Afficher SRA heatmap + contrôles lab overrides |
| `tests/lib/intelligence/biomechanics-phase2.test.ts` | Créer | Tests scoreRedundancy avec morpho + SRA heatmap |

---

## Task 1 : scoreRedundancy avec morpho asymmetry adjustments

**Files:**
- Modify: `lib/programs/intelligence/types.ts`
- Modify: `lib/programs/intelligence/scoring.ts`
- Create: `tests/lib/intelligence/biomechanics-phase2.test.ts`

**Contexte :**
Actuellement `scoreRedundancy` ne prend pas en compte les ajustements morpho. Si un client a une asymétrie bras >2cm, un exercice bilatéral (bench press) et un exercice unilatéral (dumbbell press unilatéral) sur le même pattern ne sont PAS redondants — l'unilatéral cible spécifiquement le côté faible. La règle : si `morphoStimulusAdjustments` contient un boost unilateral pour ce pattern (coeff > 1.0), les paires bilatéral+unilatéral ne sont plus marquées redondantes.

Pour détecter si un exercice est unilatéral : regarder si son `movement_pattern` commence par `unilateral_` OU si son nom contient `unilatéral|unilateral|single|1 bras|1 jambe` (regex case-insensitive).

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/lib/intelligence/biomechanics-phase2.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import { scoreRedundancy } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession } from '@/lib/programs/intelligence/types'

const bilateralBench = {
  name: 'Développé couché',
  sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
  movement_pattern: 'horizontal_push',
  equipment_required: ['barre'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: ['epaules'],
  is_compound: true,
}

const unilateralBench = {
  name: 'Développé haltère unilatéral',
  sets: 3, reps: '10-12', rest_sec: 90, rir: 2, notes: '',
  movement_pattern: 'horizontal_push',
  equipment_required: ['halteres'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: [],
  is_compound: true,
}

const session: BuilderSession = {
  name: 'Push', day_of_week: 1,
  exercises: [bilateralBench, unilateralBench],
}

describe('scoreRedundancy with morpho', () => {
  it('marks bilateral+bilateral same pattern as redundant (no morpho)', () => {
    const duplicateBench = { ...bilateralBench, name: 'Développé couché machine' }
    const s: BuilderSession = { name: 'Push', day_of_week: 1, exercises: [bilateralBench, duplicateBench] }
    const { redundantPairs } = scoreRedundancy([s])
    expect(redundantPairs.length).toBe(1)
  })

  it('marks bilateral+unilateral as redundant when no morpho adjustment', () => {
    const { redundantPairs } = scoreRedundancy([session])
    expect(redundantPairs.length).toBe(1)
  })

  it('does NOT mark bilateral+unilateral as redundant when morpho has unilateral boost', () => {
    const morpho = { unilateral_push: 1.15 } // arm asymmetry → unilateral boost
    const { redundantPairs } = scoreRedundancy([session], morpho)
    expect(redundantPairs.length).toBe(0)
  })

  it('still marks bilateral+bilateral as redundant even with morpho', () => {
    const duplicateBench = { ...bilateralBench, name: 'Développé couché machine' }
    const s: BuilderSession = { name: 'Push', day_of_week: 1, exercises: [bilateralBench, duplicateBench] }
    const morpho = { unilateral_push: 1.15 }
    const { redundantPairs } = scoreRedundancy([s], morpho)
    expect(redundantPairs.length).toBe(1)
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run tests/lib/intelligence/biomechanics-phase2.test.ts
```
Expected: FAIL — `scoreRedundancy` ne prend pas encore de 2e param.

- [ ] **Step 3 : Modifier `scoring.ts` — signature `scoreRedundancy`**

Changer la signature de `scoreRedundancy` pour accepter un 2e paramètre optionnel :

```typescript
// Avant
export function scoreRedundancy(
  sessions: BuilderSession[],
): { score: number; alerts: IntelligenceAlert[]; redundantPairs: RedundantPair[] }

// Après
export function scoreRedundancy(
  sessions: BuilderSession[],
  morphoStimulusAdjustments?: Record<string, number>,
): { score: number; alerts: IntelligenceAlert[]; redundantPairs: RedundantPair[] }
```

- [ ] **Step 4 : Ajouter helper `isUnilateral` et logique morpho dans `scoreRedundancy`**

Ajouter juste avant la fonction `scoreRedundancy` :

```typescript
const UNILATERAL_REGEX = /unilatéral|unilateral|single|1 bras|1 jambe/i

function isUnilateral(ex: BuilderExercise): boolean {
  return (ex.movement_pattern?.startsWith('unilateral_') ?? false) ||
         UNILATERAL_REGEX.test(ex.name)
}
```

Dans le corps de `scoreRedundancy`, dans la boucle double (après la vérification `isCompA && isCompB`), ajouter AVANT le push vers `redundantPairs` :

```typescript
// Si morpho a un boost unilatéral pour ce pattern et que l'une des deux est unilatérale,
// ce n'est pas de la redondance — c'est du travail ciblé asymétrie
if (morphoStimulusAdjustments) {
  const unilateralPatternKey = `unilateral_${pA}`
  const hasUnilateralBoost = (morphoStimulusAdjustments[unilateralPatternKey] ?? 1.0) > 1.0
  if (hasUnilateralBoost && (isUnilateral(exA) !== isUnilateral(exB))) continue
}
```

- [ ] **Step 5 : Mettre à jour l'appel dans `buildIntelligenceResult`**

Dans `buildIntelligenceResult`, changer l'appel à `scoreRedundancy` :

```typescript
// Avant
const redundancyResult = scoreRedundancy(filteredSessions)

// Après
const redundancyResult = scoreRedundancy(filteredSessions, morphoStimulusAdjustments)
```

- [ ] **Step 6 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run tests/lib/intelligence/biomechanics-phase2.test.ts
```
Expected: PASS — 4 tests.

- [ ] **Step 7 : Vérifier aucune régression**

```bash
npx vitest run tests/lib/intelligence/
```
Expected: tous les tests existants passent.

- [ ] **Step 8 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "scoring\|types\|biomechanics"
```
Expected: aucune erreur sur ces fichiers.

- [ ] **Step 9 : Commit**

```bash
git add lib/programs/intelligence/scoring.ts tests/lib/intelligence/biomechanics-phase2.test.ts
git commit -m "feat(intelligence): scoreRedundancy skips bilateral+unilateral when morpho has unilateral boost"
```

---

## Task 2 : SRA Heatmap — type + export depuis scoreSRA

**Files:**
- Modify: `lib/programs/intelligence/types.ts`
- Modify: `lib/programs/intelligence/scoring.ts`

**Contexte :**
La SRA heatmap montre la fatigue accumulée par groupe musculaire sur 4 semaines (le programme se répète 4 fois). Chaque semaine, chaque muscle a un niveau de fatigue calculé depuis le volume pondéré (`sets × stimCoeff`) des sessions qui le sollicitent. La heatmap est un tableau `SRAHeatmapWeek[]` où chaque entry représente une semaine avec les muscles et leur fatigue normalisée 0–100.

Le calcul : pour chaque muscle, pour chaque semaine de 1 à 4, la fatigue = somme des `weightedVolume` de toutes les sessions de la semaine contenant ce muscle, divisée par la fenêtre SRA en heures × facteur de récupération de 0.2 (un set prend ~0.2% de la fenêtre SRA en fatigue).

La heatmap n'est exportée que depuis `scoreSRA` (ne pas l'ajouter au `IntelligenceResult` global pour ne pas alourdir — elle est consommée seulement par `LabModeSection`).

- [ ] **Step 1 : Ajouter le type `SRAHeatmapWeek` dans `types.ts`**

Ajouter à la fin de `types.ts` :

```typescript
// Fatigue par muscle pour une semaine donnée (0–100, 0 = repos, 100 = max fatigue)
export interface SRAHeatmapWeek {
  week: number          // 1, 2, 3, 4
  muscles: {
    name: string        // slug FR
    fatigue: number     // 0–100
  }[]
}
```

- [ ] **Step 2 : Modifier la signature de `scoreSRA` pour retourner `sraHeatmap`**

Changer le type de retour de `scoreSRA` :

```typescript
// Avant
): { score: number; alerts: IntelligenceAlert[]; sraMap: SRAPoint[] }

// Après
): { score: number; alerts: IntelligenceAlert[]; sraMap: SRAPoint[]; sraHeatmap: SRAHeatmapWeek[] }
```

- [ ] **Step 3 : Calculer la heatmap dans `scoreSRA`**

Ajouter ce calcul JUSTE AVANT le `return` de `scoreSRA`, après le calcul du `score` :

```typescript
// ─── SRA Heatmap (4 semaines) ─────────────────────────────────────────────
// Le programme hebdomadaire se répète sur 4 semaines.
// Pour chaque semaine, la fatigue d'un muscle = somme des weightedVolume
// des séances qui le sollicitent ÷ (fenêtre_SRA_heures × 0.003) → clampé 0–100.
// Le facteur 0.003 est empirique : 1 set compound = ~3‰ de la fenêtre SRA.
const sraHeatmap: SRAHeatmapWeek[] = [1, 2, 3, 4].map(week => {
  const muscleNames = Object.keys(muscleSessionMap)
  const muscles = muscleNames.map(muscle => {
    const window = (SRA_WINDOWS[muscle] ?? SRA_WINDOW_DEFAULT) * levelMult
    // volume pondéré total sur la semaine (tous les sets × coeff du muscle)
    let totalVolume = 0
    for (const session of sessions) {
      const musclePresent = session.exercises.some(ex =>
        ex.primary_muscles.map(normalizeMuscleSlug).includes(muscle)
      )
      if (musclePresent) {
        for (const ex of session.exercises) {
          if (ex.primary_muscles.map(normalizeMuscleSlug).includes(muscle)) {
            totalVolume += weightedVolume(ex)
          }
        }
      }
    }
    // Fatigue = volume / (fenêtre × 0.003), clampé 0–100
    const fatigue = Math.round(Math.min(100, (totalVolume / (window * 0.003))))
    return { name: muscle, fatigue }
  })
  return { week, muscles: muscles.filter(m => m.fatigue > 0) }
})
```

Et dans le `return`, ajouter `sraHeatmap` :

```typescript
return { score, alerts, sraMap, sraHeatmap }
```

- [ ] **Step 4 : Ajouter `sraHeatmap` dans `IntelligenceResult` (types.ts)**

Dans l'interface `IntelligenceResult`, ajouter :

```typescript
sraHeatmap: SRAHeatmapWeek[]
```

- [ ] **Step 5 : Propager dans `buildIntelligenceResult`**

Dans `buildIntelligenceResult`, la ligne :

```typescript
const sraResult = scoreSRA(filteredSessions, meta, profile)
```

Reste identique — mais dans le `return` final, ajouter :

```typescript
sraHeatmap: sraResult.sraHeatmap,
```

- [ ] **Step 6 : Ajouter des tests pour la heatmap**

Dans `tests/lib/intelligence/biomechanics-phase2.test.ts`, ajouter :

```typescript
import { scoreSRA } from '@/lib/programs/intelligence/scoring'

describe('SRA heatmap', () => {
  const pushEx = {
    name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
    movement_pattern: 'horizontal_push', equipment_required: [],
    primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: [],
    is_compound: true,
  }
  const meta: import('@/lib/programs/intelligence/types').TemplateMeta = {
    goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'commercial_gym',
  }

  it('returns 4 weeks in sraHeatmap', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [pushEx] }]
    const { sraHeatmap } = scoreSRA(sessions, meta)
    expect(sraHeatmap).toHaveLength(4)
    expect(sraHeatmap[0].week).toBe(1)
    expect(sraHeatmap[3].week).toBe(4)
  })

  it('each week has identical muscle data (same program repeats)', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [pushEx] }]
    const { sraHeatmap } = scoreSRA(sessions, meta)
    expect(sraHeatmap[0].muscles).toEqual(sraHeatmap[1].muscles)
  })

  it('fatigue is > 0 for muscles that are trained', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [pushEx] }]
    const { sraHeatmap } = scoreSRA(sessions, meta)
    const week1 = sraHeatmap[0]
    const pectoraux = week1.muscles.find(m => m.name === 'pectoraux')
    expect(pectoraux).toBeDefined()
    expect(pectoraux!.fatigue).toBeGreaterThan(0)
  })

  it('fatigue is clamped to max 100', () => {
    const heavyEx = { ...pushEx, sets: 100 }
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [heavyEx] }]
    const { sraHeatmap } = scoreSRA(sessions, meta)
    const week1 = sraHeatmap[0]
    week1.muscles.forEach(m => {
      expect(m.fatigue).toBeLessThanOrEqual(100)
    })
  })

  it('returns empty sraHeatmap when no exercises', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [] }]
    const { sraHeatmap } = scoreSRA(sessions, meta)
    expect(sraHeatmap.every(w => w.muscles.length === 0)).toBe(true)
  })
})
```

- [ ] **Step 7 : Lancer les tests**

```bash
npx vitest run tests/lib/intelligence/biomechanics-phase2.test.ts
```
Expected: PASS — 4 (Task 1) + 5 (Task 2) = 9 tests.

- [ ] **Step 8 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "scoring\|types\|intelligence" | grep -v "node_modules"
```
Expected: aucune erreur.

- [ ] **Step 9 : Commit**

```bash
git add lib/programs/intelligence/types.ts lib/programs/intelligence/scoring.ts tests/lib/intelligence/biomechanics-phase2.test.ts
git commit -m "feat(intelligence): SRA heatmap 4-week fatigue export from scoreSRA"
```

---

## Task 3 : `useLabOverrides` hook + intégration dans `useProgramIntelligence`

**Files:**
- Modify: `lib/programs/intelligence/types.ts`
- Modify: `lib/programs/intelligence/index.ts`

**Contexte :**
Le Lab Mode doit permettre au coach de surcharger les coefficients stimulus par pattern (ex: augmenter manual le coeff `horizontal_push` de 0.85 → 1.0 pour tester l'impact). Ces overrides remplacent temporairement les `morphoStimulusAdjustments` pour le pattern concerné.

`LabOverrides` est un `Record<string, number>` — exactement le même type que `MorphoStimulusAdjustments`. Dans `useProgramIntelligence`, on merge les deux : `morpho` est la base, `labOverrides` écrase les valeurs correspondantes. Format de merge : `{ ...morphoAdjustments, ...labOverrides }`.

Le hook `useLabOverrides` est un simple `useState<Record<string, number>>({})` avec helper `setOverride(pattern, value)` et `resetOverrides()`. Il est exporté depuis `index.ts`.

- [ ] **Step 1 : Ajouter `LabOverrides` dans `types.ts`**

Ajouter à la fin de `types.ts` :

```typescript
// Lab Mode overrides — le coach peut surcharger le coefficient stimulus par pattern
// Se merge par-dessus les morphoStimulusAdjustments (labOverrides prend priorité)
export type LabOverrides = Record<string, number>
```

- [ ] **Step 2 : Créer le hook `useLabOverrides` dans `index.ts`**

Dans `lib/programs/intelligence/index.ts`, ajouter après les imports existants et avant `useProgramIntelligence` :

```typescript
// ─── Lab Mode Overrides ───────────────────────────────────────────────────────

export function useLabOverrides() {
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const setOverride = useCallback((pattern: string, value: number) => {
    setOverrides(prev => ({ ...prev, [pattern]: value }))
  }, [])

  const resetOverrides = useCallback(() => {
    setOverrides({})
  }, [])

  return { overrides, setOverride, resetOverrides }
}
```

Ajouter `useCallback` aux imports React si manquant.

- [ ] **Step 3 : Modifier `useProgramIntelligence` pour accepter `labOverrides` (5e param)**

Changer la signature :

```typescript
// Avant
export function useProgramIntelligence(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  morphoStimulusAdjustments?: Record<string, number>,
)

// Après
export function useProgramIntelligence(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  morphoStimulusAdjustments?: Record<string, number>,
  labOverrides?: Record<string, number>,
)
```

Et dans le `useEffect`/`setTimeout` qui appelle `buildIntelligenceResult`, merger les adjustments :

```typescript
// Merge morpho + lab overrides (lab prend priorité)
const effectiveAdjustments = morphoStimulusAdjustments || labOverrides
  ? { ...(morphoStimulusAdjustments ?? {}), ...(labOverrides ?? {}) }
  : undefined

setResult(buildIntelligenceResult(sessions, meta, profile, effectiveAdjustments))
```

- [ ] **Step 4 : Re-exporter `LabOverrides` depuis `index.ts`**

Ajouter dans les exports de `index.ts` :

```typescript
export type { LabOverrides } from './types'
```

- [ ] **Step 5 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "intelligence/index\|LabOverrides" | grep -v "node_modules"
```
Expected: aucune erreur.

- [ ] **Step 6 : Commit**

```bash
git add lib/programs/intelligence/types.ts lib/programs/intelligence/index.ts
git commit -m "feat(intelligence): useLabOverrides hook + merge with morpho in useProgramIntelligence"
```

---

## Task 4 : SRA Heatmap UI dans LabModeSection + Lab Overrides sliders

**Files:**
- Modify: `components/programs/studio/LabModeSection.tsx`
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Contexte :**
`LabModeSection` doit afficher :
1. La SRA heatmap (grille muscles × 4 semaines, couleur selon fatigue)
2. Des sliders de lab overrides par pattern présent dans le programme

La heatmap est passée via une nouvelle prop `sraHeatmap?: SRAHeatmapWeek[]`. Les overrides sont passés via props `labOverrides: Record<string, number>`, `onOverrideChange: (pattern: string, value: number) => void`, `onOverrideReset: () => void`.

Dans `ProgramTemplateBuilder`, utiliser le hook `useLabOverrides` et passer les valeurs à `EditorPane` → `LabModeSection`.

**SRA Heatmap UI :**
- Grille : muscles en lignes, 4 semaines en colonnes
- Cellule colorée selon fatigue : 0–30 = `bg-white/[0.04]` (repos), 31–60 = `bg-amber-500/20`, 61–100 = `bg-red-500/25`
- Valeur de fatigue en petit texte dans la cellule

**Lab Overrides UI :**
- Liste des patterns uniques présents dans le programme (extraits des exercices)
- Pour chaque pattern : label + input range (0.5–1.5, step 0.05) + valeur affichée
- Bouton "Reset" pour réinitialiser tous les overrides

- [ ] **Step 1 : Mettre à jour les props de `LabModeSection`**

Remplacer l'interface `Props` dans `LabModeSection.tsx` :

```typescript
import type { IntelligenceResult, SRAHeatmapWeek } from '@/lib/programs/intelligence'

interface Props {
  result: IntelligenceResult | null
  morphoConnected: boolean
  morphoDate?: string
  sraHeatmap?: SRAHeatmapWeek[]
  labOverrides?: Record<string, number>
  presentPatterns?: string[]                           // patterns uniques dans le programme
  onOverrideChange?: (pattern: string, value: number) => void
  onOverrideReset?: () => void
}
```

- [ ] **Step 2 : Ajouter la section SRA Heatmap dans le JSX de `LabModeSection`**

Dans le bloc `{visible && (...)}`, après la section "Debug subscores" et avant "Règles actives", ajouter :

```tsx
{/* SRA Heatmap */}
{sraHeatmap && sraHeatmap.some(w => w.muscles.length > 0) && (
  <div>
    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 mb-2 flex items-center gap-1.5">
      <Zap size={10} />
      Fatigue musculaire (4 semaines)
    </p>
    {/* Collect unique muscles across all weeks */}
    {(() => {
      const allMuscles = Array.from(new Set(sraHeatmap.flatMap(w => w.muscles.map(m => m.name))))
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr>
                <th className="text-left text-white/25 pr-2 pb-1 font-normal">Muscle</th>
                {sraHeatmap.map(w => (
                  <th key={w.week} className="text-center text-white/25 px-1 pb-1 font-normal">S{w.week}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allMuscles.map(muscle => (
                <tr key={muscle}>
                  <td className="text-white/40 pr-2 py-0.5 capitalize">{muscle}</td>
                  {sraHeatmap.map(week => {
                    const m = week.muscles.find(x => x.name === muscle)
                    const fatigue = m?.fatigue ?? 0
                    const bg = fatigue > 60 ? 'bg-red-500/25' : fatigue > 30 ? 'bg-amber-500/20' : 'bg-white/[0.03]'
                    return (
                      <td key={week.week} className={`text-center px-1 py-0.5 rounded ${bg}`}>
                        <span className="font-mono text-white/50">{fatigue > 0 ? fatigue : '–'}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    })()}
  </div>
)}
```

Ajouter `Zap` aux imports Lucide.

- [ ] **Step 3 : Ajouter la section Lab Overrides dans le JSX**

Après la section SRA Heatmap et avant "Règles actives" :

```tsx
{/* Lab Overrides */}
{presentPatterns && presentPatterns.length > 0 && onOverrideChange && (
  <div>
    <div className="flex items-center justify-between mb-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30 flex items-center gap-1.5">
        <Sliders size={10} />
        Overrides coefficients
      </p>
      {onOverrideReset && Object.keys(labOverrides ?? {}).length > 0 && (
        <button
          onClick={onOverrideReset}
          className="text-[9px] text-[#8b5cf6]/60 hover:text-[#8b5cf6] transition-colors"
        >
          Reset
        </button>
      )}
    </div>
    <div className="space-y-2">
      {presentPatterns.map(pattern => {
        const currentVal = (labOverrides ?? {})[pattern] ?? 1.0
        return (
          <div key={pattern} className="flex items-center gap-2">
            <span className="text-[9px] text-white/40 w-28 shrink-0 truncate capitalize">
              {pattern.replace(/_/g, ' ')}
            </span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={currentVal}
              onChange={e => onOverrideChange(pattern, parseFloat(e.target.value))}
              className="flex-1 accent-[#8b5cf6] h-1"
            />
            <span
              className="text-[9px] font-mono w-8 text-right shrink-0"
              style={{ color: currentVal !== 1.0 ? '#8b5cf6' : 'rgba(255,255,255,0.3)' }}
            >
              {currentVal.toFixed(2)}
            </span>
          </div>
        )
      })}
    </div>
  </div>
)}
```

Ajouter `Sliders` aux imports Lucide.

- [ ] **Step 4 : Modifier `EditorPane.tsx` pour accepter + passer les nouvelles props**

Dans `EditorPane.tsx`, l'interface `Props` doit accepter les nouvelles props (passthrough vers `LabModeSection`) :

```typescript
import type { SRAHeatmapWeek } from '@/lib/programs/intelligence'

// Dans l'interface Props de EditorPane, ajouter :
sraHeatmap?: SRAHeatmapWeek[]
labOverrides?: Record<string, number>
onOverrideChange?: (pattern: string, value: number) => void
onOverrideReset?: () => void
```

Et dans le rendu de `LabModeSection` dans `EditorPane`, passer les nouvelles props :

```tsx
<LabModeSection
  result={result}
  morphoConnected={morphoConnected}
  morphoDate={morphoDate}
  sraHeatmap={sraHeatmap}
  labOverrides={labOverrides}
  presentPatterns={presentPatterns}   // extraire depuis sessions
  onOverrideChange={onOverrideChange}
  onOverrideReset={onOverrideReset}
/>
```

`presentPatterns` = liste unique des `movement_pattern` des exercices non-null : 
```typescript
const presentPatterns = Array.from(new Set(
  sessions.flatMap(s => s.exercises.map(e => e.movement_pattern).filter((p): p is string => !!p))
))
```

- [ ] **Step 5 : Modifier `ProgramTemplateBuilder.tsx` pour utiliser `useLabOverrides`**

Dans `ProgramTemplateBuilder.tsx` :

1. Importer `useLabOverrides` :
```typescript
import { useProgramIntelligence, useLabOverrides } from '@/lib/programs/intelligence'
```

2. Après les autres hooks, ajouter :
```typescript
const { overrides: labOverrides, setOverride: onOverrideChange, resetOverrides: onOverrideReset } = useLabOverrides()
```

3. Passer `labOverrides` comme 5e argument à `useProgramIntelligence` :
```typescript
const intelligenceResult = useProgramIntelligence(sessions, meta, profile ?? undefined, morphoAdjustments ?? undefined, labOverrides)
```

4. Passer au `EditorPane` les nouvelles props :
```tsx
<EditorPane
  // ... props existantes ...
  sraHeatmap={intelligenceResult?.sraHeatmap}
  labOverrides={labOverrides}
  onOverrideChange={onOverrideChange}
  onOverrideReset={onOverrideReset}
/>
```

- [ ] **Step 6 : TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "LabMode|EditorPane|ProgramTemplate|sraHeatmap|LabOverride" | grep -v "node_modules"
```
Expected: aucune erreur.

- [ ] **Step 7 : Vérifier que les tests passent toujours**

```bash
npx vitest run tests/lib/intelligence/
```
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add components/programs/studio/LabModeSection.tsx components/programs/studio/EditorPane.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(lab-mode): SRA heatmap + coefficient overrides sliders in Lab Mode"
```

---

## Task 5 : Amélioration qualité alertes + CHANGELOG + project-state

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

**Contexte :**
Les alertes actuelles manquent parfois de précision dans les `suggestion`. On va enrichir les 3 alertes les plus fréquentes avec des valeurs concrètes issues du contexte du programme :
1. `SRA_VIOLATION` — préciser combien d'heures il manque ET quel jour de semaine suggéré
2. `PUSH_PULL_IMBALANCE` — préciser le volume exact push vs pull (en sets)
3. `REDUNDANT_EXERCISES` — préciser l'économie de sets si on retire l'un des deux

Ces améliorations sont dans les fonctions de scoring existantes, sans changer les signatures.

- [ ] **Step 1 : Améliorer `SRA_VIOLATION` dans `scoreSRA`**

Dans la boucle qui génère les alertes SRA, remplacer les alertes existantes :

Pour `severity: 'critical'` (hours <= window * 0.5) :

```typescript
alerts.push({
  severity: 'critical',
  code: 'SRA_VIOLATION',
  title: `Récupération insuffisante — ${muscle}`,
  explanation: `${muscle.charAt(0).toUpperCase() + muscle.slice(1)} sollicité ${hours}h après la séance précédente (minimum requis : ${Math.round(window)}h pour niveau ${effectiveLevel}).`,
  suggestion: `Espacez cette séance d'au moins ${Math.round(window - hours)}h supplémentaires — ou réduisez le volume ${muscle} dans l'une des deux séances.`,
  sessionIndex: curr.sessionIndex,
})
```

Pour `severity: 'warning'` (hours <= window * 0.8) :

```typescript
alerts.push({
  severity: 'warning',
  code: 'SRA_VIOLATION',
  title: `Récupération courte — ${muscle}`,
  explanation: `${muscle.charAt(0).toUpperCase() + muscle.slice(1)} sollicité ${hours}h après la séance précédente. Idéal : ${Math.round(window)}h. Manque : ${Math.round(window - hours)}h.`,
  suggestion: `Décalez cette séance ou réduisez l'intensité (sets ou charge) des exercices ciblant ${muscle}.`,
  sessionIndex: curr.sessionIndex,
})
```

- [ ] **Step 2 : Améliorer `PUSH_PULL_IMBALANCE` dans `scoreBalance`**

Dans `scoreBalance`, calculer les volumes bruts en sets pour les mentions dans l'alerte :

Après le calcul de `pushVol` et `pullVol`, ajouter (pour usage dans les messages) :

```typescript
// Volume brut en sets pour les messages d'alertes
let pushSets = 0, pullSets = 0
for (const session of sessions) {
  for (const ex of session.exercises) {
    const p = getPattern(ex)
    if (PUSH_PATTERNS.has(p)) pushSets += ex.sets
    if (PULL_PATTERNS.has(p)) pullSets += ex.sets
  }
}
```

Et dans les alertes, remplacer les messages :

Pour critical :
```typescript
explanation: `Ratio push/pull : ${ratio.toFixed(2)} (push ${pushSets} séries, pull ${pullSets} séries). Un déséquilibre important augmente le risque de dysfonction gléno-humérale.`,
suggestion: ratio > 1
  ? `Ajoutez ${Math.ceil((pushSets - pullSets) / 3)} exercices de tirage (rowing, tractions, face pull) pour rééquilibrer.`
  : `Ajoutez ${Math.ceil((pullSets - pushSets) / 3)} exercices de poussée (développé, OHP, dips) pour rééquilibrer.`,
```

Pour warning :
```typescript
explanation: `Ratio push/pull : ${ratio.toFixed(2)} (push ${pushSets} séries, pull ${pullSets} séries). Objectif "${meta.goal}" : ratio cible ${thresholds.warn[0]}–${thresholds.warn[1]}.`,
suggestion: ratio > 1
  ? `Envisagez d'ajouter 1–2 exercices de tirage ou d'augmenter le volume pull de ${Math.ceil(pushSets - pullSets)} séries.`
  : `Envisagez d'ajouter 1–2 exercices de poussée ou d'augmenter le volume push de ${Math.ceil(pullSets - pushSets)} séries.`,
```

- [ ] **Step 3 : Améliorer `REDUNDANT_EXERCISES` dans `scoreRedundancy`**

Dans l'alerte `REDUNDANT_EXERCISES`, remplacer le `suggestion` statique :

```typescript
// Calculer les séries totales des deux exercices redondants
const combinedSets = exA.sets + exB.sets
alerts.push({
  severity: 'warning',
  code: 'REDUNDANT_EXERCISES',
  title: `Redondance mécanique : ${exA.name} + ${exB.name}`,
  explanation: `Ces deux exercices ciblent les mêmes muscles (${overlap.join(', ')}) avec le même pattern (${pA}) et une intensité similaire (coefficients ${coeffA.toFixed(2)} vs ${coeffB.toFixed(2)}).`,
  suggestion: `Remplacer l'un par un angle complémentaire libère ${Math.max(exA.sets, exB.sets)} séries pour un pattern différent (${Math.max(exA.sets, exB.sets)} séries redondantes sur ${combinedSets} au total).`,
  sessionIndex: si,
  exerciseIndex: b,
})
```

- [ ] **Step 4 : Lancer les tests intelligence**

```bash
npx vitest run tests/lib/intelligence/
```
Expected: PASS.

- [ ] **Step 5 : TypeScript final**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules\|CarbCycling\|stripe\|payments" | grep "error TS" | wc -l
```
Expected: même nombre qu'avant (erreurs pré-existantes seulement).

- [ ] **Step 6 : Mettre à jour CHANGELOG.md**

Ajouter en tête de `CHANGELOG.md` :

```
## YYYY-MM-DD

FEATURE: scoreRedundancy — morpho unilateral boost bypass pour paires bilatéral+unilatéral
FEATURE: SRA heatmap 4 semaines exportée par scoreSRA (SRAHeatmapWeek[])
FEATURE: useLabOverrides hook + merge morpho dans useProgramIntelligence
FEATURE: Lab Mode — SRA heatmap + coefficient sliders
REFACTOR: Alertes SRA_VIOLATION, PUSH_PULL_IMBALANCE, REDUNDANT_EXERCISES — messages enrichis avec valeurs concrètes
```

- [ ] **Step 7 : Mettre à jour project-state.md**

Mettre à jour la section "Next Steps — Phase 2 Biomechanics Engine" pour cocher les items accomplis et ajouter une section datée Phase 2.

- [ ] **Step 8 : Commit final**

```bash
git add lib/programs/intelligence/scoring.ts CHANGELOG.md
git commit -m "feat(intelligence): enrich alert messages with concrete values (SRA, balance, redundancy)"
```
