export const SCORING_VERSION = 'v1.1.0';

export type Axis = 'sleep'|'nutrition'|'stress'|'training'|'recovery'|'adherence';

/**
 * Poids initiaux (V1 verrouillée) — issus de la spec technique.
 * Ajustements futurs -> bump SCORING_VERSION (v1.1.x, v1.2.x…)
 */
export const AXIS_WEIGHTS: Record<Axis, number> = {
  sleep: 0.18,
  nutrition: 0.16,
  stress: 0.20,
  training: 0.15,
  recovery: 0.16,
  adherence: 0.15,
};
