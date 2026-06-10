import OpenAI from 'openai'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return new OpenAI({ apiKey })
}

export interface DailyBriefInput {
  flowType: 'morning' | 'evening'
  sessionName: string | null
  targetKcal: number
  targetProtein: number
  targetWaterMl: number
  energyLevel?: number | null
  sleepHours?: number | null
  sleepQuality?: number | null
  muscleSoreness?: number | null
}

export async function buildDailyBrief(input: DailyBriefInput): Promise<string> {
  const { flowType, sessionName, targetKcal, targetProtein, targetWaterMl } = input
  const waterL = (targetWaterMl / 1000).toFixed(1)

  const sessionLine = sessionName
    ? `Séance : ${sessionName}`
    : 'Pas de séance prévue — récupération active'

  let coachSentence: string
  try {
    const openai = getOpenAIClient()
    let context: string
    if (flowType === 'morning') {
      const parts = [
        input.sleepHours   != null ? `sommeil ${input.sleepHours}h`     : null,
        input.sleepQuality != null ? `qualité ${input.sleepQuality}/4`  : null,
        input.energyLevel  != null ? `énergie ${input.energyLevel}/5`   : null,
      ].filter(Boolean)
      context = parts.length ? parts.join(', ') : 'données non disponibles'
    } else {
      const parts = [
        input.energyLevel    != null ? `énergie ${input.energyLevel}/5`        : null,
        input.muscleSoreness != null ? `courbatures ${input.muscleSoreness}/4` : null,
      ].filter(Boolean)
      context = parts.length ? parts.join(', ') : 'données non disponibles'
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 40,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `En 10 mots max, une phrase d'encouragement de coach en français pour ce ${flowType === 'morning' ? 'matin' : 'soir'}. Contexte client: ${context}. Style: direct, sans flatterie, sans emoji.`,
      }],
    })
    coachSentence = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    coachSentence = flowType === 'morning'
      ? 'Lance-toi, la journée est à toi.'
      : 'Bonne récupération ce soir.'
  }

  return `📋 Ta journée :\n• ${sessionLine}\n• Nutrition : ${targetKcal} kcal | ${targetProtein}g P | ${waterL}L eau\n💬 ${coachSentence}`
}
