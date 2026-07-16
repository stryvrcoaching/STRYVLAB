import { describe, it, expect } from 'vitest'
import { getCheckinFlow } from '@/lib/client/checkin/flows'

const MORNING_FLOW = getCheckinFlow('morning', 'fr')
const EVENING_FLOW = getCheckinFlow('evening', 'fr')

describe('MORNING_FLOW', () => {
  it('has 5 steps', () => expect(MORNING_FLOW.steps).toHaveLength(5))

  it('first step is optional rhr_morning number input', () => {
    const step = MORNING_FLOW.steps[0]
    expect(step.key).toBe('rhr_morning')
    expect(step.component).toBe('number')
    expect(step.unit).toBe('bpm')
    expect(step.optional).toBe(true)
  })

  it('sleep_hours uses the time input', () => {
    const step = MORNING_FLOW.steps[1]
    expect(step.key).toBe('sleep_hours')
    expect(step.component).toBe('time')
    expect(step.min).toBe(4)
    expect(step.max).toBe(12)
    expect(step.step).toBe(15)
  })

  it('sleep_quality is chips with 4 options', () => {
    const step = MORNING_FLOW.steps[2]
    expect(step.key).toBe('sleep_quality')
    expect(step.component).toBe('chips')
    expect(step.options).toHaveLength(4)
  })

  it('energy_level chips has 5 options', () => {
    const step = MORNING_FLOW.steps[3]
    expect(step.key).toBe('energy_level')
    expect(step.component).toBe('chips')
    expect(step.options).toHaveLength(5)
  })

  it('contains an optional weight input', () => {
    const step = MORNING_FLOW.steps.find((entry) => entry.key === 'weight_kg')
    expect(step?.component).toBe('number')
    expect(step?.optional).toBe(true)
  })

  it('type is morning', () => expect(MORNING_FLOW.type).toBe('morning'))
  it('greeting is defined', () => expect(MORNING_FLOW.greeting).toBeTruthy())
})

describe('EVENING_FLOW', () => {
  it('has 5 steps including daily_steps', () => expect(EVENING_FLOW.steps).toHaveLength(5))

  it('daily_steps is optional number input', () => {
    const step = EVENING_FLOW.steps.find((entry) => entry.key === 'daily_steps')
    expect(step?.component).toBe('number')
    expect(step?.optional).toBe(true)
  })

  it('type is evening', () => expect(EVENING_FLOW.type).toBe('evening'))

  it('all steps have key, component, question', () => {
    for (const step of EVENING_FLOW.steps) {
      expect(step.key).toBeTruthy()
      expect(step.component).toMatch(/^(chips|number|time)$/)
      expect(step.question).toBeTruthy()
    }
  })

  it('muscle_soreness is conditional', () => {
    const step = EVENING_FLOW.steps.find((entry) => entry.key === 'muscle_soreness')
    expect(step?.condition).toBeDefined()
  })

  it('muscle_soreness condition returns true when has_session_today=1', () => {
    const step = EVENING_FLOW.steps.find((entry) => entry.key === 'muscle_soreness')
    expect(step?.condition?.({ '__has_session_today': 1 })).toBe(true)
  })

  it('muscle_soreness condition returns false when has_session_today=0', () => {
    const step = EVENING_FLOW.steps.find((entry) => entry.key === 'muscle_soreness')
    expect(step?.condition?.({ '__has_session_today': 0 })).toBe(false)
  })
})
