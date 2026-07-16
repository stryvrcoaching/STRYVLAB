import { NUTRITION_DAY_ROLE_LABELS, type NutritionDayRole } from '@/lib/nutrition/day-role'
import type { NutritionPlanMeal } from '@/lib/nutrition/protocol-builder'

export type NutritionProtocolPdfClient = {
  id: string
  firstName: string
  lastName: string
  email: string | null
}

export type NutritionProtocolPdfCoach = {
  id: string
  name: string
  email: string | null
  phone: string | null
  brandName: string | null
  logoUrl: string | null
}

export type NutritionProtocolPdfDay = {
  id: string
  name: string
  position: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  hydration_ml: number | null
  role: NutritionDayRole
  carb_cycle_type: 'high' | 'medium' | 'low' | null
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | null
  recommendations: string | null
  meal_plan: NutritionPlanMeal[]
}

export type NutritionProtocolPdfDocumentData = {
  id: string
  title: string
  notes: string | null
  generatedAt: string
  scheduleStartDate: string | null
  cycleSyncEnabled: boolean
  coach: NutritionProtocolPdfCoach
  client: NutritionProtocolPdfClient | null
  days: NutritionProtocolPdfDay[]
}

export function buildNutritionProtocolPdfFilename(data: NutritionProtocolPdfDocumentData) {
  const base = data.title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'protocole-nutritionnel'
  return `${base}-nutrition.pdf`
}

export function formatNutritionRoleLabel(role: NutritionDayRole) {
  return NUTRITION_DAY_ROLE_LABELS[role] ?? 'Neutre'
}
