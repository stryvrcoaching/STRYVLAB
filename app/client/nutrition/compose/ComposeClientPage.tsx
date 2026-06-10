'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Mic, Pencil, Plus, Sparkles } from 'lucide-react'
import { shiftIsoDate } from '@/lib/utils/date'
import SmartNutritionHero from '@/components/client/smart/SmartNutritionHero'
import SmartNutritionPrepList, { type SmartNutritionPrep } from '@/components/client/smart/SmartNutritionPrepList'
import { NutritionLogContent, type NutritionLogContentHandle, type NutritionLogLayer } from '@/app/client/nutrition/log/NutritionLogContent'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import { computeSimulationState } from '@/lib/nutrition/simulation-state'
import { collectSimulationScenarios, createNextScenarioOption, normalizeScenarioKey, type SimulationScenarioOption } from '@/lib/nutrition/simulation-scenarios'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { FlashMessage, useFlash } from '@/components/client/smart/FlashMessage'

interface ComposeClientPageProps {
  consumed: NutritionMacros
  target: NutritionMacros
  date: string
  todayDate: string
  initialPreps: SmartNutritionPrep[]
  gender?: string | null
  bodyWeightKg?: number | null
}

type DraftTotals = { calories: number; protein: number; carbs: number; fat: number; count: number }
type PrepSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const ZERO_DRAFTS: DraftTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }

