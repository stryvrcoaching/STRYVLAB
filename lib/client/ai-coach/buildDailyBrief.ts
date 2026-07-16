import OpenAI from 'openai'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  return new OpenAI({ apiKey })
}

export interface DailyBriefInput {
  lang: ClientLang
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
  const { flowType, sessionName, targetKcal, targetProtein, targetWaterMl, lang } = input
  const waterL = (targetWaterMl / 1000).toFixed(1)

  const sessionLine = sessionName
    ? (
      lang === 'es'
        ? `Sesión: ${sessionName}`
        : lang === 'en'
          ? `Session: ${sessionName}`
          : `Séance : ${sessionName}`
    )
    : (
      lang === 'es'
        ? 'No hay sesión prevista — recuperación activa'
        : lang === 'en'
          ? 'No session planned — active recovery'
          : 'Pas de séance prévue — récupération active'
    )

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
      context = parts.length ? parts.join(', ') : (lang === 'es' ? 'datos no disponibles' : lang === 'en' ? 'data not available' : 'données non disponibles')
    } else {
      const parts = [
        input.energyLevel    != null ? `énergie ${input.energyLevel}/5`        : null,
        input.muscleSoreness != null ? `courbatures ${input.muscleSoreness}/4` : null,
      ].filter(Boolean)
      context = parts.length ? parts.join(', ') : (lang === 'es' ? 'datos no disponibles' : lang === 'en' ? 'data not available' : 'données non disponibles')
    }

    const targetLanguage = lang === 'es' ? 'espagnol' : lang === 'en' ? 'anglais' : 'français'
    const momentLabel = lang === 'es' ? (flowType === 'morning' ? 'mañana' : 'noche') : lang === 'en' ? (flowType === 'morning' ? 'morning' : 'evening') : (flowType === 'morning' ? 'matin' : 'soir')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 40,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `En 10 mots max, une phrase d'encouragement de coach en ${targetLanguage} pour ce ${momentLabel}. Contexte client: ${context}. Style: direct, sans flatterie, sans emoji.`,
      }],
    })
    coachSentence = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    coachSentence = lang === 'es'
      ? (flowType === 'morning' ? 'Empieza, el día es tuyo.' : 'Buena recuperación esta noche.')
      : lang === 'en'
        ? (flowType === 'morning' ? 'Get after it, the day is yours.' : 'Recover well tonight.')
        : (flowType === 'morning' ? 'Lance-toi, la journée est à toi.' : 'Bonne récupération ce soir.')
  }

  const dayLabel = lang === 'es' ? 'Tu día' : lang === 'en' ? 'Your day' : 'Ta journée'
  const nutritionLabel = lang === 'es' ? 'Nutrición' : lang === 'en' ? 'Nutrition' : 'Nutrition'
  const waterLabel = lang === 'es' ? 'agua' : lang === 'en' ? 'water' : 'eau'
  return `📋 ${dayLabel}:\n• ${sessionLine}\n• ${nutritionLabel}: ${targetKcal} kcal | ${targetProtein}g P | ${waterL}L ${waterLabel}\n💬 ${coachSentence}`
}
