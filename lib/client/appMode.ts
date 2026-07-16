export type ClientInstallPlatform = 'ios' | 'android' | 'other'
export type ClientEntryExperience = 'install-guide' | 'onboarding' | 'none'

export type ClientAppEnvironment = {
  displayModeStandalone: boolean
  navigatorStandalone: boolean
  userAgent: string
}

export function isInstalledClientAppFromEnvironment(environment: ClientAppEnvironment): boolean {
  return Boolean(
    environment.displayModeStandalone
    || environment.navigatorStandalone
    || /STRYV-(?:iOS|Android)/i.test(environment.userAgent),
  )
}

export function isInstalledClientApp(): boolean {
  if (typeof window === 'undefined') return false

  return isInstalledClientAppFromEnvironment({
    displayModeStandalone: Boolean(window.matchMedia?.('(display-mode: standalone)').matches),
    navigatorStandalone: Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
    userAgent: window.navigator.userAgent,
  })
}

export function getClientInstallPlatform(userAgent?: string): ClientInstallPlatform {
  const value = userAgent ?? (typeof window !== 'undefined' ? window.navigator.userAgent : '')
  if (/iPad|iPhone|iPod/i.test(value)) return 'ios'
  if (/Android/i.test(value)) return 'android'
  return 'other'
}

export function resolveClientEntryExperience(input: {
  installed: boolean
  onboardingDone: boolean
  installGuideSeen: boolean
}): ClientEntryExperience {
  if (!input.installed) return input.installGuideSeen ? 'none' : 'install-guide'
  return input.onboardingDone ? 'none' : 'onboarding'
}
