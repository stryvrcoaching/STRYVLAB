import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'
import { TONE_MATRIX, type Tone } from '@/lib/client/ai-coach/resolveTone'
import { orderedByWaking, getFieldsForFlow } from '@/lib/client/checkin/fieldRegistry'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

function sessionFact(f: DailyFacts): string | null {
  const name = f.session.planned ?? 'ta séance'
  switch (f.session.status) {
    case 'completed': return `Séance ${name} bouclée.`
    case 'cancelled':
    case 'skipped': return `Séance ${name} non faite aujourd'hui.`
    case 'rest': return `Jour de repos.`
    case 'none': return `Séance ${name} prévue, pas encore faite.`
    default: return null
  }
}

function nutritionFact(f: DailyFacts): string | null {
  const nu = f.nutrition
  if (nu.status === 'over') return `Calories au-dessus de la cible (+${nu.deltaKcal}).`
  if (nu.status === 'under') return `Calories sous la cible (${nu.deltaKcal}).`
  if (nu.proteinShort) return `Protéines courtes (${nu.proteinLogged}/${nu.proteinTarget}g).`
  return `Nutrition dans la cible (${nu.pctKcal}%).`
}

const LOW_STEPS = 6000

function secondaryFact(f: DailyFacts): string | null {
  if (f.hydration.pct < 60) return `Hydratation à ${f.hydration.pct}%.`
  if (f.steps != null && f.steps > 0 && f.steps < LOW_STEPS) return `Pas en dessous de la cible (${f.steps}).`
  return null
}

export type ClosingInput = {
  facts: DailyFacts
  tips: string[]
  tone: Tone
  flow: 'morning' | 'evening'
  name?: string
  lang: ClientLang
}

export function composeClosingMessage(input: ClosingInput): string {
  const style = TONE_MATRIX[input.lang][input.tone]
  const isMorning = input.flow === 'morning'

  // Morning closing: omit facts that are trivially "bad" just because the client
  // woke up 10 minutes ago. Only surface facts with genuine signal.
  const sessionLine = (() => {
    const f = sessionFact(input.facts)
    // "not yet done" at morning check-in = always true, never actionable
    if (isMorning && input.facts.session.status === 'none') return null
    return f
  })()
  const nutritionLine = (() => {
    if (isMorning) {
      // Calories under / on-track at morning = meaningless (client hasn't eaten yet)
      const s = input.facts.nutrition.status
      if (s === 'under' || s === 'on_track') return null
    }
    return nutritionFact(input.facts)
  })()
  // Hydration always low in the morning — skip it, the tip will handle it if relevant
  const secondaryLine = isMorning ? null : secondaryFact(input.facts)

  const facts = [sessionLine, nutritionLine, secondaryLine].filter(Boolean) as string[]
  const numbered = facts.length > 0 ? '\n' + facts.map((line, i) => `${i + 1}. ${line}`).join('\n') : ''
  const actions = input.tips.length > 0 ? '\n\n' + input.tips.join('\n') : ''
  const closer = input.flow === 'evening' ? style.closerEvening : style.closerMorning
  return `${style.openerClosing(input.name ?? '')}${numbered}${actions}\n\n${closer}`.trim()
}

/** First action to do on waking (D6), with a contextual hint for BPM. */
function localizeFieldLabel(key: string, lang: ClientLang): string {
  const labels: Record<string, Record<ClientLang, string>> = {
    rhr_morning: { fr: 'ta fréquence cardiaque au repos', en: 'your resting heart rate', es: 'tu frecuencia cardiaca en reposo' },
    sleep_hours: { fr: 'ta durée de sommeil', en: 'your sleep duration', es: 'tu duración de sueño' },
    sleep_quality: { fr: 'ta qualité de sommeil', en: 'your sleep quality', es: 'tu calidad de sueño' },
    energy_level: { fr: 'ton niveau d’énergie', en: 'your energy level', es: 'tu nivel de energía' },
    weight_kg: { fr: 'ton poids', en: 'your weight', es: 'tu peso' },
    stress_level: { fr: 'ton niveau de stress', en: 'your stress level', es: 'tu nivel de estrés' },
    daily_steps: { fr: 'ton nombre de pas', en: 'your step count', es: 'tu número de pasos' },
    muscle_soreness: { fr: 'tes courbatures', en: 'your soreness', es: 'tus agujetas' },
    hunger_level: { fr: 'ton niveau de faim', en: 'your hunger level', es: 'tu nivel de hambre' },
    mood: { fr: 'ton humeur', en: 'your mood', es: 'tu estado de ánimo' },
  }
  return labels[key]?.[lang] ?? labels.energy_level[lang]
}

function firstWakingAction(fields: string[]): { key: string; isRhr: boolean } | null {
  const first = orderedByWaking(fields)[0]
  if (!first) return null
  return { key: first.key, isRhr: first.key === 'rhr_morning' }
}

export type MorningGreetingInput = {
  name: string
  tone: Tone
  lang: ClientLang
  enabledFields: string[]
  hasTrainingToday: boolean
  trainingName: string | null
}

