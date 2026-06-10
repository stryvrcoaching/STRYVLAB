// tests/lib/morpho/adjustments.test.ts

import { describe, it, expect } from 'vitest';
import {
  calculateStimulusAdjustments,
  applyMorphoAdjustment,
  MOVEMENT_PATTERNS,
} from '@/lib/morpho/adjustments';

describe('calculateStimulusAdjustments', () => {
  it('returns 1.0 for all patterns when no asymmetry', () => {
    const morpho = {};
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    for (const pattern of MOVEMENT_PATTERNS) {
      expect(adjustments[pattern]).toBe(1.0);
    }
  });

  it('returns 1.0 when asymmetry is exactly 2cm', () => {
    const morpho = {
      asymmetries: { arm_diff_cm: 2 },
    };
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // Threshold is >2, so 2cm exactly should not trigger boost
    expect(adjustments['unilateral_push']).toBe(1.0);
    expect(adjustments['unilateral_pull']).toBe(1.0);
  });

  it('boosts unilateral patterns with arm asymmetry >2cm', () => {
    const morpho = {
      asymmetries: { arm_diff_cm: 2.5 },
    };
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    expect(adjustments['unilateral_push']).toBe(1.15);
    expect(adjustments['unilateral_pull']).toBe(1.15);
    expect(adjustments['horizontal_push']).toBe(1.0);
  });

  it('adjusts horizontal patterns with shoulder imbalance >2cm', () => {
    const morpho = {
      asymmetries: { shoulder_imbalance_cm: 2.5 },
    };
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    expect(adjustments['horizontal_push']).toBe(0.9);
    expect(adjustments['horizontal_pull']).toBe(1.1);
    expect(adjustments['vertical_push']).toBe(1.0);
  });

  it('boosts pull patterns with long arms (ratio >0.40)', () => {
    const morpho = {
      dimensions: { arm_cm_l: 75, arm_cm_r: 75 },
    };
    const client = { height_cm: 180 }; // arm ratio: 75/180 = 0.417
    const adjustments = calculateStimulusAdjustments(morpho, client);

    expect(adjustments['vertical_pull']).toBeGreaterThanOrEqual(1.12);
    expect(adjustments['horizontal_pull']).toBeGreaterThanOrEqual(1.05);
  });

  it('does not boost pull patterns with arm ratio exactly 0.40', () => {
    const morpho = {
      dimensions: { arm_cm_l: 72, arm_cm_r: 72 },
    };
    const client = { height_cm: 180 }; // arm ratio: 72/180 = 0.40
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // Threshold is >0.40, so 0.40 exactly should not trigger boost
    expect(adjustments['vertical_pull']).toBe(1.0);
    expect(adjustments['horizontal_pull']).toBe(1.0);
  });

  it('boosts push patterns with short arms (ratio <0.36)', () => {
    const morpho = {
      dimensions: { arm_cm_l: 63, arm_cm_r: 63 },
    };
    const client = { height_cm: 180 }; // arm ratio: 63/180 = 0.35
    const adjustments = calculateStimulusAdjustments(morpho, client);

    expect(adjustments['horizontal_push']).toBeGreaterThanOrEqual(1.1);
    expect(adjustments['vertical_push']).toBeGreaterThanOrEqual(1.08);
  });

  it('does not boost push patterns with arm ratio exactly 0.36', () => {
    const morpho = {
      dimensions: { arm_cm_l: 64.8, arm_cm_r: 64.8 },
    };
    const client = { height_cm: 180 }; // arm ratio: 64.8/180 = 0.36
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // Threshold is <0.36, so 0.36 exactly should not trigger boost
    expect(adjustments['horizontal_push']).toBe(1.0);
    expect(adjustments['vertical_push']).toBe(1.0);
  });

  it('handles missing height gracefully', () => {
    const morpho = {
      dimensions: { arm_cm_l: 75, arm_cm_r: 75 },
    };
    const client = {}; // no height_cm
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // Should not crash; all patterns remain at 1.0
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(adjustments[pattern]).toBeGreaterThanOrEqual(0.8);
      expect(adjustments[pattern]).toBeLessThanOrEqual(1.2);
    }
  });

  it('handles zero height gracefully', () => {
    const morpho = {
      dimensions: { arm_cm_l: 75, arm_cm_r: 75 },
    };
    const client = { height_cm: 0 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // Should not crash; all patterns remain at 1.0
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(adjustments[pattern]).toBe(1.0);
    }
  });

  it('clamps adjustments to reasonable range [0.8, 1.2]', () => {
    const morpho = {
      asymmetries: { arm_diff_cm: 10, shoulder_imbalance_cm: 10 },
      dimensions: { arm_cm_l: 100, arm_cm_r: 100 },
    };
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    for (const pattern of MOVEMENT_PATTERNS) {
      expect(adjustments[pattern]).toBeGreaterThanOrEqual(0.8);
      expect(adjustments[pattern]).toBeLessThanOrEqual(1.2);
    }
  });

  it('uses maximum when multiple rules apply to same pattern', () => {
    const morpho = {
      dimensions: { arm_cm_l: 75, arm_cm_r: 75 }, // long arms, will boost pull
      asymmetries: { arm_diff_cm: 2.5 }, // will also boost unilateral_pull
    };
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    // vertical_pull gets boosted by long arms rule
    expect(adjustments['vertical_pull']).toBeGreaterThanOrEqual(1.12);
    // unilateral_pull gets boosted by arm asymmetry rule (1.15)
    expect(adjustments['unilateral_pull']).toBe(1.15);
  });

  it('returns all movement patterns in output', () => {
    const morpho = {};
    const client = { height_cm: 180 };
    const adjustments = calculateStimulusAdjustments(morpho, client);

    for (const pattern of MOVEMENT_PATTERNS) {
      expect(adjustments).toHaveProperty(pattern);
    }
  });
});

describe('applyMorphoAdjustment', () => {
  it('multiplies base coefficient by adjustment coefficient', () => {
    const adjusted = applyMorphoAdjustment(0.75, 1.15);
    // 0.75 × 1.15 = 0.8625
    expect(adjusted).toBeCloseTo(0.8625, 2);
  });

  it('clamps result to max 1.2', () => {
    const adjusted = applyMorphoAdjustment(1.0, 1.5); // would be 1.5, clamped to 1.2
    expect(adjusted).toBe(1.2);
  });

  it('clamps result to min 0.4', () => {
    const adjusted = applyMorphoAdjustment(0.3, 1.0); // would be 0.3, clamped to 0.4
    expect(adjusted).toBe(0.4);
  });

  it('handles zero coefficient gracefully', () => {
    const adjusted = applyMorphoAdjustment(0.5, 0);
    expect(adjusted).toBe(0.4); // 0.5 × 0 = 0, clamped to 0.4
  });

  it('handles typical adjustment range', () => {
    const low = applyMorphoAdjustment(0.6, 0.9); // 0.54, stays
    const high = applyMorphoAdjustment(0.8, 1.2); // 0.96, stays
    expect(low).toBeCloseTo(0.54, 2);
    expect(high).toBeCloseTo(0.96, 2);
  });
});
