'use client'

import { Copy, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { ProgramWeekRecord } from '@/lib/programs/programWeeks'

export type CompletionBehavior = 'repeat' | 'hold_last' | 'stop'

interface Props {
  weeks: ProgramWeekRecord[]
  activeWeekId: string | null
  completionBehavior: CompletionBehavior
  loading: boolean
  action: 'switch' | 'add' | 'duplicate' | 'delete' | 'completion' | 'mesocycle' | null
  onSelectWeek: (weekId: string) => void
  onAddEmptyWeek: () => void
  onDuplicateWeek: () => void
  onDeleteWeek: () => void
  onGenerateMesocycle: () => void
  onCompletionBehaviorChange: (behavior: CompletionBehavior) => void
}

const COMPLETION_OPTIONS: Array<{ value: CompletionBehavior; label: string }> = [
  { value: 'repeat', label: 'Recommencer le cycle' },
  { value: 'hold_last', label: 'Conserver la dernière semaine' },
  { value: 'stop', label: 'Terminer le programme' },
]

export default function WeekNavigator({
  weeks,
  activeWeekId,
  completionBehavior,
  loading,
  action,
  onSelectWeek,
  onAddEmptyWeek,
  onDuplicateWeek,
  onDeleteWeek,
  onGenerateMesocycle,
  onCompletionBehaviorChange,
}: Props) {
  const isBusy = loading || action !== null

  return (
    <section
      aria-label="Navigation du cycle d’entraînement"
      className="shrink-0 border-b-[0.3px] border-white/[0.07] bg-[#151515] px-3 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden shrink-0 xl:block">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#1f8a65]">
            Cycle d’entraînement
          </p>
          <p className="mt-0.5 text-[10px] text-white/30">
            {weeks.length} {weeks.length > 1 ? 'semaines configurées' : 'semaine configurée'}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5">
          {weeks.map((week) => {
            const active = week.id === activeWeekId
            return (
              <button
                key={week.id}
                type="button"
                onClick={() => onSelectWeek(week.id)}
                disabled={isBusy || active}
                aria-current={active ? 'step' : undefined}
                className={`h-8 shrink-0 rounded-lg border px-3 text-[10px] font-semibold transition-colors disabled:cursor-default ${
                  active
                    ? 'border-[#1f8a65]/45 bg-[#1f8a65]/12 text-[#6bc8a5]'
                    : 'border-white/[0.06] bg-white/[0.025] text-white/45 hover:border-white/[0.12] hover:text-white/75'
                }`}
              >
                {action === 'switch' && active ? <Loader2 size={11} className="animate-spin" /> : week.label}
              </button>
            )
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onGenerateMesocycle}
            disabled={isBusy || !activeWeekId}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[#1f8a65]/25 bg-[#1f8a65]/10 px-2.5 text-[10px] font-semibold text-[#6bc8a5] transition-colors hover:bg-[#1f8a65]/15 disabled:opacity-40"
            title="Générer un mésocycle"
          >
            {action === 'mesocycle' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            <span className="hidden xl:inline">Mésocycle</span>
          </button>
          <button
            type="button"
            onClick={onAddEmptyWeek}
            disabled={isBusy || weeks.length >= 52}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
            title="Ajouter une semaine vide"
          >
            {action === 'add' ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            <span className="hidden xl:inline">Semaine vide</span>
          </button>
          <button
            type="button"
            onClick={onDuplicateWeek}
            disabled={isBusy || !activeWeekId || weeks.length >= 52}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-40"
            title="Dupliquer la semaine active"
          >
            {action === 'duplicate' ? <Loader2 size={11} className="animate-spin" /> : <Copy size={11} />}
            <span className="hidden xl:inline">Dupliquer</span>
          </button>
          <button
            type="button"
            onClick={onDeleteWeek}
            disabled={isBusy || !activeWeekId || weeks.length <= 1}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-2.5 text-[10px] font-semibold text-red-200/45 transition-colors hover:border-red-400/25 hover:bg-red-400/[0.08] hover:text-red-200/75 disabled:cursor-not-allowed disabled:opacity-30"
            title={weeks.length <= 1 ? 'La dernière semaine ne peut pas être supprimée' : 'Supprimer la semaine active'}
          >
            {action === 'delete' ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            <span className="hidden 2xl:inline">Supprimer</span>
          </button>
          <label className="hidden items-center gap-2 border-l border-white/[0.07] pl-2.5 xl:flex">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/25">À la fin</span>
            <select
              value={completionBehavior}
              onChange={(event) => onCompletionBehaviorChange(event.target.value as CompletionBehavior)}
              disabled={isBusy}
              className="h-8 rounded-lg border border-white/[0.07] bg-[#1a1a1a] px-2 text-[10px] text-white/55 outline-none focus:border-[#1f8a65]/50"
            >
              {COMPLETION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}
