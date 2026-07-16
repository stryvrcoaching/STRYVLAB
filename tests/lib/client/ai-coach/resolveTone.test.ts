import { describe, it, expect } from 'vitest'
import { resolveTone, TONE_MATRIX, type Tone } from '@/lib/client/ai-coach/resolveTone'

describe('resolveTone', () => {
  it('prefers per-client tone over global', () => {
    expect(resolveTone('strict', 'bienveillant')).toBe('strict')
  })
  it('falls back to global when per-client null', () => {
    expect(resolveTone(null, 'motivant')).toBe('motivant')
  })
  it('defaults to bienveillant when both null', () => {
    expect(resolveTone(null, null)).toBe('bienveillant')
  })
  it('ignores invalid tone strings', () => {
    expect(resolveTone('garbage', null)).toBe('bienveillant')
  })
  it('matrix covers all 4 tones with distinct openers per moment + closers', () => {
    for (const lang of ['fr', 'en', 'es'] as const) {
      for (const t of ['strict', 'bienveillant', 'motivant', 'neutre'] as Tone[]) {
        const m = TONE_MATRIX[lang][t]
        expect(m.openerMorning('Kev').length).toBeGreaterThan(0)
        expect(m.openerEvening('Kev').length).toBeGreaterThan(0)
        expect(m.openerClosing('Kev').length).toBeGreaterThan(0)
        expect(m.closerEvening.length).toBeGreaterThan(0)
        expect(m.openerMorning('Kev')).not.toBe(m.openerEvening('Kev'))
      }
    }
  })
})
