import { describe, it, expect } from 'vitest'
import {
  detectDeloadSignals,
  type WeeklyData,
} from '@/lib/training/deloadDetection'

describe('detectDeloadSignals', () => {
  it('should detect RIR inflation (getting easier)', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 5, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 120 },
      { week: 2, avgRir: 4.5, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 121 },
      { week: 3, avgRir: 4, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.length).toBeGreaterThan(0)
    expect(signals.some(s => s.type === 'rir_inflation')).toBe(true)
    expect(signals.find(s => s.type === 'rir_inflation')?.severity).toBe('warning')
  })

  it('should not detect RIR inflation if RIR < 4', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 3, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 120 },
      { week: 2, avgRir: 2.5, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 121 },
      { week: 3, avgRir: 2, completionRate: 0.95, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'rir_inflation')).toBe(false)
  })

  it('should detect completion rate drop (warning)', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.70, totalVolume: 4000, oneRMEstimate: 120 },
      { week: 2, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 121 },
      { week: 3, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'completion_drop')).toBe(true)
    expect(signals.find(s => s.type === 'completion_drop')?.severity).toBe('warning')
  })

  it('should detect completion rate drop (critical)', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.55, totalVolume: 3000, oneRMEstimate: 120 },
      { week: 2, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 121 },
      { week: 3, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'completion_drop')).toBe(true)
    expect(signals.find(s => s.type === 'completion_drop')?.severity).toBe('critical')
  })

  it('should detect 1RM decline (critical)', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.80, totalVolume: 4500, oneRMEstimate: 113 }, // -5.8% from w3
      { week: 2, avgRir: 2, completionRate: 0.85, totalVolume: 5000, oneRMEstimate: 117 },
      { week: 3, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'performance_decline')).toBe(true)
    expect(signals.find(s => s.type === 'performance_decline')?.severity).toBe('critical')
  })

  it('should not detect 1RM decline if < 5%', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.80, totalVolume: 4500, oneRMEstimate: 114.5 }, // -4.5%
      { week: 2, avgRir: 2, completionRate: 0.85, totalVolume: 5000, oneRMEstimate: 117 },
      { week: 3, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'performance_decline')).toBe(false)
  })

  it('should detect volume stagnation', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.90, totalVolume: 5050, oneRMEstimate: 120 }, // +1% from w3
      { week: 2, avgRir: 2, completionRate: 0.90, totalVolume: 5025, oneRMEstimate: 120 },
      { week: 3, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'volume_stagnation')).toBe(true)
    expect(signals.find(s => s.type === 'volume_stagnation')?.severity).toBe('warning')
  })

  it('should not detect volume stagnation if completion < 85%', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.80, totalVolume: 5050, oneRMEstimate: 120 },
      { week: 2, avgRir: 2, completionRate: 0.80, totalVolume: 5025, oneRMEstimate: 120 },
      { week: 3, avgRir: 2, completionRate: 0.80, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.some(s => s.type === 'volume_stagnation')).toBe(false)
  })

  it('should return empty array if < 3 weeks data', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: 2, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: 120 },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.length).toBe(0)
  })

  it('should handle null values gracefully', () => {
    const weeklyData: WeeklyData[] = [
      { week: 1, avgRir: null, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: null },
      { week: 2, avgRir: null, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: null },
      { week: 3, avgRir: null, completionRate: 0.90, totalVolume: 5000, oneRMEstimate: null },
    ]

    const signals = detectDeloadSignals(weeklyData)
    expect(signals.length).toBeGreaterThanOrEqual(0) // should not crash
  })
})
