'use client'

import { useMemo } from 'react'
import { calculateMacros, type MacroGoal, type MacroGender } from '@/lib/formulas/macros'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import type { DayDraft, NutritionClientData } from '@/lib/nutrition/types'

const GOAL_OPTIONS: { value: MacroGoal; label: string }[] = [
  { value: 'deficit',     label: 'Déficit — Perte de gras' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'surplus',     label: 'Surplus — Prise de muscle' },
]

interface Props {
  day: DayDraft
  clientData: NutritionClientData | null
  goal: MacroGoal
  onGoalChange: (g: MacroGoal) => void
  onDayChange: (updates: Partial<DayDraft>) => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">{children}</label>
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
    />
  )
}

export default function NutritionMacrosSection({ day, clientData, goal, onGoalChange, onDayChange }: Props) {
  const autoCalc = useMemo(() => {
    if (!clientData?.weight_kg || !clientData?.age || !clientData?.height_cm) return null
    try {
      return calculateMacros({
        gender: (clientData.gender === 'female' ? 'female' : 'male') as MacroGender,
        age: clientData.age,
        weight: clientData.weight_kg,
        height: clientData.height_cm,
        bodyFat: clientData.body_fat_pct ?? undefined,
        muscleMassKg: clientData.muscle_mass_kg ?? undefined,
        workouts: clientData.weekly_frequency ?? 3,
        goal,
        bmrKcalMeasured: clientData.bmr_kcal_measured ?? undefined,
        steps: clientData.daily_steps ?? undefined,
        stressLevel: clientData.stress_level ?? undefined,
        sleepDurationH: clientData.sleep_duration_h ?? undefined,
        caffeineDaily: clientData.caffeine_daily_mg ?? undefined,
        alcoholWeekly: clientData.alcohol_weekly ?? undefined,
        workHoursPerWeek: clientData.work_hours_per_week ?? undefined,
        sessionDurationMin: clientData.session_duration_min ?? undefined,
      })
    } catch {
      return null
    }
  }, [clientData, goal])

  function applyAutoCalc() {
    if (!autoCalc) return
    onDayChange({
      calories: String(Math.round(autoCalc.calories)),
      protein_g: String(Math.round(autoCalc.macros.p)),
      carbs_g: String(Math.round(autoCalc.macros.c)),
      fat_g: String(Math.round(autoCalc.macros.f)),
    })
  }

  const protein = Number(day.protein_g) || 0
  const carbs   = Number(day.carbs_g) || 0
  const fat     = Number(day.fat_g) || 0
  const total   = protein * 4 + carbs * 4 + fat * 9

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Objectif nutritionnel</FieldLabel>
        <select
          value={goal}
          onChange={e => onGoalChange(e.target.value as MacroGoal)}
          className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white outline-none appearance-none"
        >
          {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#181818]">{o.label}</option>)}
        </select>
      </div>

      {autoCalc && (
        <div className="flex items-center justify-between bg-[#1f8a65]/[0.06] border-[0.3px] border-[#1f8a65]/20 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-[#1f8a65]">Calcul automatique disponible</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {Math.round(autoCalc.calories)} kcal · P {Math.round(autoCalc.macros.p)}g · G {Math.round(autoCalc.macros.c)}g · L {Math.round(autoCalc.macros.f)}g
            </p>
          </div>
          <button
            onClick={applyAutoCalc}
            className="h-7 px-3 rounded-lg bg-[#1f8a65]/20 text-[#1f8a65] text-[11px] font-bold hover:bg-[#1f8a65]/30 transition-colors"
          >
            Appliquer
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Calories (kcal)</FieldLabel>
          <NumInput value={day.calories} onChange={v => onDayChange({ calories: v })} placeholder="ex: 2200" />
        </div>
        <div>
          <FieldLabel>Protéines (g)</FieldLabel>
          <NumInput value={day.protein_g} onChange={v => onDayChange({ protein_g: v })} placeholder="ex: 180" />
        </div>
        <div>
          <FieldLabel>Glucides (g)</FieldLabel>
          <NumInput value={day.carbs_g} onChange={v => onDayChange({ carbs_g: v })} placeholder="ex: 250" />
        </div>
        <div>
          <FieldLabel>Lipides (g)</FieldLabel>
          <NumInput value={day.fat_g} onChange={v => onDayChange({ fat_g: v })} placeholder="ex: 70" />
        </div>
      </div>

      {total > 0 && (
        <div className="flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3">
          <div className="grid grid-cols-3 flex-1 gap-2 text-center">
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Protéines</p>
              <p className="text-[13px] font-bold" style={{ color: NUTRITION_UI_COLORS.protein }}>{Math.round((protein * 4 / total) * 100)}%</p>
              <p className="text-[9px] text-white/30">{protein}g</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Glucides</p>
              <p className="text-[13px] font-bold" style={{ color: NUTRITION_UI_COLORS.carbs }}>{Math.round((carbs * 4 / total) * 100)}%</p>
              <p className="text-[9px] text-white/30">{carbs}g</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Lipides</p>
              <p className="text-[13px] font-bold" style={{ color: NUTRITION_UI_COLORS.fat }}>{Math.round((fat * 9 / total) * 100)}%</p>
              <p className="text-[9px] text-white/30">{fat}g</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
