'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ClientTopBar from '@/components/client/ClientTopBar'
import SmartNutritionHero from '@/components/client/smart/SmartNutritionHero'
import SmartAlertsFeed, { type GenericAlert } from '@/components/client/smart/SmartAlertsFeed'
import RemainingBreakdown from '@/components/client/smart/RemainingBreakdown'
import MacroWeekGrid from '@/components/client/smart/MacroWeekGrid'
import NutritionMealsList from '@/components/client/smart/NutritionMealsList'
import NutritionStreakCard from '@/components/client/smart/NutritionStreakCard'
import TdeeChart from '@/components/client/smart/TdeeChart'
import KcalVariationChart from '@/components/client/smart/KcalVariationChart'
import TdeeVsIntakeChart from '@/components/client/smart/TdeeVsIntakeChart'
import { ct, type ClientLang, type ClientDictKey } from '@/lib/i18n/clientTranslations'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import type { NutritionMeal } from '@/lib/nutrition/food-items'
import type { SmartNutritionPrep } from '@/components/client/smart/SmartNutritionPrepList'
import CycleSyncBanner from '@/components/client/nutrition/CycleSyncBanner'
import type { CyclePhase, CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'

const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false })
const CyclePhaseModal   = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'),   { ssr: false })
const MealLogSheet      = dynamic(() => import('@/components/client/smart/MealLogSheet'),      { ssr: false })
const QuickWaterModal   = dynamic(() => import('@/components/client/QuickWaterModal'),         { ssr: false })
const VoiceLogSheet     = dynamic(() => import('@/components/client/smart/VoiceLogSheet'),     { ssr: false })

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

type Tab = 'suivi' | 'tendances'

