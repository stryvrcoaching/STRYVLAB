import { normalizeAxisScore } from './normalizer';
import { AXIS_WEIGHTS, SCORING_VERSION, type Axis } from './weights';

export type Direction = 'positive' | 'negative' | 'neutral';


export interface AnswerMap {
  [question_id: string]: number | boolean | string | null | undefined;
}

export interface MappingImpact {
  axis: Axis;
  weight: number;     // 0..1
  direction: Direction;
}

export interface MappingQuestion {
  question_id: string;
  impacts: MappingImpact[];
}

export interface MappingFile {
  scoring_version: string;
  questions: MappingQuestion[];
}

export interface AxisScore {
  raw: number;
  normalized: number; // 0–100
  weight: number;
}

export interface ScoringResult {
  scoring_version: string;
  axes: Record<Axis, AxisScore>;
  ipt_global: number;
}

/**
 * Convertit une réponse (number/bool/string) en score numérique.
 * V1.1: bool -> 0/10 ; string -> NaN (à mapper explicitement si besoin)
 */
function coerceAnswer(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 10 : 0;
  return null;
}

export function computeIPTScore(answers: AnswerMap, mapping: MappingFile): ScoringResult {
  const axesList: Axis[] = ['sleep','nutrition','stress','training','recovery','adherence'];

  const rawAxes: Record<Axis, number> = {
    sleep: 0, nutrition: 0, stress: 0, training: 0, recovery: 0, adherence: 0
  };

  for (const q of mapping.questions) {
    const v = coerceAnswer(answers[q.question_id]);
    if (v === null) continue;

    for (const imp of q.impacts) {
      const signed =
        imp.direction === 'negative' ? -v :
        imp.direction === 'positive' ? v :
        v * 0.0; // neutral => n’impacte pas le raw (évite bruit)
      rawAxes[imp.axis] += signed * imp.weight;
    }
  }

  const axes: Record<Axis, AxisScore> = {} as any;
  let weightedSum = 0;
  let weightTotal = 0;

  for (const axis of axesList) {
    const normalized = normalizeAxisScore(axis, rawAxes[axis]);
    axes[axis] = { raw: rawAxes[axis], normalized, weight: AXIS_WEIGHTS[axis] };
    weightedSum += normalized * AXIS_WEIGHTS[axis];
    weightTotal += AXIS_WEIGHTS[axis];
  }

  const ipt_global = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  return { scoring_version: SCORING_VERSION, axes, ipt_global };
}
