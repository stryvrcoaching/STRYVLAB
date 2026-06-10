import { describe, it, expect } from 'vitest'
import { selectAdvice, type AdviceInput } from '@/lib/client/ai-coach/adviceRules'

const base: AdviceInput = {
  facts: {
    dayKind: 'training',
    session: { planned: 'Push A', status: 'completed' },
    nutrition: { kcalLogged: 2000, kcalTarget: 2000, deltaKcal: 0, pctKcal: 100, proteinLogged: 150, proteinTarget: 150, proteinShort: false, status: 'on_track' },
    hydration: { ml: 2500, targetMl: 2500, pct: 100 },
    steps: 9000,
    checkin: {},
  },
  trend: { kcalOverDays: 0, proteinShortDays: 0 },
  freedom: 'safe',
}

describe('selectAdvice', () => {
  it('cancelled session => silent coach_alert, NO client reprogramming tip', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, dayKind: 'cancelled', session: { planned: 'Push A', status: 'cancelled' } } })
    expect(out.coachAlerts.map((a) => a.category)).toContain('program_signal')
    expect(out.tips.join(' ')).not.toMatch(/reprogramm|décale|charge/i)
  })

  it('never emits program-touching tips for soreness (D9)', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, checkin: { soreness: 4 } } })
    expect(out.tips.join(' ')).not.toMatch(/baisse|charge|repose-toi|écoute ton corps/i)
    expect(out.coachAlerts.map((a) => a.category)).toContain('recovery_flag')
  })

  it('3-day kcal over => firm tip + coach_alert nutrition_trend', () => {
    const out = selectAdvice({ ...base, trend: { kcalOverDays: 3, proteinShortDays: 0 } })
    expect(out.coachAlerts.map((a) => a.category)).toContain('nutrition_trend')
    expect(out.tips.length).toBeGreaterThan(0)
  })

  it('freedom=none emits zero client tips (still alerts coach)', () => {
    const out = selectAdvice({ ...base, freedom: 'none', facts: { ...base.facts, hydration: { ml: 500, targetMl: 2500, pct: 20 } } })
    expect(out.tips).toEqual([])
  })

  it('hydration tip uses coach method (gorgées, no 2L bottle)', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, hydration: { ml: 500, targetMl: 2500, pct: 20 } } })
    expect(out.tips.join(' ')).toMatch(/gorgées/i)
    expect(out.tips.join(' ')).not.toMatch(/bouteille de 2 ?L/i)
  })

  it('sleep tip makes no caffeine assumption (D13)', () => {
    const out = selectAdvice({ ...base, freedom: 'extended', facts: { ...base.facts, checkin: { sleepHours: 5 } } })
    expect(out.tips.join(' ')).not.toMatch(/caféine|café/i)
  })

  it('caps client tips at 2', () => {
    const out = selectAdvice({
      ...base,
      freedom: 'extended',
      facts: { ...base.facts, checkin: { sleepHours: 5, stress: 4 }, hydration: { ml: 300, targetMl: 2500, pct: 12 }, nutrition: { ...base.facts.nutrition, proteinLogged: 80, proteinShort: true } },
    })
    expect(out.tips.length).toBeLessThanOrEqual(2)
  })
})
