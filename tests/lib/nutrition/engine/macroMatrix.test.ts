import { describe, it, expect } from 'vitest'
import {
  computeBaseMacros,
  computeCarbCycling,
  PROTEIN_RATIO,
  FAT_RATIO,
} from '@/lib/nutrition/engine/macroMatrix'

describe('computeBaseMacros', () => {
  it('deficit 80kg man at 2400 kcal → P=176g F=64g C=rest', () => {
    const r = computeBaseMacros(80, 'deficit', 2400)
    expect(r.protein_g).toBe(176)   // 80 × 2.2
    expect(r.fat_g).toBe(64)        // 80 × 0.8
    // carbs = (2400 - 176*4 - 64*9) / 4 = (2400 - 704 - 576) / 4 = 1120/4 = 280
    expect(r.carbs_g).toBe(280)
    expect(r.calories).toBe(2400)
  })

  it('maintenance 65kg woman at 1900 kcal → P=130g F=65g C=rest', () => {
    const r = computeBaseMacros(65, 'maintenance', 1900)
    expect(r.protein_g).toBe(130)   // 65 × 2.0
    expect(r.fat_g).toBe(65)        // 65 × 1.0
    // carbs = (1900 - 130*4 - 65*9) / 4 = (1900 - 520 - 585) / 4 = 795/4 ≈ 199 (rounded)
    expect(r.carbs_g).toBe(199)
  })

  it('surplus 90kg man at 3200 kcal → P=162g F=90g', () => {
    const r = computeBaseMacros(90, 'surplus', 3200)
    expect(r.protein_g).toBe(162)   // 90 × 1.8
    expect(r.fat_g).toBe(90)        // 90 × 1.0
    // carbs = (3200 - 162*4 - 90*9) / 4 = (3200 - 648 - 810) / 4 = 1742/4 ≈ 436 (rounded)
    expect(r.carbs_g).toBe(436)
  })

  it('clamps carbs to 0 when calories too low', () => {
    const r = computeBaseMacros(70, 'deficit', 800)
    expect(r.carbs_g).toBe(0)
    expect(r.protein_g).toBe(154) // 70 × 2.2
  })

  it('PROTEIN_RATIO and FAT_RATIO are exported constants', () => {
    expect(PROTEIN_RATIO.deficit).toBe(2.2)
    expect(PROTEIN_RATIO.maintenance).toBe(2.0)
    expect(PROTEIN_RATIO.surplus).toBe(1.8)
    expect(FAT_RATIO.deficit).toBe(0.8)
    expect(FAT_RATIO.maintenance).toBe(1.0)
    expect(FAT_RATIO.surplus).toBe(1.0)
  })
})

describe('computeCarbCycling', () => {
  it('P and F stay identical on high and low days', () => {
    const base = computeBaseMacros(75, 'deficit', 2200)
    const cc = computeCarbCycling(base, 1.4, 0.5)
    expect(cc.high.protein_g).toBe(base.protein_g)
    expect(cc.high.fat_g).toBe(base.fat_g)
    expect(cc.low.protein_g).toBe(base.protein_g)
    expect(cc.low.fat_g).toBe(base.fat_g)
  })

  it('high day carbs > base carbs and low day carbs < base carbs', () => {
    const base = computeBaseMacros(75, 'deficit', 2200)
    const cc = computeCarbCycling(base, 1.4, 0.5)
    expect(cc.high.carbs_g).toBeGreaterThan(base.carbs_g)
    expect(cc.low.carbs_g).toBeLessThan(base.carbs_g)
  })

  it('high day calories > base and low day calories < base', () => {
    const base = computeBaseMacros(75, 'deficit', 2200)
    const cc = computeCarbCycling(base, 1.4, 0.5)
    expect(cc.high.calories).toBeGreaterThan(base.calories)
    expect(cc.low.calories).toBeLessThan(base.calories)
  })

  it('low day carbs clamped to 0 if multiplier is 0', () => {
    const base = computeBaseMacros(60, 'deficit', 1500)
    const cc = computeCarbCycling(base, 1.5, 0.0)
    expect(cc.low.carbs_g).toBe(0)
  })

  it('base is preserved in result', () => {
    const base = computeBaseMacros(75, 'maintenance', 2000)
    const cc = computeCarbCycling(base, 1.3, 0.6)
    expect(cc.base).toEqual(base)
  })
})
