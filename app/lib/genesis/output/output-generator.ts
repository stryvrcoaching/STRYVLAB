import type { Mode, GenesisOutput } from './output.types';

export function generateOutput(params: {
  mode: Mode;
  scoring_version: string;
  ipt_global: number;
  axes: Record<string, { normalized: number }>;
  patterns: any[];
}): GenesisOutput {
  const { mode, scoring_version, ipt_global, axes, patterns } = params;

  if (mode === 'ipt') {
    const constraints = patterns.slice(0, 3).map((p: any) => p.title || p.pattern_id);
    const levers = ['stabiliser sommeil', 'simplifier nutrition', 'marche quotidienne'].slice(0, 3);

    return {
      mode,
      scoring_version,
      ipt_global,
      axes,
      patterns,
      constraints,
      levers,
      plan_7_days: Array.from({ length: 7 }).map((_, i) => ({
        day: i + 1,
        actions: [
          '1 repas structuré riche en protéines',
          '10–20 min de marche',
          'heure de coucher régulière'
        ]
      })),
    };
  }

  if (mode === 'gplus') {
    return {
      mode,
      scoring_version,
      ipt_global,
      axes,
      patterns,
      nutrition_timing: [
        'protéines réparties sur la journée',
        'glucides placés autour de l’activité'
      ],
      parameters: {
        focus: 'optimisation',
        note: 'à enrichir avec derived variables / macros'
      }
    };
  }

  // omni
  return {
    mode,
    scoring_version,
    ipt_global,
    axes,
    patterns,
    roadmap: [
      { phase: 'cycle 1 (2 semaines)', focus: ['adhérence', 'sommeil'], checkpoints: ['stabilité routine'] },
      { phase: 'cycle 2 (4 semaines)', focus: ['nutrition', 'training'], checkpoints: ['progression mesurable'] },
      { phase: 'cycle 3 (4 semaines)', focus: ['performance', 'récupération'], checkpoints: ['consolidation'] },
    ]
  };
}
