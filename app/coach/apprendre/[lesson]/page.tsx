import { notFound } from 'next/navigation'
import CoachLearningGuide from '@/components/dashboard/CoachLearningGuide'
import { getCoachLearningLesson } from '@/lib/onboarding/coach-learning'

export default function CoachLearningLessonPage({ params }: { params: { lesson: string } }) {
  const lesson = getCoachLearningLesson(params.lesson)
  if (!lesson) notFound()

  return <CoachLearningGuide lesson={lesson} />
}
