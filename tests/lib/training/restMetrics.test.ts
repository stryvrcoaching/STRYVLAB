import { describe, expect, it } from 'vitest'
import { computeRobustAverageRestSec, normalizeRecordedRestSec } from '@/lib/training/restMetrics'

describe('rest metrics', () => {
  it('removes start and end buffers from a recorded rest', () => {
    expect(normalizeRecordedRestSec(130)).toBe(120)
    expect(normalizeRecordedRestSec(8)).toBe(0)
  })

  it('ignores a very long pause when computing the average rest', () => {
    const values = [
      ...Array.from({ length: 39 }, () => 130),
      1800,
    ]

    expect(computeRobustAverageRestSec(values)).toBe(120)
  })
})
