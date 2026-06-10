"use client"

import { Suspense, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mic, Coffee, Sun, Moon, Apple } from "lucide-react"
import { NutritionLogContent, type NutritionLogContentHandle } from "@/app/client/nutrition/log/NutritionLogContent"
import dynamic from "next/dynamic"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

// ─── Slot selector config ─────────────────────────────────────────────────────

const SLOTS: { key: SmartPrepSlot; label: string; Icon: React.ElementType }[] = [
  { key: "breakfast", label: "P.Déj",    Icon: Coffee },
  { key: "lunch",     label: "Déjeuner", Icon: Sun },
  { key: "dinner",    label: "Dîner",    Icon: Moon },
  { key: "snack",     label: "Collation",Icon: Apple },
]

function getDefaultSlot(): SmartPrepSlot {
  const h = new Date().getHours()
  if (h < 10) return "breakfast"
  if (h < 14) return "lunch"
  if (h < 18) return "snack"
  return "dinner"
}

function getTomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Live macro header ────────────────────────────────────────────────────────

interface LiveMacroHeaderProps {
  consumed: NutritionMacros
  target: NutritionMacros
  /** Draft totals from NutritionLogContent (not yet saved) */
  drafts: { calories: number; protein: number; carbs: number; fat: number; count: number }
}

function MacroBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const over = max > 0 && value > max
  return (
    <div className="h-[3px] rounded-full overflow-hidden bg-white/[0.08] flex-1">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: over ? "#ef4444" : color }}
      />
    </div>
  )
}

