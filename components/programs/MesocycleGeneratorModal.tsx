'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, BookOpen, Loader2, Sparkles, X } from 'lucide-react'
import {
  MESOCYCLE_ENGINE_VERSION,
  type MesocycleConfig,
  type MesocyclePreview,
} from '@/lib/programs/mesocycle'
import type { ProgramWeekRecord } from '@/lib/programs/programWeeks'
import type { CompletionBehavior } from './studio/WeekNavigator'

interface Props {
  programId: string
  weeks: ProgramWeekRecord[]
  activeWeekId: string | null
  completionBehavior: CompletionBehavior
  onClose: () => void
  onApplied: (result: {
    weeks: ProgramWeekRecord[]
    completion_behavior: CompletionBehavior
  }) => void
}

type SourceMode = 'active' | 'all'

const inputClassName =
  'h-9 w-full rounded-lg border border-white/[0.08] bg-[#111] px-2.5 text-[11px] text-white/75 outline-none transition-colors focus:border-[#1f8a65]/60'

const weekTypeLabels: Record<string, string> = {
  base: 'Base',
  build: 'Construction',
  overload: 'Surcharge',
  deload: 'Deload',
  peak: 'Pic',
  custom: 'Personnalisée',
}

function makeDefaultConfig(
  sourceWeekIds: string[],
  completionBehavior: CompletionBehavior,
): MesocycleConfig {
  return {
    version: MESOCYCLE_ENGINE_VERSION,
    sourceWeekIds,
    outputWeekCount: 6,
    volume: { mode: 'linear', startPercent: 100, endPercent: 120 },
    rir: { mode: 'linear', start: 3, end: 1 },
    deload: { enabled: true, volumePercent: 60, rir: 4 },
    safety: { minSetsPerExercise: 1, maxSetsPerExercise: 8 },
    completionBehavior,
  }
}

