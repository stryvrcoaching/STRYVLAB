// tests/lib/morpho/parse.test.ts

import { describe, it, expect } from 'vitest';
import { parseMorphoResponses, estimateMuscleFromBiometrics } from '@/lib/morpho/parse';

describe('parseMorphoResponses', () => {
  it('extracts body_fat_pct from vision response', () => {
    const response = 'Client appears to be 18% body fat';
    const result = parseMorphoResponses([response]);
    expect(result.body_fat_pct).toBe(18);
  });

  it('extracts body_fat_pct with alternative phrasing', () => {
    const response = 'Body fat: 22%';
    const result = parseMorphoResponses([response]);
    expect(result.body_fat_pct).toBe(22);
  });

  it('extracts waist dimension', () => {
    const response = 'Waist: 78cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.waist_cm).toBe(78);
  });

  it('extracts hips dimension', () => {
    const response = 'Hips: 92cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.hips_cm).toBe(92);
  });

  it('extracts chest dimension', () => {
    const response = 'Chest: 98cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.chest_cm).toBe(98);
  });

  it('extracts arm dimensions left and right', () => {
    const response = 'Left arm: 32cm, Right arm: 32.5cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.arm_cm_l).toBe(32);
    expect(result.dimensions?.arm_cm_r).toBe(32.5);
  });

  it('extracts arm asymmetry', () => {
    const response = 'Arm difference: 1.2cm';
    const result = parseMorphoResponses([response]);
    expect(result.asymmetries?.arm_diff_cm).toBe(1.2);
  });

  it('extracts leg asymmetry', () => {
    const response = 'Leg difference: 0.8cm';
    const result = parseMorphoResponses([response]);
    expect(result.asymmetries?.leg_diff_cm).toBe(0.8);
  });

  it('extracts shoulder imbalance', () => {
    const response = 'Shoulder imbalance: 2.5cm';
    const result = parseMorphoResponses([response]);
    expect(result.asymmetries?.shoulder_imbalance_cm).toBe(2.5);
  });

  it('extracts hip imbalance', () => {
    const response = 'Hip difference: 1.1cm';
    const result = parseMorphoResponses([response]);
    expect(result.asymmetries?.hip_imbalance_cm).toBe(1.1);
  });

  it('extracts posture notes', () => {
    const response = 'Posture: Slight anterior pelvic tilt';
    const result = parseMorphoResponses([response]);
    expect(result.asymmetries?.posture_notes).toBe('Slight anterior pelvic tilt');
  });

  it('handles missing data gracefully', () => {
    const response = 'No measurable data available';
    const result = parseMorphoResponses([response]);
    expect(result.body_fat_pct).toBeUndefined();
    expect(result.dimensions?.waist_cm).toBeUndefined();
  });

  it('combines multiple vision responses', () => {
    const responses = ['Front photo: 18% body fat', 'Side photo: Waist 78cm, Shoulder imbalance: 2cm'];
    const result = parseMorphoResponses(responses);
    expect(result.body_fat_pct).toBe(18);
    expect(result.dimensions?.waist_cm).toBe(78);
    expect(result.asymmetries?.shoulder_imbalance_cm).toBe(2);
  });

  it('extracts decimal values', () => {
    const response = 'Body fat: 15.8%, Arm difference: 1.5cm';
    const result = parseMorphoResponses([response]);
    expect(result.body_fat_pct).toBe(15.8);
    expect(result.asymmetries?.arm_diff_cm).toBe(1.5);
  });

  it('extracts thigh dimensions', () => {
    const response = 'Left thigh: 58cm, Right thigh: 59cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.thigh_cm_l).toBe(58);
    expect(result.dimensions?.thigh_cm_r).toBe(59);
  });

  it('extracts calf dimensions', () => {
    const response = 'Left calf: 38cm, Right calf: 38.5cm';
    const result = parseMorphoResponses([response]);
    expect(result.dimensions?.calf_cm_l).toBe(38);
    expect(result.dimensions?.calf_cm_r).toBe(38.5);
  });
});

describe('estimateMuscleFromBiometrics', () => {
  it('estimates muscle mass from weight and body fat', () => {
    const muscle = estimateMuscleFromBiometrics(80, 18);
    // 80 × (1 - 0.18) × 0.85 = 80 × 0.82 × 0.85 = 55.76 kg
    expect(muscle).toBeCloseTo(55.76, 1);
  });

  it('handles low body fat percentage', () => {
    const muscle = estimateMuscleFromBiometrics(75, 8);
    // 75 × (1 - 0.08) × 0.85 = 75 × 0.92 × 0.85 = 58.65 kg
    expect(muscle).toBeCloseTo(58.65, 1);
  });

  it('handles high body fat percentage', () => {
    const muscle = estimateMuscleFromBiometrics(90, 28);
    // 90 × (1 - 0.28) × 0.85 = 90 × 0.72 × 0.85 = 55.08 kg
    expect(muscle).toBeCloseTo(55.08, 1);
  });

  it('returns 0 for zero weight', () => {
    const muscle = estimateMuscleFromBiometrics(0, 15);
    expect(muscle).toBe(0);
  });

  it('returns 0 for negative weight', () => {
    const muscle = estimateMuscleFromBiometrics(-10, 15);
    expect(muscle).toBe(0);
  });

  it('returns 0 for negative body fat', () => {
    const muscle = estimateMuscleFromBiometrics(80, -5);
    expect(muscle).toBe(0);
  });

  it('returns 0 for body fat >100%', () => {
    const muscle = estimateMuscleFromBiometrics(80, 105);
    expect(muscle).toBe(0);
  });

  it('scales linearly with weight', () => {
    const muscle50 = estimateMuscleFromBiometrics(50, 20);
    const muscle100 = estimateMuscleFromBiometrics(100, 20);
    expect(muscle100).toBeCloseTo(muscle50 * 2, 1);
  });
});
