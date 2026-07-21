'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, PlayCircle } from 'lucide-react'
import {
  COACH_LEARNING_CHAPTERS,
  COACH_LEARNING_LESSONS,
  type CoachLearningChapter,
} from '@/lib/onboarding/coach-learning'
import { readCoachLearningProgress } from '@/lib/onboarding/coach-learning-progress'

type ChapterId = CoachLearningChapter['id']

export default function CoachLearningAcademy() {
  const router = useRouter()
  const [activeChapterId, setActiveChapterId] = useState<ChapterId>('foundations')
  const [completedByLesson, setCompletedByLesson] = useState<Record<string, string[]>>({})

  useEffect(() => {
    setCompletedByLesson(Object.fromEntries(
      COACH_LEARNING_LESSONS.map((lesson) => [lesson.id, readCoachLearningProgress(lesson.id)]),
    ))
  }, [])

  const activeChapter = COACH_LEARNING_CHAPTERS.find((chapter) => chapter.id === activeChapterId)!
  const lessons = useMemo(
    () => activeChapter.lessonIds
      .map((id) => COACH_LEARNING_LESSONS.find((lesson) => lesson.id === id))
      .filter((lesson): lesson is (typeof COACH_LEARNING_LESSONS)[number] => Boolean(lesson)),
    [activeChapter],
  )
  const completedLessons = COACH_LEARNING_LESSONS.filter((lesson) => {
    const completed = completedByLesson[lesson.id] ?? []
    return lesson.steps.every((step) => completed.includes(step.id))
  }).length

  return (
    <main className="min-h-screen bg-[#121212] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7fe0b8]">
            <GraduationCap size={14} /> Académie STRYV lab
          </div>
          <h1 className="mt-3 font-barlow text-4xl font-bold tracking-tight text-white sm:text-5xl">Apprendre la plateforme</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/55">Des parcours courts pour comprendre quoi faire, où le faire et comment relier chaque outil à votre suivi client.</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-[0.3px] border-white/[0.07] bg-[#181818] px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-white/55">
            <CheckCircle2 size={15} className="shrink-0 text-[#1f8a65]" />
            <span><strong className="font-semibold text-white">{completedLessons}/{COACH_LEARNING_LESSONS.length}</strong> leçons terminées</span>
          </div>
          <p className="text-[11px] text-white/35">Commencez par le chapitre 1, puis avancez selon vos besoins.</p>
        </div>

        <nav className="mt-6 flex gap-2 overflow-x-auto pb-1" aria-label="Chapitres de l’académie">
          {COACH_LEARNING_CHAPTERS.map((chapter, index) => {
            const active = chapter.id === activeChapterId
            const chapterCompleted = chapter.lessonIds.filter((id) => {
              const lesson = COACH_LEARNING_LESSONS.find((item) => item.id === id)
              const completed = completedByLesson[id] ?? []
              return lesson?.steps.every((step) => completed.includes(step.id))
            }).length
            return (
              <button key={chapter.id} type="button" onClick={() => setActiveChapterId(chapter.id)} className={`min-w-max rounded-xl border-[0.3px] px-3 py-2.5 text-left transition-colors ${active ? 'border-[#1f8a65]/45 bg-[#1f8a65]/[0.12] text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/50 hover:bg-white/[0.05] hover:text-white/80'}`}>
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] opacity-60">Chapitre {index + 1}</span>
                <span className="mt-0.5 block text-[12px] font-semibold">{chapter.shortTitle}</span>
                <span className="mt-0.5 block text-[10px] tabular-nums opacity-50">{chapterCompleted}/{chapter.lessonIds.length}</span>
              </button>
            )
          })}
        </nav>

        <section className="mt-6" aria-labelledby="chapter-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7fe0b8]/80">Parcours recommandé</p>
              <h2 id="chapter-title" className="mt-1 text-xl font-bold text-white">{activeChapter.title}</h2>
              <p className="mt-1 max-w-2xl text-[13px] text-white/45">{activeChapter.description}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lessons.map((lesson, index) => {
              const completed = completedByLesson[lesson.id] ?? []
              const isComplete = lesson.steps.every((step) => completed.includes(step.id))
              return (
                <article key={lesson.id} className="group flex min-h-[220px] flex-col rounded-2xl border-[0.3px] border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] font-bold text-white/50">{index + 1}</span>
                    {isComplete ? <CheckCircle2 size={18} className="text-[#1f8a65]" /> : <BookOpen size={17} className="text-white/30" />}
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold text-white">{lesson.title}</h3>
                  <p className="mt-2 flex-1 text-[12px] leading-relaxed text-white/45">{lesson.summary}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-[10px] tabular-nums text-white/35">{completed.filter((id) => lesson.steps.some((step) => step.id === id)).length}/{lesson.steps.length} étapes</span>
                    <button type="button" onClick={() => router.push(`/coach/apprendre/${lesson.id}`)} className="inline-flex items-center gap-1 text-[12px] font-bold text-[#7fe0b8] transition-colors group-hover:text-white">
                      {isComplete ? 'Revoir' : completed.length > 0 ? 'Continuer' : 'Commencer'} <ArrowRight size={13} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="mt-6 flex items-center gap-2 text-[11px] text-white/35"><PlayCircle size={13} /> Chaque leçon reste accessible à tout moment, indépendamment de votre progression.</div>
      </div>
    </main>
  )
}
