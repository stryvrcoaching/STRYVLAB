/**
 * 1RM Formulas — Scientifically validated
 * Sources: Brzycki 1993, Epley 1985, Lombardi 1989
 */

export type OneRMFormula = 'average' | 'brzycki' | 'epley' | 'lombardi';

export interface OneRMInput {
  weight: number; // kg or lbs
  reps: number;
}

export interface OneRMResult {
  oneRM: number;
  brzycki: number;
  epley: number;
  lombardi: number;
  confidence: '±2.5%' | '±5%' | '±10-15%' | '±15%+';
  warnings: string[];
}

// Pure formula functions
export const brzycki = (w: number, r: number): number =>
  w / (1.0278 - 0.0278 * r);

export const epley = (w: number, r: number): number =>
  w * (1 + 0.0333 * r);

export const lombardi = (w: number, r: number): number =>
  w * Math.pow(r, 0.1);

export function calculateOneRM(input: OneRMInput, formula: OneRMFormula = 'average'): OneRMResult {
  const { weight: w, reps: r } = input;

  const brz = brzycki(w, r);
  const epl = epley(w, r);
  const lom = lombardi(w, r);
  const avg = (brz + epl + lom) / 3;

  const selectedRM =
    formula === 'average' ? avg :
    formula === 'epley' ? epl :
    formula === 'lombardi' ? lom :
    brz;

  const warnings: string[] = [];
  let confidence: OneRMResult['confidence'] = '±5%';

  if (r === 1) {
    warnings.push('1 répétition = 1RM réel (Mesure directe).');
    confidence = '±2.5%';
  }
  if (r >= 2 && r <= 8) {
    warnings.push('✓ Zone optimale de précision (±2.5%).');
    confidence = '±2.5%';
  }
  if (r > 10) {
    warnings.push('Précision réduite au-delà de 10 reps (±10-15%).');
    confidence = '±10-15%';
  }
  if (r > 15) {
    warnings.push('Estimation très imprécise (>15 reps).');
    confidence = '±15%+';
  }

  return {
    oneRM: selectedRM,
    brzycki: brz,
    epley: epl,
    lombardi: lom,
    confidence,
    warnings,
  };
}

export const TRAINING_ZONES = (oneRM: number) => [
  { num: 1, intensity: '95-100%', weight: oneRM,         reps: '1 rep',     objective: 'Force Max',   desc: 'Neural' },
  { num: 2, intensity: '85-90%',  weight: oneRM * 0.875, reps: '3-5 reps',  objective: 'Force Pure',  desc: 'Myofibrillaire' },
  { num: 3, intensity: '80-85%',  weight: oneRM * 0.825, reps: '5-8 reps',  objective: 'Hypertrophie', desc: 'Tension Méca' },
  { num: 4, intensity: '70-80%',  weight: oneRM * 0.75,  reps: '8-12 reps', objective: 'Volume',       desc: 'Métabolique' },
  { num: 5, intensity: '60-70%',  weight: oneRM * 0.65,  reps: '12-15+ reps', objective: 'Endurance', desc: 'Capilarisation' },
  { num: 6, intensity: '<60%',    weight: oneRM * 0.50,  reps: '20+ reps',  objective: 'Technique',    desc: 'Apprentissage' },
];