export default function ComposeClientPage({ consumed, target, date, todayDate, initialPreps, gender, bodyWeightKg }: ComposeClientPageProps) {
  const { t } = useClientT()
  const router = useRouter()
  const logRef = useRef<NutritionLogContentHandle>(null)
  const [draftTotals, setDraftTotals] = useState<DraftTotals>(ZERO_DRAFTS)
  const [saving, setSaving] = useState<'prep' | 'meal' | null>(null)
  const [editingPrep, setEditingPrep] = useState<SmartNutritionPrep | null>(null)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [contentLayer, setContentLayer] = useState<NutritionLogLayer>('category')
  const [scenarioOptions, setScenarioOptions] = useState<SimulationScenarioOption[]>(() => {
    const dbOptions = collectSimulationScenarios(initialPreps)
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`compose-scenarios-${date}`)
        if (stored) {
          const parsed = JSON.parse(stored) as SimulationScenarioOption[]
          const merged = new Map<string, SimulationScenarioOption>()
          for (const opt of dbOptions) merged.set(opt.key, opt)
          for (const opt of parsed) if (!merged.has(opt.key)) merged.set(opt.key, opt)
          return Array.from(merged.values())
        }
      } catch {}
    }
    return dbOptions
  })
  const [showScenarioPanel, setShowScenarioPanel] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<PrepSlot>('lunch')
  const [prepTitle, setPrepTitle] = useState('')
  const [renamingScenarioKey, setRenamingScenarioKey] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [activeScenarioKey, setActiveScenarioKey] = useState<string>(() => {
    const activePrepScenario = initialPreps.find((prep) => prep.is_active)?.scenario_key
    return normalizeScenarioKey(activePrepScenario)
  })
  const { flash, showFlash, dismiss: dismissFlash } = useFlash()

  useEffect(() => {
    const nextOptions = collectSimulationScenarios(initialPreps)
    setScenarioOptions((prev) => {
      const merged = new Map<string, SimulationScenarioOption>()
      for (const option of prev) merged.set(option.key, option)
      for (const option of nextOptions) merged.set(option.key, option)
      return Array.from(merged.values())
    })
    const activePrepScenario = initialPreps.find((prep) => prep.is_active)?.scenario_key
    if (!nextOptions.some((scenario) => scenario.key === activeScenarioKey)) {
      setActiveScenarioKey(normalizeScenarioKey(activePrepScenario))
    }
  }, [activeScenarioKey, initialPreps])

  // Persist ephemeral scenarios (without preps) across date navigation
  useEffect(() => {
    try {
      sessionStorage.setItem(`compose-scenarios-${date}`, JSON.stringify(scenarioOptions))
    } catch {}
  }, [scenarioOptions, date])

  function startRename(key: string, currentLabel: string) {
    setRenamingScenarioKey(key)
    setRenameValue(currentLabel)
  }

  function commitRename() {
    if (!renamingScenarioKey || !renameValue.trim()) {
      setRenamingScenarioKey(null)
      return
    }
    const newLabel = renameValue.trim()
    setScenarioOptions(prev => prev.map(s =>
      s.key === renamingScenarioKey ? { ...s, label: newLabel } : s
    ))
    setRenamingScenarioKey(null)
    // PATCH existing preps in this scenario so DB label stays in sync
    const prepsToUpdate = initialPreps.filter(p => p.scenario_key === renamingScenarioKey)
    prepsToUpdate.forEach(prep => {
      fetch(`/api/client/nutrition/preps/${prep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_label: newLabel }),
      }).catch(err => console.error('[rename] PATCH prep failed', err))
    })
  }

  const activeScenario = useMemo(
    () => scenarioOptions.find((scenario) => scenario.key === activeScenarioKey) ?? scenarioOptions[0] ?? { key: 'default', label: "Scénario principal" },
    [activeScenarioKey, scenarioOptions],
  )
  const maxComposeDate = useMemo(() => shiftIsoDate(todayDate, 3), [todayDate])
  const isFutureDate = date > todayDate
  const canGoPrevDay = date > todayDate
  const canGoNextDay = date < maxComposeDate
  const activeScenarioLabel = activeScenario.label === "Aujourd'hui" ? "Scénario principal" : activeScenario.label
  const headerIsCompact = headerCollapsed || contentLayer !== 'category'
  const shouldShowScenarioControls = initialPreps.length > 0 || scenarioOptions.length > 1

  const hasDrafts = draftTotals.count > 0

  const goToComposeDate = useCallback((nextDate: string) => {
    if (hasDrafts) return
    router.push(`/client/nutrition/compose?date=${nextDate}`)
  }, [router, hasDrafts])

  const composeDateLabel = useMemo(() => {
    if (date === todayDate) return t('compose.today')
    if (date === shiftIsoDate(todayDate, 1)) return t('compose.tomorrow')
    if (date === shiftIsoDate(todayDate, 2)) return t('compose.dayPlus2')
    if (date === shiftIsoDate(todayDate, 3)) return t('compose.dayPlus3')
    return date
  }, [date, todayDate, t])

  const simulation = computeSimulationState({
    consumed,
    preps: initialPreps,
    draftTotals,
    activeScenarioKey,
  })
  const consumedWithActivePreps: NutritionMacros = {
    kcal: consumed.kcal + simulation.prepTotals.kcal,
    protein_g: consumed.protein_g + simulation.prepTotals.protein_g,
    carbs_g: consumed.carbs_g + simulation.prepTotals.carbs_g,
    fat_g: consumed.fat_g + simulation.prepTotals.fat_g,
    water_ml: consumed.water_ml,
  }
  const effectiveConsumed = simulation.simulatedConsumed

  const handleDraftsChange = useCallback((totals: DraftTotals) => {
    setDraftTotals(totals)
  }, [])
  const suppressInternalRedirect = useCallback(() => {}, [])

  async function handleSavePrep() {
    setSaving('prep')
    const ok = await logRef.current?.savePrep()
    if (ok) {
      logRef.current?.clearDrafts()
      setEditingPrep(null)
      setPrepTitle('')
      router.refresh()
    } else {
      showFlash('Erreur lors de la sauvegarde. Réessaie.', 'error')
    }
    setSaving(null)
  }

  async function handleSaveMeal() {
    setSaving('meal')
    const mealOk = await logRef.current?.saveMeal()
    if (!mealOk) {
      showFlash('Erreur lors de la validation. Réessaie.', 'error')
      setSaving(null)
      return
    }
    const prepLogResults = await Promise.allSettled(
      simulation.activePreps.map(prep =>
        fetch(`/api/client/nutrition/preps/${prep.id}/log`, { method: 'POST' })
      )
    )
    const failedCount = prepLogResults.filter(
      r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
    ).length
    if (failedCount > 0) {
      console.error(`[handleSaveMeal] ${failedCount} prep(s) failed to log`)
    }
    setSaving(null)
    router.push('/client/nutrition')
  }

  function handleCancel() {
    logRef.current?.clearDrafts()
    setEditingPrep(null)
    setPrepTitle('')
  }

  const activePrepCount = simulation.activePreps.length
  const activeScenarioPrepCount = initialPreps.filter((prep) => prep.scenario_key === activeScenario.key).length

  // Scenario comparison totals (all preps grouped by scenario, using is_active ones)
  const scenarioComparison = useMemo(() => {
    return scenarioOptions.map(scenario => {
      // Use ALL preps in scenario (not just active) for a true plan comparison
      const allPreps = initialPreps.filter(p => p.scenario_key === scenario.key)
      return {
        key: scenario.key,
        label: scenario.label === "Aujourd'hui" ? "Scénario principal" : scenario.label,
        kcal: allPreps.reduce((s, p) => s + p.total_calories, 0),
        protein: allPreps.reduce((s, p) => s + p.total_protein_g, 0),
        carbs: allPreps.reduce((s, p) => s + p.total_carbs_g, 0),
        fat: allPreps.reduce((s, p) => s + p.total_fat_g, 0),
        prepCount: allPreps.length,
        isActive: scenario.key === activeScenarioKey,
      }
    })
  }, [scenarioOptions, initialPreps, activeScenarioKey])

  function handleCreateScenario() {
    const nextScenario = createNextScenarioOption(scenarioOptions)
    setScenarioOptions((prev) => [...prev, nextScenario])
    setActiveScenarioKey(nextScenario.key)
    setShowScenarioPanel(true)
    setEditingPrep(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    function handleScroll() {
      setHeaderCollapsed(window.scrollY > 24)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const SLOT_LABELS: Record<PrepSlot, string> = {
    breakfast: t('compose.slot.breakfast'),
    lunch: t('compose.slot.lunch'),
    dinner: t('compose.slot.dinner'),
    snack: t('compose.slot.snack'),
  }

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0d] pb-28">
      <FlashMessage flash={flash} onDismiss={dismissFlash} />
      
      {/* Safe-area background fill — status bar zone matches the header nav card color */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#111114]" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      
      <section
        className="sticky top-0 z-40 px-3 pb-2 bg-[#111114]"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="pb-1.5">
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.04] border border-white/[0.05] px-2 py-2">
            <button
              onClick={() => canGoPrevDay && !hasDrafts && goToComposeDate(shiftIsoDate(date, -1))}
              disabled={!canGoPrevDay || hasDrafts}
              title={hasDrafts ? t('compose.saveDayFirst') : undefined}
              className="h-9 w-9 rounded-xl bg-white/[0.04] text-white/60 flex items-center justify-center disabled:opacity-25 active:scale-[0.97] transition-all"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="text-center min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-[0.16em] text-white/24 font-bold">{t('compose.simulatedDay')}</p>
              <p className="mt-1 text-[13px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white truncate">
                {composeDateLabel}
              </p>
              {hasDrafts && (
                <p className="text-[9px] uppercase tracking-[0.1em] text-[#818cf8]/70 mt-0.5">{t('compose.saveDayFirst')}</p>
              )}
            </div>
            {/* Mic button — opens voice/text log, same as standard log page */}
            <button
              onClick={() => logRef.current?.openVoice?.('voice')}
              className="h-9 w-9 rounded-xl bg-[#818cf8]/12 text-[#818cf8] flex items-center justify-center active:scale-[0.97] transition-all mr-1"
              aria-label="Dicter ou saisir un repas par texte"
            >
              <Mic size={16} />
            </button>
            <button
              onClick={() => canGoNextDay && !hasDrafts && goToComposeDate(shiftIsoDate(date, 1))}
              disabled={!canGoNextDay || hasDrafts}
              title={hasDrafts ? t('compose.saveDayFirst') : undefined}
              className="h-9 w-9 rounded-xl bg-[#818cf8]/12 text-[#818cf8] flex items-center justify-center disabled:opacity-25 active:scale-[0.97] transition-all"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className={`px-3 transition-all duration-200 ${headerIsCompact ? 'pb-1.5' : 'pb-1'}`}>
          <SmartNutritionHero
            date={date}
            consumed={effectiveConsumed}
            target={target}
            simulationMode
            gender={gender}
            bodyWeightKg={bodyWeightKg}
            compact
            micro={headerIsCompact}
            showSimulationBadge={false}
          />
        </div>

        {/* Simulation world info */}
        <div className={`px-3 transition-all duration-200 overflow-hidden ${(headerIsCompact || (activePrepCount === 0 && !hasDrafts && scenarioOptions.length <= 1)) ? 'max-h-0 pb-0 opacity-0' : 'max-h-24 pb-2 opacity-100'}`}>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 rounded-2xl bg-[#818cf8]/8 px-3 py-2.5">
              <div className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#818cf8]">
                {t('compose.simulatedWorld')}
              </div>
              <div className="mt-1 text-[11px] text-white/68 leading-relaxed">
                {activePrepCount > 0
                  ? t('compose.activePrepCount', { n: activePrepCount, label: activeScenarioLabel.toLowerCase() })
                  : t('compose.noActivePrep')}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] px-3 py-2 text-right shrink-0 min-w-[104px]">
              <div className="text-[15px] font-black text-white tabular-nums">
                {Math.round(simulation.prepTotals.kcal)}
              </div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-white/30">
                {t('compose.kcalSimulated')}
              </div>
            </div>
          </div>
        </div>

        {/* Slot selector — always visible in category layer */}
        {contentLayer === 'category' && !headerIsCompact && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/28 font-bold shrink-0">
                {t('compose.slot.label')}
              </p>
              <div className="flex gap-1 flex-1 overflow-x-auto">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as PrepSlot[]).map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`shrink-0 h-7 px-3 rounded-full text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.97] ${
                      selectedSlot === slot
                        ? 'bg-[#818cf8]/20 text-[#818cf8]'
                        : 'bg-white/[0.04] text-white/36'
                    }`}
                  >
                    {SLOT_LABELS[slot]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prep title input — shown when there are drafts to save */}
        {hasDrafts && (
          <div className="px-3 pb-2">
            <input
              type="text"
              value={prepTitle}
              onChange={e => setPrepTitle(e.target.value)}
              placeholder="Nom du repas (optionnel)"
              maxLength={80}
              className="w-full h-9 px-3 rounded-xl bg-[#111114] text-white text-[12px] placeholder:text-white/20 outline-none border border-white/[0.06] focus:border-[#818cf8]/30"
            />
          </div>
        )}

        {/* Action buttons when drafts exist */}
        {hasDrafts && (
          <div className={`px-3 pb-3 grid gap-2 ${isFutureDate ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <button
              onClick={handleCancel}
              disabled={saving !== null}
              className="h-11 rounded-xl bg-white/[0.04] text-white/40 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {t('compose.cancel')}
            </button>
            <button
              onClick={handleSavePrep}
              disabled={saving !== null}
              className="h-11 rounded-xl bg-[#818cf8]/15 text-[#818cf8] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              {saving === 'prep' ? t('compose.saving') : t('compose.save')}
            </button>
            {/* Valider only makes sense for today — for future dates the user should use Sauver */}
            {!isFutureDate && (
              <button
                onClick={handleSaveMeal}
                disabled={saving !== null}
                className="h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving === 'meal' ? t('compose.saving') : t('compose.validate')}
              </button>
            )}
          </div>
        )}

        {/* Scenario chips + inline rename */}
        {shouldShowScenarioControls && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {scenarioOptions.map((scenario) => {
                const active = scenario.key === activeScenarioKey
                const label = scenario.label === "Aujourd'hui" ? "Scénario principal" : scenario.label
                return (
                  <button
                    key={scenario.key}
                    onClick={() => {
                      if (active) {
                        // Second tap on active chip → rename
                        startRename(scenario.key, label)
                      } else {
                        setActiveScenarioKey(scenario.key)
                        setEditingPrep(null)
                        setRenamingScenarioKey(null)
                      }
                    }}
                    className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] transition-all inline-flex items-center gap-1 ${
                      active ? 'bg-[#818cf8]/16 text-[#818cf8]' : 'bg-white/[0.04] text-white/38'
                    }`}
                  >
                    {label}
                    {active && <Pencil size={9} className="opacity-50" />}
                  </button>
                )
              })}
              <button
                onClick={handleCreateScenario}
                className="shrink-0 h-9 w-9 rounded-full bg-white/[0.04] text-[#818cf8] flex items-center justify-center active:scale-[0.98] transition-all"
                aria-label={t('compose.newScenario')}
              >
                <Plus size={15} />
              </button>
              <button
                onClick={() => setShowScenarioPanel((value) => !value)}
                className={`shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] transition-all ${
                  showScenarioPanel ? 'bg-[#818cf8]/12 text-[#818cf8]' : 'bg-white/[0.04] text-white/45'
                }`}
              >
                <Sparkles size={12} />
                {t('compose.preps')}
                {showScenarioPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* Inline rename input */}
            {renamingScenarioKey && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setRenamingScenarioKey(null)
                  }}
                  onBlur={commitRename}
                  maxLength={40}
                  className="flex-1 h-9 rounded-xl bg-[#111114] text-white text-[12px] px-3 outline-none border border-[#818cf8]/30 min-w-0"
                  placeholder="Nom du scénario..."
                />
                <button
                  onMouseDown={e => { e.preventDefault(); commitRename() }}
                  className="h-9 px-3 rounded-xl bg-[#818cf8]/15 text-[#818cf8] text-[11px] font-bold shrink-0"
                >
                  OK
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <NutritionLogContent
        ref={logRef}
        onSuccess={suppressInternalRedirect}
        embedded
        externalScroll
        composerMode="guide"
        prepId={editingPrep?.id ?? null}
        initialPrepEntries={editingPrep?.entries}
        prepScenario={{ key: activeScenario.key, label: activeScenarioLabel }}
        prepDate={date}
        prepMealSlot={selectedSlot}
        prepTitle={prepTitle || null}
        hideActions
        onDraftsChange={handleDraftsChange}
        onLayerChange={setContentLayer}
        balanceContext={{ consumed: consumedWithActivePreps, target, profile: { gender, weightKg: bodyWeightKg } }}
      />

      {shouldShowScenarioControls && showScenarioPanel && (
        <div className="px-4 pt-3 space-y-3">
          {/* Scenario comparison card — shows when 2+ scenarios exist */}
          {scenarioOptions.length > 1 && (
            <div className="rounded-[24px] bg-[#111114] px-3 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 px-1 pb-2">
                {t('compose.comparison.title')}
              </p>
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-1 pb-1.5 border-b border-white/[0.06]">
                {['', 'Kcal', 'P', 'G', 'L'].map((h, i) => (
                  <span key={i} className="text-[9px] uppercase tracking-[0.1em] text-white/25 font-bold text-right first:text-left">{h}</span>
                ))}
              </div>
              <div className="mt-1.5 space-y-1">
                {scenarioComparison.map(sc => (
                  <button
                    key={sc.key}
                    onClick={() => setActiveScenarioKey(sc.key)}
                    className={`w-full grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-1 py-1.5 rounded-xl text-left transition-all active:scale-[0.99] ${sc.isActive ? 'bg-[#818cf8]/10' : 'hover:bg-white/[0.03]'}`}
                  >
                    <span className={`text-[11px] font-semibold truncate ${sc.isActive ? 'text-[#818cf8]' : 'text-white/70'}`}>
                      {sc.label}
                      {sc.isActive && <span className="ml-1.5 text-[9px] uppercase tracking-[0.1em] text-[#818cf8]/70">{t('compose.comparison.active')}</span>}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-right text-white">{Math.round(sc.kcal)}</span>
                    <span className="text-[11px] tabular-nums text-right" style={{ color: NUTRITION_UI_COLORS.protein }}>{Math.round(sc.protein)}g</span>
                    <span className="text-[11px] tabular-nums text-right" style={{ color: NUTRITION_UI_COLORS.carbs }}>{Math.round(sc.carbs)}g</span>
                    <span className="text-[11px] tabular-nums text-right" style={{ color: NUTRITION_UI_COLORS.fat }}>{Math.round(sc.fat)}g</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prep list */}
          <div className="rounded-[24px] bg-[#111114] px-3 py-3">
            <div className="flex items-start justify-between gap-3 px-1 pb-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">{t('compose.preps')} simulées</p>
                <p className="mt-1 text-[11px] text-white/46">
                  {activeScenarioPrepCount} prep{activeScenarioPrepCount > 1 ? 's' : ''} dans {activeScenarioLabel}
                </p>
              </div>
              <button
                onClick={() => setShowScenarioPanel(false)}
                className="h-8 w-8 rounded-xl bg-white/[0.04] text-white/40 flex items-center justify-center active:scale-[0.98] transition-all"
                aria-label="Masquer les prépas"
              >
                <ChevronUp size={14} />
              </button>
            </div>
            <SmartNutritionPrepList
              initialPreps={initialPreps}
              compact
              showScenarioChips={false}
              activeScenarioKey={activeScenario.key}
              onScenarioChange={setActiveScenarioKey}
              scenarioOptions={scenarioOptions}
              onEdit={(prep) => {
                setEditingPrep(prep)
                setSelectedSlot((prep.meal_slot as PrepSlot) ?? 'lunch')
                setActiveScenarioKey(prep.scenario_key)
                setShowScenarioPanel(false)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}
