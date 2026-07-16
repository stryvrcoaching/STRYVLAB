import { describe, expect, it } from 'vitest'
import {
  getClientInstallPlatform,
  isInstalledClientAppFromEnvironment,
  resolveClientEntryExperience,
} from '@/lib/client/appMode'

describe('client app mode', () => {
  it('keeps a regular mobile browser in install mode', () => {
    expect(isInstalledClientAppFromEnvironment({
      displayModeStandalone: false,
      navigatorStandalone: false,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    })).toBe(false)
  })

  it('recognises an installed iOS home-screen app', () => {
    expect(isInstalledClientAppFromEnvironment({
      displayModeStandalone: false,
      navigatorStandalone: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    })).toBe(true)
  })

  it('recognises native STRYV containers', () => {
    expect(isInstalledClientAppFromEnvironment({
      displayModeStandalone: false,
      navigatorStandalone: false,
      userAgent: 'Mozilla/5.0 STRYV-iOS',
    })).toBe(true)
  })

  it('resolves the relevant installation instructions', () => {
    expect(getClientInstallPlatform('Mozilla/5.0 (iPhone)')).toBe('ios')
    expect(getClientInstallPlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android')
    expect(getClientInstallPlatform('Mozilla/5.0 (Macintosh)')).toBe('other')
  })

  it('never launches the complete onboarding before installation', () => {
    expect(resolveClientEntryExperience({
      installed: false,
      onboardingDone: false,
      installGuideSeen: false,
    })).toBe('install-guide')
    expect(resolveClientEntryExperience({
      installed: false,
      onboardingDone: false,
      installGuideSeen: true,
    })).toBe('none')
  })

  it('launches the complete onboarding on first installed opening only', () => {
    expect(resolveClientEntryExperience({
      installed: true,
      onboardingDone: false,
      installGuideSeen: true,
    })).toBe('onboarding')
    expect(resolveClientEntryExperience({
      installed: true,
      onboardingDone: true,
      installGuideSeen: false,
    })).toBe('none')
  })
})