function LiveMacroHeader({ consumed, target, drafts }: LiveMacroHeaderProps) {
  // Total = déjà consommé + drafts en cours (simulation live)
  const totalKcal   = consumed.kcal        + drafts.calories
  const totalProt   = consumed.protein_g   + drafts.protein
  const totalCarbs  = consumed.carbs_g     + drafts.carbs
  const totalFat    = consumed.fat_g       + drafts.fat

  const kcalPct = target.kcal > 0 ? Math.min((totalKcal / target.kcal) * 100, 100) : 0
  const kcalOver = totalKcal > target.kcal

  // Arc SVG — 200° arc, r=28
  const r = 28
  const cx = 36
  const cy = 36
  const startAngle = -200
  const endAngle   = 20
  const totalDeg   = endAngle - startAngle
  const toRad = (d: number) => (d * Math.PI) / 180
  const arcX = (a: number) => cx + r * Math.cos(toRad(a))
  const arcY = (a: number) => cy + r * Math.sin(toRad(a))

  function arcPath(fromDeg: number, toDeg: number) {
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${arcX(fromDeg)} ${arcY(fromDeg)} A ${r} ${r} 0 ${large} 1 ${arcX(toDeg)} ${arcY(toDeg)}`
  }

  const fillDeg = startAngle + (totalDeg * kcalPct) / 100

  return (
    <div className="flex items-center gap-4 px-4 py-3 shrink-0" style={{ borderBottom: "0.3px solid rgba(129,140,248,0.14)" }}>
      {/* Arc gauge kcal */}
      <div className="shrink-0 relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 72 72">
          {/* Track */}
          <path
            d={arcPath(startAngle, endAngle)}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Fill */}
          {kcalPct > 0 && (
            <path
              d={arcPath(startAngle, fillDeg)}
              fill="none"
              stroke={kcalOver ? "#ef4444" : NUTRITION_UI_COLORS.calories}
              strokeWidth="5"
              strokeLinecap="round"
            />
          )}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-black text-white leading-none tabular-nums">
            {Math.round(totalKcal)}
          </span>
          <span className="text-[8px] text-white/30 uppercase tracking-[0.10em]">kcal</span>
        </div>
      </div>

      {/* Macro bars */}
      <div className="flex-1 flex flex-col gap-2.5">
        {/* Protéines */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.10em] w-4" style={{ color: NUTRITION_UI_COLORS.protein }}>P</span>
          <MacroBar value={totalProt} max={target.protein_g} color={NUTRITION_UI_COLORS.protein} />
          <span className="text-[10px] tabular-nums text-white/40 w-14 text-right">
            {Math.round(totalProt)}<span className="text-white/20">/{Math.round(target.protein_g)}g</span>
          </span>
        </div>
        {/* Glucides */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.10em] w-4" style={{ color: NUTRITION_UI_COLORS.carbs }}>G</span>
          <MacroBar value={totalCarbs} max={target.carbs_g} color={NUTRITION_UI_COLORS.carbs} />
          <span className="text-[10px] tabular-nums text-white/40 w-14 text-right">
            {Math.round(totalCarbs)}<span className="text-white/20">/{Math.round(target.carbs_g)}g</span>
          </span>
        </div>
        {/* Lipides */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.10em] w-4" style={{ color: NUTRITION_UI_COLORS.fat }}>L</span>
          <MacroBar value={totalFat} max={target.fat_g} color={NUTRITION_UI_COLORS.fat} />
          <span className="text-[10px] tabular-nums text-white/40 w-14 text-right">
            {Math.round(totalFat)}<span className="text-white/20">/{Math.round(target.fat_g)}g</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface MealLogSheetProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  mealId?: string | null
  prep?: SmartNutritionPrep | null
  composerMode?: "standard" | "guide" | "simulation"
  entryMode?: "default" | "search" | "favorites" | "categories"
  intent?: "track" | "compose"
  /** Date active de la page nutrition (YYYY-MM-DD). En mode guide, les preps sont créés pour cette date. */
  activeDate?: string
  balanceContext?: {
    consumed: NutritionMacros
    target: NutritionMacros
    profile?: {
      gender?: string | null
      weightKg?: number | null
    }
  }
}

export default function MealLogSheet({
  open,
  onClose,
  onSuccess,
  mealId,
  prep,
  composerMode = "standard",
  entryMode = "default",
  intent,
  activeDate,
  balanceContext,
}: MealLogSheetProps) {
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<SmartPrepSlot>(getDefaultSlot)
  const [saving, setSaving] = useState<"prep" | "meal" | null>(null)
  const [drafts, setDrafts] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 })
  const logRef = useRef<NutritionLogContentHandle>(null)

  const isGuideMode = composerMode === "guide"
  const resolvedIntent = intent ?? (composerMode === "standard" ? "track" : "compose")
  // Date du prep : si on édite un prep existant → sa date ; sinon la date active de la page (ou today)
  const resolvedSlot = prep ? (prep.meal_slot ?? selectedSlot) : selectedSlot
  const resolvedDate = prep
    ? (prep.planned_for?.slice(0, 10) ?? getTodayDate())
    : (activeDate ?? getTodayDate())

  const showLiveHeader = !!balanceContext

  async function handleSavePrep() {
    setSaving("prep")
    await logRef.current?.savePrep()
    setSaving(null)
    onSuccess?.()
  }

  async function handleSaveMeal() {
    setSaving("meal")
    await logRef.current?.saveMeal()
    setSaving(null)
    onSuccess?.()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Plein écran — monte depuis le bas */}
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: isGuideMode ? '#0a0a10' : '#0d0d0d' }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 320, damping: 32 } }}
            exit={{ y: "100%", transition: { duration: 0.22, ease: "easeIn" } }}
          >
            {/* Safe-area background fill — makes iOS status bar match the sheet bg */}
            <div
              className="shrink-0"
              style={{
                height: 'env(safe-area-inset-top, 0px)',
                background: isGuideMode ? '#0a0a10' : '#0d0d0d',
              }}
            />
            {/* ── Topbar fixe ── */}
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{
                paddingTop: "16px",
                paddingBottom: "12px",
                borderBottom: isGuideMode ? "0.3px solid rgba(129,140,248,0.18)" : "0.3px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex flex-col">
                <p
                  className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] leading-tight"
                  style={{ color: isGuideMode ? "#818cf8" : "white" }}
                >
                  {isGuideMode ? "Je compose" : "J'ai mangé…"}
                </p>
                {isGuideMode && (
                  <p className="text-[10px] uppercase tracking-[0.10em] font-semibold" style={{ color: "rgba(129,140,248,0.5)" }}>
                    Planification · {resolvedDate === getTodayDate() ? "Aujourd'hui" : resolvedDate}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isGuideMode && (
                  <button
                    onClick={() => setVoiceOpen(true)}
                    className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08] transition-colors"
                    title="Saisie vocale"
                  >
                    <Mic size={16} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="h-9 w-9 flex items-center justify-center rounded-xl active:bg-white/[0.08] transition-colors"
                  style={{ background: isGuideMode ? "rgba(129,140,248,0.08)" : "rgba(255,255,255,0.06)", color: isGuideMode ? "rgba(129,140,248,0.6)" : "rgba(255,255,255,0.4)" }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── Jauges live ── */}
            {showLiveHeader && (
              <LiveMacroHeader
                consumed={balanceContext.consumed}
                target={balanceContext.target}
                drafts={drafts}
              />
            )}

            {/* ── Slot selector (guide mode uniquement) ── */}
            {isGuideMode && (
              <div
                className="px-4 py-3 shrink-0 flex gap-2"
                style={{ borderBottom: "0.3px solid rgba(129,140,248,0.10)" }}
              >
                {SLOTS.map(({ key, label, Icon }) => {
                  const active = resolvedSlot === key
                  const disabled = !!prep
                  return (
                    <button
                      key={key}
                      onClick={() => !disabled && setSelectedSlot(key)}
                      disabled={disabled}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-wide transition-all duration-150 ${
                        disabled ? "opacity-60" : "active:scale-[0.97]"
                      }`}
                      style={active
                        ? { background: "rgba(129,140,248,0.20)", color: "#818cf8", border: "0.3px solid rgba(129,140,248,0.35)" }
                        : { background: "rgba(129,140,248,0.05)", color: "rgba(255,255,255,0.35)" }
                      }
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── NutritionLogContent ── */}
            <div className="flex-1 overflow-hidden relative min-h-0">
              <Suspense fallback={<div className="h-full" style={{ background: isGuideMode ? '#0a0a10' : '#0d0d0d' }} />}>
                <NutritionLogContent
                  ref={isGuideMode ? logRef : undefined}
                  embedded
                  mealId={mealId}
                  prepId={prep?.id ?? null}
                  initialPrepEntries={prep?.entries}
                  composerMode={isGuideMode ? "guide" : composerMode}
                  entryMode={entryMode}
                  onSuccess={isGuideMode ? undefined : (onSuccess ?? onClose)}
                  balanceContext={balanceContext}
                  prepMealSlot={isGuideMode ? resolvedSlot : null}
                  prepDate={isGuideMode ? resolvedDate : null}
                  hideActions={isGuideMode}
                  onDraftsChange={setDrafts}
                />
              </Suspense>
            </div>

            {/* ── Footer guide mode (indigo) ── */}
            {isGuideMode && (
              <div
                className="px-4 pt-3 shrink-0 flex gap-2"
                style={{
                  paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
                  borderTop: "0.3px solid rgba(129,140,248,0.15)",
                }}
              >
                <button
                  onClick={onClose}
                  className="h-11 px-4 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all"
                  style={{ background: "rgba(129,140,248,0.06)", color: "rgba(255,255,255,0.40)" }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSavePrep}
                  disabled={saving !== null}
                  className="flex-1 h-11 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{ background: "rgba(129,140,248,0.18)", color: "#818cf8" }}
                >
                  {saving === "prep" ? "Sauvegarde…" : "Planifier"}
                </button>
                <button
                  onClick={handleSaveMeal}
                  disabled={saving !== null}
                  className="flex-1 h-11 rounded-xl text-[12px] font-barlow-condensed font-bold uppercase tracking-wide active:scale-[0.97] transition-all disabled:opacity-50"
                  style={{ background: "#f2f2f2", color: "#080808" }}
                >
                  {saving === "meal" ? "Logger…" : "Valider"}
                </button>
              </div>
            )}
          </motion.div>

          {/* Voice sheet — z au-dessus */}
          <VoiceLogSheet
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            onSuccess={() => { setVoiceOpen(false); onSuccess?.() }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
