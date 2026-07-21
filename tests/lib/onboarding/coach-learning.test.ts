import { describe, expect, it } from 'vitest'
import { ACTIVATION_STEPS } from '@/lib/onboarding/coach-activation'
import {
  COACH_LEARNING_CHAPTERS,
  COACH_LEARNING_LESSONS,
  getCoachLearningLesson,
} from '@/lib/onboarding/coach-learning'

describe('coach learning lessons', () => {
  it('provides a concrete, actionable lesson for every learning entry point', () => {
    const learningEntries = ACTIVATION_STEPS.filter((step) => step.kind === 'learn')

    expect(learningEntries).toHaveLength(COACH_LEARNING_LESSONS.length)

    for (const entry of learningEntries) {
      const lessonId = entry.href.split('/').pop()!
      const lesson = getCoachLearningLesson(lessonId)

      expect(entry.href).toMatch(/^\/coach\/apprendre\//)
      expect(lesson).not.toBeNull()
      expect(lesson!.outcome.length).toBeGreaterThan(20)
      expect(lesson!.steps.length).toBeGreaterThanOrEqual(2)
      expect(lesson!.steps.every((step) => step.href.startsWith('/coach/'))).toBe(true)
      expect(lesson!.steps.every((step) => step.actionLabel.length > 0)).toBe(true)
    }
  })

  it('returns null for an unknown guide', () => {
    expect(getCoachLearningLesson('inconnu')).toBeNull()
  })

  it('classifies every guide once in the academy chapters', () => {
    const lessonIds = COACH_LEARNING_LESSONS.map((lesson) => lesson.id)
    const chapterLessonIds = COACH_LEARNING_CHAPTERS.flatMap((chapter) => chapter.lessonIds)

    expect(chapterLessonIds).toHaveLength(lessonIds.length)
    expect(new Set(chapterLessonIds).size).toBe(lessonIds.length)
    expect([...chapterLessonIds].sort()).toEqual([...lessonIds].sort())
  })
})
