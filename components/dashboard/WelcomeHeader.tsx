'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type OnboardingState = {
  hasClient: boolean
  hasTemplate: boolean
  hasFormula: boolean
}

const STEPS = [
  {
    id: 'client',
    label: 'Ajouter ton premier client',
    key: 'hasClient' as keyof OnboardingState,
    href: '/coach/clients/new',
    cta: 'Créer un client',
  },
  {
    id: 'template',
    label: 'Créer un template de bilan',
    key: 'hasTemplate' as keyof OnboardingState,
    href: '/coach/assessments/templates/new',
    cta: 'Créer un bilan',
  },
  {
    id: 'formula',
    label: 'Créer ta première formule',
    key: 'hasFormula' as keyof OnboardingState,
    href: '/coach/formules',
    cta: 'Créer une formule',
  },
]

const TITLES: Record<number, string> = {
  0: 'Bienvenue dans la nouvelle ère du coaching.',
  1: 'Premier client ajouté — crée ton premier bilan.',
  2: 'Presque prêt — définis ta première formule.',
}

export default function WelcomeHeader({ state }: { state: OnboardingState }) {
  const router = useRouter()
  const completedCount = STEPS.filter(s => state[s.key]).length

  if (completedCount === 3) return null

  const activeIndex = STEPS.findIndex(s => !state[s.key])

  return (
    <div className="mb-6 rounded-2xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-6">
      <div className="mb-5">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em] mb-1.5">
          Espace Coach
        </p>
        <h2 className="text-white text-xl font-bold tracking-tight">
          {TITLES[completedCount]}
        </h2>
      </div>

      <div className="space-y-2 mb-5">
        {STEPS.map((step, i) => {
          const done = state[step.key]
          const active = i === activeIndex
          const locked = !done && i > activeIndex

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center justify-between rounded-xl px-4 py-3 transition-colors',
                done && 'bg-[#1f8a65]/5',
                active && 'bg-white/[0.03] border-[0.3px] border-[#1f8a65]/20',
                locked && 'opacity-40',
              )}
            >
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 size={16} className="text-[#1f8a65] shrink-0" />
                ) : (
                  <Circle size={16} className={cn('shrink-0', active ? 'text-[#1f8a65]' : 'text-white/20')} />
                )}
                <span className={cn(
                  'text-[13px] font-medium',
                  done ? 'text-white/30 line-through' : 'text-white/80',
                )}>
                  {step.label}
                </span>
              </div>

              {active && (
                <button
                  onClick={() => router.push(step.href)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f8a65] text-white rounded-lg text-[11px] font-bold hover:bg-[#217356] transition-colors active:scale-[0.97]"
                >
                  {step.cta}
                  <ArrowRight size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-white/30">
          <span>Progression</span>
          <span>{completedCount}/3</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#1f8a65] transition-all duration-700"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
