'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Plus, Search, X } from 'lucide-react'
import exerciseCatalog from '@/data/exercise-catalog.json'
import { useClientT } from '@/components/client/ClientI18nProvider'
import useBodyScrollLock from '@/components/client/useBodyScrollLock'
import {
  getExerciseLibraryMetadataLabel,
  getExerciseLibraryMovementLabel,
  getExerciseLibraryMuscleGroupLabel,
} from '@/lib/i18n/exerciseLibraryLabels'

export type ExerciseLibraryEntry = {
  id: string
  name: string
  gifUrl?: string
  muscleGroup?: string
  exerciseType?: string
  movementPattern?: string | null
  equipment?: string[]
  isCompound?: boolean
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
}

type PreparedExercise = ExerciseLibraryEntry & {
  displayName: string
  searchIndex: string
}

const PAGE_SIZE = 24
const catalog = exerciseCatalog as ExerciseLibraryEntry[]

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const preparedExercises: PreparedExercise[] = catalog
  .filter((entry) => Boolean(entry.name?.trim()))
  .map((entry) => ({
    ...entry,
    displayName: entry.name.trim(),
    searchIndex: normalizeSearchText([
      entry.name,
      entry.muscleGroup,
      entry.primaryMuscle,
      ...(entry.primaryMuscles ?? []),
      ...(entry.secondaryMuscles ?? []),
      entry.movementPattern,
      ...(entry.equipment ?? []),
    ].filter(Boolean).join(' ')),
  }))

const muscleGroups = Array.from(new Set(preparedExercises.map((entry) => entry.muscleGroup).filter(Boolean))) as string[]
const movementPatterns = Array.from(new Set(preparedExercises.map((entry) => entry.movementPattern).filter(Boolean))) as string[]

interface ExerciseLibrarySheetProps {
  onClose: () => void
  onSelect: (exercise: ExerciseLibraryEntry) => Promise<void>
  onCreateCustom: () => void
}

