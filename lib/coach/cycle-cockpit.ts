import type { CyclePhase, CycleState } from '@/lib/cycle/cycleEngine'

export interface CycleCockpitInsight {
  phase: CyclePhase
  phaseLabel: string
  phaseColor: string
  cycleDay: number
  cycleLength: number
  phaseProgress: number
  cycleProgress: number
  regularity: CycleState['regularity']
  isEstimated: boolean
  isPeriodStartExpected: boolean
  signals: Array<{
    key: 'energy' | 'nutrition' | 'training'
    label: string
    detail: string
  }>
}

const PHASE_INSIGHTS: Record<CyclePhase, Omit<CycleCockpitInsight, 'cycleDay' | 'cycleLength' | 'phaseProgress' | 'cycleProgress' | 'regularity' | 'isEstimated' | 'isPeriodStartExpected'>> = {
  follicular: {
    phase: 'follicular',
    phaseLabel: 'Phase folliculaire',
    phaseColor: '#7fe0b8',
    signals: [
      { key: 'energy', label: 'Énergie', detail: 'Disponibilité en progression à confirmer par les check-ins.' },
      { key: 'nutrition', label: 'Nutrition', detail: 'Lire les apports et la récupération dans le contexte du protocole.' },
      { key: 'training', label: 'Entraînement', detail: 'Fenêtre de progression à individualiser selon la charge observée.' },
    ],
  },
  ovulatory: {
    phase: 'ovulatory',
    phaseLabel: 'Phase ovulatoire',
    phaseColor: '#f5c15d',
    signals: [
      { key: 'energy', label: 'Énergie', detail: 'Disponibilité potentiellement haute : valider avec les signaux réels.' },
      { key: 'nutrition', label: 'Nutrition', detail: 'Maintenir le cadre prévu et suivre l’adhérence.' },
      { key: 'training', label: 'Entraînement', detail: 'Une séance exigeante reste conditionnée par la récupération.' },
    ],
  },
  luteal: {
    phase: 'luteal',
    phaseLabel: 'Phase lutéale',
    phaseColor: '#a855f7',
    signals: [
      { key: 'energy', label: 'Énergie', detail: 'Disponibilité plus variable : comparer terrain, sommeil et charge.' },
      { key: 'nutrition', label: 'Nutrition', detail: 'Relire appétit, hydratation et adhérence avant tout ajustement.' },
      { key: 'training', label: 'Entraînement', detail: 'Ajuster la charge à la réponse observée, pas à la phase seule.' },
    ],
  },
  menstrual: {
    phase: 'menstrual',
    phaseLabel: 'Menstruation',
    phaseColor: '#fda4af',
    signals: [
      { key: 'energy', label: 'Énergie', detail: 'Disponibilité à confirmer avec la cliente et les check-ins.' },
      { key: 'nutrition', label: 'Nutrition', detail: 'Relire hydratation, confort et adhérence sans surinterpréter le poids.' },
      { key: 'training', label: 'Entraînement', detail: 'Adapter la séance aux signaux réels et au ressenti de la cliente.' },
    ],
  },
}

function phaseProgress(state: CycleState): number {
  const day = state.currentCycleDay ?? 1
  const ovulationDay = Math.floor(state.avgCycleLengthDays / 2)
  let start = 1
  let end = state.menstrualPhaseLengthDays

  if (state.currentPhase === 'follicular') {
    start = state.menstrualPhaseLengthDays + 1
    end = ovulationDay - 1
  } else if (state.currentPhase === 'ovulatory') {
    start = ovulationDay
    end = ovulationDay + 1
  } else if (state.currentPhase === 'luteal') {
    start = ovulationDay + 2
    end = state.avgCycleLengthDays
  }

  return Math.max(0, Math.min(1, (day - start + 1) / Math.max(1, end - start + 1)))
}

export function buildCycleCockpitInsight(state: CycleState | null): CycleCockpitInsight | null {
  if (!state?.hasActiveCycle || !state.currentPhase || !state.currentCycleDay) return null

  return {
    ...PHASE_INSIGHTS[state.currentPhase],
    cycleDay: state.currentCycleDay,
    cycleLength: state.avgCycleLengthDays,
    phaseProgress: phaseProgress(state),
    cycleProgress: Math.max(0, Math.min(1, state.currentCycleDay / state.avgCycleLengthDays)),
    regularity: state.regularity,
    isEstimated: state.confidence !== 'calibrated' || state.regularity === 'irregular',
    isPeriodStartExpected: state.isPeriodStartExpected,
  }
}
