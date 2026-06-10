"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Trash2, ChevronDown, ChevronUp, Check, Coffee, Sun, Moon, Apple, Droplets, Pencil, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { NutritionMeal, NutritionEntry } from "@/lib/nutrition/food-items"
import type { SmartNutritionPrep } from "@/components/client/smart/SmartNutritionPrepList"
import { useClientT } from "@/components/client/ClientI18nProvider"
import type { ClientDictKey } from "@/lib/i18n/clientTranslations"
import type { NutritionMacros } from "./SmartNutritionWidget"
import type { SmartPrepSlot } from "@/lib/nutrition/simulation-state"
import { NUTRITION_UI_COLORS } from "@/lib/nutrition/ui-colors"
import { computeActionableRemaining } from "@/lib/nutrition/actionable-remaining"

const MC = {
  prot: NUTRITION_UI_COLORS.protein,
  carb: NUTRITION_UI_COLORS.carbs,
  fat: NUTRITION_UI_COLORS.fat,
}

const MEAL_TYPE_KEYS: Record<string, ClientDictKey> = {
  breakfast: "meal.type.breakfast",
  lunch:     "meal.type.lunch",
  dinner:    "meal.type.dinner",
  snack:     "meal.type.snack",
}

const MEAL_TYPE_ICON: Record<string, LucideIcon> = {
  breakfast: Coffee,
  lunch:     Sun,
  dinner:    Moon,
  snack:     Apple,
  drinks:    Droplets,
}

const SLOT_LABEL: Record<SmartPrepSlot, string> = {
  breakfast: "P.Déj",
  lunch: "Déjeuner",
  dinner: "Dîner",
  snack: "Collation",
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: "2-digit", minute: "2-digit" })
}

function MacroStrip({ p, g, f }: { p: number; g: number; f: number }) {
  const pK = p * 4, gK = g * 4, fK = f * 9
  const total = pK + gK + fK || 1
  return (
    <div className="flex h-[4px] rounded-full overflow-hidden gap-[2px]">
      <div className="rounded-full" style={{ width: `${(pK / total) * 100}%`, backgroundColor: MC.prot }} />
      <div className="rounded-full" style={{ width: `${(gK / total) * 100}%`, backgroundColor: MC.carb }} />
      <div className="rounded-full" style={{ width: `${(fK / total) * 100}%`, backgroundColor: MC.fat }} />
    </div>
  )
}

// ─── Meal components ──────────────────────────────────────────────────────────

