import { describe, expect, it } from 'vitest'

import {
  hasInteractiveCheckinInit,
  shouldUpgradeInitMessageToInteractiveCheckin,
} from '@/lib/client/checkin/initMessages'

describe('initMessages', () => {
  it('detects an interactive check-in init message', () => {
    expect(hasInteractiveCheckinInit({
      id: '1',
      message_type: 'morning_init',
      created_at: '2026-06-02T06:30:00.000Z',
      metadata: { key: 'checkin_ready', flow_type: 'morning' },
    })).toBe(true)
  })

  it('marks standalone init messages for upgrade when a check-in should be prompted', () => {
    expect(shouldUpgradeInitMessageToInteractiveCheckin({
      id: '1',
      message_type: 'morning_init',
      created_at: '2026-06-02T06:30:00.000Z',
      metadata: null,
    }, true)).toBe(true)
  })

  it('does not upgrade an already interactive init message', () => {
    expect(shouldUpgradeInitMessageToInteractiveCheckin({
      id: '1',
      message_type: 'evening_init',
      created_at: '2026-06-02T21:00:00.000Z',
      metadata: { key: 'checkin_ready', flow_type: 'evening' },
    }, true)).toBe(false)
  })
})
