import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'

export type SmartPrepSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface SimulatedPrepLike {
  id: string
  meal_slot?: string | null
  variant_group_id?: string | null
  scenario_key?: string | null
  scenario_label?: string | null
  is_active?: boolean | null
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fat_g: number
}

export interface SimulationDraftTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface SimulationStateResult {
  activePreps: SimulatedPrepLike[]
  activePrepsBySlot: Record<SmartPrepSlot, SimulatedPrepLike[]>
  prepTotals: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
  simulatedConsumed: NutritionMacros
}

const SLOT_ORDER: SmartPrepSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

function createEmptyTotals(): Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'> {
  return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

function normalizeSlot(value?: string | null): SmartPrepSlot {
  if (value === 'breakfast' || value === 'lunch' || value === 'dinner') return value
  return 'snack'
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function addMacroTotals(
  base: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
  delta: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
) {
  base.kcal = round1(base.kcal + delta.kcal)
  base.protein_g = round1(base.protein_g + delta.protein_g)
  base.carbs_g = round1(base.carbs_g + delta.carbs_g)
  base.fat_g = round1(base.fat_g + delta.fat_g)
}

export function isPrepActiveForSimulation(prep: Pick<SimulatedPrepLike, 'is_active'>): boolean {
  return prep.is_active === true
}

export function computeSimulationState({
  consumed,
  preps,
  draftTotals,
  activeScenarioKey,
}: {
  consumed: NutritionMacros
  preps: SimulatedPrepLike[]
  draftTotals?: SimulationDraftTotals | null
  activeScenarioKey?: string | null
}): SimulationStateResult {
  const normalizedScenarioKey = activeScenarioKey?.trim() || null
  const activePreps = preps.filter((prep) => {
    if (!isPrepActiveForSimulation(prep)) return false
    if (!normalizedScenarioKey) return true
    return (prep.scenario_key?.trim() || 'default') === normalizedScenarioKey
  })
  const activePrepsBySlot: Record<SmartPrepSlot, SimulatedPrepLike[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  }
  const prepTotals = createEmptyTotals()

  for (const prep of activePreps) {
    const slot = normalizeSlot(prep.meal_slot)
    activePrepsBySlot[slot].push(prep)
    addMacroTotals(prepTotals, {
      kcal: Number(prep.total_calories ?? 0),
      protein_g: Number(prep.total_protein_g ?? 0),
      carbs_g: Number(prep.total_carbs_g ?? 0),
      fat_g: Number(prep.total_fat_g ?? 0),
    })
  }

  for (const slot of SLOT_ORDER) {
    activePrepsBySlot[slot].sort((a, b) => {
      const left = a.variant_group_id ?? ''
      const right = b.variant_group_id ?? ''
      if (left !== right) return left.localeCompare(right)
      return a.id.localeCompare(b.id)
    })
  }

  const simulatedConsumed: NutritionMacros = {
    kcal: round1(consumed.kcal + prepTotals.kcal + (draftTotals?.calories ?? 0)),
    protein_g: round1(consumed.protein_g + prepTotals.protein_g + (draftTotals?.protein ?? 0)),
    carbs_g: round1(consumed.carbs_g + prepTotals.carbs_g + (draftTotals?.carbs ?? 0)),
    fat_g: round1(consumed.fat_g + prepTotals.fat_g + (draftTotals?.fat ?? 0)),
    water_ml: consumed.water_ml,
  }

  return {
    activePreps,
    activePrepsBySlot,
    prepTotals,
    simulatedConsumed,
  }
}
