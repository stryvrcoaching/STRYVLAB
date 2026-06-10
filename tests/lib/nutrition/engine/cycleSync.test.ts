import { describe, it, expect } from 'vitest'
import {
  getCycleSyncAdjustment,
  adjustMacrosForPhase,
  detectCurrentPhase,
} from '@/lib/nutrition/engine/cycleSync'
import type { StryvrmMacros } from '@/lib/nutrition/engine/types'

const BASE: StryvrmMacros = {
  protein_g: 160,
  fat_g: 64,
  carbs_g: 200,
  calories: 2000,
}

describe('getCycleSyncAdjustment', () => {
  it('luteal → positive calorie delta (thermogenic)', () => {
    const adj = getCycleSyncAdjustment('luteal')
    expect(adj.caloriesDelta).toBeGreaterThan(0)
    expect(adj.caloriesDelta).toBeLessThanOrEqual(200)
  })

  it('luteal → positive carbs delta (serotonin/cravings)', () => {
    const adj = getCycleSyncAdjustment('luteal')
    expect(adj.carbsDelta).toBeGreaterThan(0)
  })

  it('luteal → positive protein delta (anti-catabolic)', () => {
    const adj = getCycleSyncAdjustment('luteal')
    expect(adj.proteinDelta).toBeGreaterThan(0)
  })

  it('luteal → increased hydration', () => {
    const adj = getCycleSyncAdjustment('luteal')
    expect(adj.hydrationDeltaMl).toBeGreaterThan(0)
  })

  it('follicular → optimalForDeficit true (best phase for cut)', () => {
    const adj = getCycleSyncAdjustment('follicular')
    expect(adj.optimalForDeficit).toBe(true)
  })

  it('ovulatory → optimalForDeficit true (peak performance)', () => {
    const adj = getCycleSyncAdjustment('ovulatory')
    expect(adj.optimalForDeficit).toBe(true)
  })

  it('luteal → optimalForDeficit false (cravings/metabolism up)', () => {
    expect(getCycleSyncAdjustment('luteal').optimalForDeficit).toBe(false)
  })

  it('menstrual → optimalForDeficit false', () => {
    expect(getCycleSyncAdjustment('menstrual').optimalForDeficit).toBe(false)
  })

  it('all phases return non-empty notes', () => {
    const phases = ['follicular', 'ovulatory', 'luteal', 'menstrual'] as const
    for (const p of phases) {
      expect(getCycleSyncAdjustment(p).notes.length).toBeGreaterThan(0)
    }
  })
})

describe('adjustMacrosForPhase', () => {
  it('luteal → higher calories than base', () => {
    const adj = adjustMacrosForPhase(BASE, 'luteal')
    expect(adj.calories).toBeGreaterThan(BASE.calories)
  })

  it('luteal → higher protein than base', () => {
    const adj = adjustMacrosForPhase(BASE, 'luteal')
    expect(adj.protein_g).toBeGreaterThan(BASE.protein_g)
  })

  it('follicular → calories equal or within 50 of base', () => {
    const adj = adjustMacrosForPhase(BASE, 'follicular')
    expect(Math.abs(adj.calories - BASE.calories)).toBeLessThanOrEqual(50)
  })

  it('calories always match macro math (P×4 + C×4 + F×9)', () => {
    const phases = ['follicular', 'ovulatory', 'luteal', 'menstrual'] as const
    for (const p of phases) {
      const adj = adjustMacrosForPhase(BASE, p)
      const computed = adj.protein_g * 4 + adj.carbs_g * 4 + adj.fat_g * 9
      expect(Math.abs(computed - adj.calories)).toBeLessThanOrEqual(10)
    }
  })

  it('no negative macro values', () => {
    const phases = ['follicular', 'ovulatory', 'luteal', 'menstrual'] as const
    for (const p of phases) {
      const adj = adjustMacrosForPhase(BASE, p)
      expect(adj.protein_g).toBeGreaterThanOrEqual(0)
      expect(adj.carbs_g).toBeGreaterThanOrEqual(0)
      expect(adj.fat_g).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('detectCurrentPhase', () => {
  it('day 1 → menstrual', () => {
    expect(detectCurrentPhase(1)).toBe('menstrual')
  })

  it('day 6 → follicular', () => {
    expect(detectCurrentPhase(6)).toBe('follicular')
  })

  it('day 14 → ovulatory', () => {
    expect(detectCurrentPhase(14)).toBe('ovulatory')
  })

  it('day 20 → luteal', () => {
    expect(detectCurrentPhase(20)).toBe('luteal')
  })

  it('day 28 → luteal', () => {
    expect(detectCurrentPhase(28)).toBe('luteal')
  })

  it('wraps correctly for day 30 (irregular cycle)', () => {
    const phase = detectCurrentPhase(30)
    expect(['follicular', 'ovulatory', 'luteal', 'menstrual']).toContain(phase)
  })
})
