import { describe, it, expect } from 'vitest'
import { PHASE_CONTENT, type CycleContext } from '@/lib/client/cycle/phaseContent'

const PHASES = ['follicular', 'ovulatory', 'luteal', 'menstrual'] as const
const CONTEXTS: CycleContext[] = ['nutrition', 'training']

describe('PHASE_CONTENT', () => {
  it('has content for every phase × context combination', () => {
    for (const phase of PHASES) {
      for (const ctx of CONTEXTS) {
        const c = PHASE_CONTENT[phase][ctx]
        expect(c.title, `${phase}.${ctx}.title`).toBeTruthy()
        expect(c.subtitle, `${phase}.${ctx}.subtitle`).toBeTruthy()
        expect(c.bullets.length, `${phase}.${ctx}.bullets`).toBeGreaterThanOrEqual(2)
        expect(c.impact, `${phase}.${ctx}.impact`).toBeTruthy()
      }
    }
  })

  it('has at least 3 bullets per content block', () => {
    for (const phase of PHASES) {
      for (const ctx of CONTEXTS) {
        const c = PHASE_CONTENT[phase][ctx]
        expect(c.bullets.length, `${phase}.${ctx} bullet count`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
