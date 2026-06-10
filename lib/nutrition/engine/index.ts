export type {
  EngineGoal,
  EngineGender,
  StryvrmMacros,
  CarbCyclingResult,
  TdeeComponents,
  WeeklyCheckinSummary,
  WeeklyDiagnosis,
  WeeklyAction,
  WeeklyAnalysisResult,
  TriggerCode,
  TriggerRecommendation,
} from './types'

export { PROTEIN_RATIO, FAT_RATIO, computeBaseMacros, computeCarbCycling } from './macroMatrix'
export { computeBMR, computeNEAT, computeEAT, computeTEF, computeTDEE } from './tdeeComponents'
export { checkAdherenceGuardrail, checkFatigueGuardrail, runGuardrails } from './guardrails'
export { analyzeWeek } from './weeklyAnalysis'
export { computeTriggers } from './triggers'
export type { TriggerInput } from './triggers'
export { getCycleSyncAdjustment, adjustMacrosForPhase, detectCurrentPhase } from './cycleSync'
export type { CyclePhase, CycleSyncAdjustment } from './cycleSync'
