import { describe, it, expect } from 'vitest'
import { scoreRedundancy, scoreSRA } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta } from '@/lib/programs/intelligence/types'

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

const metaHypertrophy: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'commercial_gym',
}

const benchEx = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
  movement_pattern: 'horizontal_push', equipment_required: [],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: [],
  is_compound: true,
}

describe('SRA heatmap', () => {
  it('returns 4 weeks in sraHeatmap', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [benchEx] }]
    const { sraHeatmap } = scoreSRA(sessions, metaHypertrophy)
    expect(sraHeatmap).toHaveLength(4)
    expect(sraHeatmap[0].week).toBe(1)
    expect(sraHeatmap[3].week).toBe(4)
  })

  it('each week has identical muscle data (same program repeats)', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [benchEx] }]
    const { sraHeatmap } = scoreSRA(sessions, metaHypertrophy)
    expect(sraHeatmap[0].muscles).toEqual(sraHeatmap[1].muscles)
  })

  it('fatigue is > 0 for muscles that are trained', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [benchEx] }]
    const { sraHeatmap } = scoreSRA(sessions, metaHypertrophy)
    const week1 = sraHeatmap[0]
    const pectoraux = week1.muscles.find(m => m.name === 'pectoraux')
    expect(pectoraux).toBeDefined()
    expect(pectoraux!.fatigue).toBeGreaterThan(0)
  })

  it('fatigue is clamped to max 100', () => {
    const heavyEx = { ...benchEx, sets: 100 }
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [heavyEx] }]
    const { sraHeatmap } = scoreSRA(sessions, metaHypertrophy)
    const week1 = sraHeatmap[0]
    week1.muscles.forEach(m => {
      expect(m.fatigue).toBeLessThanOrEqual(100)
    })
  })

  it('returns empty muscles per week when no exercises', () => {
    const sessions = [{ name: 'A', day_of_week: 1, exercises: [] }]
    const { sraHeatmap } = scoreSRA(sessions, metaHypertrophy)
    expect(sraHeatmap.every(w => w.muscles.length === 0)).toBe(true)
  })
})