export default function MesocycleGeneratorModal({
  programId,
  weeks,
  activeWeekId,
  completionBehavior,
  onClose,
  onApplied,
}: Props) {
  const initialSourceId = activeWeekId ?? weeks[0]?.id ?? ''
  const [sourceMode, setSourceMode] = useState<SourceMode>('active')
  const [config, setConfig] = useState<MesocycleConfig>(() =>
    makeDefaultConfig(initialSourceId ? [initialSourceId] : [], completionBehavior),
  )
  const [preview, setPreview] = useState<MesocyclePreview | null>(null)
  const [loading, setLoading] = useState<'preview' | 'apply' | null>(null)
  const [error, setError] = useState('')

  const selectedSourceLabels = useMemo(() => {
    const selected = new Set(config.sourceWeekIds)
    return weeks.filter((week) => selected.has(week.id)).map((week) => week.label)
  }, [config.sourceWeekIds, weeks])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose])

  function updateConfig(updater: (current: MesocycleConfig) => MesocycleConfig) {
    setConfig(updater)
    setPreview(null)
    setError('')
  }

  function handleSourceMode(nextMode: SourceMode) {
    setSourceMode(nextMode)
    updateConfig((current) => ({
      ...current,
      sourceWeekIds: nextMode === 'all'
        ? weeks.map((week) => week.id)
        : [activeWeekId ?? weeks[0]?.id].filter((id): id is string => Boolean(id)),
    }))
  }

  async function requestMesocycle(action: 'preview' | 'apply') {
    setLoading(action)
    setError('')
    try {
      const response = await fetch(`/api/programs/${programId}/mesocycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, config }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Impossible de générer le mésocycle')
      }
      setPreview(data.preview)
      if (action === 'apply') onApplied(data)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de générer le mésocycle',
      )
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="mesocycle-title">
      <button
        type="button"
        aria-label="Fermer le générateur"
        className="absolute inset-0 bg-black/75"
        onClick={() => !loading && onClose()}
      />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#181818] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[#6bc8a5]">
              <Sparkles size={14} />
              <p className="text-[9px] font-bold uppercase tracking-[0.17em]">Moteur déterministe · sans IA</p>
            </div>
            <h2 id="mesocycle-title" className="mt-1 text-[17px] font-semibold text-white">Générer un mésocycle</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/40">
              Prépare une progression calculée du volume et du RIR. Rien n’est modifié avant votre validation finale.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/coach/documentation/workout-mesocycles"
              target="_blank"
              rel="noreferrer"
              aria-label="Ouvrir la documentation sur les mésocycles"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-[10px] font-semibold text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/75"
            >
              <BookOpen size={12} />
              <span className="hidden sm:inline">Guide complet</span>
            </Link>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              disabled={Boolean(loading)}
              className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2 text-white/40 transition-colors hover:text-white/75 disabled:opacity-40"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="overflow-y-auto border-b border-white/[0.07] p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <Fieldset title="Structure">
                <Field label="Semaines sources">
                  <select value={sourceMode} onChange={(event) => handleSourceMode(event.target.value as SourceMode)} className={inputClassName}>
                    <option value="active">Semaine active uniquement</option>
                    <option value="all">Toutes les semaines existantes</option>
                  </select>
                </Field>
                <p className="text-[10px] leading-relaxed text-white/30">
                  Base utilisée : {selectedSourceLabels.join(', ') || 'aucune'}
                </p>
                <Field label="Durée du mésocycle">
                  <select
                    value={config.outputWeekCount}
                    onChange={(event) => updateConfig((current) => ({ ...current, outputWeekCount: Number(event.target.value) }))}
                    className={inputClassName}
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 2).map((count) => (
                      <option key={count} value={count}>{count} semaines</option>
                    ))}
                  </select>
                </Field>
              </Fieldset>

              <Fieldset title="Progression du volume">
                <Field label="Stratégie">
                  <select
                    value={config.volume.mode}
                    onChange={(event) => updateConfig((current) => ({
                      ...current,
                      volume: { ...current.volume, mode: event.target.value as 'stable' | 'linear' },
                    }))}
                    className={inputClassName}
                  >
                    <option value="linear">Progression linéaire</option>
                    <option value="stable">Volume stable</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="Départ"
                    value={config.volume.startPercent}
                    suffix="%"
                    min={50}
                    max={150}
                    onChange={(value) => updateConfig((current) => ({ ...current, volume: { ...current.volume, startPercent: value } }))}
                  />
                  <NumberField
                    label="Arrivée"
                    value={config.volume.mode === 'stable' ? config.volume.startPercent : config.volume.endPercent}
                    suffix="%"
                    min={50}
                    max={150}
                    disabled={config.volume.mode === 'stable'}
                    onChange={(value) => updateConfig((current) => ({ ...current, volume: { ...current.volume, endPercent: value } }))}
                  />
                </div>
              </Fieldset>

              <Fieldset title="Proximité de l’échec">
                <div className="grid grid-cols-2 gap-2">
                  <NumberField
                    label="RIR départ"
                    value={config.rir.start}
                    min={0}
                    max={5}
                    step={0.5}
                    onChange={(value) => updateConfig((current) => ({ ...current, rir: { ...current.rir, start: value } }))}
                  />
                  <NumberField
                    label="RIR arrivée"
                    value={config.rir.end}
                    min={0}
                    max={5}
                    step={0.5}
                    onChange={(value) => updateConfig((current) => ({ ...current, rir: { ...current.rir, end: value } }))}
                  />
                </div>
              </Fieldset>

              <Fieldset title="Semaine de décharge">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <span>
                    <span className="block text-[11px] font-semibold text-white/70">Ajouter un deload final</span>
                    <span className="mt-0.5 block text-[9px] text-white/30">Réduction du volume et RIR plus élevé</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={config.deload.enabled}
                    onChange={(event) => updateConfig((current) => ({ ...current, deload: { ...current.deload, enabled: event.target.checked } }))}
                    className="h-4 w-4 accent-[#1f8a65]"
                  />
                </label>
                {config.deload.enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField
                      label="Volume deload"
                      value={config.deload.volumePercent}
                      suffix="%"
                      min={40}
                      max={100}
                      onChange={(value) => updateConfig((current) => ({ ...current, deload: { ...current.deload, volumePercent: value } }))}
                    />
                    <NumberField
                      label="RIR deload"
                      value={config.deload.rir}
                      min={0}
                      max={5}
                      step={0.5}
                      onChange={(value) => updateConfig((current) => ({ ...current, deload: { ...current.deload, rir: value } }))}
                    />
                  </div>
                )}
              </Fieldset>

              <Fieldset title="Garde-fou">
                <NumberField
                  label="Maximum de séries par exercice"
                  value={config.safety.maxSetsPerExercise}
                  min={1}
                  max={12}
                  onChange={(value) => updateConfig((current) => ({ ...current, safety: { ...current.safety, maxSetsPerExercise: value } }))}
                />
              </Fieldset>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">Aperçu calculé</p>
                <p className="mt-1 text-[11px] text-white/45">Volume, RIR et source de chaque semaine</p>
              </div>
              {preview && (
                <span className="rounded-full border border-[#1f8a65]/25 bg-[#1f8a65]/10 px-2.5 py-1 text-[9px] font-semibold text-[#6bc8a5]">
                  {preview.outputWeekCount} semaines prêtes
                </span>
              )}
            </div>

            {!preview ? (
              <div className="mt-5 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-8 text-center">
                <Sparkles size={22} className="text-[#1f8a65]/70" />
                <p className="mt-3 text-[13px] font-semibold text-white/65">Configurez puis prévisualisez</p>
                <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-white/30">
                  L’aperçu montre précisément les ajustements avant toute écriture dans le programme.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {preview.weeks.map((week) => (
                  <article key={week.position} className={`rounded-xl border p-3 ${week.weekType === 'deload' ? 'border-[#86aeb8]/25 bg-[#86aeb8]/[0.06]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-white/75">{week.label}</p>
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">{weekTypeLabels[week.weekType]}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] text-white/25">Source : {week.sourceWeekLabel}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label="Volume" value={`${week.volumePercent}%`} />
                      <Metric label="RIR cible" value={String(week.targetRir)} />
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[9px] text-white/30">
                      <span>{week.sourceTotalSets} séries</span>
                      <ArrowRight size={9} />
                      <span className="font-semibold text-white/55">≈ {week.projectedTotalSets}</span>
                    </div>
                    <p className="mt-1 text-[9px] text-white/25">{week.sessionCount} séances · {week.exerciseCount} exercices</p>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-300/70" />
              <p className="text-[10px] leading-relaxed text-amber-100/45">
                L’application remplacera les {weeks.length} semaines actuelles. Les historiques d’entraînement restent conservés grâce aux identifiants de lignée.
              </p>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2.5 text-[10px] text-red-200/75">{error}</p>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-3.5">
          <p className="text-[9px] text-white/25">Moteur {MESOCYCLE_ENGINE_VERSION} · Les exercices cardio/temps ne sont pas modifiés.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={Boolean(loading)} className="h-9 rounded-lg border border-white/[0.07] px-3 text-[10px] font-semibold text-white/45 hover:text-white/70 disabled:opacity-40">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => void requestMesocycle('preview')}
              disabled={Boolean(loading) || config.sourceWeekIds.length === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 text-[10px] font-semibold text-white/65 hover:bg-white/[0.07] disabled:opacity-40"
            >
              {loading === 'preview' && <Loader2 size={12} className="animate-spin" />}
              Prévisualiser
            </button>
            <button
              type="button"
              onClick={() => void requestMesocycle('apply')}
              disabled={Boolean(loading) || !preview}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#1f8a65] px-3.5 text-[10px] font-bold text-white transition-colors hover:bg-[#257f62] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {loading === 'apply' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Appliquer le mésocycle
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">{title}</p>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-medium text-white/45">{label}</span>
      {children}
    </label>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[9px] font-medium text-white/35">{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${inputClassName} ${suffix ? 'pr-8' : ''} disabled:opacity-35`}
        />
        {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-white/25">{suffix}</span>}
      </span>
    </label>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.1em] text-white/25">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-white/70">{value}</p>
    </div>
  )
}
