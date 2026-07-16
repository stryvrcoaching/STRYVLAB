"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import PhotoMealLogSheet from "@/components/client/smart/PhotoMealLogSheet"
import type { NutritionMacros } from "@/components/client/smart/SmartNutritionWidget"
import { queueNutritionLiveRefresh } from "@/lib/client/nutrition-live"

type TodayProgressPayload = {
  consumed?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    water_ml?: number
    caffeine_mg?: number
  }
  target?: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
  } | null
}

function toNutritionContext(payload: TodayProgressPayload | null) {
  if (!payload?.target) return null

  const consumed: NutritionMacros = {
    kcal: Number(payload.consumed?.calories ?? 0),
    protein_g: Number(payload.consumed?.protein_g ?? 0),
    carbs_g: Number(payload.consumed?.carbs_g ?? 0),
    fat_g: Number(payload.consumed?.fat_g ?? 0),
    water_ml: Number(payload.consumed?.water_ml ?? 0),
    caffeine_mg: Number(payload.consumed?.caffeine_mg ?? 0),
  }

  const target: NutritionMacros = {
    kcal: Number(payload.target.calories ?? 0),
    protein_g: Number(payload.target.protein_g ?? 0),
    carbs_g: Number(payload.target.carbs_g ?? 0),
    fat_g: Number(payload.target.fat_g ?? 0),
    water_ml: 0,
  }

  if (target.kcal <= 0) return null
  return { consumed, target }
}

function VoiceLogPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeDate = searchParams?.get("date") ?? new Date().toISOString().slice(0, 10)
  const returnTab = searchParams?.get("return_tab")
  const [nutritionContext, setNutritionContext] = useState<ReturnType<typeof toNutritionContext>>(null)

  useEffect(() => {
    let active = true

    fetch(`/api/client/nutrition/today-progress?date=${activeDate}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: TodayProgressPayload | null) => {
        if (!active) return
        setNutritionContext(toNutritionContext(payload))
      })
      .catch(() => {
        if (active) setNutritionContext(null)
      })

    return () => {
      active = false
    }
  }, [activeDate])

  const closeToNutrition = () => {
    const params = new URLSearchParams({ date: activeDate })
    if (returnTab && returnTab !== "suivi") params.set("tab", returnTab)
    router.push(`/client/nutrition?${params.toString()}`)
  }

  return (
    <PhotoMealLogSheet
      open
      presentation="page"
      activeDate={activeDate}
      nutritionContext={nutritionContext}
      initialNoteOpen
      onClose={closeToNutrition}
      onSuccess={() => {
        queueNutritionLiveRefresh({ date: activeDate })
        closeToNutrition()
      }}
    />
  )
}

export default function VoiceLogPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0d0d0d]" />}>
      <VoiceLogPageInner />
    </Suspense>
  )
}
