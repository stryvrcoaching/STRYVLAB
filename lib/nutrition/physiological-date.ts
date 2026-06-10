import type { MealType } from "@/lib/nutrition/food-items"

export const PHYSIOLOGICAL_DAY_CUTOFF_HOUR = 5
export const PHYSIOLOGICAL_DAY_CUTOFF_MINUTE = 0

// Removed hardcoded offset; now timezone-aware.

/**
 * Formats a Date object into YYYY-MM-DD string in the given timezone.
 * If no timezone is provided, UTC is used.
 */
function formatLocalDate(date: Date, tz?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz ?? 'UTC',
  }).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value ?? '';
  const month = parts.find(p => p.type === 'month')?.value ?? '';
  const day = parts.find(p => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function computePhysiologicalDate(input: Date, tz?: string): string {
  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date passed to computePhysiologicalDate");
  }

  // Determine hour in the target timezone (default UTC)
  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: tz ?? 'UTC',
  }).formatToParts(date);
  const hour = Number(timeParts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(timeParts.find(p => p.type === 'minute')?.value ?? '0');
  const minutesSinceMidnight = hour * 60 + minute;
  const cutoffMinutes = PHYSIOLOGICAL_DAY_CUTOFF_HOUR * 60 + PHYSIOLOGICAL_DAY_CUTOFF_MINUTE;

  // If before the physiological day cutoff, consider previous day.
  if (minutesSinceMidnight < cutoffMinutes) {
    date.setDate(date.getDate() - 1);
  }

  return formatLocalDate(date, tz);
}

export function inferMealType(input: Date, tz?: string): MealType {
  // Determine hour in the target timezone (default UTC)
  const hourStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz ?? 'UTC',
  }).format(input);
  const hour = Number(hourStr);

  if (hour < 11) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 22) return "dinner";
  return "snack";
}
