import type { SupabaseClient } from '@supabase/supabase-js'
import type { NutritionSmoothingPlan, NutritionSmoothingPlanDay } from '@/lib/nutrition/smoothing/types'

export async function fetchActiveSmoothingPlanDaysForDates(
  db: SupabaseClient,
  clientId: string,
  dates: string[],
): Promise<NutritionSmoothingPlanDay[]> {
  const uniqueDates = [...new Set(dates.filter(Boolean))]
  if (uniqueDates.length === 0) return []

  const { data, error } = await db
    .from('nutrition_smoothing_plan_days')
    .select(`
      id,
      plan_id,
      date,
      sequence_index,
      resolved_bucket,
      source_day_label,
      day_weight,
      base_target_kcal,
      cycle_synced_target_kcal,
      kcal_delta,
      protein_delta_g,
      carbs_delta_g,
      fat_delta_g,
      status,
      created_at,
      updated_at,
      nutrition_smoothing_plans!inner (
        client_id,
        status
      )
    `)
    .in('date', uniqueDates)
    .eq('nutrition_smoothing_plans.client_id', clientId)
    .eq('nutrition_smoothing_plans.status', 'active')
    .order('sequence_index', { ascending: true })

  if (error || !data) return []
  return data as unknown as NutritionSmoothingPlanDay[]
}

export async function fetchLatestActiveSmoothingPlan(
  db: SupabaseClient,
  clientId: string,
): Promise<NutritionSmoothingPlan | null> {
  const { data, error } = await db
    .from('nutrition_smoothing_plans')
    .select(`
      id,
      client_id,
      coach_id,
      source_date,
      source_target_kcal,
      source_consumed_kcal,
      threshold_kcal,
      raw_delta_kcal,
      smoothable_delta_kcal,
      direction,
      duration_days,
      strategy,
      status,
      created_by,
      client_decision,
      replaced_by_plan_id,
      coach_note,
      coach_note_updated_at,
      coach_last_action,
      created_at,
      updated_at,
      nutrition_smoothing_plan_days (
        id,
        plan_id,
        date,
        sequence_index,
        resolved_bucket,
        source_day_label,
        day_weight,
        base_target_kcal,
        cycle_synced_target_kcal,
        kcal_delta,
        protein_delta_g,
        carbs_delta_g,
        fat_delta_g,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const plan = data as unknown as NutritionSmoothingPlan
  plan.days = ((data as any).nutrition_smoothing_plan_days ?? []) as NutritionSmoothingPlanDay[]
  return plan
}

export async function fetchActiveSmoothingPlanForCoach(
  db: SupabaseClient,
  coachId: string,
  clientId: string,
): Promise<NutritionSmoothingPlan | null> {
  const { data, error } = await db
    .from('nutrition_smoothing_plans')
    .select(`
      id,
      client_id,
      coach_id,
      source_date,
      source_target_kcal,
      source_consumed_kcal,
      threshold_kcal,
      raw_delta_kcal,
      smoothable_delta_kcal,
      direction,
      duration_days,
      strategy,
      status,
      created_by,
      client_decision,
      replaced_by_plan_id,
      coach_note,
      coach_note_updated_at,
      coach_last_action,
      created_at,
      updated_at,
      nutrition_smoothing_plan_days (
        id,
        plan_id,
        date,
        sequence_index,
        resolved_bucket,
        source_day_label,
        day_weight,
        base_target_kcal,
        cycle_synced_target_kcal,
        kcal_delta,
        protein_delta_g,
        carbs_delta_g,
        fat_delta_g,
        status,
        created_at,
        updated_at
      )
    `)
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  const plan = data as unknown as NutritionSmoothingPlan
  plan.days = ((data as any).nutrition_smoothing_plan_days ?? []) as NutritionSmoothingPlanDay[]
  return plan
}
