import type { ClientLang } from '@/lib/i18n/clientTranslations'
import { formatSleepHours } from '@/lib/client/checkin/sleepTimeFormat'

export interface FlowOption {
  label: string
  value: number
  emoji?: string
}

export interface FlowStep {
  key: string
  component: 'chips' | 'slider' | 'number' | 'time'
  question: string
  helperText?: string
  options?: FlowOption[]
  min?: number
  max?: number
  step?: number
  unit?: string
  optional?: boolean
  condition?: (collected: Record<string, number>) => boolean
}

export interface CheckinFlow {
  type: 'morning' | 'evening'
  greeting: string
  steps: FlowStep[]
}

export type CheckinData = {
  sleep_hours?: number
  sleep_quality?: number
  energy_level?: number
  stress_level?: number
  weight_kg?: number
  rhr_morning?: number
  daily_steps?: number
  hunger_level?: number
  muscle_soreness?: number
  notes?: string
  mood?: number
}

const FLOW_COPY = {
  fr: {
    morning: {
      greeting: 'On fait le point sur ton réveil.',
      rhrQuestion: 'As-tu relevé ta fréquence cardiaque au repos ce matin ?',
      rhrHelper: 'Idéalement au réveil, avant de te lever. Si tu ne l’as pas mesurée, tu peux passer cette étape.',
      sleepQuestion: 'Combien d’heures as-tu dormi ?',
      sleepQualityQuestion: 'Comment évalues-tu la qualité de ta nuit ?',
      wakeEnergyQuestion: 'Quel est ton niveau d’énergie ce matin ?',
      weightQuestion: 'Quel est ton poids ce matin ?',
      label: 'Check-in matin',
      recorded: 'C’est noté. Ton check-in du matin est enregistré.',
    },
    evening: {
      greeting: 'On fait le point sur ta journée.',
      energyQuestion: 'Comment te sens-tu ce soir niveau énergie ?',
      stressQuestion: 'Comment évalues-tu ta charge mentale aujourd’hui ?',
      sorenessQuestion: 'Comment sont tes courbatures ce soir ?',
      hungerQuestion: 'Comment est ton appétit ce soir ?',
      stepsQuestion: 'Combien de pas as-tu faits aujourd’hui ?',
      label: 'Check-in soir',
      recorded: 'C’est noté. Ton check-in du soir est enregistré.',
    },
    ready: {
      morningQuestion: 'Souhaites-tu faire ton check-in du matin maintenant ?',
      eveningQuestion: 'Souhaites-tu faire ton check-in du soir maintenant ?',
      yes: 'Commencer',
      later: 'Plus tard',
      deferMorning: 'Très bien. Tu pourras lancer ton check-in depuis le bouton Check-in en haut à gauche.',
      deferEvening: 'Très bien. Tu pourras lancer ton check-in depuis le bouton Check-in en haut à gauche.',
    },
    summary: {
      morningPrefix: 'Check-in matin',
      eveningPrefix: 'Check-in soir',
      sleep: 'Sommeil',
      quality: 'Qualité',
      energy: 'Énergie',
      stress: 'Stress',
      weight: 'Poids',
      mood: 'Humeur',
      rhr: 'RHR',
      soreness: 'Courbatures',
      hunger: 'Faim',
      steps: 'Pas',
      validatedMorning: 'Check-in matin terminé',
      validatedEvening: 'Check-in soir terminé',
    },
    values: {
      sleepQuality: { 1: 'Mauvaise', 2: 'Moyenne', 3: 'Bonne', 4: 'Excellente' },
      energy: { 1: 'Épuisé', 2: 'Fatigué', 3: 'Normal', 4: 'En forme', 5: 'Très en forme' },
      eveningEnergy: { 1: 'À plat', 2: 'Fatigué', 3: 'Correct', 4: 'Bon', 5: 'Très bon' },
      stress: { 1: 'Très légère', 2: 'Légère', 3: 'Modérée', 4: 'Élevée', 5: 'Très élevée' },
      soreness: { 1: 'Aucune', 2: 'Légères', 3: 'Marquées', 4: 'Très marquées' },
      hunger: { 1: 'Faible', 2: 'Légère', 3: 'Présente', 4: 'Forte' },
      mood: { 1: 'Bas', 2: 'Moyen-', 3: 'Stable', 4: 'Bon', 5: 'Excellent' },
    },
  },
  en: {
    morning: {
      greeting: 'Let’s do a quick morning check.',
      rhrQuestion: 'Did you take your resting heart rate this morning?',
      rhrHelper: 'Ideally before getting out of bed. If you did not take it, you can skip this step.',
      sleepQuestion: 'How many hours did you sleep?',
      sleepQualityQuestion: 'How would you rate your night?',
      wakeEnergyQuestion: 'What is your energy level this morning?',
      weightQuestion: 'What is your weight this morning?',
      label: 'Morning check-in',
      recorded: 'Got it. Your morning check-in is saved.',
    },
    evening: {
      greeting: 'Let’s wrap up the day with a quick check.',
      energyQuestion: 'How is your energy tonight?',
      stressQuestion: 'How heavy did today feel mentally?',
      sorenessQuestion: 'How are your muscles feeling now?',
      hungerQuestion: 'How is your hunger tonight?',
      stepsQuestion: 'What step count do you see today?',
      label: 'Evening check-in',
      recorded: 'Got it. Your evening check-in is saved.',
    },
    ready: {
      morningQuestion: 'Do you want to do your morning check-in now?',
      eveningQuestion: 'Do you want to do your evening check-in now?',
      yes: "Yes, let's go",
      later: 'Later',
      deferMorning: 'All right, take your time. When you are ready, start your check-in with the Check-in button at the top left and we will do it together.',
      deferEvening: 'All right, take your time. When you are ready, start your check-in with the Check-in button at the top left and we will review your day together.',
    },
    summary: {
      morningPrefix: 'Morning check-in',
      eveningPrefix: 'Evening check-in',
      sleep: 'Sleep',
      quality: 'Quality',
      energy: 'Energy',
      stress: 'Stress',
      weight: 'Weight',
      mood: 'Mood',
      rhr: 'RHR',
      soreness: 'Soreness',
      hunger: 'Hunger',
      steps: 'Steps',
      validatedMorning: 'Morning check-in completed',
      validatedEvening: 'Evening check-in completed',
    },
    values: {
      sleepQuality: { 1: 'Bad', 2: 'Average', 3: 'Good', 4: 'Excellent' },
      energy: { 1: 'Exhausted', 2: 'Tired', 3: 'Normal', 4: 'Good', 5: 'Great' },
      eveningEnergy: { 1: 'Very low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Very good' },
      stress: { 1: 'Very light', 2: 'Light', 3: 'Moderate', 4: 'Heavy', 5: 'Very heavy' },
      soreness: { 1: 'None', 2: 'Light', 3: 'Noticeable', 4: 'Very high' },
      hunger: { 1: 'Not hungry', 2: 'A little hungry', 3: 'Hungry', 4: 'Very hungry' },
      mood: { 1: 'Low', 2: 'Below average', 3: 'Stable', 4: 'Good', 5: 'Excellent' },
    },
  },
  es: {
    morning: {
      greeting: 'Hagamos un punto rápido de tu mañana.',
      rhrQuestion: '¿Tomaste tu frecuencia cardiaca en reposo esta mañana?',
      rhrHelper: 'Idealmente antes de salir de la cama. Si no la tomaste, puedes omitir este paso.',
      sleepQuestion: '¿Cuántas horas dormiste?',
      sleepQualityQuestion: '¿Cómo valorarías tu noche?',
      wakeEnergyQuestion: '¿Cuál es tu nivel de energía esta mañana?',
      weightQuestion: '¿Cuál es tu peso esta mañana?',
      label: 'Check-in de mañana',
      recorded: 'Perfecto. Tu check-in de mañana está registrado.',
    },
    evening: {
      greeting: 'Cerramos el día con un punto rápido.',
      energyQuestion: '¿Cómo está tu energía esta noche?',
      stressQuestion: '¿Cómo de pesada fue tu carga mental hoy?',
      sorenessQuestion: '¿Cómo están tus agujetas ahora?',
      hungerQuestion: '¿Cómo está tu hambre esta noche?',
      stepsQuestion: '¿Qué número de pasos ves hoy?',
      label: 'Check-in de noche',
      recorded: 'Perfecto. Tu check-in de noche está registrado.',
    },
    ready: {
      morningQuestion: '¿Quieres hacer tu check-in de mañana ahora?',
      eveningQuestion: '¿Quieres hacer tu check-in de noche ahora?',
      yes: 'Sí, vamos',
      later: 'Más tarde',
      deferMorning: 'Perfecto, tómate tu tiempo. Cuando quieras, lanza tu check-in con el botón Check-in arriba a la izquierda y lo hacemos juntos.',
      deferEvening: 'Perfecto, tómate tu tiempo. Cuando quieras, lanza tu check-in con el botón Check-in arriba a la izquierda y repasamos tu día juntos.',
    },
    summary: {
      morningPrefix: 'Check-in de mañana',
      eveningPrefix: 'Check-in de noche',
      sleep: 'Sueño',
      quality: 'Calidad',
      energy: 'Energía',
      stress: 'Estrés',
      weight: 'Peso',
      mood: 'Estado de ánimo',
      rhr: 'FC reposo',
      soreness: 'Agujetas',
      hunger: 'Hambre',
      steps: 'Pasos',
      validatedMorning: 'Check-in de mañana completado',
      validatedEvening: 'Check-in de noche completado',
    },
    values: {
      sleepQuality: { 1: 'Mala', 2: 'Regular', 3: 'Buena', 4: 'Excelente' },
      energy: { 1: 'Agotado', 2: 'Cansado', 3: 'Normal', 4: 'En forma', 5: 'Muy en forma' },
      eveningEnergy: { 1: 'Muy baja', 2: 'Baja', 3: 'Correcta', 4: 'Buena', 5: 'Muy buena' },
      stress: { 1: 'Muy ligera', 2: 'Ligera', 3: 'Moderada', 4: 'Alta', 5: 'Muy alta' },
      soreness: { 1: 'Ninguna', 2: 'Leves', 3: 'Marcadas', 4: 'Muy fuertes' },
      hunger: { 1: 'Sin hambre', 2: 'Un poco de hambre', 3: 'Hambre', 4: 'Mucha hambre' },
      mood: { 1: 'Bajo', 2: 'Medio-', 3: 'Estable', 4: 'Bueno', 5: 'Excelente' },
    },
  },
} satisfies Record<ClientLang, Record<string, any>>

