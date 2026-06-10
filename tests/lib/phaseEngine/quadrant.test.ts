import { describe, it, expect } from 'vitest'
import {
  optimalZoneCenterFromContext,
  optimalZoneCenterFromTrainingGoal,
  scoreToPlotX,
  scoreToPlotY,
} from '@/lib/coach/phaseEngine/quadrant'
import { defaultPhaseProfile } from './testFixtures'

const LAYOUT = { width: 400, height: 300, padding: 10 }

function zoneCtx(
  overrides: Partial<Parameters<typeof optimalZoneCenterFromContext>[0]> = {},
) {
  return {
    trainingGoal: 'maintenance',
    clientProfile: defaultPhaseProfile,
    recommendedDirection: 'maintenance' as const,
    recommendedAdaptiveState: 'stable' as const,
    recommendedDirectionScore: 0,
    recommendedAdaptiveScore: 0,
    ...overrides,
  }
}

describe('quadrant score mapping', () => {
  it('maps directionScore -1 to left edge and +1 to right edge', () => {
    expect(scoreToPlotX(-1, LAYOUT)).toBe(10)
    expect(scoreToPlotX(1, LAYOUT)).toBe(390)
    expect(scoreToPlotX(-0.6, LAYOUT)).toBeCloseTo(10 + 0.2 * 380, 1)
  })

  it('maps adaptiveScore +1 to top and -1 to bottom', () => {
    expect(scoreToPlotY(1, LAYOUT)).toBe(10)
    expect(scoreToPlotY(-1, LAYOUT)).toBe(290)
    expect(scoreToPlotY(0, LAYOUT)).toBe(150)
  })

  it('shifts optimal zone toward deficit for fat_loss goal', () => {
    const fat = optimalZoneCenterFromTrainingGoal('fat_loss')
    const maint = optimalZoneCenterFromTrainingGoal('maintenance')
    expect(fat.directionScore).toBeLessThan(maint.directionScore)
    expect(scoreToPlotX(fat.directionScore, LAYOUT)).toBeLessThan(scoreToPlotX(maint.directionScore, LAYOUT))
  })

  it('keeps fat_loss optimal target on deficit axis when recommendation is deficit', () => {
    const target = optimalZoneCenterFromContext(
      zoneCtx({
        trainingGoal: 'fat_loss',
        clientProfile: { ...defaultPhaseProfile, currentPhase: 'cut' },
        recommendedDirection: 'aggressive_deficit',
        recommendedDirectionScore: -0.55,
        recommendedAdaptiveScore: 0.1,
      }),
    )
    expect(target.directionScore).toBeLessThan(-0.15)
    expect(target.adaptiveScore).toBeLessThan(0.35)
    expect(scoreToPlotX(target.directionScore, LAYOUT)).toBeLessThan(LAYOUT.width / 2)
  })

  it('does not place fat_loss optimal zone in surplus quadrant', () => {
    const target = optimalZoneCenterFromContext(
      zoneCtx({
        trainingGoal: 'fat_loss',
        clientProfile: { ...defaultPhaseProfile, currentPhase: 'cut' },
        recommendedDirection: 'controlled_deficit',
        recommendedAdaptiveState: 'recovered',
        recommendedDirectionScore: -0.4,
        recommendedAdaptiveScore: 0.2,
      }),
    )
    expect(target.directionScore).toBeLessThan(0)
    expect(scoreToPlotX(target.directionScore, LAYOUT)).toBeLessThan(LAYOUT.width / 2)
  })

  it('anchors hypertrophy goal in deficit when active phase is cut', () => {
    const target = optimalZoneCenterFromContext(
      zoneCtx({
        trainingGoal: 'hypertrophy',
        clientProfile: { ...defaultPhaseProfile, currentPhase: 'cut' },
        recommendedDirection: 'maintenance',
        recommendedDirectionScore: 0.2,
        recommendedAdaptiveScore: 0.3,
      }),
    )
    expect(target.directionScore).toBeLessThan(-0.1)
    expect(scoreToPlotX(target.directionScore, LAYOUT)).toBeLessThan(LAYOUT.width / 2)
  })

  it('anchors zone in deficit when cyclic protocol is low-carb maintenance', () => {
    const target = optimalZoneCenterFromContext(
      zoneCtx({
        trainingGoal: 'hypertrophy',
        clientProfile: {
          ...defaultPhaseProfile,
          currentPhase: 'maintenance',
          cyclicProtocolMode: 'deficit',
        },
        recommendedDirectionScore: 0.15,
        recommendedAdaptiveScore: 0.2,
      }),
    )
    expect(target.directionScore).toBeLessThan(0)
  })
})
