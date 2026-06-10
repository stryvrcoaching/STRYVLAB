'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Share2, ChevronDown, ChevronUp, FlaskConical, Activity,
  UserCheck, X, Zap, AlertTriangle, Info, CheckCircle2,
  Check, Send, Moon, Droplets, RefreshCw, ArrowRight, Sparkles,
} from 'lucide-react'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import NutritionProtocolDayTabs from './NutritionProtocolDayTabs'
import {
  type DayDraft, type NutritionProtocol, type NutritionClientData,
  emptyDayDraft, dayDraftFromDb,
} from '@/lib/nutrition/types'
import {
  calculateMacros,
  type MacroGoal, type MacroGender, type MacroResult,
  type SmartProtocolSuggestion,
} from '@/lib/formulas/macros'
import {
  calculateCarbCycling,
  type CarbCyclingResult, type CarbCycleProtocol, type CarbCycleGoal,
  type CarbCycleIntensity, type CarbCyclePhase, type CarbCycleInsulin,
  type CarbCycleOccupation,
} from '@/lib/formulas/carbCycling'
import { calculateHydration, type HydrationActivity, type HydrationClimate } from '@/lib/formulas/hydration'
import { useLabClientSearch, type LabClient } from '@/lib/lab/useLabClientSearch'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

// ─── Types locaux ──────────────────────────────────────────────────────────────

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'
type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'
type CycleInputMode = 'day' | 'date'

// ─── Constantes ────────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sédentaire', light: 'Légèrement actif', moderate: 'Modérément actif',
  active: 'Actif', veryActive: 'Très actif',
}
const ACTIVITY_STEPS: Record<ActivityLevel, number> = {
  sedentary: 2000, light: 4000, moderate: 7000, active: 11000, veryActive: 15000,
}
const GOAL_LABELS: Record<MacroGoal, string> = {
  deficit: 'Déficit — Perte de gras', maintenance: 'Maintenance', surplus: 'Surplus — Prise de muscle',
}
const CLIENT_GOAL_MAP: Record<string, MacroGoal> = {
  fat_loss: 'deficit', weight_loss: 'deficit', sèche: 'deficit', cut: 'deficit',
  muscle_gain: 'surplus', hypertrophy: 'surplus', prise_de_masse: 'surplus', bulk: 'surplus',
  maintenance: 'maintenance', recomposition: 'maintenance',
}
const SPORT_PRACTICE_MAP: Record<string, ActivityLevel> = {
  sedentary: 'sedentary', light: 'light', moderate: 'moderate', active: 'active', athlete: 'veryActive',
}
const PRIORITY_CONFIG = {
  critical: { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20',   dot: 'bg-red-400'   },
  high:     { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  medium:   { color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  dot: 'bg-blue-400'  },
  low:      { color: 'text-white/40',  bg: 'bg-white/[0.03]', border: 'border-white/[0.06]', dot: 'bg-white/30'  },
} as const

const HYDRATION_ACTIVITY_MAP: Record<ActivityLevel, HydrationActivity> = {
  sedentary: 'sedentary', light: 'light', moderate: 'moderate', active: 'intense', veryActive: 'athlete',
}

// Mapping MacroGoal → CarbCycleGoal
const MACRO_TO_CC_GOAL: Record<MacroGoal, CarbCycleGoal> = {
  deficit: 'moderate',
  maintenance: 'recomp',
  surplus: 'bulk',
}

// Cycle Sync data
const PHASE_NUTRITION: Record<CyclePhase, { caloriesModifier: number; carbsModifier: number; fatsModifier: number; supplements: string[] }> = {
  menstrual:  { caloriesModifier: 1.0,  carbsModifier: 1.0,  fatsModifier: 1.0,  supplements: ['Fer (18-25mg)', 'Vitamine C', 'Magnésium (300-400mg)', 'Oméga-3 (2g)'] },
  follicular: { caloriesModifier: 0.95, carbsModifier: 1.35, fatsModifier: 0.9,  supplements: ['Créatine (5g)', 'Vitamine D3 (2000-4000 UI)'] },
  ovulatory:  { caloriesModifier: 1.0,  carbsModifier: 1.4,  fatsModifier: 0.9,  supplements: ['Créatine (5g)', 'Bêta-alanine (3-5g)', 'Caféine pré-workout (200-300mg)'] },
  luteal:     { caloriesModifier: 1.08, carbsModifier: 0.75, fatsModifier: 1.2,  supplements: ['Magnésium (400-600mg)', 'Vitamine B6 (50-100mg)', 'Inositol (2-4g)'] },
}
const PHASE_TRAINING: Record<CyclePhase, { volumeModifier: number; intensityRange: string; focus: string[]; avoidance: string[] }> = {
  menstrual:  { volumeModifier: 0.6, intensityRange: '50-65% 1RM', focus: ['Cardio léger', 'Mobilité', 'Yoga'], avoidance: ['Charges lourdes', 'HIIT', 'Volume élevé'] },
  follicular: { volumeModifier: 1.3, intensityRange: '80-95% 1RM', focus: ['Force maximale', 'Hypertrophie', 'Composés'], avoidance: [] },
  ovulatory:  { volumeModifier: 1.2, intensityRange: '85-100% 1RM', focus: ['Tests 1RM', 'PRs', 'Explosivité'], avoidance: ['Sur-entraînement'] },
  luteal:     { volumeModifier: 0.8, intensityRange: '65-80% 1RM', focus: ['Hypertrophie modérée', 'Technique', 'Cardio steady-state'], avoidance: ['Charges max', 'Déficit agressif'] },
}
const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstruation', follicular: 'Phase Folliculaire', ovulatory: 'Ovulation', luteal: 'Phase Lutéale',
}
const PHASE_COLORS: Record<CyclePhase, { border: string; bg: string; text: string }> = {
  menstrual:  { border: 'border-red-500/30',    bg: 'bg-red-500/[0.08]',    text: 'text-red-400'    },
  follicular: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-400' },
  ovulatory:  { border: 'border-yellow-500/30', bg: 'bg-yellow-500/[0.08]', text: 'text-yellow-400' },
  luteal:     { border: 'border-orange-500/30', bg: 'bg-orange-500/[0.08]', text: 'text-orange-400'  },
}

function calculateCyclePhase(dayOfCycle: number, cycleLength: number): CyclePhase {
  if (dayOfCycle >= 1 && dayOfCycle <= 5) return 'menstrual'
  if (dayOfCycle >= 6 && dayOfCycle <= Math.floor(cycleLength / 2) - 1) return 'follicular'
  if (dayOfCycle >= Math.floor(cycleLength / 2) && dayOfCycle <= Math.floor(cycleLength / 2) + 1) return 'ovulatory'
  return 'luteal'
}

// ─── Petits composants UI ──────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">{children}</label>
}