export function composeMorningGreeting(input: MorningGreetingInput): string {
  const style = TONE_MATRIX[input.lang][input.tone]
  const first = firstWakingAction(input.enabledFields)
  const firstLabel = first ? localizeFieldLabel(first.key, input.lang) : ''
  const ctaHint = first
    ? first.isRhr
      ? (
        input.lang === 'es'
          ? `Si puedes, empieza por ${firstLabel} antes de salir de la cama.`
          : input.lang === 'en'
            ? `If you can, start with ${firstLabel} before getting out of bed.`
            : `Si tu peux, commence par ${firstLabel} avant de sortir du lit.`
      )
      : (
        input.lang === 'es'
          ? `Si puedes, empieza por ${firstLabel}.`
          : input.lang === 'en'
            ? `If you can, start with ${firstLabel}.`
            : `Si tu peux, commence par ${firstLabel}.`
      )
    : ''
  const context = input.hasTrainingToday
    ? (
      input.lang === 'es'
        ? `Tienes prevista ${input.trainingName?.trim() || 'una sesión'} hoy.`
        : input.lang === 'en'
          ? `You have ${input.trainingName?.trim() || 'a session'} planned today.`
          : `Tu as ${input.trainingName?.trim() || 'une séance'} prévue aujourd'hui.`
    )
    : ''
  return [
    style.openerMorning(input.name),
    context,
    ctaHint,
    input.lang === 'es'
      ? '¿Quieres que lancemos tu check-in de mañana?'
      : input.lang === 'en'
        ? 'Do you want to start your morning check-in?'
        : 'Tu veux faire ton check-in du matin maintenant ?',
  ].filter(Boolean).join('\n')
}

export type EveningGreetingInput = {
  name: string
  tone: Tone
  lang: ClientLang
  enabledEveningFields: string[]
  hasTrainingToday: boolean
  trainingName: string | null
}

export function composeEveningGreeting(input: EveningGreetingInput): string {
  const style = TONE_MATRIX[input.lang][input.tone]
  const labels = input.enabledEveningFields
    .map((k) => localizeFieldLabel(k, input.lang))
    .filter(Boolean) as string[]
  // Session name can contain commas ("épaules, dos, pectoraux") — isolate in parens
  // so it never breaks the sentence.
  const sessionLine = input.hasTrainingToday
    ? (
      input.lang === 'es'
        ? `Una palabra sobre tu sesión de hoy (${input.trainingName?.trim() || 'sesión'}), tu recuperación o tu nutrición si hace falta.`
        : input.lang === 'en'
          ? `A quick note on today’s session (${input.trainingName?.trim() || 'session'}), your recovery, or your nutrition if needed.`
          : `Un mot sur ta séance du jour (${input.trainingName?.trim() || 'séance'}), ta récup ou ta nutrition si besoin.`
    )
    : (
      input.lang === 'es'
        ? 'Repasamos tu día si quieres.'
        : input.lang === 'en'
          ? 'We can review your day if you want.'
          : 'On débriefe ta journée si tu veux.'
    )
  const ctaLine = labels.length > 0
    ? (
      input.lang === 'es'
        ? `¿Quieres hacer tu check-in de noche ahora? Revisaremos ${labels.join(', ')}.`
        : input.lang === 'en'
          ? `Do you want to do your evening check-in now? We will look at ${labels.join(', ')}.`
          : `Tu veux faire ton check-in du soir maintenant ? On y regardera ${labels.join(', ')}.`
    )
    : (
      input.lang === 'es'
        ? '¿Quieres hacer tu check-in de noche ahora?'
        : input.lang === 'en'
          ? 'Do you want to do your evening check-in now?'
          : 'Tu veux faire ton check-in du soir maintenant ?'
    )
  return [style.openerEvening(input.name), sessionLine, ctaLine, style.closerEvening]
    .filter(Boolean)
    .join('\n')
}

export type EveningReminderInput = { tone: Tone; lang: ClientLang; enabledMorningFields: string[] }

export function composeEveningReminder(input: EveningReminderInput): string {
  const first = firstWakingAction(input.enabledMorningFields)
  if (!first) {
    if (input.lang === 'es') return 'Pequeño recordatorio para mañana por la mañana: al despertar, toma primero las medidas que sigue tu coach.'
    if (input.lang === 'en') return 'Quick reminder for tomorrow morning: when you wake up, take the measurements your coach tracks first.'
    return "Petit rappel pour demain matin : au réveil, prends d'abord les mesures que ton coach suit."
  }
  const firstLabel = localizeFieldLabel(first.key, input.lang)
  const suffix = first.isRhr
    ? (
      input.lang === 'es'
        ? ', antes incluso de salir de la cama para que sea fiable'
        : input.lang === 'en'
          ? ', before getting out of bed so it stays reliable'
          : ", avant même de sortir du lit pour qu'elle soit fiable"
    )
    : (
      input.lang === 'es'
        ? ', nada más despertar'
        : input.lang === 'en'
          ? ', right when you wake up'
          : ', dès le réveil'
    )
  if (input.lang === 'es') return `Pequeño recordatorio para mañana por la mañana: empieza por ${firstLabel}${suffix}.`
  if (input.lang === 'en') return `Quick reminder for tomorrow morning: start with ${firstLabel}${suffix}.`
  return `Petit rappel pour demain matin : commence par ${firstLabel}${suffix}.`
}

export { orderedByWaking, getFieldsForFlow }
