import { describe, it, expect } from 'vitest'
import { scoreAlternatives } from '@/lib/programs/intelligence/alternatives'
import type { BuilderExercise, TemplateMeta } from '@/lib/programs/intelligence/types'

function makeExercise(overrides: Partial<BuilderExercise>): BuilderExercise {
  return {
    name: '',
    sets: 3,
    reps: '8-10',
    rest_sec: null,
    rir: null,
    notes: '',
    movement_pattern: null,
    primary_muscles: [],
    secondary_muscles: [],
    equipment_required: [],
    is_compound: undefined,
    group_id: undefined,
    ...overrides,
  }
}

const context = {
  equipmentArchetype: 'commercial_gym',
  goal: 'hypertrophy',
  level: 'intermediate',
  sessionExercises: [],
}

describe('scoreAlternatives — back sub-groups', () => {
  it('traction (vertical_pull) does NOT label shrug (scapular_elevation) as Remplace mécaniquement', () => {
    const traction = makeExercise({
      name: 'Traction pronation',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(traction, context)
    const shrugs = alts.filter(a => a.entry.movementPattern === 'scapular_elevation')
    for (const s of shrugs) {
      expect(s.label).not.toBe('Remplace mécaniquement')
    }
  })

  it('traction (vertical_pull) scores another vertical_pull higher than a horizontal_pull', () => {
    const traction = makeExercise({
      name: 'Traction pronation',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(traction, context)
    const vPulls = alts.filter(a => a.entry.movementPattern === 'vertical_pull')
    const hPulls = alts.filter(a => a.entry.movementPattern === 'horizontal_pull')
    if (vPulls.length > 0 && hPulls.length > 0) {
      expect(vPulls[0].score).toBeGreaterThan(hPulls[0].score)
    }
  })

  it('returns at most 6 alternatives', () => {
    const ex = makeExercise({
      name: 'Développé couché barre',
      movement_pattern: 'horizontal_push',
      primary_muscles: ['pectoraux'],
      is_compound: true,
    })
    const alts = scoreAlternatives(ex, context)
    expect(alts.length).toBeLessThanOrEqual(6)
  })

  it('oblique lateral flexion on hyperextension bench ranks cable/dumbbell lateral flexion, not bear plank', () => {
    const lateralFlexion = makeExercise({
      name: 'Flexions des obliques banc lombaire 45',
      movement_pattern: 'core_anti_flex',
      primary_muscles: ['obliques'],
      constraintProfile: 'side_flexion',
      primaryMuscle: 'obliques',
    })
    const alts = scoreAlternatives(lateralFlexion, context)
    const names = alts.map(a => a.entry.name)
    expect(names).toContain('Flexions latérales poulie basse')
    expect(names).toContain('Flexions latérales haltère')
    expect(names).not.toContain('Bear plank avec kickback')
    expect(names).not.toContain('Chinese plank planche chinoise')
    const top3 = alts.slice(0, 3).map(a => a.entry.name)
    expect(top3.some(n => n.includes('latéral') || n.includes('oblique'))).toBe(true)
  })

  it('no duplicate name prefixes in results', () => {
    const ex = makeExercise({
      name: 'Tirage vertical poulie haute',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(ex, context)
    const prefixes = alts.map(a =>
      a.entry.name.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    )
    const unique = new Set(prefixes)
    expect(unique.size).toBe(prefixes.length)
  })
})