function MealTypeChooser({ mealId, current, onChange }: { mealId: string; current: string; onChange: (t: string) => void }) {
  const { t } = useClientT()
  const [open, setOpen] = useState(false)
  const types = ["breakfast", "lunch", "dinner", "snack"] as const

  async function pick(type: string) {
    setOpen(false)
    onChange(type)
    await fetch(`/api/client/nutrition/meals/${mealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_type: type }),
    })
  }

  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }} className="flex items-center gap-1.5 group">
        {(() => { const Icon = MEAL_TYPE_ICON[current] ?? Coffee; return <Icon size={11} className="text-white/50 group-hover:text-white/80 transition-colors" /> })()}
        <span className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors">
          {MEAL_TYPE_KEYS[current] ? t(MEAL_TYPE_KEYS[current]) : current}
        </span>
        <svg width="8" height="8" viewBox="0 0 8 8" className="text-white/20 group-hover:text-white/50 transition-colors" fill="currentColor"><path d="M4 5L1 2h6L4 5z"/></svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-6 z-50 bg-[#111111] rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.7)] min-w-[140px]"
            >
              {types.map(type => (
                <button
                  key={type}
                  onClick={() => pick(type)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-white/[0.06] ${
                    type === current ? "text-[#f2f2f2] font-bold" : "text-white/70"
                  }`}
                >
                  {(() => { const Icon = MEAL_TYPE_ICON[type] ?? Coffee; return <Icon size={12} className="text-white/40" /> })()}
                  {MEAL_TYPE_KEYS[type] ? t(MEAL_TYPE_KEYS[type]) : type}
                  {type === current && <Check size={10} className="ml-auto text-[#f2f2f2]" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function TimeEditor({ mealId, loggedAt, onUpdated }: { mealId: string; loggedAt: string; onUpdated: (iso: string) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const d = new Date(loggedAt)
  const currentVal = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const timeVal = e.target.value
    if (!timeVal) return
    setSaving(true)
    setOpen(false)
    const base = new Date(loggedAt)
    const [h, m] = timeVal.split(':').map(Number)
    base.setHours(h, m, 0, 0)
    const iso = base.toISOString()
    await fetch(`/api/client/nutrition/meals/${mealId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logged_at: iso }),
    })
    onUpdated(iso)
    setSaving(false)
  }

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 group mt-0.5">
        <span className={`text-[10px] text-white/25 group-hover:text-white/50 transition-colors ${saving ? 'opacity-40' : ''}`}>
          {saving ? '…' : timeStr}
        </span>
        <Pencil size={8} className="text-white/15 group-hover:text-white/40 transition-colors" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -3, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute left-0 top-6 z-50 bg-[#1a1a1a] border border-white/[0.08] rounded-xl px-3 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.7)]"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30 mb-2">Heure</p>
              <input
                type="time"
                defaultValue={currentVal}
                onChange={handleChange}
                className="bg-transparent text-white border-none outline-none"
                style={{ fontSize: 16, colorScheme: 'dark' }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function EntryRow({
  entry, mealId, onDeleted, onUpdated,
}: {
  entry: NutritionEntry & { food_items?: { name_fr?: string } }
  mealId: string
  onDeleted: (entryId: string) => void
  onUpdated: (entryId: string, quantity_g: number, newMealTotals: Record<string, number>) => void
}) {
  const name = entry.food_items?.name_fr ?? (entry as any).food_item?.name_fr ?? "—"
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState(String(entry.quantity_g))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function saveQty(e: React.FormEvent) {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!q || q <= 0 || q === entry.quantity_g) { setEditing(false); return }
    setSaving(true)
    const res = await fetch(`/api/client/nutrition/entries/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_g: q }),
    })
    if (res.ok) {
      const json = await res.json()
      onUpdated(entry.id, q, json.meal?.totals ?? {})
    }
    setSaving(false)
    setEditing(false)
  }

  async function deleteEntry(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    const res = await fetch(`/api/client/nutrition/entries/${entry.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(entry.id)
    else setDeleting(false)
  }

  return (
    <div className={`flex items-center gap-2 transition-opacity ${deleting ? 'opacity-30' : ''}`}>
      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0 mt-[1px]" />
      <span className="text-[12px] text-white/65 truncate flex-1 min-w-0">{name}</span>
      {editing ? (
        <form onSubmit={saveQty} className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            type="number"
            min={1}
            max={5000}
            step={1}
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-14 h-6 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[11px] text-white text-center tabular-nums outline-none focus:border-white/30"
          />
          <span className="text-[10px] text-white/30">g</span>
          <button type="submit" disabled={saving} className="h-6 px-2 bg-white/[0.1] rounded-lg text-[10px] text-white/70 hover:text-white active:scale-95 transition-all disabled:opacity-40">
            {saving ? '…' : '✓'}
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); setEditing(false) }} className="h-6 px-2 bg-white/[0.05] rounded-lg text-[10px] text-white/40 hover:text-white/70">
            ✕
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); setEditing(true) }} className="flex items-center gap-1 group">
            <span className="text-[11px] text-white/30 group-hover:text-white/60 transition-colors tabular-nums">{entry.quantity_g}g</span>
            <Pencil size={8} className="text-white/15 group-hover:text-white/40 transition-colors" />
          </button>
          <span className="text-[11px] text-white/40 font-semibold w-14 text-right tabular-nums">
            {Math.round(entry.calories_kcal)} kcal
          </span>
          <button
            onClick={deleteEntry}
            disabled={deleting}
            className="h-6 w-6 flex items-center justify-center rounded-lg bg-red-500/0 hover:bg-red-500/15 text-white/20 hover:text-red-400 active:scale-95 transition-all disabled:opacity-40"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

function MealCard({
  meal, expanded, onToggle, onDelete, onTypeChange, onAddMore, isDeleting,
}: {
  meal: NutritionMeal
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
  onTypeChange: (t: string) => void
  onAddMore: () => void
  isDeleting: boolean
}) {
  const { t } = useClientT()
  const [entries, setEntries] = useState<NutritionMeal['entries']>(meal.entries)
  const [loggedAt, setLoggedAt] = useState(meal.logged_at)
  const [totals, setTotals] = useState({
    total_calories: meal.total_calories,
    total_protein_g: meal.total_protein_g,
    total_carbs_g: meal.total_carbs_g,
    total_fat_g: meal.total_fat_g,
  })

  useEffect(() => {
    setEntries(meal.entries)
    setLoggedAt(meal.logged_at)
    setTotals({
      total_calories: meal.total_calories,
      total_protein_g: meal.total_protein_g,
      total_carbs_g: meal.total_carbs_g,
      total_fat_g: meal.total_fat_g,
    })
  }, [meal])

  function handleEntryDeleted(entryId: string) {
    setEntries(prev => prev?.filter(e => e.id !== entryId))
  }

  function handleEntryUpdated(entryId: string, quantity_g: number, newTotals: Record<string, number>) {
    setEntries(prev => prev?.map(e => e.id === entryId ? { ...e, quantity_g } : e))
    if (newTotals.total_calories !== undefined) {
      setTotals({
        total_calories: newTotals.total_calories,
        total_protein_g: newTotals.total_protein_g ?? totals.total_protein_g,
        total_carbs_g: newTotals.total_carbs_g ?? totals.total_carbs_g,
        total_fat_g: newTotals.total_fat_g ?? totals.total_fat_g,
      })
    }
  }

  return (
    <motion.div
      layout
      animate={{ opacity: isDeleting ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="bg-[#111111] rounded-2xl"
    >
      <div className="flex items-center px-4 pt-4 pb-3 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <MealTypeChooser mealId={meal.id} current={meal.meal_type} onChange={onTypeChange} />
          <TimeEditor mealId={meal.id} loggedAt={loggedAt} onUpdated={setLoggedAt} />
        </div>
        <div className="text-right mr-3">
          <p className="text-[22px] font-black text-white leading-none">{Math.round(totals.total_calories)}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">kcal</p>
        </div>
        <div className="text-white/20 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-3 mb-2">
          <span className="text-[11px] font-semibold" style={{ color: MC.prot }}>P {totals.total_protein_g}g</span>
          <span className="text-[11px] font-semibold" style={{ color: MC.carb }}>G {totals.total_carbs_g}g</span>
          <span className="text-[11px] font-semibold" style={{ color: MC.fat }}>L {totals.total_fat_g}g</span>
        </div>
        <MacroStrip p={totals.total_protein_g} g={totals.total_carbs_g} f={totals.total_fat_g} />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20 pt-3 pb-2">
                {t('journal.ingredients')}
              </p>
              {entries && entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map(e => (
                    <EntryRow
                      key={e.id}
                      entry={e as any}
                      mealId={meal.id}
                      onDeleted={handleEntryDeleted}
                      onUpdated={handleEntryUpdated}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/20 pb-1">—</p>
              )}
            </div>
            <div className="px-4 pb-4 pt-2 flex gap-2">
              <button
                onClick={onAddMore}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-white/[0.05] rounded-xl text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                {t('journal.addIngredients')}
              </button>
              <button
                onClick={onDelete}
                className="h-8 w-8 flex items-center justify-center bg-red-500/10 border border-red-500/15 rounded-xl text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Prep entry row (Planning view) — inline quantity edit, delete ────────────

type PrepEntry = SmartNutritionPrep['entries'][number]

function PrepEntryRow({
  entry,
  prepId,
  allEntries,
  onEntriesUpdated,
}: {
  entry: PrepEntry
  prepId: string
  allEntries: PrepEntry[]
  onEntriesUpdated: (entries: PrepEntry[], totals: { total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState(String(Math.round(entry.quantity_g)))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function patchEntries(nextEntries: PrepEntry[]) {
    const res = await fetch(`/api/client/nutrition/preps/${prepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: nextEntries.map(e => ({ food_item_id: e.food_item_id, quantity_g: e.quantity_g })),
      }),
    })
    if (res.ok) {
      const json = await res.json()
      const updated: SmartNutritionPrep = json.data
      onEntriesUpdated(updated.entries, {
        total_calories: updated.total_calories,
        total_protein_g: updated.total_protein_g,
        total_carbs_g: updated.total_carbs_g,
        total_fat_g: updated.total_fat_g,
      })
    }
  }

  async function saveQty(e: React.FormEvent) {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!q || q <= 0 || q === entry.quantity_g) { setEditing(false); return }
    setSaving(true)
    const next = allEntries.map(en =>
      en.food_item_id === entry.food_item_id ? { ...en, quantity_g: q } : en
    )
    await patchEntries(next)
    setSaving(false)
    setEditing(false)
  }

  async function deleteEntry(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    const next = allEntries.filter(en => en.food_item_id !== entry.food_item_id)
    await patchEntries(next)
    // onEntriesUpdated will remove this entry from parent state
  }

  return (
    <div className={`flex items-center gap-2 transition-opacity ${deleting ? 'opacity-30' : ''}`}>
      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0 mt-[1px]" />
      <span className="text-[12px] text-white/65 truncate flex-1 min-w-0">{entry.name_fr}</span>
      {editing ? (
        <form onSubmit={saveQty} className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            type="number"
            min={1}
            max={5000}
            step={1}
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-14 h-6 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[11px] text-white text-center tabular-nums outline-none focus:border-white/30"
          />
          <span className="text-[10px] text-white/30">g</span>
          <button type="submit" disabled={saving} className="h-6 px-2 bg-white/[0.1] rounded-lg text-[10px] text-white/70 active:scale-95 transition-all disabled:opacity-40">
            {saving ? '…' : '✓'}
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); setEditing(false) }} className="h-6 px-2 bg-white/[0.05] rounded-lg text-[10px] text-white/40">
            ✕
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); setEditing(true) }} className="flex items-center gap-1 group">
            <span className="text-[11px] text-white/30 group-hover:text-white/60 transition-colors tabular-nums">{Math.round(entry.quantity_g)}g</span>
            <Pencil size={8} className="text-white/15 group-hover:text-white/40 transition-colors" />
          </button>
          <span className="text-[11px] text-white/40 font-semibold w-14 text-right tabular-nums">
            {Math.round(entry.calories_kcal)} kcal
          </span>
          <button
            onClick={deleteEntry}
            disabled={deleting}
            className="h-6 w-6 flex items-center justify-center rounded-lg bg-red-500/0 hover:bg-red-500/15 text-white/20 hover:text-red-400 active:scale-95 transition-all disabled:opacity-40"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Prep card (Planning view) — miroir de MealCard ──────────────────────────