export default function ExerciseLibrarySheet({ onClose, onSelect, onCreateCustom }: ExerciseLibrarySheetProps) {
  const { lang, t } = useClientT()
  const [mounted, setMounted] = useState(false)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [movementPattern, setMovementPattern] = useState('')
  const [resultLimit, setResultLimit] = useState(PAGE_SIZE)
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)

  useBodyScrollLock(mounted)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (lang === 'fr') {
      setTranslations({})
      return
    }
    let cancelled = false
    fetch('/api/client/exercise-translations')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!cancelled) setTranslations(data?.translations ?? {})
      })
      .catch(() => {
        if (!cancelled) setTranslations({})
      })
    return () => { cancelled = true }
  }, [lang])

  useEffect(() => {
    setResultLimit(PAGE_SIZE)
  }, [deferredSearch, muscleGroup, movementPattern])

  const localizedExercises = useMemo(() => preparedExercises.map((entry) => {
    const displayName = translations[entry.id] ?? translations[entry.name] ?? entry.displayName
    return {
      ...entry,
      displayName,
      searchIndex: normalizeSearchText(`${entry.searchIndex} ${displayName}`),
    }
  }), [translations])

  const filteredExercises = useMemo(() => {
    const normalizedSearch = normalizeSearchText(deferredSearch)
    return localizedExercises.filter((entry) => {
      const matchesGroup = !muscleGroup || entry.muscleGroup === muscleGroup
      const matchesPattern = !movementPattern || entry.movementPattern === movementPattern
      const matchesSearch = !normalizedSearch || entry.searchIndex.includes(normalizedSearch)
      return matchesGroup && matchesPattern && matchesSearch
    })
  }, [deferredSearch, localizedExercises, muscleGroup, movementPattern])

  const visibleExercises = filteredExercises.slice(0, resultLimit)
  const canLoadMore = filteredExercises.length > resultLimit
  const localizedMuscleGroups = useMemo(() => muscleGroups
    .map((value) => ({ value, label: getExerciseLibraryMuscleGroupLabel(value, lang) }))
    .sort((first, second) => first.label.localeCompare(second.label, lang)), [lang])
  const localizedMovementPatterns = useMemo(() => movementPatterns
    .map((value) => ({ value, label: getExerciseLibraryMovementLabel(value, lang) }))
    .sort((first, second) => first.label.localeCompare(second.label, lang)), [lang])

  async function selectExercise(exercise: ExerciseLibraryEntry) {
    if (addingExerciseId) return
    setAddingExerciseId(exercise.id)
    setError(null)

    try {
      await onSelect(exercise)
      onClose()
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : t('common.unknownError'))
    } finally {
      setAddingExerciseId(null)
    }
  }

  const close = () => {
    if (!addingExerciseId) onClose()
  }

  if (!mounted) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label={t('ui.close')}
        onClick={close}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-library-title"
        className="client-native-bottom-sheet fixed bottom-0 left-0 right-0 z-[70] flex max-h-[88dvh] flex-col rounded-t-[28px] bg-[#121212] shadow-2xl"
        style={{ paddingBottom: 'var(--client-modal-bottom-padding)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/[0.10]" />

        <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-5">
          <div>
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#1f8a65]">
              {t('logger.library.title')}
            </p>
            <h2 id="exercise-library-title" className="mt-1 text-[20px] font-bold tracking-[-0.035em] text-white">
              {t('logger.library.addTitle')}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t('ui.close')}
            onClick={close}
            disabled={Boolean(addingExerciseId)}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 disabled:opacity-30"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex shrink-0 flex-col gap-3 px-5 pb-4">
          <label className="flex h-12 items-center gap-2 rounded-xl bg-[#0d0d0d] px-3 focus-within:ring-2 focus-within:ring-white/10">
            <Search size={15} className="text-white/30" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('logger.library.search')}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/25"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={muscleGroup}
              onChange={(event) => setMuscleGroup(event.target.value)}
              aria-label={t('logger.field.muscleGroup')}
              className="h-10 min-w-0 rounded-xl bg-white/[0.045] px-3 text-[11px] font-medium text-white/70 outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="">{t('common.all')}</option>
              {localizedMuscleGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
            </select>
            <select
              value={movementPattern}
              onChange={(event) => setMovementPattern(event.target.value)}
              aria-label={t('logger.field.movementType')}
              className="h-10 min-w-0 rounded-xl bg-white/[0.045] px-3 text-[11px] font-medium text-white/70 outline-none focus:ring-2 focus:ring-white/10"
            >
              <option value="">{t('logger.library.allMoves')}</option>
              {localizedMovementPatterns.map((pattern) => <option key={pattern.value} value={pattern.value}>{pattern.label}</option>)}
            </select>
          </div>

          {error ? <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[11px] text-red-200">{error}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <div className="space-y-2">
            {visibleExercises.map((exercise) => {
              const isAdding = addingExerciseId === exercise.id

              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => void selectExercise(exercise)}
                  disabled={Boolean(addingExerciseId)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.045] p-2.5 text-left transition-colors hover:bg-white/[0.065] active:bg-white/[0.08] disabled:opacity-60"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.05]">
                    {exercise.gifUrl ? (
                      <img src={exercise.gifUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : <span className="text-[18px] text-white/15">💪</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-white">{exercise.displayName}</p>
                    <p className="mt-1 text-[10px] leading-snug text-white/40">
                      {getExerciseLibraryMetadataLabel({
                        muscleGroup: exercise.muscleGroup,
                        primaryMuscle: exercise.primaryMuscle,
                        lang,
                      }) || t('logger.library.title')}
                    </p>
                  </div>
                  <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-2.5 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] text-white/75">
                    {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {isAdding ? `${t('common.add')}…` : t('common.add')}
                  </span>
                </button>
              )
            })}
          </div>

          {filteredExercises.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.045] px-4 py-8 text-center">
              <p className="text-[13px] font-semibold text-white">{t('logger.library.none')}</p>
              <p className="mt-1 text-[11px] text-white/40">{t('logger.library.noneDesc')}</p>
            </div>
          ) : null}

          {canLoadMore ? (
            <button
              type="button"
              onClick={() => setResultLimit((limit) => limit + PAGE_SIZE)}
              className="mt-3 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white/70"
            >
              {t('logger.library.more')}
            </button>
          ) : null}
        </div>

        <footer className="shrink-0 bg-[#121212] px-5 pt-3">
          <button
            type="button"
            onClick={onCreateCustom}
            disabled={Boolean(addingExerciseId)}
            className="h-11 w-full rounded-xl bg-white/[0.05] font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-white/80 disabled:opacity-30"
          >
            {t('logger.create.customExercise')}
          </button>
        </footer>
      </section>
    </>,
    document.body,
  )
}
