const STORAGE_PREFIX = 'stryv-coach-learning:'
const ACTIVE_LESSON_KEY = 'stryv-coach-learning-active'

export type ActiveCoachLearningStep = {
  lessonId: string
  stepId: string
}

export function readCoachLearningProgress(lessonId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}${lessonId}`) ?? '[]')
    return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : []
  } catch {
    return []
  }
}

export function writeCoachLearningProgress(lessonId: string, completedStepIds: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${STORAGE_PREFIX}${lessonId}`, JSON.stringify(completedStepIds))
}

export function startCoachLearningStep(lessonId: string, stepId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_LESSON_KEY, JSON.stringify({ lessonId, stepId }))
}

export function readActiveCoachLearningStep(): ActiveCoachLearningStep | null {
  if (typeof window === 'undefined') return null
  try {
    const value = JSON.parse(window.localStorage.getItem(ACTIVE_LESSON_KEY) ?? 'null')
    return typeof value?.lessonId === 'string' && typeof value?.stepId === 'string' ? value : null
  } catch {
    return null
  }
}

export function clearActiveCoachLearningStep() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACTIVE_LESSON_KEY)
}
