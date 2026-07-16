import type { ClientLang } from '@/lib/i18n/clientTranslations'
import { formatSleepHours } from '@/lib/client/checkin/sleepTimeFormat'
import { getCheckinFlow, type FlowStep } from '@/lib/client/checkin/flows'
import { getFieldDef } from '@/lib/client/checkin/fieldRegistry'

export type CheckinUiStep = FlowStep & {
  emoji: string
  lowLabel?: string
  highLabel?: string
}

const VISUALS = {
  fr: {
    sleep_hours: { emoji: '🌙', lowLabel: 'Court', highLabel: 'Long' },
    sleep_quality: { emoji: '😴', lowLabel: 'Mauvaise', highLabel: 'Excellente' },
    energy_level: { emoji: '⚡', lowLabel: 'Bas', highLabel: 'Haut' },
    stress_level: { emoji: '🧠', lowLabel: 'Calme', highLabel: 'Très élevé' },
    rhr_morning: { emoji: '❤️', lowLabel: 'Bas', highLabel: 'Haut' },
    weight_kg: { emoji: '⚖️' },
    muscle_soreness: { emoji: '💪', lowLabel: 'Aucune', highLabel: 'Forte' },
    hunger_level: { emoji: '🍽️', lowLabel: 'Faible', highLabel: 'Forte' },
    daily_steps: { emoji: '👟' },
  },
  en: {
    sleep_hours: { emoji: '🌙', lowLabel: 'Short', highLabel: 'Long' },
    sleep_quality: { emoji: '😴', lowLabel: 'Poor', highLabel: 'Excellent' },
    energy_level: { emoji: '⚡', lowLabel: 'Low', highLabel: 'High' },
    stress_level: { emoji: '🧠', lowLabel: 'Calm', highLabel: 'Very high' },
    rhr_morning: { emoji: '❤️', lowLabel: 'Low', highLabel: 'High' },
    weight_kg: { emoji: '⚖️' },
    muscle_soreness: { emoji: '💪', lowLabel: 'None', highLabel: 'High' },
    hunger_level: { emoji: '🍽️', lowLabel: 'Low', highLabel: 'High' },
    daily_steps: { emoji: '👟' },
  },
  es: {
    sleep_hours: { emoji: '🌙', lowLabel: 'Corto', highLabel: 'Largo' },
    sleep_quality: { emoji: '😴', lowLabel: 'Mala', highLabel: 'Excelente' },
    energy_level: { emoji: '⚡', lowLabel: 'Baja', highLabel: 'Alta' },
    stress_level: { emoji: '🧠', lowLabel: 'Calma', highLabel: 'Muy alta' },
    rhr_morning: { emoji: '❤️', lowLabel: 'Baja', highLabel: 'Alta' },
    weight_kg: { emoji: '⚖️' },
    muscle_soreness: { emoji: '💪', lowLabel: 'Ninguna', highLabel: 'Alta' },
    hunger_level: { emoji: '🍽️', lowLabel: 'Baja', highLabel: 'Alta' },
    daily_steps: { emoji: '👟' },
  },
} satisfies Record<ClientLang, Record<string, { emoji: string; lowLabel?: string; highLabel?: string }>>

function visualFor(lang: ClientLang, key: string) {
  return VISUALS[lang]?.[key] ?? VISUALS.fr[key] ?? { emoji: '📋' }
}

function fallbackStep(key: string, lang: ClientLang): CheckinUiStep {
  const field = getFieldDef(key)
  const visual = visualFor(lang, key)
  return {
    key,
    component: field?.unit ? 'number' : 'chips',
    question: field?.label ?? key,
    min: field?.scale?.min ?? 1,
    max: field?.scale?.max ?? 5,
    step: field?.unit === 'kg' ? 0.1 : 1,
    unit: field?.unit,
    emoji: visual.emoji,
    lowLabel: visual.lowLabel,
    highLabel: visual.highLabel,
  }
}

export function getCheckinUiSteps(
  flowType: 'morning' | 'evening',
  fields: string[],
  lang: ClientLang,
): CheckinUiStep[] {
  const sequence = getCheckinFlow(flowType, lang).steps
  const enabled = new Set(fields)

  const known = sequence
    .filter((step) => enabled.has(step.key))
    .map((step) => ({
      ...step,
      ...visualFor(lang, step.key),
    }))

  const leftovers = fields
    .filter((key) => !known.some((step) => step.key === key))
    .map((key) => fallbackStep(key, lang))

  return [...known, ...leftovers]
}

export function formatCheckinStepValue(step: CheckinUiStep, value: number, lang: ClientLang): string {
  if (step.component === 'chips') {
    return step.options?.find((option) => option.value === value)?.label ?? String(value)
  }

  if (step.component === 'time') {
    return formatSleepHours(value)
  }

  if (step.key === 'daily_steps') {
    return new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB').format(value)
  }

  if (step.key === 'weight_kg') {
    return `${new Intl.NumberFormat(
      lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB',
      { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 },
    ).format(value)} ${step.unit ?? 'kg'}`
  }

  if (step.step && step.step < 1) {
    return `${value.toFixed(1)}${step.unit ? ` ${step.unit}` : ''}`
  }

  return `${value}${step.unit ? ` ${step.unit}` : ''}`
}

export function getDefaultCheckinStepValue(step: CheckinUiStep): number | undefined {
  if (step.optional) return undefined
  switch (step.key) {
    case 'sleep_hours':
      return 8
    case 'daily_steps':
      return 8000
    case 'rhr_morning':
      return 60
    default:
      return step.component === 'chips'
        ? undefined
        : typeof step.min === 'number' && typeof step.max === 'number'
          ? Math.round(((step.min + step.max) / 2) / (step.step && step.step < 1 ? step.step : 1)) * (step.step && step.step < 1 ? step.step : 1)
          : step.min
  }
}
