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
}

export const MORNING_FLOW: CheckinFlow = {
  type: 'morning',
  greeting: 'On fait le point sur ta nuit 🌙',
  steps: [
    {
      key: 'sleep_hours',
      component: 'time',
      question: "Combien d'heures de sommeil ?",
      min: 4,
      max: 12,
      step: 15,
    },
    {
      key: 'sleep_quality',
      component: 'chips',
      question: 'Comment tu as dormi ?',
      options: [
        { label: 'Mauvais',   value: 1, emoji: '😴' },
        { label: 'Moyen',     value: 2, emoji: '😐' },
        { label: 'Bien',      value: 3, emoji: '🙂' },
        { label: 'Excellent', value: 4, emoji: '⚡' },
      ],
    },
    {
      key: 'energy_level',
      component: 'chips',
      question: "Niveau d'énergie au réveil ?",
      options: [
        { label: 'Épuisé',  value: 1, emoji: '🪫' },
        { label: 'Fatigué', value: 2, emoji: '😴' },
        { label: 'Normal',  value: 3, emoji: '😐' },
        { label: 'Chargé',  value: 4, emoji: '💪' },
        { label: 'Top',     value: 5, emoji: '⚡' },
      ],
    },
    {
      key: 'weight_kg',
      component: 'number',
      question: 'Ton poids ce matin ?',
      unit: 'kg',
      optional: true,
    },
    {
      key: 'rhr_morning',
      component: 'number',
      question: 'Ta frequence cardiaque au repos ce matin ?',
      helperText: 'Au reveil, prends ton pouls pendant 60 sec si tu peux. Sinon, passe cette etape.',
      unit: 'bpm',
      min: 30,
      max: 200,
      optional: true,
    },
  ],
}

export const EVENING_FLOW: CheckinFlow = {
  type: 'evening',
  greeting: "Comment s'est passée ta journée ?",
  steps: [
    {
      key: 'energy_level',
      component: 'chips',
      question: "Niveau d'énergie en fin de journée ?",
      options: [
        { label: 'Épuisé',  value: 1, emoji: '🪫' },
        { label: 'Fatigué', value: 2, emoji: '😴' },
        { label: 'Normal',  value: 3, emoji: '😐' },
        { label: 'Bien',    value: 4, emoji: '💪' },
        { label: 'Top',     value: 5, emoji: '⚡' },
      ],
    },
    {
      key: 'stress_level',
      component: 'chips',
      question: "Niveau de stress aujourd'hui ?",
      options: [
        { label: 'Aucun',   value: 1, emoji: '😌' },
        { label: 'Léger',   value: 2, emoji: '🙂' },
        { label: 'Modéré',  value: 3, emoji: '😐' },
        { label: 'Élevé',   value: 4, emoji: '😟' },
        { label: 'Intense', value: 5, emoji: '🔥' },
      ],
    },
    {
      key: 'muscle_soreness',
      component: 'chips',
      question: 'Courbatures / douleurs musculaires ?',
      options: [
        { label: 'Aucune',   value: 1, emoji: '✅' },
        { label: 'Légères',  value: 2, emoji: '😌' },
        { label: 'Modérées', value: 3, emoji: '😬' },
        { label: 'Intenses', value: 4, emoji: '😫' },
      ],
      // shown only if the client completed a session today
      condition: (collected) => Boolean(collected['__has_session_today']),
    },
    {
      key: 'hunger_level',
      component: 'chips',
      question: 'Niveau de faim en fin de journée ?',
      options: [
        { label: 'Rassasié',  value: 1, emoji: '😌' },
        { label: 'Normal',    value: 2, emoji: '😐' },
        { label: 'Faim',      value: 3, emoji: '🍽️' },
        { label: 'Très faim', value: 4, emoji: '🦁' },
      ],
    },
    {
      key: 'daily_steps',
      component: 'number',
      question: "Combien de pas aujourd'hui ?",
      unit: 'pas',
      min: 0,
      max: 100000,
      optional: true,
    },
  ],
}
