"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart, HeartOff, Loader2, Search, ShieldAlert, Star, X } from "lucide-react"
import { FoodIcon } from "@/components/nutrition/FoodIcon"
import {
  FOOD_FRAMEWORKS,
  FOOD_SAFETY_TAXONOMY,
  type FoodPreferenceAssessmentValue,
  type FoodPreferenceStatus,
  type FoodSafetyRuleInput,
} from "@/lib/nutrition/food-preferences"
import type { FoodItem } from "@/lib/nutrition/food-items"

type Props = {
  value: unknown
  onChange: (value: FoodPreferenceAssessmentValue) => void
  catalogEndpoint?: string
  previewMode?: boolean
}

type FoodSearchItem = FoodItem

const EMPTY_VALUE: FoodPreferenceAssessmentValue = {
  allergy_status: "none",
  allergies: [],
  intolerances: [],
  frameworks: [],
  preferences: [],
}

const CATEGORIES = [
  { key: "", label: "Tous" },
  { key: "proteins", label: "Protéines" },
  { key: "carbs", label: "Féculents" },
  { key: "vegetables", label: "Légumes" },
  { key: "fruits", label: "Fruits" },
  { key: "fats", label: "Lipides" },
] as const

function normalizeValue(value: unknown): FoodPreferenceAssessmentValue {
  if (!value || typeof value !== "object") return EMPTY_VALUE
  const candidate = value as Partial<FoodPreferenceAssessmentValue>
  return {
    allergy_status: candidate.allergy_status === "declared" ? "declared" : "none",
    allergies: Array.isArray(candidate.allergies) ? candidate.allergies : [],
    intolerances: Array.isArray(candidate.intolerances) ? candidate.intolerances : [],
    frameworks: Array.isArray(candidate.frameworks) ? candidate.frameworks : [],
    preferences: Array.isArray(candidate.preferences) ? candidate.preferences : [],
  }
}

