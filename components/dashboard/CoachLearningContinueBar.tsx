'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, GraduationCap, X } from 'lucide-react'
import { getCoachLearningLesson } from '@/lib/onboarding/coach-learning'
import {
  clearActiveCoachLearningStep,
  readActiveCoachLearningStep,
  type ActiveCoachLearningStep,
} from '@/lib/onboarding/coach-learning-progress'

export default function CoachLearningContinueBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [active, setActive] = useState<ActiveCoachLearningStep | null>(null)

  useEffect(() => {
    const next = readActiveCoachLearningStep()
    setActive(pathname.startsWith('/coach/apprendre/') ? null : next)
  }, [pathname])

  if (!active) return null

  const lesson = getCoachLearningLesson(active.lessonId)
  const stepIndex = lesson?.steps.findIndex((step) => step.id === active.stepId) ?? -1
  if (!lesson || stepIndex < 0) return null

  return (
    <div className="fixed bottom-[148px] left-1/2 z-[60] w-[min(460px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl border-[0.3px] border-[#1f8a65]/35 bg-[#141414]/[0.97] px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <GraduationCap size={16} className="shrink-0 text-[#7fe0b8]" />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7fe0b8]/80">Guide en cours · étape {stepIndex + 1}/{lesson.steps.length}</p>
          <p className="truncate text-[12px] font-medium text-white/80">{lesson.title} — {lesson.steps[stepIndex].title}</p>
        </div>
        <button type="button" onClick={() => router.push(`/coach/apprendre/${lesson.id}`)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#1f8a65] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#217356]">
          Guide <ArrowLeft size={12} />
        </button>
        <button type="button" aria-label="Quitter le guide" onClick={() => { clearActiveCoachLearningStep(); setActive(null) }} className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/70">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