function NumInput({ value, onChange, placeholder, step, min, max, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  step?: string; min?: string; max?: string; className?: string
}) {
  return (
    <input
      type="number" value={value} step={step} min={min} max={max}
      onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors ${className}`}
    />
  )
}

function DSSelect<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)}
      className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white outline-none focus:border-white/[0.12] transition-colors appearance-none cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value} className="bg-[#181818]">{o.label}</option>)}
    </select>
  )
}

function SectionHeader({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={11} className="text-white/30" strokeWidth={1.75} />}
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{children}</p>
    </div>
  )
}

function ModuleBlock({
  title, icon: Icon, badge, defaultOpen = false, accent, children,
}: {
  title: string; icon?: React.ElementType; badge?: string; defaultOpen?: boolean
  accent?: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={13} className={accent ?? 'text-white/30'} strokeWidth={1.75} />}
          <span className="text-[11px] font-semibold text-white/70">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/[0.06] text-white/30">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4 border-t-[0.3px] border-white/[0.04] pt-3">{children}</div>}
    </div>
  )
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  clientId: string
  existingProtocol?: NutritionProtocol
}

// ─── Composant principal ───────────────────────────────────────────────────────

export default function NutritionProtocolTool({ clientId, existingProtocol }: Props) {
  const router = useRouter()

  // ── Protocol state ──────────────────────────────────────────────────────────
  const [protocolName, setProtocolName]   = useState(existingProtocol?.name ?? 'Nouveau protocole')
  const [days,         setDays]           = useState<DayDraft[]>(
    existingProtocol?.days?.length
      ? existingProtocol.days.map(dayDraftFromDb)
      : [emptyDayDraft('Jour entraînement'), emptyDayDraft('Jour repos')]
  )
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [saving,   setSaving]   = useState(false)
  const [sharing,  setSharing]  = useState(false)
  const [error,    setError]    = useState('')

  const isEditing = !!existingProtocol
  useClientTopBar(isEditing ? 'Modifier le protocole' : 'Nouveau protocole')

  // ── MacroCalculator state ───────────────────────────────────────────────────
  const clientSearch = useLabClientSearch()
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // FIX: track whether client data was injected so we can auto-compute
  const [clientLoaded, setClientLoaded] = useState(false)
  const [dataInjected, setDataInjected] = useState(false)

  const [gender,        setGender]        = useState<MacroGender>('male')
  const [age,           setAge]           = useState('')
  const [weight,        setWeight]        = useState('')
  const [height,        setHeight]        = useState('')
  const [bodyFat,       setBodyFat]       = useState('')
  const [muscleMass,    setMuscleMass]    = useState('')
  const [bmrMeasured,   setBmrMeasured]   = useState('')
  const [visceralFat,   setVisceralFat]   = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [workouts,      setWorkouts]      = useState('3')
  const [sessionDuration, setSessionDuration] = useState('')
  const [trainingCalsWeekly, setTrainingCalsWeekly] = useState('')
  // FIX: cardioFreq and sessionDuration are now correctly mapped separately
  const [cardioFreq,    setCardioFreq]    = useState('')
  const [cardioDuration, setCardioDuration] = useState('')
  const [dailySteps,    setDailySteps]    = useState('')
  const [goal,          setGoal]          = useState<MacroGoal>('maintenance')
  const [stressLevel,   setStressLevel]   = useState('')
  const [sleepH,        setSleepH]        = useState('')
  const [sleepQuality,  setSleepQuality]  = useState('')
  const [energyLevel,   setEnergyLevel]   = useState('')
  const [caffeineDaily, setCaffeineDaily] = useState('')
  const [alcoholWeekly, setAlcoholWeekly] = useState('')
  const [workHours,     setWorkHours]     = useState('')
  const [menstrualPhase, setMenstrualPhase] = useState<'follicular' | 'luteal' | 'unknown' | ''>('')
  const [showAdvanced,  setShowAdvanced]  = useState(false)

  const [macroResult,  setMacroResult]  = useState<MacroResult | null>(null)
  const [baseMacroResult, setBaseMacroResult] = useState<MacroResult | null>(null)
  const [calorieAdjust,   setCalorieAdjust]   = useState(0)
  const [proteinOverride, setProteinOverride] = useState('')
  const [activeProtocol, setActiveProtocol]   = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // ── Carb Cycling state ──────────────────────────────────────────────────────
  const [ccOccupation,  setCcOccupation]  = useState<CarbCycleOccupation>('sedentaire')
  const [ccIntensity,   setCcIntensity]   = useState<CarbCycleIntensity>('moderee')
  const [ccPhase,       setCcPhase]       = useState<CarbCyclePhase>('hypertrophie')
  // FIX: ccGoal is synced from main goal state, not independent
  const [ccGoal,        setCcGoal]        = useState<CarbCycleGoal>('recomp')
  const [ccInsulin,     setCcInsulin]     = useState<CarbCycleInsulin>('normale')
  const [ccProtocol,    setCcProtocol]    = useState<CarbCycleProtocol>('3/1')
  const [ccResult,      setCcResult]      = useState<CarbCyclingResult | null>(null)

  // ── Hydration state ─────────────────────────────────────────────────────────
  const [hydClimate, setHydClimate] = useState<HydrationClimate>('temperate')
  const [hydResult,  setHydResult]  = useState<{ liters: number; glasses: number; breakdown: { base: number; gender: number; activity: number; climate: number }; warnings: string[] } | null>(null)

  // ── Cycle Sync state ────────────────────────────────────────────────────────
  const [csInputMode,   setCsInputMode]   = useState<CycleInputMode>('day')
  const [csCycleLength, setCsCycleLength] = useState('28')
  const [csCurrentDay,  setCsCurrentDay]  = useState('')
  const [csLastPeriod,  setCsLastPeriod]  = useState('')
  const [csResult,      setCsResult]      = useState<{
    phase: CyclePhase; dayOfCycle: number; adjustedCal: number
    adjustedProtein: number; adjustedCarbs: number; adjustedFats: number
    supplements: string[]; training: typeof PHASE_TRAINING[CyclePhase]; warnings: string[]
  } | null>(null)

  const activeDay = days[activeDayIndex] ?? days[0]
  const isFemale  = gender === 'female'
  const canCalculateMacros = useMemo(
    () => parseFloat(weight) >= 40 && parseFloat(height) >= 140 && parseFloat(age) >= 15,
    [weight, height, age]
  )

  // ── Click outside dropdown ──────────────────────────────────────────────────
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  // ── Auto-inject clientId data on mount ─────────────────────────────────────
  // FIX: cardio_frequency and session_duration_min are correctly mapped to their own state
  useEffect(() => {
    if (clientLoaded) return
    fetch(`/api/clients/${clientId}/nutrition-data`)
      .then(r => r.json())
      .then(d => {
        const c: NutritionClientData = d.client
        if (!c) { setClientLoaded(true); return }
        if (c.weight_kg)              setWeight(String(c.weight_kg))
        if (c.body_fat_pct)           setBodyFat(String(c.body_fat_pct))
        if (c.age)                    setAge(String(c.age))
        if (c.height_cm)              setHeight(String(c.height_cm))
        if (c.muscle_mass_kg)         setMuscleMass(String(c.muscle_mass_kg))
        if (c.bmr_kcal_measured)      setBmrMeasured(String(c.bmr_kcal_measured))
        if (c.visceral_fat_level)     setVisceralFat(String(c.visceral_fat_level))
        // FIX: session_duration_min → sessionDuration, cardio_frequency → cardioFreq (NOT mixed up)
        if (c.session_duration_min)   setSessionDuration(String(c.session_duration_min))
        if (c.cardio_frequency != null) setCardioFreq(String(c.cardio_frequency))
        if (c.training_calories_weekly) setTrainingCalsWeekly(String(c.training_calories_weekly))
        if (c.cardio_duration_min)    setCardioDuration(String(c.cardio_duration_min))
        if (c.daily_steps)            setDailySteps(String(c.daily_steps))
        if (c.stress_level)           setStressLevel(String(c.stress_level))
        if (c.sleep_duration_h)       setSleepH(String(c.sleep_duration_h))
        if (c.sleep_quality)          setSleepQuality(String(c.sleep_quality))
        if (c.energy_level)           setEnergyLevel(String(c.energy_level))
        if (c.caffeine_daily_mg)      setCaffeineDaily(String(c.caffeine_daily_mg))
        if (c.alcohol_weekly)         setAlcoholWeekly(String(c.alcohol_weekly))
        if (c.work_hours_per_week)    setWorkHours(String(c.work_hours_per_week))
        if (c.weekly_frequency)       setWorkouts(String(c.weekly_frequency))
        if (c.gender)                 setGender(c.gender === 'female' ? 'female' : 'male')
        if (c.occupation) {
          if (c.occupation.toLowerCase().includes('debout') || c.occupation.toLowerCase().includes('bout')) setCcOccupation('debout')
          else if (c.occupation.toLowerCase().includes('physique') || c.occupation.toLowerCase().includes('manuel')) setCcOccupation('physique')
          else setCcOccupation('sedentaire')
        }
        if (c.training_goal) {
          const m = CLIENT_GOAL_MAP[c.training_goal.toLowerCase()]
          if (m) setGoal(m)
        }
        if (c.sport_practice) {
          const m = SPORT_PRACTICE_MAP[c.sport_practice.toLowerCase()]
          if (m) setActivityLevel(m)
        }
        setClientLoaded(true)
        setDataInjected(true)
      })
      .catch(() => { setClientLoaded(true) })
  }, [clientId, clientLoaded])

  // FIX: Sync ccGoal whenever the main goal changes
  useEffect(() => {
    setCcGoal(MACRO_TO_CC_GOAL[goal])
  }, [goal])

  // ── MacroCalculator compute ─────────────────────────────────────────────────
  const buildMacroInput = useCallback(() => {
    const w = parseFloat(weight); const h = parseFloat(height); const a = parseFloat(age)
    if (!w || !h || !a) return null
    const steps = dailySteps ? parseInt(dailySteps) : ACTIVITY_STEPS[activityLevel]
    return {
      weight: w, height: h, age: a, gender, goal,
      bodyFat:     bodyFat     ? parseFloat(bodyFat)     : undefined,
      muscleMassKg: muscleMass ? parseFloat(muscleMass)  : undefined,
      bmrKcalMeasured: bmrMeasured ? parseFloat(bmrMeasured) : undefined,
      visceralFatLevel: visceralFat ? parseFloat(visceralFat) : undefined,
      steps,
      workHoursPerWeek: workHours ? parseFloat(workHours) : undefined,
      workouts: parseInt(workouts) || 0,
      sessionDurationMin: sessionDuration ? parseFloat(sessionDuration) : undefined,
      trainingCaloriesWeekly: trainingCalsWeekly ? parseFloat(trainingCalsWeekly) : undefined,
      cardioFrequency: cardioFreq ? parseFloat(cardioFreq) : undefined,
      cardioDurationMin: cardioDuration ? parseFloat(cardioDuration) : undefined,
      stressLevel:   stressLevel   ? parseFloat(stressLevel)   : undefined,
      sleepDurationH: sleepH       ? parseFloat(sleepH)        : undefined,
      sleepQuality:  sleepQuality  ? parseFloat(sleepQuality)  : undefined,
      energyLevel:   energyLevel   ? parseFloat(energyLevel)   : undefined,
      caffeineDaily: caffeineDaily ? parseFloat(caffeineDaily) : undefined,
      alcoholWeekly: alcoholWeekly ? parseFloat(alcoholWeekly) : undefined,
      menstrualPhase: (menstrualPhase || undefined) as 'follicular' | 'luteal' | 'unknown' | undefined,
    }
  }, [weight, height, age, gender, goal, bodyFat, muscleMass, bmrMeasured, visceralFat,
      activityLevel, dailySteps, workHours, workouts, sessionDuration, trainingCalsWeekly,
      cardioFreq, cardioDuration, stressLevel, sleepH, sleepQuality, energyLevel,
      caffeineDaily, alcoholWeekly, menstrualPhase])

  const computeMacros = useCallback(() => {
    const input = buildMacroInput()
    if (!input) return
    const res = calculateMacros(input)
    setBaseMacroResult(res); setMacroResult(res)
    setCalorieAdjust(0); setProteinOverride('')
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [buildMacroInput])

  // FIX: Auto-calc macros after client data is injected
  useEffect(() => {
    if (dataInjected && canCalculateMacros) {
      computeMacros()
      setDataInjected(false)
    }
  }, [dataInjected, canCalculateMacros, computeMacros])

  // ── Macro adjustments live recalc ───────────────────────────────────────────
  useEffect(() => {
    if (!baseMacroResult) return
    const bw = parseFloat(weight) || 1
    const adjustedCals = Math.round(baseMacroResult.calories + baseMacroResult.tdee * calorieAdjust / 100)
    const proteinG = proteinOverride !== ''
      ? Math.max(0, Math.round((parseFloat(proteinOverride) || 0) * bw))
      : baseMacroResult.macros.p
    const remainingKcal = adjustedCals - proteinG * 4
    let fats: number, carbs: number
    if (proteinOverride !== '') {
      fats  = Math.max(20, Math.round(remainingKcal * 0.30 / 9))
      carbs = Math.max(0,  Math.round((remainingKcal - fats * 9) / 4))
    } else {
      const delta = adjustedCals - baseMacroResult.calories
      fats  = Math.max(20, baseMacroResult.macros.f + Math.round(delta * 0.30 / 9))
      carbs = Math.max(0,  baseMacroResult.macros.c + Math.round(delta * 0.70 / 4))
    }
    const totalKcal = proteinG * 4 + fats * 9 + carbs * 4
    const lbm = baseMacroResult.leanMass
    setMacroResult(prev => prev ? {
      ...prev, calories: adjustedCals, macros: { p: proteinG, f: fats, c: carbs },
      ratios: {
        p: Math.round((proteinG / lbm) * 10) / 10,
        f: Math.round((fats / bw)     * 10) / 10,
        c: Math.round((carbs / bw)    * 10) / 10,
      },
      ratiosByBW: {
        p: Math.round((proteinG / bw) * 10) / 10,
        f: Math.round((fats / bw)     * 10) / 10,
        c: Math.round((carbs / bw)    * 10) / 10,
      },
      percents: {
        p: Math.round((proteinG * 4 / totalKcal) * 100),
        f: Math.round((fats    * 9 / totalKcal) * 100),
        c: Math.round((carbs   * 4 / totalKcal) * 100),
      },
    } : prev)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calorieAdjust, proteinOverride])

  const applyProtocolSuggestion = (s: SmartProtocolSuggestion) => {
    if (!baseMacroResult || !macroResult) return
    const bw = parseFloat(weight) || 1
    if (s.id === 'protein_low') {
      const optRatio = goal === 'deficit' ? 2.7 : 2.2
      setProteinOverride((baseMacroResult.leanMass * optRatio / bw).toFixed(1))
    }
    if (['fats_critical', 'sleep_suboptimal', 'stress_critical'].includes(s.id)) {
      setCalorieAdjust(prev => Math.min(prev + 5, 30))
    }
    setActiveProtocol(s.id)
    setTimeout(() => setActiveProtocol(null), 2000)
  }

  // ── Client search injection ─────────────────────────────────────────────────
  const injectClient = useCallback((client: LabClient) => {
    if (client.weight_kg   != null) setWeight(String(client.weight_kg))
    if (client.body_fat_pct != null) setBodyFat(String(client.body_fat_pct))
    if (client.age         != null) setAge(String(client.age))
    if (client.height_cm   != null) setHeight(String(client.height_cm))
    if (client.muscle_mass_kg != null) setMuscleMass(String(client.muscle_mass_kg))
    if (client.bmr_kcal_measured != null) setBmrMeasured(String(client.bmr_kcal_measured))
    if (client.visceral_fat_level != null) setVisceralFat(String(client.visceral_fat_level))
    if (client.session_duration_min != null) setSessionDuration(String(client.session_duration_min))
    if (client.training_calories_weekly != null) setTrainingCalsWeekly(String(client.training_calories_weekly))
    if (client.cardio_frequency != null) setCardioFreq(String(client.cardio_frequency))
    if (client.cardio_duration_min != null) setCardioDuration(String(client.cardio_duration_min))
    if (client.daily_steps != null) setDailySteps(String(client.daily_steps))
    if (client.stress_level != null) setStressLevel(String(client.stress_level))
    if (client.sleep_duration_h != null) setSleepH(String(client.sleep_duration_h))
    if (client.sleep_quality != null) setSleepQuality(String(client.sleep_quality))
    if (client.energy_level != null) setEnergyLevel(String(client.energy_level))
    if (client.caffeine_daily_mg != null) setCaffeineDaily(String(client.caffeine_daily_mg))
    if (client.alcohol_weekly != null) setAlcoholWeekly(String(client.alcohol_weekly))
    if (client.work_hours_per_week != null) setWorkHours(String(client.work_hours_per_week))
    if (client.weekly_frequency != null) setWorkouts(String(client.weekly_frequency))
    if (client.training_goal) {
      const m = CLIENT_GOAL_MAP[client.training_goal.toLowerCase()]
      if (m) setGoal(m)
    }
    if (client.sport_practice) {
      const m = SPORT_PRACTICE_MAP[client.sport_practice.toLowerCase()]
      if (m) setActivityLevel(m)
    }
    setGender(client.gender === 'female' || client.gender === 'Femme' ? 'female' : 'male')
    setMacroResult(null); setBaseMacroResult(null)
    setCalorieAdjust(0); setProteinOverride('')
    setShowAdvanced(true)
    setDataInjected(true)
  }, [])

  // ── Apply macro result to active day ───────────────────────────────────────
  function applyMacrosToDay() {
    if (!macroResult) return
    updateDay(activeDayIndex, {
      calories: String(macroResult.calories),
      protein_g: String(macroResult.macros.p),
      carbs_g: String(macroResult.macros.c),
      fat_g: String(macroResult.macros.f),
    })
  }

  // ── Carb Cycling compute ────────────────────────────────────────────────────
  const computeCarbCycling = useCallback(() => {
    const w = parseFloat(weight); const h = parseFloat(height)
    const a = parseFloat(age)
    if (!w || !h || !a) return
    const res = calculateCarbCycling({
      gender: gender === 'female' ? 'female' : 'male',
      age: a, weight: w, height: h,
      bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      occupation: ccOccupation,
      sessionsPerWeek: parseInt(workouts) || 3,
      sessionDuration: sessionDuration ? parseFloat(sessionDuration) : 60,
      intensity: ccIntensity,
      goal: ccGoal, phase: ccPhase, protocol: ccProtocol, insulin: ccInsulin,
    })
    setCcResult(res)
  }, [weight, height, age, gender, bodyFat, workouts, sessionDuration,
      ccOccupation, ccIntensity, ccGoal, ccPhase, ccProtocol, ccInsulin])

  function applyCarbCyclingHighDay() {
    if (!ccResult) return
    updateDay(activeDayIndex, {
      calories: String(ccResult.high.kcal),
      protein_g: String(ccResult.high.p),
      carbs_g: String(ccResult.high.c),
      fat_g: String(ccResult.high.f),
      carb_cycle_type: 'high',
    })
  }
  function applyCarbCyclingLowDay() {
    if (!ccResult) return
    updateDay(activeDayIndex, {
      calories: String(ccResult.low.kcal),
      protein_g: String(ccResult.low.p),
      carbs_g: String(ccResult.low.c),
      fat_g: String(ccResult.low.f),
      carb_cycle_type: 'low',
    })
  }

  // ── Hydration compute ───────────────────────────────────────────────────────
  const computeHydration = useCallback(() => {
    const w = parseFloat(weight)
    if (!w) return
    const res = calculateHydration({
      weight: w,
      gender: gender === 'female' ? 'female' : 'male',
      activity: HYDRATION_ACTIVITY_MAP[activityLevel],
      climate: hydClimate,
    })
    setHydResult(res)
  }, [weight, gender, activityLevel, hydClimate])

  function applyHydrationToDay() {
    if (!hydResult) return
    updateDay(activeDayIndex, { hydration_ml: String(Math.round(hydResult.liters * 1000)) })
  }

  // ── Cycle Sync compute ──────────────────────────────────────────────────────
  const computeCycleSync = useCallback(() => {
    if (!macroResult) return
    let dayOfCycle: number
    const cl = parseInt(csCycleLength) || 28
    if (csInputMode === 'day') {
      dayOfCycle = parseInt(csCurrentDay) || 1
    } else {
      if (!csLastPeriod) return
      const diffMs = Date.now() - new Date(csLastPeriod).getTime()
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      dayOfCycle = (diffDays % cl) || cl
    }
    const phase = calculateCyclePhase(dayOfCycle, cl)
    const proto = PHASE_NUTRITION[phase]
    const train = PHASE_TRAINING[phase]
    const adjustedCal     = Math.round(macroResult.calories * proto.caloriesModifier)
    const adjustedCarbs   = Math.round(macroResult.macros.c * proto.carbsModifier)
    const adjustedFats    = Math.round(macroResult.macros.f * proto.fatsModifier)
    const remainingKcal   = adjustedCal - macroResult.macros.p * 4 - adjustedFats * 9
    const adjustedProtein = Math.max(macroResult.macros.p, Math.round(remainingKcal / 4))
    const warnings: string[] = []
    if (adjustedCal < 1200) warnings.push('Apport calorique très bas — surveiller la récupération')
    setCsResult({ phase, dayOfCycle, adjustedCal, adjustedProtein, adjustedCarbs, adjustedFats, supplements: proto.supplements, training: train, warnings })
  }, [macroResult, csInputMode, csCycleLength, csCurrentDay, csLastPeriod])

  function applyCycleSyncToDay() {
    if (!csResult) return
    updateDay(activeDayIndex, {
      calories: String(csResult.adjustedCal),
      protein_g: String(csResult.adjustedProtein),
      carbs_g: String(csResult.adjustedCarbs),
      fat_g: String(csResult.adjustedFats),
      cycle_sync_phase: csResult.phase,
    })
  }

  // ── Generate full protocol (smart fill all days) ────────────────────────────
  function generateFullProtocol() {
    if (!macroResult) return
    const w = parseFloat(weight)
    const ccInput = w && parseFloat(height) && parseFloat(age) ? {
      gender: gender === 'female' ? 'female' : 'male' as 'male' | 'female',
      age: parseFloat(age), weight: w, height: parseFloat(height),
      bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      occupation: ccOccupation,
      sessionsPerWeek: parseInt(workouts) || 3,
      sessionDuration: sessionDuration ? parseFloat(sessionDuration) : 60,
      intensity: ccIntensity,
      goal: ccGoal, phase: ccPhase, protocol: ccProtocol, insulin: ccInsulin,
    } : null
    const ccRes = ccInput ? calculateCarbCycling(ccInput) : null
    const hydRes = w ? calculateHydration({
      weight: w,
      gender: gender === 'female' ? 'female' : 'male',
      activity: HYDRATION_ACTIVITY_MAP[activityLevel],
      climate: hydClimate,
    }) : null

    setDays(prev => prev.map((day, i) => {
      const isTraining = day.name.toLowerCase().includes('entrainement') ||
        day.name.toLowerCase().includes('entraînement') ||
        day.name.toLowerCase().includes('training') ||
        day.name.toLowerCase().includes('muscul') ||
        day.name.toLowerCase().includes('sport') ||
        i % 2 === 0

      const macros = ccRes
        ? (isTraining ? { calories: String(ccRes.high.kcal), protein_g: String(ccRes.high.p), carbs_g: String(ccRes.high.c), fat_g: String(ccRes.high.f), carb_cycle_type: 'high' as const }
                      : { calories: String(ccRes.low.kcal),  protein_g: String(ccRes.low.p),  carbs_g: String(ccRes.low.c),  fat_g: String(ccRes.low.f),  carb_cycle_type: 'low' as const })
        : { calories: String(macroResult.calories), protein_g: String(macroResult.macros.p), carbs_g: String(macroResult.macros.c), fat_g: String(macroResult.macros.f), carb_cycle_type: '' as const }

      const hydration = hydRes ? { hydration_ml: String(Math.round(hydRes.liters * 1000)) } : {}

      return { ...day, ...macros, ...hydration }
    }))
  }

  // ── Day management ──────────────────────────────────────────────────────────
  function updateDay(index: number, updates: Partial<DayDraft>) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d))
  }
  function addDay() {
    const nd = emptyDayDraft(`Jour ${days.length + 1}`)
    setDays(prev => [...prev, nd]); setActiveDayIndex(days.length)
  }
  function removeDay(index: number) {
    setDays(prev => prev.filter((_, i) => i !== index))
    setActiveDayIndex(prev => Math.min(prev, days.length - 2))
  }
  function renameDay(index: number, name: string) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, name } : d))
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function daysPayload() {
    return days.map((d, i) => ({
      id: d.dbId, name: d.name, position: i,
      calories:         d.calories         ? Number(d.calories)         : null,
      protein_g:        d.protein_g        ? Number(d.protein_g)        : null,
      carbs_g:          d.carbs_g          ? Number(d.carbs_g)          : null,
      fat_g:            d.fat_g            ? Number(d.fat_g)            : null,
      hydration_ml:     d.hydration_ml     ? Number(d.hydration_ml)     : null,
      carb_cycle_type:  d.carb_cycle_type  || null,
      cycle_sync_phase: d.cycle_sync_phase || null,
      recommendations:  d.recommendations  || null,
    }))
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const payload = { name: protocolName, days: daysPayload() }
      const url = isEditing && existingProtocol
        ? `/api/clients/${clientId}/nutrition-protocols/${existingProtocol.id}`
        : `/api/clients/${clientId}/nutrition-protocols`
      const method = isEditing ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json(); setError(e.error ?? 'Erreur'); return }
      router.push(`/coach/clients/${clientId}/protocoles/nutrition`)
    } catch { setError('Erreur réseau') } finally { setSaving(false) }
  }

  async function handleSaveAndShare() {
    setSaving(true); setSharing(true); setError('')
    try {
      const payload = { name: protocolName, days: daysPayload() }
      let protocolId = existingProtocol?.id
      if (isEditing && protocolId) {
        const res = await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { setError('Erreur'); return }
      } else {
        const res = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) { setError('Erreur'); return }
        const data = await res.json(); protocolId = data.protocol.id
      }
      if (protocolId) await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/share`, { method: 'POST' })
      router.push(`/coach/clients/${clientId}/protocoles/nutrition`)
    } catch { setError('Erreur réseau') } finally { setSaving(false); setSharing(false) }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="max-w-[1400px] mx-auto px-6 pb-24 space-y-5 pt-4">

        {/* ── Protocol name + actions ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <FieldLabel>Nom du protocole</FieldLabel>
            <input
              value={protocolName}
              onChange={e => setProtocolName(e.target.value)}
              placeholder="ex: Protocole Avril 2026"
              className="w-full h-10 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] px-4 text-[14px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
            />
          </div>
        </div>

        {/* ── Day tabs ── */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-2">Jours du protocole</p>
          <NutritionProtocolDayTabs
            days={days} activeDayIndex={activeDayIndex}
            onSelectDay={setActiveDayIndex} onAddDay={addDay}
            onRemoveDay={removeDay} onRenameDay={renameDay}
          />
        </div>

        {/* ── Day summary bar ── */}
        {activeDay && (
          <div className="flex items-center gap-3 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold text-white/50 shrink-0">{activeDay.name}</p>
            <div className="flex-1 flex flex-wrap gap-2">
              {activeDay.calories && (
                <span className="px-2 py-0.5 rounded-full bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 text-[10px] font-bold text-[#1f8a65]">{activeDay.calories} kcal</span>
              )}
              {activeDay.protein_g && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${NUTRITION_UI_COLORS.protein}18`, border: `0.3px solid ${NUTRITION_UI_COLORS.protein}33`, color: NUTRITION_UI_COLORS.protein }}>P: {activeDay.protein_g}g</span>}
              {activeDay.carbs_g && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${NUTRITION_UI_COLORS.carbs}18`, border: `0.3px solid ${NUTRITION_UI_COLORS.carbs}33`, color: NUTRITION_UI_COLORS.carbs }}>G: {activeDay.carbs_g}g</span>}
              {activeDay.fat_g && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${NUTRITION_UI_COLORS.fat}18`, border: `0.3px solid ${NUTRITION_UI_COLORS.fat}33`, color: NUTRITION_UI_COLORS.fat }}>L: {activeDay.fat_g}g</span>}
              {activeDay.hydration_ml && <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border-[0.3px] border-sky-500/20 text-[10px] font-bold text-sky-400">{activeDay.hydration_ml}ml eau</span>}
              {activeDay.carb_cycle_type && <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border-[0.3px] border-violet-500/20 text-[10px] font-bold text-violet-400">Jour {activeDay.carb_cycle_type}</span>}
              {activeDay.cycle_sync_phase && <span className="px-2 py-0.5 rounded-full bg-pink-500/10 border-[0.3px] border-pink-500/20 text-[10px] font-bold text-pink-400">{PHASE_LABELS[activeDay.cycle_sync_phase as CyclePhase]}</span>}
            </div>
            {/* Générer tout */}
            {macroResult && (
              <button
                onClick={generateFullProtocol}
                className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/25 text-[10px] font-bold text-[#1f8a65] hover:bg-[#1f8a65]/20 transition-all active:scale-[0.97]"
              >
                <Sparkles size={11} />
                Générer tous les jours
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MACRO CALCULATOR — Layout dual-pane
        ════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white/[0.01] border-[0.3px] border-white/[0.06] rounded-2xl overflow-hidden">
          {/* Header section */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b-[0.3px] border-white/[0.04]">
            <FlaskConical size={13} className="text-[#1f8a65]" strokeWidth={1.75} />
            <span className="text-[11px] font-semibold text-white/70">Calculateur Macros & TDEE</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1f8a65]/10 text-[#1f8a65]/70 ml-1">Principal</span>
            {clientLoaded && (
              <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 text-[#1f8a65]">
                <CheckCircle2 size={9} />
                Données injectées
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[520px_1fr] gap-5 p-4">

            {/* ══ COLONNE GAUCHE — Inputs ══ */}
            <div className="space-y-3">

              {/* Client search */}
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                <SectionHeader icon={UserCheck}>Client injecté</SectionHeader>
                <div className="relative" ref={searchRef}>
                  <div className={`flex items-center gap-2 h-9 rounded-lg border-[0.3px] px-3 transition-colors ${
                    clientSearch.selected ? 'border-[#1f8a65]/30 bg-[#1f8a65]/[0.05]' : 'border-white/[0.06] bg-white/[0.03]'
                  }`}>
                    <UserCheck size={13} className={clientSearch.selected ? 'text-[#1f8a65]/60' : 'text-white/20'} />
                    <input
                      value={clientSearch.query}
                      onChange={e => { clientSearch.search(e.target.value); setShowDropdown(true) }}
                      onFocus={() => clientSearch.results.length > 0 && setShowDropdown(true)}
                      placeholder="Changer de client…"
                      className="flex-1 bg-transparent text-[12px] font-medium text-white placeholder:text-white/25 outline-none"
                    />
                    {clientSearch.selected ? (
                      <button onClick={() => { clientSearch.clear() }} className="text-white/30 hover:text-white/60 transition-colors"><X size={12} /></button>
                    ) : clientSearch.loading ? (
                      <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                    ) : null}
                  </div>
                  {showDropdown && clientSearch.results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden z-50 shadow-xl">
                      {clientSearch.results.map((client, i) => (
                        <button key={client.id}
                          onClick={() => { clientSearch.select(client); injectClient(client); setShowDropdown(false) }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition-colors text-left ${i < clientSearch.results.length - 1 ? 'border-b-[0.3px] border-white/[0.04]' : ''}`}
                        >
                          <div>
                            <p className="text-[12px] font-semibold text-white">{client.name}</p>
                            {client.email && <p className="text-[10px] text-white/30">{client.email}</p>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                            {client.weight_kg != null && <span>{client.weight_kg}kg</span>}
                            {client.body_fat_pct != null && <span>{client.body_fat_pct}%</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clientLoaded && (weight || age) && (
                  <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Poids', value: weight, unit: 'kg' }, { label: 'BF%', value: bodyFat, unit: '%' },
                      { label: 'Taille', value: height, unit: 'cm' }, { label: 'Âge', value: age, unit: 'ans' },
                      { label: 'Séances', value: workouts, unit: '/sem' }, { label: 'Pas/j', value: dailySteps, unit: '' },
                    ].map(({ label, value, unit }) => value ? (
                      <div key={label} className="bg-white/[0.02] rounded-lg px-2 py-1.5 text-center">
                        <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
                        <p className="text-[11px] font-bold text-white">{value}{unit}</p>
                      </div>
                    ) : null)}
                  </div>
                )}
              </div>

              {/* Biométrie */}
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                <SectionHeader icon={Activity}>Biométrie & Profil</SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FieldLabel>Sexe</FieldLabel>
                    <div className="flex gap-1.5">
                      {([['male', 'Homme'], ['female', 'Femme']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setGender(v)}
                          className={`flex-1 h-8 rounded-lg text-[11px] font-bold border-[0.3px] transition-all ${
                            gender === v ? 'bg-[#1f8a65]/10 border-[#1f8a65]/30 text-[#1f8a65]' : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70'
                          }`}>{l}</button>
                      ))}
                    </div>
                  </div>
                  <div><FieldLabel>Âge</FieldLabel><NumInput value={age} onChange={setAge} placeholder="30" min="15" max="85" /></div>
                  <div><FieldLabel>Poids (kg)</FieldLabel><NumInput value={weight} onChange={setWeight} placeholder="75" min="40" max="250" /></div>
                  <div><FieldLabel>Taille (cm)</FieldLabel><NumInput value={height} onChange={setHeight} placeholder="178" min="140" max="220" /></div>
                  <div><FieldLabel>Masse grasse (%)</FieldLabel><NumInput value={bodyFat} onChange={setBodyFat} placeholder="15" step="0.1" /></div>
                  <div><FieldLabel>Masse musculaire (kg)</FieldLabel><NumInput value={muscleMass} onChange={setMuscleMass} placeholder="Optionnel" step="0.1" /></div>
                  <div><FieldLabel>BMR mesuré (kcal)</FieldLabel><NumInput value={bmrMeasured} onChange={setBmrMeasured} placeholder="Balance impédance" /></div>
                </div>
              </div>

              {/* Activité */}
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                <SectionHeader icon={Zap}>Activité & Entraînement</SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FieldLabel>Niveau d&apos;activité quotidienne</FieldLabel>
                    <DSSelect value={activityLevel} onChange={setActivityLevel}
                      options={(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(([v, l]) => ({ value: v, label: l }))}
                    />
                  </div>
                  <div><FieldLabel>Séances musculation/sem</FieldLabel><NumInput value={workouts} onChange={setWorkouts} placeholder="3" min="0" max="7" /></div>
                  <div><FieldLabel>Durée session (min)</FieldLabel><NumInput value={sessionDuration} onChange={setSessionDuration} placeholder="60" /></div>
                  <div><FieldLabel>Séances cardio/sem</FieldLabel><NumInput value={cardioFreq} onChange={setCardioFreq} placeholder="0" min="0" max="14" /></div>
                  <div><FieldLabel>Durée cardio (min)</FieldLabel><NumInput value={cardioDuration} onChange={setCardioDuration} placeholder="30" /></div>
                  <div><FieldLabel>Pas quotidiens</FieldLabel><NumInput value={dailySteps} onChange={setDailySteps} placeholder="Auto" /></div>
                  <div><FieldLabel>Kcal sport/sem (tracker)</FieldLabel><NumInput value={trainingCalsWeekly} onChange={setTrainingCalsWeekly} placeholder="Tracker" /></div>
                </div>
              </div>

              {/* Objectif */}
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                <SectionHeader>Objectif</SectionHeader>
                <div className="space-y-1.5">
                  {(Object.entries(GOAL_LABELS) as [MacroGoal, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setGoal(v)}
                      className={`w-full flex items-center justify-between px-3 h-9 rounded-lg border-[0.3px] text-left transition-all ${
                        goal === v ? 'bg-[#1f8a65]/10 border-[#1f8a65]/25 text-white' : 'bg-white/[0.02] border-white/[0.05] text-white/45 hover:text-white/70 hover:bg-white/[0.04]'
                      }`}>
                      <span className="text-[11px] font-semibold">{l}</span>
                      {goal === v && <CheckCircle2 size={12} className="text-[#1f8a65]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avancé */}
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden">
                <button onClick={() => setShowAdvanced(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={11} className="text-white/30" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Données avancées (bien-être, lifestyle)</span>
                    {[stressLevel, sleepH, alcoholWeekly, caffeineDaily, visceralFat].some(Boolean) && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#1f8a65]/15 text-[#1f8a65] text-[9px] font-bold">
                        {[stressLevel, sleepH, alcoholWeekly, caffeineDaily, visceralFat].filter(Boolean).length} renseignés
                      </span>
                    )}
                  </div>
                  {showAdvanced ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
                </button>
                {showAdvanced && (
                  <div className="px-4 pb-4 border-t-[0.3px] border-white/[0.04] pt-4 grid grid-cols-2 gap-3">
                    <div><FieldLabel>Stress (1–10)</FieldLabel><NumInput value={stressLevel} onChange={setStressLevel} placeholder="—" min="1" max="10" step="0.5" /></div>
                    <div><FieldLabel>Sommeil (h)</FieldLabel><NumInput value={sleepH} onChange={setSleepH} placeholder="—" step="0.5" /></div>
                    <div><FieldLabel>Qualité sommeil (1–5)</FieldLabel><NumInput value={sleepQuality} onChange={setSleepQuality} placeholder="—" min="1" max="5" /></div>
                    <div><FieldLabel>Énergie (1–10)</FieldLabel><NumInput value={energyLevel} onChange={setEnergyLevel} placeholder="—" min="1" max="10" /></div>
                    <div><FieldLabel>Caféine (mg/j)</FieldLabel><NumInput value={caffeineDaily} onChange={setCaffeineDaily} placeholder="200" /></div>
                    <div><FieldLabel>Alcool (verres/sem)</FieldLabel><NumInput value={alcoholWeekly} onChange={setAlcoholWeekly} placeholder="0" /></div>
                    <div><FieldLabel>Heures travail/sem</FieldLabel><NumInput value={workHours} onChange={setWorkHours} placeholder="35" /></div>
                    <div><FieldLabel>Graisse viscérale</FieldLabel><NumInput value={visceralFat} onChange={setVisceralFat} placeholder="Balance InBody" /></div>
                    {gender === 'female' && (
                      <div className="col-span-2">
                        <FieldLabel>Phase du cycle</FieldLabel>
                        <DSSelect value={menstrualPhase} onChange={setMenstrualPhase}
                          options={[
                            { value: '', label: 'Non renseigné' },
                            { value: 'follicular', label: 'Folliculaire (J1–J14)' },
                            { value: 'luteal', label: 'Lutéale (J14–J28)' },
                            { value: 'unknown', label: 'Inconnue' },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Calculer */}
              <button onClick={computeMacros} disabled={!canCalculateMacros}
                className="w-full h-11 rounded-xl bg-[#1f8a65] hover:bg-[#217356] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-[12px] font-bold uppercase tracking-[0.12em] text-white transition-all flex items-center justify-center gap-2">
                <FlaskConical size={14} />
                Calculer les macros
              </button>
            </div>

            {/* ══ COLONNE DROITE — Résultats ══ */}
            <div ref={resultsRef}>
              {!macroResult ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-3 border-[0.3px] border-dashed border-white/[0.06] rounded-xl">
                  <FlaskConical size={28} className="text-white/10" />
                  {clientLoaded && !canCalculateMacros ? (
                    <p className="text-[12px] text-white/20">Poids, taille et âge requis (min 40kg, 140cm, 15 ans)</p>
                  ) : (
                    <p className="text-[12px] text-white/20">Renseigne les données et lance le calcul</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">

                  {/* Context flags */}
                  {(macroResult.contextFlags.length > 0 || macroResult.corrections.length > 0) && (
                    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                      <SectionHeader icon={Info}>Sources de données</SectionHeader>
                      <div className="flex flex-wrap gap-1.5">
                        {macroResult.contextFlags.map(f => (
                          <div key={f.key} title={f.detail}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border-[0.3px] text-[10px] font-semibold cursor-help ${
                              f.type === 'success' ? 'border-[#1f8a65]/30 bg-[#1f8a65]/10 text-[#1f8a65]' :
                              f.type === 'danger'  ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                              f.type === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                              'border-white/[0.06] bg-white/[0.03] text-white/40'
                            }`}>
                            {f.type === 'success' ? <CheckCircle2 size={9} /> : f.type === 'danger' ? <AlertTriangle size={9} /> : f.type === 'warning' ? <AlertTriangle size={9} /> : <Info size={9} />}
                            {f.label}
                          </div>
                        ))}
                      </div>
                      {macroResult.corrections.length > 0 && (
                        <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] space-y-1">
                          {macroResult.corrections.map(c => (
                            <div key={c.field} className="flex items-center justify-between text-[10px]">
                              <span className="text-white/35">{c.label} : {c.value} {c.unit}</span>
                              <span className="text-amber-400/70 font-semibold">+{c.delta} kcal</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TDEE Breakdown */}
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <SectionHeader icon={Activity}>Dépense énergétique</SectionHeader>
                      <span className="text-[9px] text-white/30">Objectif {macroResult.adjustment > 0 ? '+' : ''}{macroResult.adjustment} kcal</span>
                    </div>
                    <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                      {[
                        { label: 'BMR', value: macroResult.breakdown.bmr, color: 'text-blue-400' },
                        { label: '+ NEAT', value: macroResult.breakdown.neat, color: 'text-emerald-400' },
                        { label: '+ EAT', value: macroResult.breakdown.eat + macroResult.breakdown.eatCardio, color: 'text-violet-400' },
                        { label: '+ TEF', value: macroResult.breakdown.tef, color: 'text-orange-400' },
                        ...(macroResult.breakdown.alcohol > 0 ? [{ label: '+ Alcool', value: macroResult.breakdown.alcohol, color: 'text-red-400' }] : []),
                      ].map((item, i, arr) => (
                        <React.Fragment key={item.label}>
                          <div className="flex flex-col items-center shrink-0">
                            <span className={`text-[15px] font-black tabular-nums ${item.color}`}>{item.value}</span>
                            <span className="text-[8px] text-white/30 font-semibold uppercase tracking-wide">{item.label}</span>
                          </div>
                          {i < arr.length - 1 && <span className="text-white/15 text-[11px] shrink-0 mx-0.5">=</span>}
                        </React.Fragment>
                      ))}
                      <span className="text-white/15 text-[11px] shrink-0 mx-0.5">=</span>
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-[15px] font-black tabular-nums text-white">{macroResult.tdee}</span>
                        <span className="text-[8px] text-white/30 font-semibold uppercase tracking-wide">TDEE</span>
                      </div>
                      <span className="text-white/15 text-[11px] shrink-0 mx-0.5">→</span>
                      <div className="flex flex-col items-center shrink-0">
                        <span className="text-[18px] font-black tabular-nums text-[#1f8a65]">{macroResult.calories}</span>
                        <span className="text-[8px] text-[#1f8a65]/60 font-semibold uppercase tracking-wide">Cible</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'BMR', value: macroResult.breakdown.bmr, color: 'bg-blue-500/60', pct: macroResult.breakdown.bmr / macroResult.tdee * 100 },
                        { label: 'NEAT', value: macroResult.breakdown.neat, color: 'bg-emerald-500/60', pct: macroResult.breakdown.neat / macroResult.tdee * 100 },
                        { label: 'EAT', value: macroResult.breakdown.eat + macroResult.breakdown.eatCardio, color: 'bg-violet-500/60', pct: (macroResult.breakdown.eat + macroResult.breakdown.eatCardio) / macroResult.tdee * 100 },
                        { label: 'TEF', value: macroResult.breakdown.tef, color: 'bg-orange-500/60', pct: macroResult.breakdown.tef / macroResult.tdee * 100 },
                      ].map(b => (
                        <div key={b.label} className="flex items-center gap-2">
                          <span className="text-[10px] text-white/30 w-8 shrink-0">{b.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, b.pct)}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-white/50 w-12 text-right tabular-nums">{b.value} kcal</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04] grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[18px] font-black text-white tabular-nums">{macroResult.leanMass}<span className="text-[10px] text-white/30 font-normal ml-0.5">kg</span></p>
                        <p className="text-[9px] text-white/30">Masse maigre</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-black text-white tabular-nums">{macroResult.estimatedBF}<span className="text-[10px] text-white/30 font-normal ml-0.5">%</span></p>
                        <p className="text-[9px] text-white/30">BF% estimé</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-black text-white tabular-nums">{macroResult.tdee - macroResult.calories > 0 ? '-' : '+'}{Math.abs(macroResult.tdee - macroResult.calories)}<span className="text-[10px] text-white/30 font-normal ml-0.5">kcal</span></p>
                        <p className="text-[9px] text-white/30">Ajustement</p>
                      </div>
                    </div>
                  </div>

                  {/* Macros cards */}
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                    <SectionHeader>Macronutriments</SectionHeader>
                    <div className="flex rounded-lg overflow-hidden h-2 mb-4 gap-px">
                      <div style={{ width: `${macroResult.percents.p}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} />
                      <div style={{ width: `${macroResult.percents.f}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} />
                      <div style={{ width: `${macroResult.percents.c}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { key: 'p' as const, label: 'Protéines', color: NUTRITION_UI_COLORS.protein, sub: 'Synthèse & rétention' },
                        { key: 'f' as const, label: 'Lipides',   color: NUTRITION_UI_COLORS.fat,     sub: 'Hormones & santé' },
                        { key: 'c' as const, label: 'Glucides',  color: NUTRITION_UI_COLORS.carbs,   sub: 'Énergie & glycogène' },
                      ].map(({ key, label, color, sub }) => (
                        <div key={key} className="bg-white/[0.02] rounded-xl p-3 border-[0.3px] border-white/[0.04]">
                          <p className="text-[9px] text-white/35 mb-1 uppercase tracking-wide">{label}</p>
                          <p className="text-[24px] font-black tabular-nums leading-none" style={{ color }}>
                            {macroResult.macros[key]}<span className="text-[11px] text-white/30 font-normal ml-0.5">g</span>
                          </p>
                          <p className="text-[9px] text-white/25 mt-1">{sub}</p>
                          <div className="mt-2 pt-2 border-t-[0.3px] border-white/[0.04] space-y-0.5">
                            <p className="text-[10px] text-white/35">{macroResult.percents[key]}% des kcal</p>
                            <p className="text-[10px] text-white/35">{macroResult.ratiosByBW[key]} g/kg PC</p>
                            {key === 'p' && <p className="text-[10px] text-white/35">{macroResult.ratios.p} g/kg LBM</p>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Ajustements */}
                    <div className="pt-3 border-t-[0.3px] border-white/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/25 mb-3">Ajustements</p>
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-white/35">Ajustement calorique</span>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setCalorieAdjust(0)} className="text-[9px] text-white/25 hover:text-white/50 transition-colors">reset</button>
                              <span className={`text-[11px] font-bold tabular-nums ${calorieAdjust > 0 ? 'text-[#1f8a65]' : calorieAdjust < 0 ? 'text-red-400' : 'text-white/40'}`}>
                                {calorieAdjust > 0 ? '+' : ''}{calorieAdjust}%
                              </span>
                            </div>
                          </div>
                          <input type="range" min="-30" max="30" step="1" value={calorieAdjust}
                            onChange={e => setCalorieAdjust(Number(e.target.value))}
                            className="w-full h-1 accent-[#1f8a65] cursor-pointer"
                          />
                          <div className="flex justify-between text-[8px] text-white/20 mt-0.5"><span>-30%</span><span>0</span><span>+30%</span></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/35">Protéines (g/kg poids de corps)</span>
                          <div className={`flex items-center rounded-lg border-[0.3px] overflow-hidden ${proteinOverride !== '' ? 'border-[#1f8a65]/30 bg-[#1f8a65]/[0.06]' : 'border-white/[0.06] bg-white/[0.03]'}`}>
                            <input type="number" step="0.1" min="0.5" max="4" value={proteinOverride}
                              onChange={e => setProteinOverride(e.target.value)}
                              placeholder={baseMacroResult && weight ? (baseMacroResult.macros.p / (parseFloat(weight) || 1)).toFixed(1) : '—'}
                              className="w-12 h-8 bg-transparent px-2 text-[12px] font-bold text-white placeholder:text-white/20 outline-none"
                            />
                            <span className="text-[9px] text-white/25 pr-2">g/kg</span>
                            {proteinOverride !== '' && (
                              <button onClick={() => setProteinOverride('')} className="h-8 w-8 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"><X size={11} /></button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recovery adaptation */}
                  {macroResult.recoveryAdaptation && (
                    <div className="bg-amber-500/[0.06] border-[0.3px] border-amber-500/20 rounded-xl p-4">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-semibold text-amber-300 mb-1">Adaptation récupération — déficit réduit recommandé</p>
                          <p className="text-[10px] text-amber-400/70 leading-relaxed">
                            {macroResult.recoveryAdaptation.reason} → réduire le déficit de {macroResult.recoveryAdaptation.suggestedDeficitReduction}% conseillé.
                          </p>
                          <button onClick={() => setCalorieAdjust(prev => Math.min(prev + macroResult.recoveryAdaptation!.suggestedDeficitReduction, 30))}
                            className="mt-2 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                            Appliquer +{macroResult.recoveryAdaptation.suggestedDeficitReduction}% →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {macroResult.warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {macroResult.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.06] border-[0.3px] border-red-500/15">
                          <AlertTriangle size={11} className="text-red-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] text-red-300/80">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Smart Protocol */}
                  {macroResult.smartProtocol.length > 0 && (
                    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
                      <SectionHeader icon={Zap}>Smart Protocol</SectionHeader>
                      <p className="text-[10px] text-white/30 mb-3 -mt-1 leading-relaxed">Recommandations basées sur la littérature scientifique.</p>
                      <div className="space-y-2">
                        {macroResult.smartProtocol.map(s => {
                          const cfg = PRIORITY_CONFIG[s.priority]
                          const isActive = activeProtocol === s.id
                          const isApplyable = ['protein_low', 'fats_critical', 'sleep_suboptimal', 'stress_critical'].includes(s.id)
                          return (
                            <div key={s.id} className={`rounded-xl border-[0.3px] p-3 ${cfg.bg} ${cfg.border} ${isActive ? 'ring-1 ring-[#1f8a65]/30' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${cfg.dot}`} />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                      <span className={`text-[11px] font-bold ${cfg.color}`}>{s.title}</span>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full border-[0.3px] font-bold uppercase tracking-wide ${cfg.color} ${cfg.border} opacity-70`}>
                                        {s.priority === 'critical' ? 'Critique' : s.priority === 'high' ? 'Prioritaire' : s.priority === 'medium' ? 'Recommandé' : 'Info'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-white/40 leading-relaxed mb-1.5">{s.rationale}</p>
                                    <p className="text-[10px] text-white/60 font-medium">→ {s.action}</p>
                                    {s.source && <p className="text-[9px] text-white/20 mt-1 italic">{s.source}</p>}
                                  </div>
                                </div>
                                {isApplyable && (
                                  <button onClick={() => applyProtocolSuggestion(s)}
                                    className={`shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold transition-all ${
                                      isActive ? 'bg-[#1f8a65]/20 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30' : 'bg-white/[0.05] text-white/40 hover:bg-white/[0.08] hover:text-white/70 border-[0.3px] border-white/[0.06]'
                                    }`}>
                                    {isActive ? <Check size={10} /> : <Send size={10} />}
                                    {isActive ? 'Appliqué' : 'Appliquer'}
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Apply to day */}
                  <button onClick={applyMacrosToDay}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#1f8a65]/15 border-[0.3px] border-[#1f8a65]/25 text-[11px] font-bold text-[#1f8a65] hover:bg-[#1f8a65]/25 transition-all active:scale-[0.98]">
                    <ArrowRight size={13} />
                    Appliquer à &quot;{activeDay?.name}&quot;
                  </button>

                  {/* Provenance */}
                  <div className="flex items-center gap-1 text-[10px] text-white/20">
                    <span>LBM:{macroResult.dataProvenance.lbmSource}</span>
                    <span>·</span><span>BMR:{macroResult.dataProvenance.bmrSource}</span>
                    <span>·</span><span>EAT:{macroResult.dataProvenance.eatSource}</span>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            MODULES COMPLÉMENTAIRES
        ════════════════════════════════════════════════════════════════════════ */}

        {/* ── Carb Cycling ── */}
        <ModuleBlock title="Carb Cycling" icon={RefreshCw} badge="Module" accent="text-violet-400">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="space-y-3">
              <p className="text-[10px] text-white/30 leading-relaxed">
                Utilise les données biométriques et d&apos;activité renseignées ci-dessus. Configure le protocole et l&apos;objectif.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Protocole</FieldLabel>
                  <DSSelect value={ccProtocol} onChange={setCcProtocol}
                    options={[
                      { value: '2/1', label: '2 hauts / 1 bas' }, { value: '3/1', label: '3 hauts / 1 bas' },
                      { value: '4/1', label: '4 hauts / 1 bas' }, { value: '5/2', label: '5 hauts / 2 bas' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Objectif</FieldLabel>
                  <DSSelect value={ccGoal} onChange={setCcGoal}
                    options={[
                      { value: 'aggressive', label: 'Déficit agressif' }, { value: 'moderate', label: 'Déficit modéré' },
                      { value: 'recomp', label: 'Recomposition' }, { value: 'performance', label: 'Performance' },
                      { value: 'bulk', label: 'Prise de masse' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Phase d&apos;entraînement</FieldLabel>
                  <DSSelect value={ccPhase} onChange={setCcPhase}
                    options={[
                      { value: 'hypertrophie', label: 'Hypertrophie' }, { value: 'force', label: 'Force' },
                      { value: 'endurance', label: 'Endurance' }, { value: 'cut', label: 'Sèche' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Intensité</FieldLabel>
                  <DSSelect value={ccIntensity} onChange={setCcIntensity}
                    options={[
                      { value: 'legere', label: 'Légère' }, { value: 'moderee', label: 'Modérée' },
                      { value: 'intense', label: 'Intense' }, { value: 'tres_intense', label: 'Très intense' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Sensibilité à l&apos;insuline</FieldLabel>
                  <DSSelect value={ccInsulin} onChange={setCcInsulin}
                    options={[
                      { value: 'normale', label: 'Normale' }, { value: 'elevee', label: 'Élevée' },
                      { value: 'reduite', label: 'Réduite' },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Occupation</FieldLabel>
                  <DSSelect value={ccOccupation} onChange={setCcOccupation}
                    options={[
                      { value: 'sedentaire', label: 'Sédentaire (bureau)' }, { value: 'debout', label: 'Debout (commerce)' },
                      { value: 'physique', label: 'Physique (chantier)' },
                    ]}
                  />
                </div>
              </div>
              <button onClick={computeCarbCycling}
                disabled={!weight || !height || !age}
                className="w-full h-10 rounded-xl bg-violet-500/15 border-[0.3px] border-violet-500/25 text-[11px] font-bold text-violet-400 hover:bg-violet-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <RefreshCw size={13} />
                Calculer le Carb Cycling
              </button>
            </div>

            {/* Résultats carb cycling */}
            {ccResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: 'TDEE', value: `${ccResult.tdee} kcal` }, { label: 'BF%', value: `${ccResult.bf}%` },
                    { label: 'LBM', value: `${ccResult.lbm} kg` }, { label: 'Moy./sem', value: `${ccResult.weeklyAvg} kcal` },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.02] rounded-lg p-3 border-[0.3px] border-white/[0.04]">
                      <p className="text-[9px] text-white/35 mb-0.5">{s.label}</p>
                      <p className="text-[13px] font-black text-white">{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {/* High day */}
                  <div className="bg-emerald-500/[0.06] border-[0.3px] border-emerald-500/20 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-400/70 mb-2">Jour HAUT</p>
                    <p className="text-[20px] font-black text-emerald-400 tabular-nums leading-none mb-1">{ccResult.high.kcal}<span className="text-[10px] text-emerald-400/50 font-normal ml-1">kcal</span></p>
                    <div className="space-y-0.5 text-[10px] text-white/50">
                      <p>P: {ccResult.high.p}g · L: {ccResult.high.f}g · G: {ccResult.high.c}g</p>
                    </div>
                    <button onClick={applyCarbCyclingHighDay}
                      className="mt-2 w-full h-7 rounded-lg bg-emerald-500/10 border-[0.3px] border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all">
                      Appliquer à &quot;{activeDay?.name}&quot;
                    </button>
                  </div>
                  {/* Low day */}
                  <div className="bg-red-500/[0.06] border-[0.3px] border-red-500/20 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-red-400/70 mb-2">Jour BAS</p>
                    <p className="text-[20px] font-black text-red-400 tabular-nums leading-none mb-1">{ccResult.low.kcal}<span className="text-[10px] text-red-400/50 font-normal ml-1">kcal</span></p>
                    <div className="space-y-0.5 text-[10px] text-white/50">
                      <p>P: {ccResult.low.p}g · L: {ccResult.low.f}g · G: {ccResult.low.c}g</p>
                    </div>
                    <button onClick={applyCarbCyclingLowDay}
                      className="mt-2 w-full h-7 rounded-lg bg-red-500/10 border-[0.3px] border-red-500/20 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-all">
                      Appliquer à &quot;{activeDay?.name}&quot;
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-white/30">
                  Protocole {ccResult.days.high}j hauts / {ccResult.days.low}j bas · {ccResult.deficit > 0 ? `Déficit ${ccResult.deficit} kcal/j` : 'Surplus'}
                </div>
                {ccResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border-[0.3px] border-amber-500/20">
                    <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-amber-300/80">{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 border-[0.3px] border-dashed border-white/[0.06] rounded-xl">
                <RefreshCw size={22} className="text-white/10" />
                <p className="text-[11px] text-white/20">Lance le calcul pour voir les résultats</p>
              </div>
            )}
          </div>
        </ModuleBlock>

        {/* ── Hydratation ── */}
        <ModuleBlock title="Hydratation" icon={Droplets} badge="Module" accent="text-sky-400">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="space-y-3">
              <p className="text-[10px] text-white/30 leading-relaxed">
                Utilise le poids et le sexe déjà renseignés. Sélectionne le climat.
              </p>
              <div>
                <FieldLabel>Climat actuel</FieldLabel>
                <DSSelect value={hydClimate} onChange={setHydClimate}
                  options={[
                    { value: 'cold', label: '❄️ Froid (< 10°C)' }, { value: 'temperate', label: '🌤 Tempéré (10–25°C)' },
                    { value: 'hot', label: '☀️ Chaud (25–35°C)' }, { value: 'veryHot', label: '🔥 Très chaud (> 35°C)' },
                  ]}
                />
              </div>
              <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3 text-[10px] text-white/35 space-y-0.5">
                <p>Poids : <span className="text-white/60 font-semibold">{weight || '—'} kg</span></p>
                <p>Sexe : <span className="text-white/60 font-semibold">{gender === 'female' ? 'Femme' : 'Homme'}</span></p>
                <p>Activité : <span className="text-white/60 font-semibold">{ACTIVITY_LABELS[activityLevel]}</span></p>
              </div>
              <button onClick={computeHydration} disabled={!weight}
                className="w-full h-10 rounded-xl bg-sky-500/15 border-[0.3px] border-sky-500/25 text-[11px] font-bold text-sky-400 hover:bg-sky-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <Droplets size={13} />
                Calculer l&apos;hydratation
              </button>
            </div>

            {hydResult ? (
              <div className="space-y-3">
                <div className="bg-sky-500/[0.08] border-[0.3px] border-sky-500/20 rounded-xl p-4 text-center">
                  <p className="text-[11px] text-sky-400/60 mb-1">Apport quotidien recommandé</p>
                  <p className="text-[36px] font-black text-sky-400 tabular-nums leading-none">{hydResult.liters.toFixed(1)}<span className="text-[16px] font-semibold ml-1">L</span></p>
                  <p className="text-[11px] text-sky-400/50 mt-1">{hydResult.glasses} verres de 250ml</p>
                </div>
                <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3 space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-white/25 mb-2">Décomposition</p>
                  {[
                    { label: 'Base (35ml/kg)', value: hydResult.breakdown.base },
                    { label: 'Ajustement sexe', value: hydResult.breakdown.gender },
                    { label: 'Activité physique', value: hydResult.breakdown.activity },
                    { label: 'Climat', value: hydResult.breakdown.climate },
                  ].map(b => (
                    <div key={b.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-white/35">{b.label}</span>
                      <span className={`text-[10px] font-semibold ${b.value > 0 ? 'text-sky-400' : b.value < 0 ? 'text-red-400' : 'text-white/30'}`}>
                        {b.value > 0 ? '+' : ''}{(b.value / 1000).toFixed(2)} L
                      </span>
                    </div>
                  ))}
                </div>
                <button onClick={applyHydrationToDay}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-sky-500/10 border-[0.3px] border-sky-500/20 text-[11px] font-bold text-sky-400 hover:bg-sky-500/20 transition-all">
                  <ArrowRight size={12} />
                  Appliquer à &quot;{activeDay?.name}&quot; ({Math.round(hydResult.liters * 1000)}ml)
                </button>
                {hydResult.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border-[0.3px] border-amber-500/20">
                    <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" /><span className="text-[10px] text-amber-300/80">{w}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full min-h-[160px] flex flex-col items-center justify-center gap-2 border-[0.3px] border-dashed border-white/[0.06] rounded-xl">
                <Droplets size={22} className="text-white/10" />
                <p className="text-[11px] text-white/20">Lance le calcul pour voir les résultats</p>
              </div>
            )}
          </div>
        </ModuleBlock>

        {/* ── Cycle Sync (femmes uniquement) ── */}
        {isFemale && (
          <ModuleBlock title="Cycle Sync" icon={Moon} badge="Module — Femmes" accent="text-pink-400">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-[10px] text-white/30 leading-relaxed">
                  Utilise automatiquement les macros calculées ci-dessus. Renseigne la position dans le cycle.
                </p>
                {!macroResult && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/[0.06] border-[0.3px] border-amber-500/20">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                    <p className="text-[10px] text-amber-300/80">Lance d&apos;abord le calcul des macros pour utiliser Cycle Sync.</p>
                  </div>
                )}
                {macroResult && (
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3 text-[10px] text-white/35 space-y-0.5">
                    <p>Macros de base : <span className="text-white/60 font-semibold">{macroResult.calories} kcal · P:{macroResult.macros.p}g C:{macroResult.macros.c}g L:{macroResult.macros.f}g</span></p>
                  </div>
                )}
                <div>
                  <FieldLabel>Mode de saisie</FieldLabel>
                  <div className="flex gap-1.5">
                    {([['day', 'Jour du cycle'], ['date', 'Date dernières règles']] as [CycleInputMode, string][]).map(([v, l]) => (
                      <button key={v} onClick={() => setCsInputMode(v)}
                        className={`flex-1 h-8 rounded-lg text-[11px] font-bold border-[0.3px] transition-all ${csInputMode === v ? 'bg-pink-500/10 border-pink-500/30 text-pink-400' : 'bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <FieldLabel>Longueur du cycle (jours)</FieldLabel>
                  <NumInput value={csCycleLength} onChange={setCsCycleLength} placeholder="28" min="21" max="35" />
                </div>
                {csInputMode === 'day' ? (
                  <div>
                    <FieldLabel>Jour actuel du cycle (J1 = premier jour des règles)</FieldLabel>
                    <NumInput value={csCurrentDay} onChange={setCsCurrentDay} placeholder="Ex: 14" min="1" max="35" />
                  </div>
                ) : (
                  <div>
                    <FieldLabel>Date des dernières règles</FieldLabel>
                    <input type="date" value={csLastPeriod} onChange={e => setCsLastPeriod(e.target.value)}
                      className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white outline-none focus:border-white/[0.12] transition-colors"
                    />
                  </div>
                )}
                <button onClick={computeCycleSync}
                  disabled={!macroResult || (csInputMode === 'day' ? !csCurrentDay : !csLastPeriod)}
                  className="w-full h-10 rounded-xl bg-pink-500/15 border-[0.3px] border-pink-500/25 text-[11px] font-bold text-pink-400 hover:bg-pink-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Moon size={13} />
                  Calculer la phase
                </button>
              </div>

              {csResult ? (
                <div className="space-y-3">
                  {/* Phase card */}
                  <div className={`rounded-xl p-4 border-[0.3px] ${PHASE_COLORS[csResult.phase].bg} ${PHASE_COLORS[csResult.phase].border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-[13px] font-black ${PHASE_COLORS[csResult.phase].text}`}>{PHASE_LABELS[csResult.phase]}</p>
                      <span className="text-[10px] text-white/30">J{csResult.dayOfCycle}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-[18px] font-black text-white tabular-nums">{csResult.adjustedCal}<span className="text-[10px] text-white/30 font-normal ml-0.5">kcal</span></p>
                        <p className="text-[9px] text-white/30">Calories ajustées</p>
                      </div>
                      <div>
                        <p className="text-[18px] font-black text-white tabular-nums">{csResult.adjustedProtein}<span className="text-[10px] text-white/30 font-normal ml-0.5">g</span></p>
                        <p className="text-[9px] text-white/30">Protéines</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-black tabular-nums" style={{ color: NUTRITION_UI_COLORS.carbs }}>{csResult.adjustedCarbs}g</p>
                        <p className="text-[9px] text-white/30">Glucides</p>
                      </div>
                      <div>
                        <p className="text-[16px] font-black tabular-nums" style={{ color: NUTRITION_UI_COLORS.fat }}>{csResult.adjustedFats}g</p>
                        <p className="text-[9px] text-white/30">Lipides</p>
                      </div>
                    </div>
                  </div>

                  {/* Protocole entraînement */}
                  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-white/25 mb-2">Protocole entraînement</p>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-white/50">Volume :</span>
                      <span className="text-[10px] font-bold text-white">{Math.round(csResult.training.volumeModifier * 100)}%</span>
                      <span className="text-[10px] text-white/50 ml-2">Intensité :</span>
                      <span className="text-[10px] font-bold text-white">{csResult.training.intensityRange}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {csResult.training.focus.map(f => (
                        <span key={f} className="px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/20 text-[9px] text-[#1f8a65]/70">{f}</span>
                      ))}
                      {csResult.training.avoidance.map(a => (
                        <span key={a} className="px-1.5 py-0.5 rounded-full bg-red-500/10 border-[0.3px] border-red-500/20 text-[9px] text-red-400/70">Éviter: {a}</span>
                      ))}
                    </div>
                  </div>

                  {/* Suppléments */}
                  {csResult.supplements.length > 0 && (
                    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-white/25 mb-2">Suppléments recommandés</p>
                      <div className="flex flex-wrap gap-1">
                        {csResult.supplements.map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-full bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[10px] text-white/50">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {csResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border-[0.3px] border-amber-500/20">
                      <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" /><span className="text-[10px] text-amber-300/80">{w}</span>
                    </div>
                  ))}

                  <button onClick={applyCycleSyncToDay}
                    className="w-full flex items-center justify-center gap-2 h-9 rounded-xl bg-pink-500/10 border-[0.3px] border-pink-500/20 text-[11px] font-bold text-pink-400 hover:bg-pink-500/20 transition-all">
                    <ArrowRight size={12} />
                    Appliquer à &quot;{activeDay?.name}&quot;
                  </button>
                </div>
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 border-[0.3px] border-dashed border-white/[0.06] rounded-xl">
                  <Moon size={22} className="text-white/10" />
                  <p className="text-[11px] text-white/20">Lance le calcul pour voir la phase</p>
                </div>
              )}
            </div>
          </ModuleBlock>
        )}

        {/* ── Recommandations manuelles ── */}
        {activeDay && (
          <ModuleBlock title="Recommandations & Notes" badge="Optionnel">
            <textarea
              value={activeDay.recommendations}
              onChange={e => updateDay(activeDayIndex, { recommendations: e.target.value })}
              placeholder="Notes visibles par le client pour ce jour..."
              rows={4}
              className="w-full rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] px-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors resize-none"
            />
          </ModuleBlock>
        )}

        {error && <p className="text-[12px] text-red-400/70">{error}</p>}

        {/* ── Sauvegarder ── */}
        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white/[0.06] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-white/[0.09] transition-colors disabled:opacity-40 active:scale-[0.98]">
            <Save size={14} />
            {saving && !sharing ? 'Sauvegarde...' : 'Sauvegarder brouillon'}
          </button>
          <button onClick={handleSaveAndShare} disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-[#217356] transition-colors disabled:opacity-40 active:scale-[0.98]">
            <Share2 size={14} />
            {sharing ? 'Partage...' : 'Sauvegarder & Partager'}
          </button>
        </div>

      </div>
    </main>
  )
}
