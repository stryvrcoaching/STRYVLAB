"use client"

import type { ElementType, ReactNode } from "react"
import { Apple, Coffee, Moon, Sun, X } from "lucide-react"
import { useClientT } from "@/components/client/ClientI18nProvider"
import SmartNutritionHero from "@/components/client/smart/SmartNutritionHero"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { clientLocale, type ClientDictKey } from "@/lib/i18n/clientTranslations"

const SLOT_META: Array<{
  key: SmartPrepSlot
  labelKey: ClientDictKey
  icon: ElementType
}> = [
  { key: "breakfast", labelKey: "compose.slot.breakfast", icon: Coffee },
  { key: "lunch", labelKey: "compose.slot.lunch", icon: Sun },
  { key: "dinner", labelKey: "compose.slot.dinner", icon: Moon },
  { key: "snack", labelKey: "compose.slot.snack", icon: Apple },
]

type HeaderAction = {
  icon: ElementType
  label: string
  onClick: () => void
}

type Props = {
  title: string
  contextLabel: string
  date: string
  consumed: NutritionMacros
  target: NutritionMacros
  action: HeaderAction
  onClose: () => void
  closeLabel: string
  notice?: ReactNode
  betweenHeroAndSlots?: ReactNode
  showSlots: boolean
  selectedSlot: SmartPrepSlot
  slotsLocked?: boolean
  onSlotChange: (slot: SmartPrepSlot) => void
}

export default function NutritionEntryHeader({
  title,
  contextLabel,
  date,
  consumed,
  target,
  action,
  onClose,
  closeLabel,
  notice,
  betweenHeroAndSlots,
  showSlots,
  selectedSlot,
  slotsLocked = false,
  onSlotChange,
}: Props) {
  const { lang, t } = useClientT()
  const locale = clientLocale(lang)
  const ActionIcon = action.icon
  const dateLabel = (() => {
    const [year, month, day] = date.split("-").map(Number)
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(Date.UTC(year, month - 1, day)))
  })()

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          paddingTop: "16px",
          paddingBottom: "14px",
          borderBottom: "0.3px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="min-w-0">
          <p className="text-[16px] font-barlow-condensed font-bold uppercase leading-tight tracking-[0.12em] text-white">
            {title}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
            {contextLabel} · {dateLabel}
          </p>
          {notice}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={action.onClick}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/58 transition-colors active:bg-white/[0.08]"
            aria-label={action.label}
            title={action.label}
          >
            <ActionIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 transition-colors active:bg-white/[0.08]"
            aria-label={closeLabel}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div
        className="px-4 py-3"
        style={{ borderBottom: "0.3px solid rgba(255,255,255,0.06)" }}
      >
        <SmartNutritionHero
          consumed={consumed}
          target={target}
          simulationMode
          compact
          micro={false}
          showSimulationBadge={false}
        />
      </div>

      {betweenHeroAndSlots}

      {showSlots && (
        <div
          className="shrink-0 px-4 py-3"
          style={{
            borderTop: "0.3px solid rgba(255,255,255,0.04)",
            borderBottom: "0.3px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex gap-2 overflow-x-auto">
            {SLOT_META.map(({ key, labelKey, icon: Icon }) => {
              const active = selectedSlot === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (!slotsLocked) onSlotChange(key)
                  }}
                  disabled={slotsLocked}
                  className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-[16px] py-2.5 text-[11px] font-barlow-condensed font-bold uppercase tracking-wide ${
                    slotsLocked ? "opacity-60" : "active:scale-[0.97]"
                  } ${
                    active
                      ? "border border-white/[0.16] bg-white/[0.12] text-white"
                      : "bg-white/[0.04] text-white/35"
                  }`}
                >
                  <Icon size={12} />
                  {t(labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
