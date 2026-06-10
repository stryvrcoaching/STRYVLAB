'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Clock, Sparkles, Wand2 } from 'lucide-react'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

type PrepEntry = {
  food_item_id: string
  name_fr: string
  quantity_g: number
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type Prep = {
  id: string
  physiological_date: string
  title: string | null
  meal_type: string | null
  meal_slot: string
  scenario_key: string
  scenario_label: string
  is_active: boolean
  status: 'planned' | 'logged'
  entries: PrepEntry[]
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
  planned_for: string | null
}

type DayGroup = {
  date: string
  isToday: boolean
  preps: Prep[]
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Petit déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
}

function MacroStrip({ p, g, f }: { p: number; g: number; f: number }) {
  const pK = p * 4
  const gK = g * 4
  const fK = f * 9
  const total = pK + gK + fK || 1
  return (
    <div className="flex h-[3px] rounded-full overflow-hidden gap-[2px] mt-1.5">
      <div className="rounded-full" style={{ width: `${(pK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} />
      <div className="rounded-full" style={{ width: `${(gK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} />
      <div className="rounded-full" style={{ width: `${(fK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} />
    </div>
  )
}

function PrepRow({ prep }: { prep: Prep }) {
  const [expanded, setExpanded] = useState(false)
  const isLogged = prep.status === 'logged'

  return (
    <div className={`rounded-xl overflow-hidden ${isLogged ? 'bg-white/[0.02] opacity-60' : prep.is_active ? 'bg-[#818cf8]/6' : 'bg-white/[0.03]'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
          isLogged ? 'bg-white/[0.06]' : prep.is_active ? 'bg-[#818cf8]/15' : 'bg-white/[0.06]'
        }`}>
          {isLogged
            ? <Check size={12} className="text-white/40" />
            : <Wand2 size={12} className={prep.is_active ? 'text-[#818cf8]' : 'text-white/40'} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{prep.title || 'Repas préparé'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-white/35">{SLOT_LABELS[prep.meal_slot] ?? prep.meal_slot}</span>
            <span className="text-white/15">·</span>
            <span className="text-[10px] text-white/30">{prep.scenario_label}</span>
            {prep.is_active && !isLogged && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#818cf8]/12 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#818cf8]">
                <Sparkles size={8} />
                Actif
              </span>
            )}
            {isLogged && (
              <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/30">Validé</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[14px] font-black text-white tabular-nums">{Math.round(prep.total_calories)}</p>
          <p className="text-[8px] uppercase tracking-[0.1em] text-white/25">kcal</p>
        </div>
        <span className="text-white/20 shrink-0">{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
      </button>

      {!expanded && <MacroStrip p={prep.total_protein_g} g={prep.total_carbs_g} f={prep.total_fat_g} />}

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-3 text-[11px] font-semibold">
            <span style={{ color: NUTRITION_UI_COLORS.protein }}>P {prep.total_protein_g}g</span>
            <span style={{ color: NUTRITION_UI_COLORS.carbs }}>G {prep.total_carbs_g}g</span>
            <span style={{ color: NUTRITION_UI_COLORS.fat }}>L {prep.total_fat_g}g</span>
          </div>
          <MacroStrip p={prep.total_protein_g} g={prep.total_carbs_g} f={prep.total_fat_g} />
          <div className="pt-1 space-y-1">
            {prep.entries.map((entry, i) => (
              <div key={`${entry.food_item_id}-${i}`} className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-white/20 shrink-0" />
                <span className="text-[11px] text-white/55 flex-1 truncate">{entry.name_fr}</span>
                <span className="text-[10px] text-white/30">{entry.quantity_g}g</span>
                <span className="text-[10px] text-white/30 w-12 text-right">{Math.round(entry.calories_kcal)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientNutritionPrepsWidget({ clientId }: { clientId: string }) {
  const [data, setData] = useState<DayGroup[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/clients/${clientId}/nutrition-preps`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!active) return
        setData(json?.data ?? null)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  const totalPlanned = data?.flatMap(d => d.preps).filter(p => p.status === 'planned').length ?? 0
  const hasAny = (data?.flatMap(d => d.preps).length ?? 0) > 0

  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#181818]">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#818cf8]/12 flex items-center justify-center">
            <Sparkles size={13} className="text-[#818cf8]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Prépas Smart Nutrition</p>
            <p className="text-[10px] text-white/35 mt-0.5">
              {loading ? '...' : !hasAny ? 'Aucune prépa planifiée' : `${totalPlanned} planifiée${totalPlanned > 1 ? 's' : ''} en attente`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalPlanned > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-[#818cf8]/15 text-[#818cf8] text-[10px] font-bold flex items-center justify-center tabular-nums">
              {totalPlanned}
            </span>
          )}
          {open ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {loading && (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.04] animate-pulse" />)}
            </div>
          )}

          {!loading && !hasAny && (
            <div className="rounded-xl bg-white/[0.03] px-3 py-4 text-center">
              <Clock size={16} className="text-white/20 mx-auto mb-2" />
              <p className="text-[11px] text-white/40">Le client n'a pas encore composé de prépa pour les prochains jours.</p>
            </div>
          )}

          {!loading && data?.map(day => {
            if (day.preps.length === 0) return null
            const label = day.isToday ? "Aujourd'hui" : day.date
            const plannedCount = day.preps.filter(p => p.status === 'planned').length
            const loggedCount = day.preps.filter(p => p.status === 'logged').length

            return (
              <div key={day.date}>
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/40">
                    {label}
                  </p>
                  <div className="flex items-center gap-2">
                    {plannedCount > 0 && (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-[#818cf8]/70 font-bold">{plannedCount} en attente</span>
                    )}
                    {loggedCount > 0 && (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-white/30 font-bold">{loggedCount} validée{loggedCount > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {day.preps.map(prep => <PrepRow key={prep.id} prep={prep} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
