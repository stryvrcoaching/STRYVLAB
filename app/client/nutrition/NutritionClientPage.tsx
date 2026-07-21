'use client'

import { useState, useCallback, useMemo, useEffect, startTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import ClientTopBar from '@/components/client/ClientTopBar'
import SmartNutritionHero from '@/components/client/smart/SmartNutritionHero'
import SmartAlertsFeed, { type GenericAlert } from '@/components/client/smart/SmartAlertsFeed'
import MacroWeekGrid from '@/components/client/smart/MacroWeekGrid'
import NutritionMealsList from '@/components/client/smart/NutritionMealsList'
import NutritionStreakCard from '@/components/client/smart/NutritionStreakCard'
import PeriodSegmentedControl from '@/components/client/smart/PeriodSegmentedControl'
import SectionEyebrow from '@/components/client/smart/SectionEyebrow'
import TdeeChart from '@/components/client/smart/TdeeChart'
import KcalVariationChart from '@/components/client/smart/KcalVariationChart'
import TdeeVsIntakeChart from '@/components/client/smart/TdeeVsIntakeChart'
import { clientLocale, ct, type ClientLang, type ClientDictKey } from '@/lib/i18n/clientTranslations'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import type { NutritionMeal } from '@/lib/nutrition/food-items'
import type { SmartNutritionPrep } from '@/components/client/smart/SmartNutritionPrepList'
import CycleSyncBanner from '@/components/client/nutrition/CycleSyncBanner'
import type { CyclePhase, CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'
import { NUTRITION_LIVE_EVENT, consumeNutritionLiveRefreshQueue, type NutritionLiveRefreshPayload } from '@/lib/client/nutrition-live'
import { prefetchNutritionRoutes, warmNutritionFlows } from '@/lib/client/prefetch-nutrition-flows'
import { localizeNutritionScenarioLabel } from '@/lib/nutrition/scenario-labels'
import type { SmartPrepSlot } from '@/lib/nutrition/simulation-state'
import { computeActionableRemaining } from '@/lib/nutrition/actionable-remaining'
import ClientWeekDayPicker from '@/components/client/ClientWeekDayPicker'

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false })
const CyclePhaseModal   = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'),   { ssr: false })
const PhotoMealRefineSheet = dynamic(() => import('@/components/client/smart/PhotoMealRefineSheet'), { ssr: false })
const QuickWaterModal   = dynamic(() => import('@/components/client/QuickWaterModal'),         { ssr: false })

type DayPoint = {
  date: string
  consumed: number
  protein_g: number
  carbs_g: number
  fat_g: number
  target: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
}

type Tab = 'suivi' | 'plan' | 'tendances'

interface Props {
  initialTab?: Tab
  date: string
  target: NutritionMacros
  consumed: NutritionMacros
  meals: NutritionMeal[]
  preps: SmartNutritionPrep[]
  alerts: GenericAlert[]
  trend: DayPoint[]
  loggedDates: Set<string>
  tdeeAdaptive: number | null
  tdeeDataSource: string | null
  bodyWeightKg: number | null
  gender?: string | null
  protocolDay: { name?: string; [key: string]: unknown } | null
  protocolDays?: Array<{
    name: string
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    carb_cycle_type?: string | null
    recommendations?: string | null
  }>
  scheduleSlots?: Array<{ dow: number; dayName: string; carbCycleType: string | null }>
  lang: ClientLang
  dayTypeBadge: React.ReactNode
  cycleSyncPhase?: CyclePhase | null
  cycleSyncAdjustment?: CycleSyncAdjustment | null
  cycleDay?: number | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean
}

const TABS: { id: Tab; labelKey?: ClientDictKey; label?: string }[] = [
  { id: 'suivi',     labelKey: 'nutrition.tab.suivi'     },
  { id: 'plan',      label: 'Plan' },
  { id: 'tendances', labelKey: 'nutrition.tab.tendances' },
]