function SafetySelector({
  title,
  subtitle,
  entries,
  onChange,
}: {
  title: string
  subtitle: string
  entries: FoodSafetyRuleInput[]
  onChange: (entries: FoodSafetyRuleInput[]) => void
}) {
  const [custom, setCustom] = useState("")
  const selected = new Set(
    entries.flatMap((entry) =>
      entry.target_type === "taxonomy" && entry.taxonomy_key
        ? [entry.taxonomy_key]
        : [],
    ),
  )
  const customEntries = entries.reduce<FoodSafetyRuleInput[]>((result, entry) => {
    if (entry.target_type === "free_text") result.push(entry)
    return result
  }, [])

  function toggle(key: string, label: string) {
    if (selected.has(key)) {
      onChange(entries.filter((entry) => entry.taxonomy_key !== key))
      return
    }
    onChange([
      ...entries,
      {
        target_type: "taxonomy",
        taxonomy_key: key,
        label,
        severity: "strict",
      },
    ])
  }

  function addCustom() {
    const label = custom.trim()
    if (!label) return
    if (
      entries.some(
        (entry) =>
          entry.target_type === "free_text" &&
          entry.label.toLocaleLowerCase("fr") === label.toLocaleLowerCase("fr"),
      )
    ) {
      setCustom("")
      return
    }
    onChange([
      ...entries,
      {
        target_type: "free_text",
        label,
        severity: "strict",
      },
    ])
    setCustom("")
  }

  return (
    <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
      <h4 className="text-[12px] font-semibold text-white">{title}</h4>
      <p className="mt-1 text-[10px] leading-relaxed text-white/40">{subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {FOOD_SAFETY_TAXONOMY.map((item) => {
          const active = selected.has(item.key)
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(item.key, item.label)}
              className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              addCustom()
            }
          }}
          placeholder="Autre aliment ou ingrédient"
          className="min-w-0 flex-1 rounded-lg bg-[#0a0a0a] px-3 py-2 text-[11px] text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg bg-white/[0.06] px-3 text-[10px] font-bold text-white/70 hover:text-white"
        >
          Ajouter
        </button>
      </div>
      {customEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {customEntries.map((entry) => (
              <span
                key={`free_text:${entry.label.toLocaleLowerCase("fr")}`}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/60"
              >
                {entry.label}
                <button
                  type="button"
                  aria-label={`Retirer ${entry.label}`}
                  onClick={() => onChange(entries.filter((candidate) => candidate !== entry))}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
        </div>
      )}
    </section>
  )
}

export default function FoodPreferencesField({
  value,
  onChange,
  catalogEndpoint,
  previewMode,
}: Props) {
  const current = useMemo(() => normalizeValue(value), [value])
  const hasExplicitAllergyStatus =
    !!value &&
    typeof value === "object" &&
    ["none", "declared"].includes(
      String((value as { allergy_status?: unknown }).allergy_status ?? ""),
    )
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("")
  const [foods, setFoods] = useState<FoodSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [customFood, setCustomFood] = useState("")

  useEffect(() => {
    if (!catalogEndpoint || previewMode) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const url = new URL(catalogEndpoint, window.location.origin)
        if (query.trim()) url.searchParams.set("q", query.trim())
        if (category) url.searchParams.set("category", category)
        url.searchParams.set("limit", "48")
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" })
        const payload = response.ok ? await response.json() : null
        setFoods(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        if (!controller.signal.aborted) setFoods([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [catalogEndpoint, category, previewMode, query])

  function update(patch: Partial<FoodPreferenceAssessmentValue>) {
    onChange({ ...current, ...patch })
  }

  function setPreference(food: FoodSearchItem, status: FoodPreferenceStatus) {
    const withoutFood = current.preferences.filter((entry) => entry.food_item_id !== food.id)
    const existing = current.preferences.find((entry) => entry.food_item_id === food.id)
    update({
      preferences:
        existing?.status === status
          ? withoutFood
          : [
              ...withoutFood,
              {
                target_type: "food_item",
                food_item_id: food.id,
                label: food.name_fr,
                status,
              },
            ],
    })
  }

  function addCustomPreference(status: FoodPreferenceStatus) {
    const label = customFood.trim()
    if (!label) return
    update({
      preferences: [
        ...current.preferences.filter(
          (entry) => !(entry.target_type === "free_text" && entry.label.toLowerCase() === label.toLowerCase()),
        ),
        { target_type: "free_text", label, status },
      ],
    })
    setCustomFood("")
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#1f8a65]" />
          <div>
            <h3 className="text-[13px] font-semibold text-white">Allergies alimentaires</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-white/45">
              Cette réponse est obligatoire. Une allergie est traitée comme une contrainte de sécurité.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { value: "none" as const, label: "Non, aucune" },
            { value: "declared" as const, label: "Oui" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={hasExplicitAllergyStatus && current.allergy_status === option.value}
              onClick={() =>
                update({
                  allergy_status: option.value,
                  allergies: option.value === "none" ? [] : current.allergies,
                })
              }
              className={`rounded-xl px-3 py-3 text-[11px] font-bold transition-colors ${
                hasExplicitAllergyStatus && current.allergy_status === option.value
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.04] text-white/55 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {hasExplicitAllergyStatus && current.allergy_status === "declared" && (
        <SafetySelector
          title="Quelles allergies ?"
          subtitle="Sélectionne les familles concernées. Tu peux ajouter un aliment introuvable."
          entries={current.allergies}
          onChange={(allergies) => update({ allergies })}
        />
      )}

      {hasExplicitAllergyStatus && (
      <SafetySelector
        title="Intolérances"
        subtitle="Les intolérances seront signalées séparément des allergies."
        entries={current.intolerances}
        onChange={(intolerances) => update({ intolerances })}
      />
      )}

      {hasExplicitAllergyStatus && (
      <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
        <h3 className="text-[13px] font-semibold text-white">Cadre alimentaire</h3>
        <p className="mt-1 text-[10px] text-white/40">Sélectionne le cadre qui doit être respecté.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {FOOD_FRAMEWORKS.map((framework) => {
            const active = current.frameworks.includes(framework.key)
            return (
              <button
                key={framework.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (framework.key === "omnivore") {
                    update({ frameworks: active ? [] : ["omnivore"] })
                    return
                  }
                  const withoutOmnivore = current.frameworks.filter((key) => key !== "omnivore")
                  update({
                    frameworks: active
                      ? withoutOmnivore.filter((key) => key !== framework.key)
                      : [...withoutOmnivore, framework.key],
                  })
                }}
                className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-[#1f8a65] text-white"
                    : "bg-white/[0.04] text-white/60 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {framework.label}
              </button>
            )
          })}
        </div>
      </section>
      )}

      {hasExplicitAllergyStatus && (
      <section className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-white">Tes préférences</h3>
            <p className="mt-1 text-[10px] text-white/40">
              Cœur : j’aime · cœur barré : je n’aime pas · étoile : à conserver.
            </p>
          </div>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold text-white/50">
            {current.preferences.length} classé{current.preferences.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#0a0a0a] px-3 py-2.5">
          <Search size={14} className="text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un aliment"
            className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-white/25"
          />
          {loading && <Loader2 size={13} className="animate-spin text-white/35" />}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                category === item.key ? "bg-white text-black" : "bg-white/[0.04] text-white/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {previewMode && (
          <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center text-[11px] text-white/40">
            Le catalogue alimentaire apparaîtra dans le bilan envoyé au client.
          </div>
        )}

        {!previewMode && foods.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {foods.map((food) => {
              const selected = current.preferences.find((entry) => entry.food_item_id === food.id)?.status
              return (
                <div
                  key={food.id}
                  className="flex min-w-0 items-center gap-2 rounded-xl border-[0.3px] border-white/[0.06] bg-[#0d0d0d] p-2.5"
                >
                  <FoodIcon food={food} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-white/75">
                    {food.name_fr}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {[
                      { status: "liked" as const, label: "J’aime", icon: Heart },
                      { status: "disliked" as const, label: "Je n’aime pas", icon: HeartOff },
                      { status: "must_keep" as const, label: "À conserver", icon: Star },
                    ].map((action) => {
                      const Icon = action.icon
                      const active = selected === action.status
                      return (
                        <button
                          key={action.status}
                          type="button"
                          title={action.label}
                          aria-label={`${action.label} : ${food.name_fr}`}
                          aria-pressed={active}
                          onClick={() => setPreference(food, action.status)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            active
                              ? "bg-[#1f8a65] text-white"
                              : "bg-white/[0.04] text-white/35 hover:text-white"
                          }`}
                        >
                          <Icon size={13} fill={active && action.status !== "disliked" ? "currentColor" : "none"} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 rounded-xl border-[0.3px] border-white/[0.06] bg-[#0a0a0a] p-3">
          <p className="text-[10px] font-semibold text-white/60">Aliment introuvable</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={customFood}
              onChange={(event) => setCustomFood(event.target.value)}
              placeholder="Nom de l’aliment"
              className="min-w-0 flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] text-white outline-none"
            />
            <div className="flex gap-1">
              {[
                { status: "liked" as const, label: "J’aime", icon: Heart },
                { status: "disliked" as const, label: "Je n’aime pas", icon: HeartOff },
                { status: "must_keep" as const, label: "À conserver", icon: Star },
              ].map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.status}
                    type="button"
                    title={action.label}
                    onClick={() => addCustomPreference(action.status)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-white/45 hover:text-white"
                  >
                    <Icon size={14} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>
      )}
    </div>
  )
}
