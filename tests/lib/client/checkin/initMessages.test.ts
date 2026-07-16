import { describe, expect, it } from 'vitest'

import {
  hasPendingInteractivePrompt,
  hasPendingInteractivePromptForFlow,
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

  it('detects a pending interactive prompt until it is answered', () => {
    expect(hasPendingInteractivePrompt([
      {
        metadata: {
          component: 'chips',
          key: 'pattern_reply',
          answered: false,
        },
      },
    ])).toBe(true)

    expect(hasPendingInteractivePrompt([
      {
        metadata: {
          component: 'chips',
          key: 'pattern_reply',
          answered: true,
        },
      },
    ])).toBe(false)
  })

  it('keeps morning and evening pending prompts independent', () => {
    expect(hasPendingInteractivePromptForFlow([
      { metadata: { component: 'chips', flow_type: 'morning', answered: false } },
    ], 'evening')).toBe(false)
    expect(hasPendingInteractivePromptForFlow([
      { metadata: { component: 'chips', flow_type: 'evening', answered: false } },
    ], 'evening')).toBe(true)
  })
})