function copyFor(lang: ClientLang) {
  return FLOW_COPY[lang] ?? FLOW_COPY.fr
}

function scaleLabel(values: Record<number, string>, value: number): string {
  return values[value] ?? String(value)
}

export function getCheckinFlow(flowType: 'morning' | 'evening', lang: ClientLang): CheckinFlow {
  const copy = copyFor(lang)

  if (flowType === 'morning') {
    return {
      type: 'morning',
      greeting: copy.morning.greeting,
      steps: [
        {
          key: 'rhr_morning',
          component: 'number',
          question: copy.morning.rhrQuestion,
          helperText: copy.morning.rhrHelper,
          unit: 'bpm',
          min: 30,
          max: 200,
          step: 1,
          optional: true,
        },
        {
          key: 'weight_kg',
          component: 'number',
          question: copy.morning.weightQuestion,
          unit: 'kg',
          min: 20,
          max: 300,
          step: 0.1,
          optional: true,
        },
        {
          key: 'sleep_quality',
          component: 'chips',
          question: copy.morning.sleepQualityQuestion,
          options: [
            { label: copy.values.sleepQuality[1], value: 1, emoji: '😴' },
            { label: copy.values.sleepQuality[2], value: 2, emoji: '😐' },
            { label: copy.values.sleepQuality[3], value: 3, emoji: '🙂' },
            { label: copy.values.sleepQuality[4], value: 4, emoji: '⚡' },
          ],
        },
        {
          key: 'sleep_hours',
          component: 'time',
          question: copy.morning.sleepQuestion,
          min: 2,
          max: 12,
          step: 0.25,
        },
        {
          key: 'energy_level',
          component: 'chips',
          question: copy.morning.wakeEnergyQuestion,
          options: [
            { label: copy.values.energy[1], value: 1, emoji: '🪫' },
            { label: copy.values.energy[2], value: 2, emoji: '😴' },
            { label: copy.values.energy[3], value: 3, emoji: '😐' },
            { label: copy.values.energy[4], value: 4, emoji: '💪' },
            { label: copy.values.energy[5], value: 5, emoji: '⚡' },
          ],
        },
      ],
    }
  }

  return {
    type: 'evening',
    greeting: copy.evening.greeting,
    steps: [
      {
        key: 'energy_level',
        component: 'chips',
        question: copy.evening.energyQuestion,
        options: [
          { label: copy.values.eveningEnergy[1], value: 1, emoji: '🪫' },
          { label: copy.values.eveningEnergy[2], value: 2, emoji: '😴' },
          { label: copy.values.eveningEnergy[3], value: 3, emoji: '😐' },
          { label: copy.values.eveningEnergy[4], value: 4, emoji: '💪' },
          { label: copy.values.eveningEnergy[5], value: 5, emoji: '⚡' },
        ],
      },
      {
        key: 'stress_level',
        component: 'chips',
        question: copy.evening.stressQuestion,
        options: [
          { label: copy.values.stress[1], value: 1, emoji: '😌' },
          { label: copy.values.stress[2], value: 2, emoji: '🙂' },
          { label: copy.values.stress[3], value: 3, emoji: '😐' },
          { label: copy.values.stress[4], value: 4, emoji: '😟' },
          { label: copy.values.stress[5], value: 5, emoji: '🔥' },
        ],
      },
      {
        key: 'muscle_soreness',
        component: 'chips',
        question: copy.evening.sorenessQuestion,
        options: [
          { label: copy.values.soreness[1], value: 1, emoji: '✅' },
          { label: copy.values.soreness[2], value: 2, emoji: '😌' },
          { label: copy.values.soreness[3], value: 3, emoji: '😬' },
          { label: copy.values.soreness[4], value: 4, emoji: '😫' },
        ],
        condition: (collected) => Boolean(collected.__has_session_today),
      },
      {
        key: 'hunger_level',
        component: 'chips',
        question: copy.evening.hungerQuestion,
        options: [
          { label: copy.values.hunger[1], value: 1, emoji: '😌' },
          { label: copy.values.hunger[2], value: 2, emoji: '😐' },
          { label: copy.values.hunger[3], value: 3, emoji: '🍽️' },
          { label: copy.values.hunger[4], value: 4, emoji: '🦁' },
        ],
      },
      {
        key: 'daily_steps',
        component: 'number',
        question: copy.evening.stepsQuestion,
        unit: lang === 'es' ? 'pasos' : lang === 'en' ? 'steps' : 'pas',
        min: 0,
        max: 200000,
        step: 1,
        optional: true,
      },
    ],
  }
}

