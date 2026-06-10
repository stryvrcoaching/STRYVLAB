import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

const MEAL_ANALYSIS_PROMPT = `You are a sports nutrition expert. Analyze the meal description and/or photos provided and estimate the nutritional macros as accurately as possible.

Return ONLY a valid JSON object with these exact keys (all values are numbers, use 0 if unknown):
{
  "calories_kcal": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fats_g": <number>,
  "fiber_g": <number>
}

Be realistic — base your estimates on typical portion sizes. If the user provides weights/volumes, use them precisely.`

export const mealAnalyzeFunction = inngest.createFunction(
  { id: 'meal-analyze', retries: 3, timeouts: { finish: '2m' }, triggers: [{ event: 'meal/analyze.requested' }] },
  async ({ event, step }) => {
    const { mealLogId } = event.data as { mealLogId: string }

    await step.run('analyze-with-gpt4o', async () => {
      const db = service()

      const { data: meal, error: fetchErr } = await db
        .from('meal_logs')
        .select('transcript, photo_urls, name')
        .eq('id', mealLogId)
        .single()

      if (fetchErr || !meal) {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        throw new Error(`Meal not found: ${mealLogId}`)
      }

      const userContent: OpenAI.Chat.ChatCompletionContentPart[] = []

      const description = [meal.name, meal.transcript].filter(Boolean).join('\n')
      if (description) {
        userContent.push({ type: 'text', text: description })
      }

      for (const url of ((meal.photo_urls as string[]) ?? []).slice(0, 3)) {
        userContent.push({ type: 'image_url', image_url: { url, detail: 'low' } })
      }

      if (userContent.length === 0) {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        return
      }

      let macros: Record<string, number> = {}
      try {
        const response = await getOpenAI().chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: MEAL_ANALYSIS_PROMPT },
            { role: 'user', content: userContent },
          ],
          max_tokens: 200,
        })
        macros = JSON.parse(response.choices[0].message.content ?? '{}')
      } catch {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        throw new Error('OpenAI call failed')
      }

      await db.from('meal_logs').update({
        estimated_macros: macros,
        ai_status: 'done',
      }).eq('id', mealLogId)

      await db.from('smart_agenda_events').update({
        data: macros,
        summary: `${macros.calories_kcal ?? 0} kcal · P${macros.protein_g ?? 0}g G${macros.carbs_g ?? 0}g L${macros.fats_g ?? 0}g`,
      }).eq('source_id', mealLogId).eq('event_type', 'meal')
    })
  }
)
