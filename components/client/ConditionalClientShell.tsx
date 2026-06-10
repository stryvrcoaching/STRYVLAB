'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import OnboardingTour from './OnboardingTour'
import { TourProvider } from './TourContext'

// Routes that are NOT part of the authenticated client shell
// (login, set-password, auth callbacks, error pages).
// These render without BottomNav and without the pb-20 bottom offset.
const AUTH_PATHS = [
  '/client/login',
  '/client/set-password',
  '/client/auth',
  '/client/access',
  '/client/onboarding',
  '/client/checkin/onboarding',
  '/client/acces-suspendu',
  '/client/programme/session/',
  '/client/nutrition/log',
]

interface Props {
  children: React.ReactNode
}

export default function ConditionalClientShell({ children }: Props) {
  const pathname = usePathname()
  const isAuthPath = AUTH_PATHS.some(p => pathname.startsWith(p))

  if (isAuthPath) {
    // Auth pages manage their own layout — no shell, no bottom nav.
    return <>{children}</>
  }

  return (
    <TourProvider>
      {/* pb = BottomNav h-16 (64) + safe-area min 24px + 16px breathing room = ~104px */}
      <div className="pb-24" style={{ paddingBottom: 'max(104px, calc(64px + env(safe-area-inset-bottom) + 16px))' }}>
        {children}
      </div>
      <BottomNav />
      <OnboardingTour />
    </TourProvider>
  )
}
