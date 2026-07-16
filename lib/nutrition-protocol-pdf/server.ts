import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { resolveCoachInfo } from '@/lib/program-pdf/server'
import {
  buildNutritionProtocolPdfFilename,
  type NutritionProtocolPdfDocumentData,
} from '@/lib/nutrition-protocol-pdf/model'
import { inferNutritionDayRole } from '@/lib/nutrition/day-role'
import { normalizePlanMeals } from '@/lib/nutrition/protocol-builder'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getNutritionProtocolPdfData(
  protocolId: string,
  user: User,
): Promise<NutritionProtocolPdfDocumentData> {
  const db = serviceClient()
  const { data: protocol, error } = await db
    .from('nutrition_protocols')
    .select(`
      id,
      client_id,
      name,
      notes,
      schedule_start_date,
      cycle_sync_enabled,
      nutrition_protocol_days(*)
    `)
    .eq('id', protocolId)
    .eq('coach_id', user.id)
    .single()

  if (error || !protocol) throw new Error('Protocole introuvable')

  const { data: client } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email')
    .eq('id', (protocol as any).client_id)
    .eq('coach_id', user.id)
    .maybeSingle()

  const coach = await resolveCoachInfo(user)

  return {
    id: (protocol as any).id,
    title: (protocol as any).name,
    notes: (protocol as any).notes ?? null,
    generatedAt: new Date().toISOString(),
    scheduleStartDate: (protocol as any).schedule_start_date ?? null,
    cycleSyncEnabled: Boolean((protocol as any).cycle_sync_enabled),
    coach,
    client: client
      ? {
          id: client.id,
          firstName: client.first_name ?? '',
          lastName: client.last_name ?? '',
          email: client.email ?? null,
        }
      : null,
    days: (((protocol as any).nutrition_protocol_days ?? []) as any[])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((day) => ({
        id: day.id,
        name: day.name,
        position: day.position ?? 0,
        calories: day.calories ?? null,
        protein_g: day.protein_g ?? null,
        carbs_g: day.carbs_g ?? null,
        fat_g: day.fat_g ?? null,
        hydration_ml: day.hydration_ml ?? null,
        role: inferNutritionDayRole({
          name: day.name ?? '',
          calories: String(day.calories ?? ''),
          carbs_g: String(day.carbs_g ?? ''),
          carb_cycle_type: day.carb_cycle_type ?? '',
          role: day.role ?? '',
        }),
        carb_cycle_type: day.carb_cycle_type ?? null,
        cycle_sync_phase: day.cycle_sync_phase ?? null,
        recommendations: day.recommendations ?? null,
        meal_plan: normalizePlanMeals(Array.isArray(day.meal_plan) ? day.meal_plan : []),
      })),
  }
}

export { buildNutritionProtocolPdfFilename }
