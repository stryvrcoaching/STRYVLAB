import { describe, it, expect } from 'vitest'
import { buildMicroCopy, buildReasons } from '@/lib/coach/phaseEngine/copy'
import { getPhaseEngineCopy } from '@/lib/coach/phaseEngine/localeCopy'

describe('phase engine copy locales', () => {
  it('returns French microCopy by default', () => {
    const text = buildMicroCopy('controlled_deficit', 'controlled_deficit', 'recovery_crash')
    expect(text).toContain('décharge')
  })

  it('returns English microCopy when locale is en', () => {
    const text = buildMicroCopy('controlled_deficit', 'controlled_deficit', 'recovery_crash', 'en')
    expect(text.toLowerCase()).toContain('deload')
  })

  it('builds localized reasons from constraint flags', () => {
    const fr = buildReasons(['catabolic_risk'], 0, 0, 'fr')
    const en = buildReasons(['catabolic_risk'], 0, 0, 'en')
    expect(fr[0]).toContain('catabolique')
    expect(en[0].toLowerCase()).toContain('catabolic')
  })

  it('exposes distinct widget UI bundles per locale', () => {
    expect(getPhaseEngineCopy('fr').widgetUi.title).toBe('Optimisation de phase')
    expect(getPhaseEngineCopy('en').widgetUi.title).toBe('Phase optimization')
  })
})
