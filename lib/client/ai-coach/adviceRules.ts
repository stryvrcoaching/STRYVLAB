import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

export type Freedom = 'none' | 'safe' | 'extended'
export type CoachAlertCategory = 'program_signal' | 'nutrition_trend' | 'recovery_flag'

export type CoachAlert = { category: CoachAlertCategory; priority: number; reason: string }

export type AdviceTrend = { kcalOverDays: number; proteinShortDays: number }

export type AdviceInput = {
  lang: ClientLang
  facts: DailyFacts
  trend: AdviceTrend
  freedom: Freedom
  flow?: 'morning' | 'evening'
}

export type AdviceOutput = { tips: string[]; coachAlerts: CoachAlert[] }

type Rule = {
  id: string
  /** lifestyle tip shown to client (freedom-gated), or null if alert-only */
  tip: ((f: DailyFacts, lang: ClientLang) => string) | null
  /** minimum freedom to show the tip */
  freedomMin: Freedom
  alert: ((f: DailyFacts, t: AdviceTrend) => CoachAlert) | null
  when: (f: DailyFacts, t: AdviceTrend) => boolean
  priority: number
}

const FREEDOM_RANK: Record<Freedom, number> = { none: 0, safe: 1, extended: 2 }

const RULES: Rule[] = [
  // Séance — program signals are alert-only (D9/D10)
  {
    id: 'session_cancelled',
    when: (f) => f.session.status === 'cancelled' || f.session.status === 'skipped',
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'program_signal', priority: 2, reason: 'session_not_done' }),
    priority: 90,
  },
  {
    id: 'soreness_high',
    when: (f) => (f.checkin.soreness ?? 0) >= 3,
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'recovery_flag', priority: 2, reason: 'soreness_high' }),
    priority: 80,
  },
  {
    id: 'rhr_flag',
    when: (f) => (f.checkin.rhr ?? 0) >= 90,
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'recovery_flag', priority: 2, reason: 'rhr_elevated' }),
    priority: 70,
  },
  // Nutrition trend (serious) — D12
  {
    id: 'kcal_over_trend',
    when: (_f, t) => t.kcalOverDays >= 3,
    tip: (_f, lang) => lang === 'es'
      ? 'Tres días por encima del objetivo: hoy toca apretar.'
      : lang === 'en'
        ? 'Three days above target: time to tighten things up today.'
        : 'Trois jours au-dessus de la cible : là on resserre dès aujourd’hui.',
    freedomMin: 'safe',
    alert: () => ({ category: 'nutrition_trend', priority: 2, reason: 'kcal_over_3d' }),
    priority: 75,
  },
  {
    id: 'protein_short_trend',
    when: (_f, t) => t.proteinShortDays >= 3,
    tip: (_f, lang) => lang === 'es'
      ? 'Proteínas por debajo del objetivo desde hace tres días: corrígelo cuanto antes.'
      : lang === 'en'
        ? 'Protein has been below target for three days: fix that first.'
        : 'Protéines sous la cible depuis trois jours, à corriger en priorité.',
    freedomMin: 'safe',
    alert: () => ({ category: 'nutrition_trend', priority: 2, reason: 'protein_short_3d' }),
    priority: 60,
  },
  // Lifestyle tips (client-facing, gated)
  {
    id: 'hydration_low',
    when: (f) => f.hydration.pct < 60,
    tip: (f, lang) => lang === 'es'
      ? `Hidratación al ${f.hydration.pct}%. Lo más simple: reparte sorbos en momentos clave (al despertar, en cada comida, en la sesión) en vez de beber mucho de golpe.`
      : lang === 'en'
        ? `Hydration is at ${f.hydration.pct}%. The easiest move: anchor a few sips to key moments (wake-up, each meal, training) instead of drinking a huge amount at once.`
        : `Hydratation à ${f.hydration.pct}%. Le plus simple : ancre des gorgées à des moments-clés (réveil, chaque repas, séance) plutôt qu’une grosse quantité d’un coup.`,
    freedomMin: 'safe',
    alert: null,
    priority: 40,
  },
  {
    id: 'stress_high',
    when: (f) => (f.checkin.stress ?? 0) >= 4,
    tip: (_f, lang) => lang === 'es'
      ? 'Estrés alto detectado. Cinco minutos de respiración o un paseo corto antes de dormir ayudan de verdad.'
      : lang === 'en'
        ? 'High stress noted. Five minutes of breathing or a short walk before bed genuinely helps.'
        : 'Stress élevé noté. 5 min de respiration ou une courte marche avant le coucher aident concrètement.',
    freedomMin: 'safe',
    alert: null,
    priority: 35,
  },
  {
    id: 'sleep_short',
    when: (f) => (f.checkin.sleepHours ?? 99) < 6,
    tip: (f, lang) => lang === 'es'
      ? `Noche corta (${f.checkin.sleepHours}h): hidrátate desde que te despiertes para ponerte en marcha.`
      : lang === 'en'
        ? `Short night (${f.checkin.sleepHours}h) — hydrate as soon as you wake up to get things moving.`
        : `Nuit courte (${f.checkin.sleepHours}h) — pense à t’hydrater dès le réveil pour relancer la machine.`,
    freedomMin: 'extended',
    alert: null,
    priority: 30,
  },
  {
    id: 'protein_short_day',
    when: (f) => f.nutrition.proteinShort,
    tip: (f, lang) => lang === 'es'
      ? `Proteínas algo cortas (${f.nutrition.proteinLogged}/${f.nutrition.proteinTarget}g): fácil de corregir en la próxima comida.`
      : lang === 'en'
        ? `Protein is a bit low (${f.nutrition.proteinLogged}/${f.nutrition.proteinTarget}g) — easy to catch up at the next meal.`
        : `Protéines un peu courtes (${f.nutrition.proteinLogged}/${f.nutrition.proteinTarget}g) — facile à rattraper au prochain repas.`,
    freedomMin: 'extended',
    alert: null,
    priority: 25,
  },
]

const MAX_TIPS = 2

// Tips that are meaningless in a morning context (client just woke up,
// calorie/hydration data reflects nothing yet).
const EVENING_ONLY_TIPS = new Set(['hydration_low', 'protein_short_day'])

export function selectAdvice(input: AdviceInput): AdviceOutput {
  const isMorning = input.flow === 'morning'
  const matched = RULES.filter((r) => r.when(input.facts, input.trend)).sort((a, b) => b.priority - a.priority)

  const coachAlerts: CoachAlert[] = []
  const tips: string[] = []

  for (const r of matched) {
    if (r.alert) coachAlerts.push(r.alert(input.facts, input.trend))
    if (
      r.tip &&
      tips.length < MAX_TIPS &&
      FREEDOM_RANK[input.freedom] >= FREEDOM_RANK[r.freedomMin] &&
      input.freedom !== 'none' &&
      !(isMorning && EVENING_ONLY_TIPS.has(r.id))
    ) {
      tips.push(r.tip(input.facts, input.lang))
    }
  }

  return { tips, coachAlerts }
}
