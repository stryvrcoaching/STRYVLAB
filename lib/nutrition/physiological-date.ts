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

/**
 * Helper to compute timezone offset in milliseconds for a specific date
 */
function getTimezoneOffsetMs(tz: string, date: Date): number {
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(date);

  const utcParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).formatToParts(date);

  const getVal = (parts: Intl.DateTimeFormatPart[], type: string) => 
    Number(parts.find(p => p.type === type)?.value ?? '0');

  const tzYear = getVal(tzParts, 'year');
  const tzMonth = getVal(tzParts, 'month') - 1;
  const tzDay = getVal(tzParts, 'day');
  let tzHour = getVal(tzParts, 'hour');
  if (tzHour === 24) tzHour = 0;
  const tzMin = getVal(tzParts, 'minute');
  const tzSec = getVal(tzParts, 'second');

  const utcYear = getVal(utcParts, 'year');
  const utcMonth = getVal(utcParts, 'month') - 1;
  const utcDay = getVal(utcParts, 'day');
  let utcHour = getVal(utcParts, 'hour');
  if (utcHour === 24) utcHour = 0;
  const utcMin = getVal(utcParts, 'minute');
  const utcSec = getVal(utcParts, 'second');

  const tzTime = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMin, tzSec);
  const utcTime = Date.UTC(utcYear, utcMonth, utcDay, utcHour, utcMin, utcSec);

  return tzTime - utcTime;
}

/**
 * Constructs a UTC ISO string for a meal's logged_at time.
 * It uses the referenceTime's current local hour, minute, second, and millisecond,
 * and adjusts the calendar date so that the resulting physiological date matches
 * the target physiologicalDate under the given timezone.
 */
export function constructLoggedAt(
  physiologicalDate: string,
  timezone: string,
  referenceTime: Date = new Date()
): string {
  // 1. Get current hour/minute/second in the client's timezone
  const timeParts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).formatToParts(referenceTime);
  const currentHour = Number(timeParts.find(p => p.type === 'hour')?.value ?? '0');
  const currentMinute = Number(timeParts.find(p => p.type === 'minute')?.value ?? '0');
  const currentSecond = Number(timeParts.find(p => p.type === 'second')?.value ?? '0');

  // 2. If the current time is before the cutoff, the physiological date is the previous day.
  // So the calendar date of the log must be physiologicalDate + 1 day.
  let calDate = physiologicalDate;
  if (currentHour < PHYSIOLOGICAL_DAY_CUTOFF_HOUR) {
    const parts = physiologicalDate.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const nextDay = new Date(year, month, day + 1);
    const y = nextDay.getFullYear();
    const m = String(nextDay.getMonth() + 1).padStart(2, '0');
    const d = String(nextDay.getDate()).padStart(2, '0');
    calDate = `${y}-${m}-${d}`;
  }

  // 3. Construct the local date-time as UTC, then subtract target timezone offset.
  // We refine it in 2 steps to handle DST boundaries perfectly.
  const parts = calDate.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const tentativeUtc = Date.UTC(year, month, day, currentHour, currentMinute, currentSecond);
  const offset1 = getTimezoneOffsetMs(timezone, new Date(tentativeUtc));
  const candidateUtc = tentativeUtc - offset1;
  const offset2 = getTimezoneOffsetMs(timezone, new Date(candidateUtc));
  const finalUtc = tentativeUtc - offset2;

  return new Date(finalUtc).toISOString();
}