interface Props {
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

const TABS: { id: Tab; labelKey: ClientDictKey }[] = [
  { id: 'suivi',     labelKey: 'nutrition.tab.suivi'     },
  { id: 'tendances', labelKey: 'nutrition.tab.tendances' },
]

export default function NutritionClientPage({
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
  const [tab, setTab] = useState<Tab>('suivi')
  const [trendDays, setTrendDays] = useState<7 | 14 | 30 | 90>(30)
  const [mealLogOpen, setMealLogOpen] = useState(false)
  const [mealComposerMode, setMealComposerMode] = useState<"standard" | "guide" | "simulation">("standard")
  const [addToMealId, setAddToMealId] = useState<string | null>(null)
  const [editingPrep, setEditingPrep] = useState<SmartNutritionPrep | null>(null)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)

  const handleMealLogSuccess = useCallback(() => {
    setMealLogOpen(false)
    setMealComposerMode("standard")
    setAddToMealId(null)
    setEditingPrep(null)
    router.refresh()
  }, [router])

  const handleVoiceSuccess = useCallback(() => {
    setVoiceOpen(false)
    router.refresh()
  }, [router])

  // Ouvrir le log pour un nouveau repas (depuis FAB + ou bouton "Ajouter un repas")
  const openNewMealLog = useCallback(() => {
    setAddToMealId(null)
    setEditingPrep(null)
    setMealComposerMode("standard")
    setMealLogOpen(true)
  }, [])

  // Ouvrir le log pour ajouter des ingrédients à un repas existant
  const handleAddMore = useCallback((mealId: string) => {
    setAddToMealId(mealId)
    setEditingPrep(null)
    setMealComposerMode("standard")
    setMealLogOpen(true)
  }, [])

  // Ouvrir le composer (mode guide) pour créer/éditer un prep
  const openPrepEdit = useCallback((prep: SmartNutritionPrep) => {
    setEditingPrep(prep)
    setAddToMealId(null)
    setMealComposerMode("guide")
    setMealLogOpen(true)
  }, [])

  // Ouvrir le composer (mode guide) pour un nouveau prep
  const openComposer = useCallback(() => {
    setAddToMealId(null)
    setEditingPrep(null)
    setMealComposerMode("guide")
    setMealLogOpen(true)
  }, [])

  // ── TopBar left: onglets ─────────────────────────────────────────────────
  const topBarLeft = (
    <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
      {TABS.map(({ id, labelKey }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-wide transition-all duration-200 ${
            tab === id
              ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
              : 'text-white/40'
          }`}
        >
          {ct(lang, labelKey)}
        </button>
      ))}
    </div>
  )

  // ── TopBar right: badge jour + arc cycle ─────────────────────────────────
  const topBarRight = (
    <div className="flex flex-col items-end gap-0.5">
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

  const balanceContextConsumed = useMemo(() => {
    if (mealComposerMode !== "guide") {
      return consumed
    }
    const base = { ...consumed }
    for (const p of preps) {
      if (p.is_active && p.id !== editingPrep?.id) {
        base.kcal += p.total_calories
        base.protein_g += p.total_protein_g
        base.carbs_g += p.total_carbs_g
        base.fat_g += p.total_fat_g
      }
    }
    return base
  }, [consumed, preps, editingPrep, mealComposerMode])

  return (
    <div className="min-h-screen bg-[#0d0d0d] font-barlow pb-32">
      <ClientTopBar left={topBarLeft} right={topBarRight} />

      <main className="max-w-[480px] mx-auto px-4 pt-[72px] flex flex-col gap-3">

        {/* ══ SUIVI ══ */}
        {tab === 'suivi' && (
          <>
            {cycleSyncPhase && cycleSyncAdjustment && (
              <CycleSyncBanner
                phase={cycleSyncPhase}
                adjustment={cycleSyncAdjustment}
                cycleDay={cycleDay ?? undefined}
              />
            )}
            <SmartNutritionHero date={date} consumed={consumed} target={target} onWaterClick={() => setWaterOpen(true)} />
            <SmartAlertsFeed alerts={alerts} />
            <RemainingBreakdown
              consumed={consumed}
              target={target}
              gender={gender}
              bodyWeightKg={bodyWeightKg}
            />
            <NutritionMealsList
              key={date}
              initialMeals={meals}
              initialPreps={preps}
              date={date}
              target={target}
              consumed={consumed}
              onAddMeal={openNewMealLog}
              onAddMore={handleAddMore}
              onEditPrep={openPrepEdit}
              onNewPrep={openComposer}
              onPrepValidated={() => router.refresh()}
              gender={gender}
              bodyWeightKg={bodyWeightKg}
            />
          </>
        )}

        {/* ══ TENDANCES ══ */}
        {tab === 'tendances' && (
          <>
            <MacroWeekGrid trend={trend} />
            <NutritionStreakCard loggedDates={loggedDates} today={date} />

            <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1">
              {([7, 14, 30, 90] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setTrendDays(d)}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-200 ${
                    trendDays === d ? 'bg-white/[0.08] text-white' : 'text-white/30'
                  }`}
                >
                  {d}j
                </button>
              ))}
            </div>

            <TdeeChart days={trendDays} />
            <KcalVariationChart days={trendDays} />
            <TdeeVsIntakeChart days={trendDays} />
          </>
        )}

      </main>

      {/* ── Sheets & modals ── */}
      <MealLogSheet
        open={mealLogOpen}
        mealId={addToMealId}
        prep={editingPrep}
        composerMode={mealComposerMode}
        intent={mealComposerMode === "standard" ? "track" : "compose"}
        activeDate={date}
        onClose={() => {
          setMealLogOpen(false)
          setMealComposerMode("standard")
          setAddToMealId(null)
          setEditingPrep(null)
        }}
        onSuccess={handleMealLogSuccess}
        balanceContext={{ consumed: balanceContextConsumed, target, profile: { gender, weightKg: bodyWeightKg } }}
      />
      <VoiceLogSheet
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSuccess={handleVoiceSuccess}
        lang={lang}
        initialInputMode="voice"
      />
      <QuickWaterModal open={waterOpen} onClose={() => setWaterOpen(false)} date={date} />
    </div>
  )
}
