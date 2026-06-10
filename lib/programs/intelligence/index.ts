'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { buildIntelligenceResult } from './scoring'
import type { BuilderSession, TemplateMeta, IntelligenceResult, IntelligenceAlert, BuilderExercise, IntelligenceProfile, LabOverrides, SRAHeatmapWeek } from './types'

export type { IntelligenceResult, IntelligenceAlert, BuilderSession, TemplateMeta, BuilderExercise, IntelligenceProfile, LabOverrides, SRAHeatmapWeek }
export { scoreAlternatives } from './alternatives'
export type { AlternativeScore } from './alternatives'
export { resolveExerciseCoeff } from './catalog-utils'
export { scoreSuperset } from './scoring'
export { VOLUME_SEGMENTS, VOLUME_GROUP_LABELS, getVolumeTargets } from './volume-targets'

const EMPTY_RESULT: IntelligenceResult = {
  globalScore: 0,
  globalNarrative: "Ajoutez des exercices pour voir l'analyse.",
  subscores: { balance: 0, recovery: 0, specificity: 0, progression: 0, completeness: 0, redundancy: 0, jointLoad: 100, coordination: 100, volumeCoverage: 100 },
  alerts: [],
  distribution: {},
  patternDistribution: { push: 0, pull: 0, legs: 0, core: 0 },
  missingPatterns: [],
  redundantPairs: [],
  sraMap: [],
  sraHeatmap: [],
  programStats: { totalSets: 0, totalEstimatedReps: 0, totalExercises: 0, avgExercisesPerSession: 0, sessionsStats: [] },
  volumeByMuscle: {},
}

// ─── Lab Mode Overrides ───────────────────────────────────────────────────────

export function useLabOverrides() {
  const [overrides, setOverrides] = useState<Record<string, number>>({})

  const setOverride = useCallback((pattern: string, value: number) => {
    setOverrides(prev => ({ ...prev, [pattern]: value }))
  }, [])

  const resetOverrides = useCallback(() => {
    setOverrides({})
  }, [])

  return { overrides, setOverride, resetOverrides }
}

// ─── Program Intelligence ─────────────────────────────────────────────────────

export function useProgramIntelligence(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  morphoStimulusAdjustments?: Record<string, number>,
  labOverrides?: Record<string, number>,
): {
  result: IntelligenceResult
  alertsFor: (sessionIdx: number, exerciseIdx: number) => IntelligenceAlert[]
} {
  const [result, setResult] = useState<IntelligenceResult>(EMPTY_RESULT)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      try {
        const effectiveAdjustments = (morphoStimulusAdjustments || labOverrides)
          ? { ...(morphoStimulusAdjustments ?? {}), ...(labOverrides ?? {}) }
          : undefined

        const next = buildIntelligenceResult(sessions, meta, profile, effectiveAdjustments)
        setResult(next)
      } catch (err) {
        console.error('[intelligence] buildIntelligenceResult crashed:', err)
      }
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sessions, meta, profile, morphoStimulusAdjustments, labOverrides])

  function alertsFor(sessionIdx: number, exerciseIdx: number): IntelligenceAlert[] {
    return result.alerts.filter(
      a => a.sessionIndex === sessionIdx && a.exerciseIndex === exerciseIdx,
    )
  }

  return { result, alertsFor }
}
