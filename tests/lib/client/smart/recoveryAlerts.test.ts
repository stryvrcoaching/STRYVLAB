import { describe, it, expect } from 'vitest'
import {
  computeRecoveryAlerts,
  type CheckinData,
} from '@/lib/client/smart/recoveryAlerts'

describe('computeRecoveryAlerts', () => {
  it('returns empty array if no morning checkin', () => {
    const alerts = computeRecoveryAlerts(null, true)
    expect(alerts.length).toBe(0)
  })

  it('returns empty array if session not planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 5,
      sleep_quality: 2,
      energy: 2,
      stress: 4,
    }
    const alerts = computeRecoveryAlerts(checkin, false)
    expect(alerts.length).toBe(0)
  })

  it('triggers sleep_debt critical when sleep_duration < 6 and session planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 5,
      sleep_quality: 3,
      energy: 3,
      stress: 2,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    const alert = alerts.find((a) => a.type === 'sleep_debt')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('critical')
    expect(alert?.title).toBe('Dette de sommeil')
  })

  it('triggers poor_sleep warning when sleep_quality <= 2 and session planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 7,
      sleep_quality: 2,
      energy: 3,
      stress: 2,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    const alert = alerts.find((a) => a.type === 'poor_sleep')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('warning')
  })

  it('triggers high_stress warning when stress >= 4 and session planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 7,
      sleep_quality: 4,
      energy: 3,
      stress: 4,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    const alert = alerts.find((a) => a.type === 'high_stress')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('warning')
  })

  it('triggers low_energy warning when energy <= 2 and session planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 7,
      sleep_quality: 4,
      energy: 2,
      stress: 2,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    const alert = alerts.find((a) => a.type === 'low_energy')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('warning')
  })

  it('triggers optimal info alert when sleep_quality >= 4, energy >= 4, and session planned', () => {
    const checkin: CheckinData = {
      sleep_duration: 8,
      sleep_quality: 4,
      energy: 4,
      stress: 2,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    const alert = alerts.find((a) => a.type === 'optimal')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('info')
    expect(alert?.title).toBe('Récupération optimale')
  })

  it('does not trigger optimal alert if sleep_quality < 4', () => {
    const checkin: CheckinData = {
      sleep_duration: 8,
      sleep_quality: 3,
      energy: 4,
      stress: 2,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    expect(alerts.find((a) => a.type === 'optimal')).toBeUndefined()
  })

  it('does not trigger sleep_debt if sleep_duration >= 6', () => {
    const checkin: CheckinData = {
      sleep_duration: 6,
      sleep_quality: 2,
      energy: 2,
      stress: 4,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    expect(alerts.find((a) => a.type === 'sleep_debt')).toBeUndefined()
  })

  it('returns multiple alerts if multiple conditions are met', () => {
    const checkin: CheckinData = {
      sleep_duration: 5,
      sleep_quality: 2,
      energy: 2,
      stress: 4,
    }
    const alerts = computeRecoveryAlerts(checkin, true)
    expect(alerts.length).toBeGreaterThan(1)
    expect(alerts.map((a) => a.type)).toContain('sleep_debt')
    expect(alerts.map((a) => a.type)).toContain('poor_sleep')
  })
})