function PrepCard({
  prep,
  expanded,
  onToggle,
  onAddMore,
  onValidated,
  onDeleted,
  isValidating,
  onUpdated,
}: {
  prep: SmartNutritionPrep
  expanded: boolean
  onToggle: () => void
  onAddMore: (prep: SmartNutritionPrep) => void
  onValidated: () => void
  onDeleted: (id: string) => void
  isValidating: boolean
  onUpdated: (entries: PrepEntry[], totals: { total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }) => void
}) {
  const { t } = useClientT()
  const [entries, setEntries] = useState<PrepEntry[]>(prep.entries)
  const [totals, setTotals] = useState({
    total_calories: prep.total_calories,
    total_protein_g: prep.total_protein_g,
    total_carbs_g: prep.total_carbs_g,
    total_fat_g: prep.total_fat_g,
  })
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEntries(prep.entries)
    setTotals({
      total_calories: prep.total_calories,
      total_protein_g: prep.total_protein_g,
      total_carbs_g: prep.total_carbs_g,
      total_fat_g: prep.total_fat_g,
    })
  }, [prep])
  const Icon = MEAL_TYPE_ICON[prep.meal_slot] ?? Apple

  function handleEntriesUpdated(
    nextEntries: PrepEntry[],
    newTotals: { total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }
  ) {
    setEntries(nextEntries)
    setTotals(newTotals)
    onUpdated(nextEntries, newTotals)
  }

  async function handleValidate(e: React.MouseEvent) {
    e.stopPropagation()
    setError(null)
    const res = await fetch(`/api/client/nutrition/preps/${prep.id}/log`, { method: "POST" })
    if (res.ok) {
      onValidated()
    } else {
      setError("Erreur — réessaie")
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    const res = await fetch(`/api/client/nutrition/preps/${prep.id}`, { method: "DELETE" })
    if (res.ok) onDeleted(prep.id)
    else { setError("Suppression impossible"); setDeleting(false) }
  }

  return (
    <motion.div
      layout
      animate={{ opacity: deleting || isValidating ? 0 : 1 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(129,140,248,0.06)", border: "0.3px solid rgba(129,140,248,0.12)" }}
    >
      {/* Header — tap to expand */}
      <div className="flex items-center px-4 pt-4 pb-3 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          {/* Slot label */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icon size={11} className="text-[#818cf8]/70" />
            <span className="text-[11px] font-bold text-[#818cf8]/80">
              {SLOT_LABEL[prep.meal_slot]}
            </span>
          </div>
          <p className="text-[13px] font-semibold text-white/80 leading-tight truncate">
            {prep.title || t('journal.ingredients')}
          </p>
        </div>
        <div className="text-right mr-3">
          <p className="text-[22px] font-black text-white leading-none">{Math.round(totals.total_calories)}</p>
          <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">kcal sim.</p>
        </div>
        <div className="text-white/20 shrink-0">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Macros + strip */}
      <div className="px-4 pb-3">
        <div className="flex gap-3 mb-2">
          <span className="text-[11px] font-semibold" style={{ color: MC.prot }}>P {Math.round(totals.total_protein_g)}g</span>
          <span className="text-[11px] font-semibold" style={{ color: MC.carb }}>G {Math.round(totals.total_carbs_g)}g</span>
          <span className="text-[11px] font-semibold" style={{ color: MC.fat }}>L {Math.round(totals.total_fat_g)}g</span>
        </div>
        <MacroStrip p={totals.total_protein_g} g={totals.total_carbs_g} f={totals.total_fat_g} />
      </div>

      {/* Expanded section */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/20 pt-3 pb-2">
                {t('journal.ingredients')}
              </p>
              {entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map(e => (
                    <PrepEntryRow
                      key={e.food_item_id}
                      entry={e}
                      prepId={prep.id}
                      allEntries={entries}
                      onEntriesUpdated={handleEntriesUpdated}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/20 pb-1">—</p>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 pt-2 flex gap-2">
              {/* Ajouter des aliments */}
              <button
                onClick={e => { e.stopPropagation(); onAddMore(prep) }}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 bg-white/[0.04] rounded-xl text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.07] active:scale-[0.98] transition-all"
              >
                {t('journal.addIngredients')}
              </button>
              {/* Supprimer le prep */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 w-8 flex items-center justify-center bg-red-500/10 border border-red-500/15 rounded-xl text-red-400 hover:bg-red-500/20 active:scale-95 transition-all disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Valider → bouton pleine largeur en bas, très visible */}
            <div className="px-4 pb-4">
              <button
                onClick={handleValidate}
                disabled={isValidating}
                className="w-full h-10 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-barlow-condensed font-bold uppercase tracking-[0.12em] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isValidating ? "…" : (
                  <>
                    <Check size={13} />
                    Valider — logger ce repas
                  </>
                )}
              </button>
            </div>

            {error && <p className="px-4 pb-3 text-[10px] text-red-400">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type BilanView = 'bilan' | 'planning'

interface Props {
  initialMeals: NutritionMeal[]
  initialPreps: SmartNutritionPrep[]
  date: string
  target: NutritionMacros
  consumed: NutritionMacros
  onAddMeal?: () => void
  onAddMore?: (mealId: string) => void
  onEditPrep?: (prep: SmartNutritionPrep) => void
  onNewPrep?: () => void
  onPrepValidated?: () => void
  gender?: string | null
  bodyWeightKg?: number | null
}

export default function NutritionMealsList({
  initialMeals,
  initialPreps,
  date,
  target,
  consumed,
  onAddMeal,
  onAddMore,
  onEditPrep,
  onNewPrep,
  onPrepValidated,
  gender,
  bodyWeightKg,
}: Props) {
  const { t } = useClientT()
  const router = useRouter()
  const [view, setView] = useState<BilanView>('bilan')
  const [meals, setMeals] = useState<NutritionMeal[]>(initialMeals)
  const [preps, setPreps] = useState<SmartNutritionPrep[]>(initialPreps)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null)

  useEffect(() => {
    setMeals(initialMeals)
  }, [initialMeals])

  useEffect(() => {
    setPreps(initialPreps)
  }, [initialPreps])

  // Preps du jour uniquement (planned)
  const todayPlannedPreps = preps.filter(
    p => p.status === "planned" && p.physiological_date === date
  )

  const prepKcal = todayPlannedPreps.reduce((acc, p) => acc + p.total_calories, 0)
  const prepProtein = todayPlannedPreps.reduce((acc, p) => acc + p.total_protein_g, 0)
  const prepCarbs = todayPlannedPreps.reduce((acc, p) => acc + p.total_carbs_g, 0)
  const prepFat = todayPlannedPreps.reduce((acc, p) => acc + p.total_fat_g, 0)

  const totalKcal = (consumed?.kcal ?? 0) + prepKcal
  const totalProtein = (consumed?.protein_g ?? 0) + prepProtein
  const totalCarbs = (consumed?.carbs_g ?? 0) + prepCarbs
  const totalFat = (consumed?.fat_g ?? 0) + prepFat

  // Calcul du reste à consommer ajustable en prenant en compte le total simulé (consommé + préparé)
  const actionable = computeActionableRemaining({
    target: {
      kcal: target.kcal,
      protein_g: target.protein_g,
      carbs_g: target.carbs_g,
      fat_g: target.fat_g,
    },
    consumed: {
      kcal: totalKcal,
      protein_g: totalProtein,
      carbs_g: totalCarbs,
      fat_g: totalFat,
    },
    profile: { gender, weightKg: bodyWeightKg },
  })

  const adjustedProtein = Math.max(0, target.protein_g - actionable.compensation.proteinReducedG)
  const adjustedCarbs = Math.max(0, target.carbs_g - actionable.compensation.carbsReducedG)
  const adjustedFat = Math.max(0, target.fat_g - actionable.compensation.fatReducedG)

  const handlePrepUpdated = (
    prepId: string,
    nextEntries: PrepEntry[],
    newTotals: { total_calories: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number }
  ) => {
    setPreps(prev => prev.map(p => {
      if (p.id === prepId) {
        return {
          ...p,
          entries: nextEntries,
          ...newTotals,
        }
      }
      return p
    }))
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function executeDelete() {
    if (!confirmTarget) return
    const { id } = confirmTarget
    setConfirmTarget(null)
    setDeletingId(id)
    const res = await fetch(`/api/client/nutrition/meals/${id}`, { method: "DELETE" })
    if (res.ok) {
      setMeals(prev => prev.filter(m => m.id !== id))
      router.refresh()
    }
    setDeletingId(null)
  }

  function updateMealType(id: string, mealType: string) {
    setMeals(prev => prev.map(m => m.id === id ? { ...m, meal_type: mealType as any } : m))
  }

  const [expandedPreps, setExpandedPreps] = useState<Set<string>>(new Set())
  const [validatingId, setValidatingId] = useState<string | null>(null)

  function toggleExpandPrep(id: string) {
    setExpandedPreps(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  function handlePrepDeleted(id: string) {
    setPreps(prev => prev.filter(p => p.id !== id))
    router.refresh()
  }

  function handlePrepValidated(id: string) {
    setValidatingId(id)
    // Petite animation avant de rafraîchir
    setTimeout(() => {
      onPrepValidated?.()
      router.refresh()
    }, 350)
  }

  return (
    <>
      {/* ── Toggle Bilan / Planning — remplace le label "Bilan du jour" ── */}
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex gap-1 bg-white/[0.03] rounded-xl p-1 shrink-0">
          {(['bilan', 'planning'] as BilanView[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-barlow-condensed font-bold uppercase tracking-wide transition-all duration-200 ${
                view === v
                  ? 'bg-[#f2f2f2] text-[#080808] shadow-sm'
                  : 'text-white/40'
              }`}
            >
              {v === 'bilan' ? 'Bilan' : 'Planning'}
            </button>
          ))}
        </div>

        {view === 'planning' && (
          <div className="flex items-end gap-[6px] py-0.5 pr-1">
            {/* Calories Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.calories }}>{Math.round(totalKcal)}</span>
                <span className="text-white/50">/{Math.round(target.kcal)}</span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalKcal / (target.kcal || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.calories,
                  }}
                />
              </div>
            </div>

            {/* Protein Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.protein }}>{Math.round(totalProtein)}</span>
                <span className="text-white/50">/{Math.round(adjustedProtein)}</span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalProtein / (adjustedProtein || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.protein,
                  }}
                />
              </div>
            </div>

            {/* Carbs Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.carbs }}>{Math.round(totalCarbs)}</span>
                <span className="text-white/50">/{Math.round(adjustedCarbs)}</span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalCarbs / (adjustedCarbs || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.carbs,
                  }}
                />
              </div>
            </div>

            {/* Fat Gauge */}
            <div className="flex flex-col items-start gap-[3px] shrink-0">
              <span className="text-[9px] font-semibold leading-none">
                <span style={{ color: NUTRITION_UI_COLORS.fat }}>{Math.round(totalFat)}</span>
                <span className="text-white/50">/{Math.round(adjustedFat)}</span>
              </span>
              <div className="relative w-[48px] h-[13px] bg-white/[0.06] rounded-xl overflow-hidden">
                <div
                  className="h-full transition-all duration-500 ease-out rounded-xl"
                  style={{
                    width: `${Math.min(100, (totalFat / (adjustedFat || 1)) * 100)}%`,
                    backgroundColor: NUTRITION_UI_COLORS.fat,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ VUE BILAN — repas loggés ══ */}
      {view === 'bilan' && (
        <>
          {meals.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <Coffee size={20} className="text-white/15" />
              </div>
              <p className="text-[13px] text-white/25">{t('journal.noMeals')}</p>
              <button
                onClick={() => onAddMeal ? onAddMeal() : router.push("/client/nutrition/log")}
                className="h-10 px-5 bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.12em] rounded-xl active:scale-95 transition-all"
              >
                {t('journal.addMeal')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {meals.map(meal => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    expanded={expanded.has(meal.id)}
                    onToggle={() => toggleExpand(meal.id)}
                    onDelete={() => setConfirmTarget({ id: meal.id, label: MEAL_TYPE_KEYS[meal.meal_type] ? t(MEAL_TYPE_KEYS[meal.meal_type]) : meal.meal_type })}
                    onTypeChange={type => updateMealType(meal.id, type)}
                    onAddMore={() => onAddMore ? onAddMore(meal.id) : router.push(`/client/nutrition/log?meal_id=${meal.id}`)}
                    isDeleting={deletingId === meal.id}
                  />
                ))}
              </AnimatePresence>

              <button
                onClick={() => onAddMeal ? onAddMeal() : router.push("/client/nutrition/log")}
                className="w-full h-11 rounded-2xl bg-[#f2f2f2] text-[#080808] text-[11px] font-bold uppercase tracking-[0.12em] active:scale-[0.98] transition-all"
              >
                {t('journal.addMeal')}
              </button>
            </div>
          )}
        </>
      )}

      {/* ══ VUE PLANNING — preps du jour ══ */}
      {view === 'planning' && (
        <>
          {todayPlannedPreps.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#818cf8]/10 flex items-center justify-center">
                <Sparkles size={20} className="text-[#818cf8]/50" />
              </div>
              <p className="text-[13px] text-white/25">Aucun repas planifié pour aujourd'hui</p>
              <button
                onClick={() => onNewPrep ? onNewPrep() : undefined}
                className="h-10 px-5 bg-[#818cf8]/15 text-[#818cf8] text-[11px] font-bold uppercase tracking-[0.12em] rounded-xl active:scale-95 transition-all"
              >
                + Composer un repas
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {todayPlannedPreps.map(prep => (
                  <PrepCard
                    key={prep.id}
                    prep={prep}
                    expanded={expandedPreps.has(prep.id)}
                    onToggle={() => toggleExpandPrep(prep.id)}
                    onAddMore={p => onEditPrep?.(p)}
                    onValidated={() => handlePrepValidated(prep.id)}
                    onDeleted={handlePrepDeleted}
                    isValidating={validatingId === prep.id}
                    onUpdated={(nextEntries, newTotals) => handlePrepUpdated(prep.id, nextEntries, newTotals)}
                  />
                ))}
              </AnimatePresence>
              <button
                onClick={() => onNewPrep ? onNewPrep() : undefined}
                className="w-full h-11 rounded-2xl bg-[#818cf8]/12 text-[#818cf8] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.10em] active:scale-[0.98] transition-all"
              >
                + Composer un repas
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Confirmation suppression repas ── */}
      <AnimatePresence>
        {confirmTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmTarget(null)}
              className="fixed inset-0 z-[80] bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-[100px] left-4 right-4 z-[90] max-w-[400px] mx-auto bg-[#111111] rounded-2xl p-5 shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
            >
              <p className="text-[14px] font-bold text-white mb-1">{t('journal.deleteTitle')}</p>
              <p className="text-[12px] text-white/40 mb-5">
                {t('journal.deleteDesc', { label: confirmTarget.label })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmTarget(null)}
                  className="flex-1 h-10 rounded-xl bg-white/[0.06] text-[12px] font-semibold text-white/60 hover:text-white active:scale-[0.98] transition-all"
                >
                  {t('journal.cancel')}
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 h-10 rounded-xl bg-red-500 text-[12px] font-bold text-white hover:bg-red-600 active:scale-[0.98] transition-all"
                >
                  {t('journal.delete')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
