"use client"

import { useState } from "react"
import { Coffee, Sun, Moon, Apple, Pencil, Sparkles } from "lucide-react"
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors"
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { useClientT } from "@/components/client/ClientI18nProvider"

const SLOT_ICON: Record<SmartPrepSlot, React.ElementType> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple,
}

function MacroStrip({ p, g, f }: { p: number; g: number; f: number }) {
  const pK = p * 4, gK = g * 4, fK = f * 9
  const total = pK + gK + fK || 1
  return (
    <div className="flex h-[3px] rounded-full overflow-hidden gap-[2px]">
      <div className="rounded-full" style={{ width: `${(pK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} />
      <div className="rounded-full" style={{ width: `${(gK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} />
      <div className="rounded-full" style={{ width: `${(fK / total) * 100}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} />
    </div>
  )
}

function PrepRow({
  prep,
  onEdit,
  onValidated,
}: {
  prep: SmartNutritionPrep
  onEdit: (prep: SmartNutritionPrep) => void
  onValidated: () => void
}) {
  const { t } = useClientT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const Icon = SLOT_ICON[prep.meal_slot] ?? Apple
  const slotLabel = t(`compose.slot.${prep.meal_slot}` as const)

  async function handleValidate() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/client/nutrition/preps/${prep.id}/log`, { method: "POST" })
    if (res.ok) {
      onValidated()
    } else {
      setError(t('nutrition.prep.retryError'))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
      <div className="flex items-center gap-3">
        {/* Slot icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.06] shrink-0">
          <Icon size={14} className="text-white/70" />
        </div>

        {/* Title + slot */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate leading-tight">
            {prep.title || t('nutrition.prep.composedMeal')}
          </p>
          <p className="text-[10px] text-white/35 uppercase tracking-[0.10em]">
            {slotLabel} · {Math.round(prep.total_calories)} kcal
          </p>
        </div>

        {/* Macro pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-semibold" style={{ color: NUTRITION_UI_COLORS.protein }}>
            P{Math.round(prep.total_protein_g)}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: NUTRITION_UI_COLORS.carbs }}>
            G{Math.round(prep.total_carbs_g)}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: NUTRITION_UI_COLORS.fat }}>
            L{Math.round(prep.total_fat_g)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(prep)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.05] text-white/35 active:bg-white/[0.08] transition-colors"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={handleValidate}
            disabled={busy}
            className="h-7 px-2.5 rounded-lg bg-[#f2f2f2] text-[#080808] text-[10px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {busy ? "…" : t('ui.validate')}
          </button>
        </div>
      </div>

      <MacroStrip
        p={prep.total_protein_g}
        g={prep.total_carbs_g}
        f={prep.total_fat_g}
      />

      {error && (
        <p className="text-[10px] text-red-400">{error}</p>
      )}
    </div>
  )
}

interface Props {
  preps: SmartNutritionPrep[]
  date: string
  onEdit: (prep: SmartNutritionPrep) => void
  onValidated: () => void
}

export default function TodayPrepsSection({ preps, date, onEdit, onValidated }: Props) {
  const { t } = useClientT()
  const todayPreps = preps.filter(
    p => p.status === "planned" && p.physiological_date === date
  )

  if (todayPreps.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {/* Section header */}
      <div className="flex items-center gap-2 px-0.5">
        <Sparkles size={12} className="text-white/62" />
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/62">
          {t('nutrition.prep.todayPlanned')}
        </p>
        <span className="ml-auto text-[10px] text-white/25">{todayPreps.length} prep{todayPreps.length > 1 ? "s" : ""}</span>
      </div>

      {/* Prep rows */}
      {todayPreps.map(prep => (
        <PrepRow
          key={prep.id}
          prep={prep}
          onEdit={onEdit}
          onValidated={onValidated}
        />
      ))}
    </div>
  )
}
