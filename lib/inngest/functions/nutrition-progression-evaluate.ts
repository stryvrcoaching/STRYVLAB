import { createClient as createServiceClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { awardProgression } from '@/lib/rewards/progression'
import { scoreNutritionDay } from '@/lib/rewards/nutrition'

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export const nutritionProgressionEvaluateFunction = inngest.createFunction(
  { id: 'nutrition-progression-evaluate', retries: 2, triggers: [{ cron: '20 3 * * *' }] },
  async ({ step }) => step.run('evaluate-closed-nutrition-days', async () => {
    const db = service()
    // Two UTC days gives every client, regardless of timezone, a closed day
    // before its score is recorded. This avoids point churn while meals are edited.
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: protocols, error } = await db
      .from('nutrition_protocols')
      .select('client_id, schedule_start_date, updated_at, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
    if (error) throw error

    const latestByClient = new Map<string, any>()
    for (const protocol of protocols ?? []) if (!latestByClient.has(protocol.client_id)) latestByClient.set(protocol.client_id, protocol)

    for (const protocol of latestByClient.values()) {
      const targetDay = resolveProtocolDayByDate(date, protocol.schedule_start_date ?? null, protocol.nutrition_protocol_days ?? [], protocol.nutrition_protocol_schedule_slots ?? [])
      if (!targetDay) continue
      const { data: meals } = await db.from('nutrition_meals').select('total_calories, total_protein_g, total_carbs_g, total_fat_g').eq('client_id', protocol.client_id).eq('physiological_date', date)
      const consumed = (meals ?? []).reduce((sum: { calories: number; protein_g: number; carbs_g: number; fat_g: number }, meal: any) => ({
        calories: sum.calories + Number(meal.total_calories ?? 0),
        protein_g: sum.protein_g + Number(meal.total_protein_g ?? 0),
        carbs_g: sum.carbs_g + Number(meal.total_carbs_g ?? 0),
        fat_g: sum.fat_g + Number(meal.total_fat_g ?? 0),
      }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
      const result = scoreNutritionDay({
        calories: Number(targetDay.calories ?? 0), protein_g: Number(targetDay.protein_g ?? 0), carbs_g: Number(targetDay.carbs_g ?? 0), fat_g: Number(targetDay.fat_g ?? 0),
      }, consumed)
      if (!result || result.points <= 0) continue
      await awardProgression(db, {
        clientId: protocol.client_id,
        action: 'nutrition',
        basePoints: result.points,
        sourceKey: `nutrition:${date}`,
        occurredAt: `${date}T23:59:59.000Z`,
        metadata: { adherence: Number(result.adherence.toFixed(3)), evaluated_date: date, meal_count: meals?.length ?? 0 },
      })
    }
  }),
)
