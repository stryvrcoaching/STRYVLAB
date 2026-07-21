/**
 * Client-side session for coach activation flow continuity.
 * Used to show "continue onboarding" when navigating away from the hub.
 */

const ACTIVE_KEY = 'stryv_coach_activation_active'
const STEP_KEY = 'stryv_coach_activation_step'
const STEP_LABEL_KEY = 'stryv_coach_activation_step_label'
const COMPLETED_FLASH_KEY = 'stryv_coach_activation_completed_flash'

export function markActivationNavigation(stepId: string, stepLabel?: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ACTIVE_KEY, '1')
    sessionStorage.setItem(STEP_KEY, stepId)
    if (stepLabel) sessionStorage.setItem(STEP_LABEL_KEY, stepLabel)
  } catch {
    /* private mode */
  }
}

export function clearActivationNavigation() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(ACTIVE_KEY)
    sessionStorage.removeItem(STEP_KEY)
    sessionStorage.removeItem(STEP_LABEL_KEY)
  } catch {
    /* private mode */
  }
}

export function isActivationNavigationActive(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

export function getActivationStepId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STEP_KEY)
  } catch {
    return null
  }
}

export function getActivationStepLabel(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STEP_LABEL_KEY)
  } catch {
    return null
  }
}

/** Set when user returns to dashboard after working on a step — show success flash. */
export function markActivationCompletedFlash(stepLabel: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(COMPLETED_FLASH_KEY, stepLabel)
  } catch {
    /* private mode */
  }
}

export function consumeActivationCompletedFlash(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = sessionStorage.getItem(COMPLETED_FLASH_KEY)
    if (v) sessionStorage.removeItem(COMPLETED_FLASH_KEY)
    return v
  } catch {
    return null
  }
}

/** Sync from URL ?from=activation&step=… (deep links / refresh). */
export function syncActivationFromUrl() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') === 'activation') {
      const step = params.get('step')
      sessionStorage.setItem(ACTIVE_KEY, '1')
      if (step) sessionStorage.setItem(STEP_KEY, step)
    }
  } catch {
    /* private mode */
  }
}
