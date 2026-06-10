import { describe, it, expect } from 'vitest'
import {
  bipolarSignalToZone,
  bodyFatTrendToZone,
  buildPhaseFooterMetricCards,
  computeDecayWeightedMean,
  unipolarSignalToZone,
  weightTrendToZone,
} from '@/lib/coach/phaseEngine/footerMetrics'
import type { DerivedSignals } from '@/lib/coach/phaseEngine/types'

const baseSignals = (): DerivedSignals => ({
  weightTrend: { value: 0, observed: true, confidence: 0.8 },
  bodyFatTrend: { value: -0.2, observed: true, confidence: 0.7 },
  waistTrend: null,
  performanceTrend: { value: 0.5, observed: true, confidence: 0.8 },
  recoveryTrend: { value: 0.2, observed: true, confidence: 0.6 },
  probableMuscleGain: { value: 0.5, observed: false, confidence: 0.3 },
  probableFatGain: { value: 0.1, observed: false, confidence: 0.3 },
  catabolicRisk: { value: 0.2, observed: false, confidence: 0.5 },
  anabolicPotential: { value: 0.6, observed: false, confidence: 0.5 },
  fatigueIndex: { value: 0.3, observed: false, confidence: 0.5 },
  recoveryCapacity: { value: 0.72, observed: true, confidence: 0.7 },
  trainingTolerance: { value: 0.7, observed: true, confidence: 0.7 },
  nutritionAdherence: { value: 0.75, observed: true, confidence: 0.75 },
  calorieCompliance: { value: 0.8, observed: true, confidence: 0.75 },
  proteinCompliance: { value: 0.78, observed: true, confidence: 0.75 },
  hydrationCompliance: { value: 0, observed: false, confidence: 0 },
  bodyResponseMatch: { value: 0.68, observed: true, confidence: 0.7 },
  phaseCompatibility: { value: 0.72, observed: true, confidence: 0.7 },
  stepLoadStability: { value: 0.65, observed: true, confidence: 0.45 },
  energyAvailabilityConsistency: { value: 0.8, observed: true, confidence: 0.75 },
  fatGainRisk: { value: 0.15, observed: false, confidence: 0.4 },
  physiologicalStressScore: 0.3,
  dataCoverage: 0.7,
  dataReliability: 0.7,
  dataQuality: 'good',
})

describe('signal zone mappers', () => {
  it('maps performanceTrend bipolar to zones', () => {
    expect(bipolarSignalToZone({ value: 0.8, observed: true, confidence: 0.8 })).toBe('optimal')
    expect(bipolarSignalToZone({ value: -0.8, observed: true, confidence: 0.8 })).toBe('poor')
  })

  it('maps recoveryCapacity unipolar to zones', () => {
    expect(unipolarSignalToZone({ value: 0.72, observed: true, confidence: 0.7 })).toBe('optimal')
    expect(unipolarSignalToZone({ value: 0.45, observed: true, confidence: 0.7 })).toBe('average')
  })

  it('flags rapid weight loss as poor', () => {
    expect(weightTrendToZone({ value: -1.2, observed: true, confidence: 0.8 })).toBe('poor')
  })

  it('flags body fat decrease as optimal', () => {
    expect(bodyFatTrendToZone({ value: -0.15, observed: true, confidence: 0.7 })).toBe('optimal')
  })

  it('returns null when confidence is too low', () => {
    expect(unipolarSignalToZone({ value: 0.9, observed: true, confidence: 0.1 })).toBeNull()
  })
})

describe('computeDecayWeightedMean', () => {
  it('weights recent points more heavily', () => {
    const mean = computeDecayWeightedMean(
      [
        { date: '2026-05-01', value: 20 },
        { date: '2026-05-28', value: 17 },
      ],
      30,
      new Date('2026-05-29'),
    )
    expect(mean).not.toBeNull()
    expect(mean!).toBeLessThan(19)
    expect(mean!).toBeGreaterThan(17)
  })
})

describe('buildPhaseFooterMetricCards', () => {
  it('derives zones from engine signals, not raw completion %', () => {
    const signals = baseSignals()
    signals.performanceTrend = { value: -0.6, observed: true, confidence: 0.9 }
    signals.recoveryCapacity = { value: 0.35, observed: true, confidence: 0.8 }

    const cards = buildPhaseFooterMetricCards(
      signals,
      {
        weightSeries: [
          { date: '2026-05-01', value: 80 },
          { date: '2026-05-20', value: 79 },
        ],
        bodyFatSeries: [
          { date: '2026-05-01', value: 18 },
          { date: '2026-05-20', value: 17.1 },
        ],
        windowDays: 30,
      },
      'fr',
      84,
    )

    expect(cards.performance.zone).toBe('poor')
    expect(cards.performance.value).toBe('20')
    expect(cards.sleep.zone).toBe('poor')
    expect(cards.bodyFat.subtitle).toBe('(Tendance lissée 30j)')
    expect(cards.bodyFat.value).toBeTruthy()
    expect(cards.weight.subtitle).toBe('(Tendance lissée 30j)')
  })

  it('restores sleep zone when recoveryCapacity has confidence but observed was false', () => {
    const signals = baseSignals()
    signals.recoveryCapacity = { value: 0.72, observed: false, confidence: 0.65 }

    const cards = buildPhaseFooterMetricCards(
      signals,
      { weightSeries: [], bodyFatSeries: [], windowDays: 30 },
      'fr',
      85,
    )

    expect(cards.sleep.zone).toBe('optimal')
    expect(cards.sleep.zoneLabel).toBe('Optimal')
  })

  it('labels sleep as insufficient recovery when check-in is high but capacity is low', () => {
    const signals = baseSignals()
    signals.recoveryCapacity = { value: 0.35, observed: true, confidence: 0.8 }

    const cards = buildPhaseFooterMetricCards(
      signals,
      { weightSeries: [], bodyFatSeries: [], windowDays: 30 },
      'fr',
      85,
    )

    expect(cards.sleep.value).toBe('85')
    expect(cards.sleep.zone).toBe('poor')
    expect(cards.sleep.zoneLabel).toBe('Récup. insuffisante')
  })
})
