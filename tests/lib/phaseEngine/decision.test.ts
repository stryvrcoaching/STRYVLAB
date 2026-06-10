import { describe, it, expect } from 'vitest';
import { computeOptimalPhase } from '../../../lib/coach/phaseEngine/decision';

describe('computeOptimalPhase', () => {
  it('should return AGGRESSIVE_CUT if required loss rate > 0.8% per week', () => {
    // Current weight: 100kg
    // Target weight: 90kg
    // Weeks remaining: 10 weeks
    // Required loss = 1kg / week = 1% of body weight / week > 0.8%
    const input = {
      currentWeight: 100,
      targetWeight: 90,
      weeksRemaining: 10,
      cnsOverload: false,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('AGGRESSIVE_CUT');
    expect(result.intensity).toBe('HIGH');
    expect(result.vetoTriggered).toBe(false);
  });

  it('should return DELOAD and trigger veto if cnsOverload is true, despite AGGRESSIVE_CUT goal', () => {
    const input = {
      currentWeight: 100,
      targetWeight: 90,
      weeksRemaining: 10,
      cnsOverload: true,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('DELOAD');
    expect(result.intensity).toBe('LOW');
    expect(result.vetoTriggered).toBe(true);
  });

  it('should return PEAK_WEEK if 1 week remaining', () => {
    const input = {
      currentWeight: 82,
      targetWeight: 80,
      weeksRemaining: 1,
      cnsOverload: false,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('PEAK_WEEK');
    expect(result.intensity).toBe('LOW');
    expect(result.vetoTriggered).toBe(false);
  });

  it('should prioritize DELOAD over PEAK_WEEK when cnsOverload is true', () => {
    const input = {
      currentWeight: 82,
      targetWeight: 80,
      weeksRemaining: 1,
      cnsOverload: true,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('DELOAD');
    expect(result.vetoTriggered).toBe(true);
  });

  it('should return MODERATE_CUT if loss rate <= 0.8% per week', () => {
    // Current weight: 100kg
    // Target weight: 95kg
    // Weeks remaining: 10 weeks
    // Required loss = 0.5kg / week = 0.5%
    const input = {
      currentWeight: 100,
      targetWeight: 95,
      weeksRemaining: 10,
      cnsOverload: false,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('MODERATE_CUT');
    expect(result.intensity).toBe('MODERATE');
    expect(result.vetoTriggered).toBe(false);
  });

  it('should return LEAN_BULK if weight delta < 0', () => {
    const input = {
      currentWeight: 80,
      targetWeight: 85,
      weeksRemaining: 12,
      cnsOverload: false,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('LEAN_BULK');
    expect(result.intensity).toBe('HIGH');
    expect(result.vetoTriggered).toBe(false);
  });

  it('should return MAINTENANCE as fallback if target weight equals current weight', () => {
    const input = {
      currentWeight: 80,
      targetWeight: 80,
      weeksRemaining: null,
      cnsOverload: false,
    };

    const result = computeOptimalPhase(input);

    expect(result.phase).toBe('MAINTENANCE');
    expect(result.intensity).toBe('MODERATE');
    expect(result.vetoTriggered).toBe(false);
  });
});
