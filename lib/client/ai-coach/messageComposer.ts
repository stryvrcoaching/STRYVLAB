import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'
import { TONE_MATRIX, type Tone } from '@/lib/client/ai-coach/resolveTone'
import { orderedByWaking, getFieldsForFlow } from '@/lib/client/checkin/fieldRegistry'

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
}

export function composeClosingMessage(input: ClosingInput): string {
  const style = TONE_MATRIX[input.tone]
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
function firstWakingAction(fields: string[]): { label: string; isRhr: boolean } | null {
  const first = orderedByWaking(fields)[0]
  if (!first) return null
  return { label: first.label, isRhr: first.key === 'rhr_morning' }
}

export type MorningGreetingInput = {
  name: string
  tone: Tone
  enabledFields: string[]
  hasTrainingToday: boolean
  trainingName: string | null
}

export function composeMorningGreeting(input: MorningGreetingInput): string {
  const style = TONE_MATRIX[input.tone]
  const first = firstWakingAction(input.enabledFields)
  // D6: waking-order hint comes BEFORE the check-in question so the client
  // can act on it (measure RHR) before tapping "Oui, on y va".
  const ctaHint = first
    ? `Avant de répondre, commence par ${first.label}${first.isRhr ? " — avant même de sortir du lit pour qu'elle soit fiable" : ''}.`
    : ''
  const context = input.hasTrainingToday
    ? `Aujourd'hui : ${input.trainingName?.trim() || 'séance prévue'}.`
    : "Pas de séance prévue aujourd'hui."
  // No closerMorning here — the closer lives in the post-checkin closing message,
  // not in the greeting. Repeating it would make the user see it twice.
  return [
    style.openerMorning(input.name),
    context,
    ctaHint,
    'Prêt pour ton check-in du matin ?',
  ].filter(Boolean).join('\n')
}

export type EveningGreetingInput = {
  name: string
  tone: Tone
  enabledEveningFields: string[]
  hasTrainingToday: boolean
  trainingName: string | null
}

export function composeEveningGreeting(input: EveningGreetingInput): string {
  const style = TONE_MATRIX[input.tone]
  const labels = input.enabledEveningFields
    .map((k) => getFieldsForFlow('evening').find((f) => f.key === k)?.label)
    .filter(Boolean) as string[]
  // Session name can contain commas ("épaules, dos, pectoraux") — isolate in parens
  // so it never breaks the sentence.
  const sessionLine = input.hasTrainingToday
    ? `Un mot sur ta séance du jour (${input.trainingName?.trim() || 'séance'}), ta récup ou ta nutrition si besoin.`
    : 'On débriefe ta journée si tu veux.'
  const ctaLine = labels.length > 0
    ? `Prêt pour ton check-in du soir ? On y regardera ${labels.join(', ')}.`
    : 'Prêt pour ton check-in du soir ?'
  return [style.openerEvening(input.name), sessionLine, ctaLine, style.closerEvening]
    .filter(Boolean)
    .join('\n')
}

export type EveningReminderInput = { tone: Tone; enabledMorningFields: string[] }

export function composeEveningReminder(input: EveningReminderInput): string {
  const first = firstWakingAction(input.enabledMorningFields)
  if (!first) {
    return "Petit rappel pour demain matin : au réveil, prends d'abord les mesures que ton coach suit."
  }
  const suffix = first.isRhr
    ? ", avant même de sortir du lit pour qu'elle soit fiable"
    : ', dès le réveil'
  return `Petit rappel pour demain matin : commence par ${first.label}${suffix}.`
}

export { orderedByWaking, getFieldsForFlow }
