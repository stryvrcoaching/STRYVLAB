"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import MealLogSheet from "@/components/client/smart/MealLogSheet"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import { resetBodyScrollLock } from "@/components/client/useBodyScrollLock"
import { queueNutritionLiveRefresh } from "@/lib/client/nutrition-live"

type BalanceContext = {
  consumed: NutritionMacros
  target: NutritionMacros
}

function toBalanceMacros(data: {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}): NutritionMacros {
  return {
    kcal: data.calories,
    protein_g: data.protein_g,
    carbs_g: data.carbs_g,
    fat_g: data.fat_g,
    water_ml: 0,
  }
}

function NutritionLogPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams?.get("mode")
  const activeDate = searchParams?.get("date") ?? new Date().toISOString().slice(0, 10)
  const mealId = searchParams?.get("meal_id")
  const returnTab = searchParams?.get("return_tab")
  const [balanceContext, setBalanceContext] = useState<BalanceContext | null>(null)

  const entryMode = useMemo(() => {
    if (mode === "search" || mode === "favorites" || mode === "categories") return mode
    return "default"
  }, [mode])

  useEffect(() => {
    resetBodyScrollLock()
    return () => {
      resetBodyScrollLock()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/client/nutrition/today-progress?date=${activeDate}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.target) return
        setBalanceContext({
          consumed: toBalanceMacros(data.consumed),
          target: toBalanceMacros(data.target),
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [activeDate])

  const closeToNutrition = () => {
    if (typeof document !== "undefined") {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
    }
    resetBodyScrollLock()
    const params = new URLSearchParams({ date: activeDate })
    if (returnTab && returnTab !== "suivi") params.set("tab", returnTab)
    router.push(`/client/nutrition?${params.toString()}`)
  }

  return (
    <MealLogSheet
      open
      mealId={mealId}
      composerMode="standard"
      intent="track"
      entryMode={entryMode}
      activeDate={activeDate}
      balanceContext={balanceContext ?? undefined}
      onClose={closeToNutrition}
      onSuccess={() => {
        queueNutritionLiveRefresh({ date: activeDate })
        closeToNutrition()
      }}
    />
  )
}

export default function NutritionLogPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0d0d0d]" />}>
      <NutritionLogPageInner />
    </Suspense>
  )
}
