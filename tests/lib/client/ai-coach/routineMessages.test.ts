import { describe, expect, it } from 'vitest'

import { buildRoutineMessage } from '@/lib/client/ai-coach/routineMessages'

describe('buildRoutineMessage', () => {
  it('keeps the planned training context in standalone morning messages', () => {
    const routine = buildRoutineMessage({
      flowType: 'morning',
      lang: 'fr',
      firstName: 'Kev',
      tone: 'strict',
      hasTrainingToday: true,
      trainingName: 'Epaules / rappel pectoraux / dos',
      checkin: { enabled: false },
    })

    expect(routine.content).toContain("Tu as Epaules / rappel pectoraux / dos prévue aujourd'hui.")
    expect(routine.content).not.toContain("Pas de séance prévue aujourd’hui.")
    expect(routine.content).toContain('Si tu as une question ou quelque chose à me signaler, écris-le ici.')
    expect(routine.metadata).toBeNull()
  })

  it('keeps the planned training context in standalone evening messages', () => {
    const routine = buildRoutineMessage({
      flowType: 'evening',
      lang: 'fr',
      firstName: 'Kev',
      tone: 'strict',
      hasTrainingToday: true,
      trainingName: 'Biceps / triceps / avant-bras',
      checkin: { enabled: false },
    })

    expect(routine.content).toContain('Un mot sur ta séance du jour (Biceps / triceps / avant-bras), ta récup ou ta nutrition si besoin.')
    expect(routine.content).toContain('Si tu as un commentaire important pour aujourd’hui, laisse-le ici.')
    expect(routine.metadata).toBeNull()
  })
})
