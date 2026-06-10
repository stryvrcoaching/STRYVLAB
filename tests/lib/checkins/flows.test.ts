import { describe, it, expect } from 'vitest'
import { MORNING_FLOW, EVENING_FLOW } from '@/lib/client/checkin/flows'

describe('MORNING_FLOW', () => {
  it('has 5 steps', () => expect(MORNING_FLOW.steps).toHaveLength(5))

  it('first step is sleep_hours slider', () => {
    const step = MORNING_FLOW.steps[0]
    expect(step.key).toBe('sleep_hours')
    expect(step.component).toBe('slider')
    expect(step.min).toBe(4)
    expect(step.max).toBe(10)
    expect(step.step).toBe(0.5)
  })

  it('sleep_quality is chips with 4 options', () => {
    const step = MORNING_FLOW.steps[1]
    expect(step.key).toBe('sleep_quality')
    expect(step.component).toBe('chips')
    expect(step.options).toHaveLength(4)
  })

  it('energy_level chips has 5 options', () => {
    const step = MORNING_FLOW.steps[2]
    expect(step.key).toBe('energy_level')
    expect(step.component).toBe('chips')
    expect(step.options).toHaveLength(5)
  })

  it('weight_kg is optional number input', () => {
    const step = MORNING_FLOW.steps[3]
    expect(step.key).toBe('weight_kg')
    expect(step.component).toBe('number')
    expect(step.optional).toBe(true)
  })

  it('rhr_morning is optional number input', () => {
    const step = MORNING_FLOW.steps[4]
    expect(step.key).toBe('rhr_morning')
    expect(step.component).toBe('number')
    expect(step.unit).toBe('bpm')
    expect(step.optional).toBe(true)
  })

  it('type is morning', () => expect(MORNING_FLOW.type).toBe('morning'))
  it('greeting is defined', () => expect(MORNING_FLOW.greeting).toBeTruthy())
})

describe('EVENING_FLOW', () => {
  it('has 5 steps including daily_steps', () => expect(EVENING_FLOW.steps).toHaveLength(5))

  it('daily_steps is optional number input', () => {
    const step = EVENING_FLOW.steps.find(s => s.key === 'daily_steps')
    expect(step?.component).toBe('number')
    expect(step?.optional).toBe(true)
  })

  it('type is evening', () => expect(EVENING_FLOW.type).toBe('evening'))

  it('all steps have key, component, question', () => {
    for (const step of EVENING_FLOW.steps) {
      expect(step.key).toBeTruthy()
      expect(step.component).toMatch(/^(chips|slider|number)$/)
      expect(step.question).toBeTruthy()
    }
  })

  it('muscle_soreness is conditional', () => {
    const step = EVENING_FLOW.steps.find(s => s.key === 'muscle_soreness')
    expect(step?.condition).toBeDefined()
  })

  it('muscle_soreness condition returns true when has_session_today=1', () => {
    const step = EVENING_FLOW.steps.find(s => s.key === 'muscle_soreness')!
    expect(step.condition!({ '__has_session_today': 1 })).toBe(true)
  })

  it('muscle_soreness condition returns false when has_session_today=0', () => {
    const step = EVENING_FLOW.steps.find(s => s.key === 'muscle_soreness')!
    expect(step.condition!({ '__has_session_today': 0 })).toBe(false)
  })
})