export function buildCheckinReadyCopy(lang: ClientLang, flowType: 'morning' | 'evening') {
  const copy = copyFor(lang).ready
  return {
    question: flowType === 'morning' ? copy.morningQuestion : copy.eveningQuestion,
    yes: copy.yes,
    later: copy.later,
    deferMessage: flowType === 'morning' ? copy.deferMorning : copy.deferEvening,
  }
}

export function getCheckinRecordedMessage(lang: ClientLang, flowType: 'morning' | 'evening') {
  const copy = copyFor(lang)
  return flowType === 'morning' ? copy.morning.recorded : copy.evening.recorded
}

export function getCheckinMomentLabel(lang: ClientLang, flowType: 'morning' | 'evening') {
  const copy = copyFor(lang)
  return flowType === 'morning' ? copy.morning.label : copy.evening.label
}

export function buildCheckinSummary(lang: ClientLang, flowType: 'morning' | 'evening', data: CheckinData): string {
  const copy = copyFor(lang)
  const labels = copy.summary
  const line1: string[] = []
  const line2: string[] = []

  if (flowType === 'morning') {
    if (data.sleep_hours != null) line1.push(`${labels.sleep} ${formatSleepHours(data.sleep_hours)}`)
    if (data.sleep_quality != null) line1.push(`${labels.quality} ${scaleLabel(copy.values.sleepQuality as Record<number, string>, data.sleep_quality)}`)
    if (data.energy_level != null) line2.push(`${labels.energy} ${scaleLabel(copy.values.energy as Record<number, string>, data.energy_level)}`)
    if (data.weight_kg != null) line2.push(`${labels.weight} ${data.weight_kg} kg`)
    if (data.rhr_morning != null) line2.push(`${labels.rhr} ${data.rhr_morning} bpm`)
    if (data.mood != null) line2.push(`${labels.mood} ${scaleLabel(copy.values.mood as Record<number, string>, data.mood)}`)

    const lines = [
      line1.length ? `${labels.morningPrefix} · ${line1.join(' · ')}` : labels.validatedMorning,
      line2.join(' · '),
    ].filter(Boolean)
    return lines.join('\n')
  }

  if (data.energy_level != null) line1.push(`${labels.energy} ${scaleLabel(copy.values.eveningEnergy as Record<number, string>, data.energy_level)}`)
  if (data.stress_level != null) line1.push(`${labels.stress} ${scaleLabel(copy.values.stress as Record<number, string>, data.stress_level)}`)
  if (data.muscle_soreness != null) line1.push(`${labels.soreness} ${scaleLabel(copy.values.soreness as Record<number, string>, data.muscle_soreness)}`)
  if (data.hunger_level != null) line2.push(`${labels.hunger} ${scaleLabel(copy.values.hunger as Record<number, string>, data.hunger_level)}`)
  if (data.daily_steps != null) {
    const formattedSteps = Math.round(data.daily_steps).toLocaleString(lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB')
    line2.push(`${labels.steps} ${formattedSteps}`)
  }
  if (data.mood != null) line2.push(`${labels.mood} ${scaleLabel(copy.values.mood as Record<number, string>, data.mood)}`)

  const lines = [
    line1.length ? `${labels.eveningPrefix} · ${line1.join(' · ')}` : labels.validatedEvening,
    line2.join(' · '),
  ].filter(Boolean)
  return lines.join('\n')
}