const NUTRITION_TREND_OPTIONS = [
  { value: 7, label: '7j' },
  { value: 14, label: '14j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
] as const

export default function NutritionClientPage({
  initialTab = 'suivi',
  date, target, consumed, meals, preps, alerts, trend,
  loggedDates, tdeeAdaptive: _tdeeAdaptive, tdeeDataSource: _tdeeDataSource, bodyWeightKg,
  gender,
  protocolDay: _protocolDay, protocolDays: _protocolDays, scheduleSlots: _scheduleSlots,
  lang, dayTypeBadge,
  cycleSyncPhase, cycleSyncAdjustment, cycleDay,
  cycleState,
  cycleSyncEnabled: _cycleSyncEnabled = false,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [trendDays, setTrendDays] = useState<7 | 14 | 30 | 90>(30)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const [photoMealRefineId, setPhotoMealRefineId] = useState<string | null>(null)

  // ── TanStack Query : snapshot live nutrition ──────────────────────────────
  const snapshotQueryKey = useMemo(() => ['nutrition-today', date] as const, [date])

  type NutritionSnapshot = {
    consumed: NutritionMacros
    meals: NutritionMeal[]
    preps: SmartNutritionPrep[]
  }

  const { data: liveSnapshot } = useQuery<NutritionSnapshot>({
    queryKey: snapshotQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/client/nutrition/today?date=${date}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('snapshot fetch failed')
      return res.json()
    },
    initialData: { consumed, meals, preps },
    staleTime: 30_000,        // 30s avant re-fetch
    gcTime: 24 * 60 * 60 * 1000, // 24h en cache
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  })

  // Normaliser les preps (localisation, defaults)
  const liveConsumed = liveSnapshot.consumed ?? consumed
  const liveMeals = liveSnapshot.meals ?? meals
  const livePreps = useMemo(() => {
    const rawPreps: SmartNutritionPrep[] = liveSnapshot.preps ?? preps
    return rawPreps.map((prep) => ({
      ...prep,
      meal_slot: prep.meal_slot ?? (prep.meal_type as SmartPrepSlot) ?? 'snack',
      variant_group_id: prep.variant_group_id ?? prep.meal_slot ?? prep.meal_type ?? 'snack',
      scenario_key: prep.scenario_key ?? 'default',
      scenario_label: localizeNutritionScenarioLabel(lang, prep.scenario_label),
      is_active: prep.is_active === true,
      entries: Array.isArray(prep.entries) ? prep.entries : [],
      total_calories: Number(prep.total_calories ?? 0),
      total_protein_g: Number(prep.total_protein_g ?? 0),
      total_carbs_g: Number(prep.total_carbs_g ?? 0),
      total_fat_g: Number(prep.total_fat_g ?? 0),
      total_fiber_g: Number(prep.total_fiber_g ?? 0),
    }))
  }, [liveSnapshot.preps, preps, lang])

  const planSummary = useMemo(() => {
    const activePlannedPreps = livePreps.filter(
      prep => prep.status === 'planned' && prep.is_active === true,
    )
    const planned = activePlannedPreps.reduce(
      (total, prep) => ({
        kcal: total.kcal + prep.total_calories,
        protein_g: total.protein_g + prep.total_protein_g,
        carbs_g: total.carbs_g + prep.total_carbs_g,
        fat_g: total.fat_g + prep.total_fat_g,
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    )
    const projected: NutritionMacros = {
      ...liveConsumed,
      kcal: (liveConsumed.kcal ?? 0) + planned.kcal,
      protein_g: (liveConsumed.protein_g ?? 0) + planned.protein_g,
      carbs_g: (liveConsumed.carbs_g ?? 0) + planned.carbs_g,
      fat_g: (liveConsumed.fat_g ?? 0) + planned.fat_g,
    }
    const actionable = computeActionableRemaining({
      target: {
        kcal: target.kcal,
        protein_g: target.protein_g,
        carbs_g: target.carbs_g,
        fat_g: target.fat_g,
      },
      consumed: projected,
      profile: { gender, weightKg: bodyWeightKg },
    })

    return {
      projected,
      adjustedTarget: {
        ...target,
        protein_g: Math.max(0, target.protein_g - actionable.compensation.proteinReducedG),
        carbs_g: Math.max(0, target.carbs_g - actionable.compensation.carbsReducedG),
        fat_g: Math.max(0, target.fat_g - actionable.compensation.fatReducedG),
      },
    }
  }, [bodyWeightKg, gender, liveConsumed, livePreps, target])

  const fetchLiveNutritionSnapshot = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: snapshotQueryKey })
  }, [queryClient, snapshotQueryKey])

  useEffect(() => {
    void fetchLiveNutritionSnapshot()
  }, [date, fetchLiveNutritionSnapshot])


  useEffect(() => {
    const pending = consumeNutritionLiveRefreshQueue(date)
    if (pending.length > 0) {
      fetchLiveNutritionSnapshot()
    }

    function handleLiveRefresh(event: Event) {
      const payload = (event as CustomEvent<NutritionLiveRefreshPayload>).detail
      if (!payload) return
      // refreshAll is emitted by flushOfflineMutations after syncing preps/meals
      if ((payload as any).refreshAll || payload.date === date) {
        fetchLiveNutritionSnapshot()
      }
    }

    window.addEventListener(NUTRITION_LIVE_EVENT, handleLiveRefresh as EventListener)
    return () => {
      window.removeEventListener(NUTRITION_LIVE_EVENT, handleLiveRefresh as EventListener)
    }
  }, [date, fetchLiveNutritionSnapshot])

  useEffect(() => {
    const cancelWarmup = warmNutritionFlows(router, date)
    return () => {
      cancelWarmup?.()
    }
  }, [date, router])

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  const updateTab = useCallback((nextTab: Tab) => {
    setTab(nextTab)
    startTransition(() => {
      const params = new URLSearchParams(window.location.search)
      params.delete('tab')
      if (nextTab === 'tendances') {
        params.set('tab', nextTab)
      }
      const query = params.toString()
      const route = nextTab === 'plan' ? '/client/nutrition/plan' : '/client/nutrition'
      router.replace(query ? `${route}?${query}` : route, { scroll: false })
    })
  }, [router])

  const handleMealLogSuccess = useCallback(() => {
    void fetchLiveNutritionSnapshot()
    router.refresh()
  }, [fetchLiveNutritionSnapshot, router])

  // Ouvrir le log pour un nouveau repas (depuis FAB + ou bouton "Ajouter un repas")
  const openNewMealLog = useCallback(() => {
    prefetchNutritionRoutes(router, date)
    const params = new URLSearchParams({ date })
    router.push(`/client/nutrition/log?${params.toString()}`)
  }, [date, router])

  const openPhotoMealRefine = useCallback((mealId: string) => {
    setPhotoMealRefineId(mealId)
  }, [])

  // Ouvrir le log pour ajouter des ingrédients à un repas existant
  const handleAddMore = useCallback((mealId: string) => {
    prefetchNutritionRoutes(router, date)
    const params = new URLSearchParams({ date, meal_id: mealId })
    router.push(`/client/nutrition/log?${params.toString()}`)
  }, [date, router])

  // Ouvrir le composer (mode guide) pour créer/éditer un prep
  const openPrepEdit = useCallback((prep: SmartNutritionPrep) => {
    const prepDate = prep.planned_for?.slice(0, 10) ?? prep.physiological_date ?? date
    prefetchNutritionRoutes(router, prepDate)
    router.push(`/client/nutrition/compose?date=${prepDate}&prep_id=${prep.id}`)
  }, [date, router])

  // Ouvrir le composer (mode guide) pour un nouveau prep
  const openComposer = useCallback(() => {
    prefetchNutritionRoutes(router, date)
    router.push(`/client/nutrition/compose?date=${date}`)
  }, [date, router])

  // ── TopBar left: onglets ─────────────────────────────────────────────────
  const topBarLeft = (
    <div className="flex gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
      {TABS.map(({ id, labelKey, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => updateTab(id)}
          className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.01em] transition-[background-color,color] duration-150 ${
            tab === id
              ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
              : 'text-white/45'
          }`}
        >
          {labelKey ? ct(lang, labelKey) : label}
        </button>
      ))}
    </div>
  )

  // ── TopBar right: badge jour + arc cycle ─────────────────────────────────
  const topBarRight = (
    <div className="flex items-center gap-2">
      {dayTypeBadge}
      {cycleState?.currentPhase && cycleState.currentCycleDay && (
        <>
          <CycleArcIndicator
            phase={cycleState.currentPhase}
            cycleDay={cycleState.currentCycleDay}
            avgCycleLength={cycleState.avgCycleLengthDays}
            menstrualLength={cycleState.menstrualPhaseLengthDays}
            confidence={cycleState.confidence}
            onClick={() => setCycleModalOpen(true)}
          />
          <CyclePhaseModal
            open={cycleModalOpen}
            phase={cycleState.currentPhase}
            cycleDay={cycleState.currentCycleDay}
            avgCycleLength={cycleState.avgCycleLengthDays}
            context="nutrition"
            onClose={() => setCycleModalOpen(false)}
          />
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-dvh bg-[#121212] font-barlow overflow-x-hidden">
      <ClientTopBar left={topBarLeft} right={topBarRight} />

      <main className="client-page-top mx-auto flex max-w-[480px] flex-col gap-3 px-4">

        {/* ══ SUIVI ══ */}
        {(tab === 'suivi' || tab === 'plan') && (
          <>
            {cycleSyncPhase && cycleSyncAdjustment && (
              <CycleSyncBanner
                phase={cycleSyncPhase}
                adjustment={cycleSyncAdjustment}
                cycleDay={cycleDay ?? undefined}
              />
            )}
            <ClientWeekDayPicker
              anchorDate={date}
              selectedDate={date}
              locale={clientLocale(lang)}
              continuous
              onSelectDate={(selectedDate) => {
                const route = tab === 'plan' ? '/client/nutrition/plan' : '/client/nutrition'
                router.push(`${route}?date=${selectedDate}`)
              }}
            />
            <SmartNutritionHero
              consumed={tab === 'plan' ? planSummary.projected : liveConsumed}
              target={tab === 'plan' ? planSummary.adjustedTarget : target}
              onWaterClick={tab === 'plan' ? undefined : () => setWaterOpen(true)}
              hideHydration={tab === 'plan'}
            />
            {tab === 'suivi' && <SmartAlertsFeed alerts={alerts} />}
            <NutritionMealsList
              key={date}
              initialMeals={liveMeals}
              initialPreps={livePreps}
              date={date}
              view={tab === 'plan' ? 'planning' : 'bilan'}
              onAddMeal={openNewMealLog}
              onRefinePhotoMeal={openPhotoMealRefine}
              onAddMore={handleAddMore}
              onEditPrep={openPrepEdit}
              onNewPrep={openComposer}
              onPrepValidated={() => {
                void fetchLiveNutritionSnapshot()
                router.refresh()
              }}
            />
          </>
        )}

        {/* ══ TENDANCES ══ */}
        {tab === 'tendances' && (
          <div className="flex flex-col gap-4">
            <MacroWeekGrid trend={trend} />
            <NutritionStreakCard loggedDates={loggedDates} today={date} />

            <PeriodSegmentedControl options={NUTRITION_TREND_OPTIONS} value={trendDays} onChange={setTrendDays} />

            <div className="flex flex-col gap-2.5">
              <SectionEyebrow>{ct(lang, 'nutrition.analysis.energy')}</SectionEyebrow>
              <div className="flex flex-col gap-4">
                <TdeeChart days={trendDays} />
                <KcalVariationChart days={trendDays} />
                <TdeeVsIntakeChart days={trendDays} />
              </div>
            </div>
          </div>
        )}

      </main>
      <PhotoMealRefineSheet
        open={!!photoMealRefineId}
        mealId={photoMealRefineId}
        onClose={() => setPhotoMealRefineId(null)}
        onSuccess={handleMealLogSuccess}
      />
      <QuickWaterModal open={waterOpen} onClose={() => setWaterOpen(false)} date={date} />
    </div>
  )
}
