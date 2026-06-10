import type { Pattern } from './patterns.v1';

export interface PatternEvidence {
  [key: string]: any;
}

export interface DetectedPattern {
  pattern_id: string;
  severity: Pattern['severity'];
  title: string;
  evidence: PatternEvidence;
  recommendations: string[];
  do: string[];
  dont: string[];
}

export interface PatternInput {
  ipt_global: number;
  axes: Record<string, { normalized: number }>;
  derived?: Record<string, any>;
}

/**
 * V1.1 — règles lisibles, purement déterministes.
 * Ajoute tes patterns critiques ici (et bump version si changement).
 */
export function detectPatterns(input: PatternInput): DetectedPattern[] {
  const out: DetectedPattern[] = [];
  const a = input.axes;

  // exemples: seuils simples (à calibrer)
  if (a.sleep?.normalized !== undefined && a.sleep.normalized < 40) {
    out.push({
      pattern_id: 'sleep_low',
      severity: 'high',
      title: 'dette de sommeil',
      evidence: { sleep_score: a.sleep.normalized },
      recommendations: [
        'prioriser une fenêtre de sommeil stable 7 jours',
        'baisser la charge d’entraînement si possible (récupération)'
      ],
      do: ['heure de coucher fixe', 'lumière faible 60 min avant'],
      dont: ['caféine tardive', 'écrans intenses en fin de journée']
    });
  }

  if (a.stress?.normalized !== undefined && a.stress.normalized < 35) {
    out.push({
      pattern_id: 'stress_high',
      severity: 'critical',
      title: 'stress chronique dominant',
      evidence: { stress_score: a.stress.normalized },
      recommendations: [
        'réduire la friction du plan (2 habitudes max)',
        'mettre l’accent sur respiration / marche quotidienne'
      ],
      do: ['marcher 15–25 min/jour', 'respiration 5 min x2/jour'],
      dont: ['augmenter volume training', 'restrictions agressives']
    });
  }

  if (input.ipt_global < 35) {
    out.push({
      pattern_id: 'ipt_low_global',
      severity: 'high',
      title: 'potentiel de transformation faible (phase stabilisation)',
      evidence: { ipt_global: input.ipt_global },
      recommendations: [
        'démarrer par un plan 7 jours ultra-simple',
        'viser l’adhérence avant l’optimisation'
      ],
      do: ['1 action nutrition + 1 action sommeil'],
      dont: ['changements multiples simultanés']
    });
  }

  return out;
}
