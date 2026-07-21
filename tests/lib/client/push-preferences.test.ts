import { describe, expect, it } from 'vitest'

import { clientPushPreferenceForKind } from '@/lib/notifications/send-client-push'

describe('client push preference routing', () => {
  it('routes every configurable notification to its matching client setting', () => {
    expect(clientPushPreferenceForKind).toMatchObject({
      session: 'notif_session_reminder',
      bilan: 'notif_bilan_received',
      program: 'notif_program_updated',
      checkin: 'notif_checkin_reminder',
      hydration: 'notif_hydration_reminder',
      meal: 'notif_meal_reminder',
      protein: 'notif_protein_reminder',
      coach_message: 'notif_coach_messages',
      system: 'notif_progress_updates',
    })
  })

  it('keeps transactional notices independent from optional notification settings', () => {
    expect(clientPushPreferenceForKind.essential).toBeNull()
  })
})
