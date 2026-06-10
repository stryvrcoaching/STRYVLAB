// lib/coach/phaseEngine/rhr.ts
/**
 * Calculate RHR delta statistics based on check‑in data.
 * Uses a strict 3‑day acute window (the three most recent valid rhr_morning values)
 * and a 21‑day baseline (the 21 days preceding the acute window).
 * Returns the current RHR, baseline RHR, deviation percentage and overload flag (>8% elevation).
 */
export function calculateRhrDelta(
  checkins: { date: string; rhr_morning?: number | null }[],
  anchorDate?: string,
): {
  currentRhr: number | null;
  baselineRhr: number | null;
  deviationPercentage: number | null;
  isCnsOverloaded: boolean;
} {
  const OVERLOAD_THRESHOLD = 8; // percent
  const targetDate = anchorDate ? anchorDate : new Date().toISOString().slice(0, 10);

  // Filter valid RHR entries up to the anchor date
  const valid = checkins
    .filter(c => c.rhr_morning != null && c.rhr_morning > 0 && c.date <= targetDate)
    .sort((a, b) => b.date.localeCompare(a.date)); // newest first

  if (valid.length < 3) {
    return { currentRhr: null, baselineRhr: null, deviationPercentage: null, isCnsOverloaded: false };
  }

  // Acute window: 3 most recent entries
  const acute = valid.slice(0, 3);
  const acuteAvg = acute.reduce((sum, r) => sum + (r.rhr_morning as number), 0) / acute.length;

  // Baseline: 21 entries preceding the acute window
  const baselineCandidates = valid.slice(3, 24); // up to 21 entries
  if (baselineCandidates.length === 0) {
    return { currentRhr: acuteAvg, baselineRhr: null, deviationPercentage: null, isCnsOverloaded: false };
  }
  const baselineAvg = baselineCandidates.reduce((sum, r) => sum + (r.rhr_morning as number), 0) / baselineCandidates.length;

  const deviation = baselineAvg === 0 ? null : ((acuteAvg - baselineAvg) / baselineAvg) * 100;
  const overloaded = deviation != null && deviation > OVERLOAD_THRESHOLD;

  return {
    currentRhr: Math.round(acuteAvg * 10) / 10,
    baselineRhr: Math.round(baselineAvg * 10) / 10,
    deviationPercentage: deviation != null ? Math.round(deviation * 10) / 10 : null,
    isCnsOverloaded: overloaded,
  };
}
