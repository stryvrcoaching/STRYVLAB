'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ExternalLink, GraduationCap, RotateCcw } from 'lucide-react'
import type { CoachLearningLesson } from '@/lib/onboarding/coach-learning'
import {
  clearActiveCoachLearningStep,
  readCoachLearningProgress,
  startCoachLearningStep,
  writeCoachLearningProgress,
} from '@/lib/onboarding/coach-learning-progress'

export default function CoachLearningGuide({ lesson }: { lesson: CoachLearningLesson }) {
  const router = useRouter()
  const [completed, setCompleted] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setCompleted(readCoachLearningProgress(lesson.id))
    setReady(true)
  }, [lesson.id])

  const updateCompleted = (stepId: string) => {
    const next = completed.includes(stepId)
      ? completed.filter((id) => id !== stepId)
      : [...completed, stepId]
    setCompleted(next)
    writeCoachLearningProgress(lesson.id, next)
  }

  const completeCount = completed.filter((id) => lesson.steps.some((step) => step.id === id)).length
  const complete = completeCount === lesson.steps.length

  return (
    <main className="min-h-screen bg-[#121212] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.push('/dashboard')} className="mb-8 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/45 transition-colors hover:text-white">
          <ArrowLeft size={14} /> Retour à l’accueil
        </button>

        <section className="rounded-2xl border-[0.3px] border-white/[0.07] bg-[#181818] p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7fe0b8]">
                <GraduationCap size={14} /> Guide pratique
              </div>
              <h1 className="font-barlow text-3xl font-bold tracking-tight text-white sm:text-4xl">{lesson.title}</h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/55">{lesson.summary}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold tabular-nums text-white/60">{ready ? `${completeCount}/${lesson.steps.length}` : '…'}</span>
          </div>

          <div className="rounded-xl border-[0.3px] border-[#1f8a65]/25 bg-[#1f8a65]/[0.07] px-4 py-3 text-[12px] leading-relaxed text-white/70">
            <span className="font-semibold text-[#7fe0b8]">Objectif : </span>{lesson.outcome}
          </div>
        </section>

        <section className="mt-4 space-y-2" aria-label={`Étapes du guide ${lesson.title}`}>
          {lesson.steps.map((step, index) => {
            const done = completed.includes(step.id)
            return (
              <article key={step.id} className="rounded-2xl border-[0.3px] border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
                <div className="flex gap-3">
                  <button type="button" onClick={() => updateCompleted(step.id)} aria-label={done ? `Marquer ${step.title} comme non terminé` : `Marquer ${step.title} comme terminé`} className="mt-0.5 shrink-0 text-[#1f8a65]">
                    {done ? <CheckCircle2 size={19} /> : <Circle size={19} className="text-white/30" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Étape {index + 1}</p>
                    <h2 className={`mt-1 text-[15px] font-semibold ${done ? 'text-white/45 line-through' : 'text-white'}`}>{step.title}</h2>
                    <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/50">{step.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => { startCoachLearningStep(lesson.id, step.id); router.push(step.href) }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1f8a65] px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#217356]">
                        {step.actionLabel} <ExternalLink size={12} />
                      </button>
                      <button type="button" onClick={() => updateCompleted(step.id)} className="text-[11px] font-semibold text-white/45 hover:text-white/80">
                        {done ? 'Reprendre cette étape' : 'Marquer comme fait'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[0.3px] border-white/[0.07] bg-[#181818] p-4">
          <p className="text-[12px] text-white/50">{complete ? 'Guide terminé. Vous pouvez y revenir à tout moment.' : 'Votre progression est enregistrée sur cet appareil.'}</p>
          <div className="flex items-center gap-3">
            {complete && <CheckCircle2 size={17} className="text-[#1f8a65]" />}
            <button type="button" onClick={() => { setCompleted([]); writeCoachLearningProgress(lesson.id, []) }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/40 hover:text-white">
              <RotateCcw size={12} /> Recommencer
            </button>
            <button type="button" onClick={() => { clearActiveCoachLearningStep(); router.push('/dashboard') }} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#7fe0b8] hover:text-white">
              Terminer <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
