import { describe, it, expect } from 'vitest'
import { computeSmartPreset } from '@/lib/formulas/macros'

describe('computeSmartPreset', () => {
  describe('maintenance', () => {
    it('returns 0 regardless of BF', () => {
      expect(computeSmartPreset('maintenance', 15, 3)).toBe(0)
      expect(computeSmartPreset('maintenance', null, 5)).toBe(0)
      expect(computeSmartPreset('maintenance', 35, 0)).toBe(0)
    })
  })

  describe('deficit', () => {
    it('returns -30 for BF > 30%', () => {
      expect(computeSmartPreset('deficit', 31, 3)).toBe(-30)
      expect(computeSmartPreset('deficit', 35, 0)).toBe(-30)
    })
    it('returns -25 for BF 25–30%', () => {
      expect(computeSmartPreset('deficit', 26, 3)).toBe(-25)
      expect(computeSmartPreset('deficit', 30, 2)).toBe(-25)
    })
    it('returns -20 for BF 20–25%', () => {
      expect(computeSmartPreset('deficit', 22, 3)).toBe(-20)
    })
    it('returns -15 for BF 15–20%', () => {
      expect(computeSmartPreset('deficit', 17, 3)).toBe(-15)
    })
    it('returns -12 for BF <= 15%', () => {
      expect(computeSmartPreset('deficit', 12, 3)).toBe(-12)
      expect(computeSmartPreset('deficit', 15, 3)).toBe(-12)
    })
    it('attenuates +3 for freq >= 5 (high volume)', () => {
      expect(computeSmartPreset('deficit', 17, 5)).toBe(-12)  // -15 + 3
      expect(computeSmartPreset('deficit', 22, 5)).toBe(-17)  // -20 + 3
    })
    it('floors attenuation at -10% for lean high-frequency athletes', () => {
      expect(computeSmartPreset('deficit', 12, 5)).toBe(-10)  // -12 + 3 = -9, floor at -10
      expect(computeSmartPreset('deficit', 10, 6)).toBe(-10)
    })
    it('defaults to BF 20 when null, returning -15', () => {
      expect(computeSmartPreset('deficit', null, 3)).toBe(-15)
    })
  })

  describe('surplus', () => {
    it('returns +10 for BF < 10%', () => {
      expect(computeSmartPreset('surplus', 9, 3)).toBe(10)
    })
    it('returns +8 for BF 10–13%', () => {
      expect(computeSmartPreset('surplus', 11, 3)).toBe(8)
    })
    it('returns +7 for BF 13–16%', () => {
      expect(computeSmartPreset('surplus', 14, 3)).toBe(7)
    })
    it('returns +5 for BF 16–20%', () => {
      expect(computeSmartPreset('surplus', 18, 3)).toBe(5)
    })
    it('returns +4 for BF >= 20%', () => {
      expect(computeSmartPreset('surplus', 22, 3)).toBe(4)
      expect(computeSmartPreset('surplus', 30, 3)).toBe(4)
    })
    it('defaults to BF 20 when null, returning +4', () => {
      expect(computeSmartPreset('surplus', null, 3)).toBe(4)
    })
  })
})
