/**
 * A rest timer is started only when the completed set prescribes a positive
 * duration. This applies identically to normal exercises and supersets.
 */
export function shouldStartPrescribedRest(restSec: number | null | undefined): boolean {
  return typeof restSec === 'number' && Number.isFinite(restSec) && restSec > 0
}

/** Objective-based default rest, in seconds, for new coach prescriptions. */
export function getDefaultRestSec(goal: string): number {
  switch ((goal ?? '').toLowerCase()) {
    case 'strength':
    case 'power':
      return 180
    case 'athletic':
      return 120
    case 'endurance':
    case 'fat_loss':
      return 45
    case 'recomp':
      return 75
    case 'maintenance':
    case 'hypertrophy':
    default:
      return 90
  }
}
