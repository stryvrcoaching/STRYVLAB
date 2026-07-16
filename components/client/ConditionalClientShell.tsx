'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import OnboardingTour from './OnboardingTour'
import PushPermissionPrompt from './PushPermissionPrompt'
import { TourProvider } from './TourContext'

// Routes that are NOT part of the authenticated client shell
// (login, set-password, auth callbacks, full-screen task flows).
// These render without BottomNav and manage their own viewport behavior.
const SHELLLESS_PATHS = [
  '/client/login',
  '/client/set-password',
  '/client/auth',
  '/client/access',
  '/client/onboarding',
  '/client/checkin/onboarding',
  '/client/acces-suspendu',
  '/client/programme/session',
  '/client/flex-workout',
  '/client/nutrition/log',
  '/client/nutrition/compose',
]

interface Props {
  children: React.ReactNode
}

export default function ConditionalClientShell({ children }: Props) {
  const pathname = usePathname()
  const isAuthPath = SHELLLESS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const isDashboard = pathname === '/client'

  useEffect(() => {
    if (isAuthPath) return
    if (typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body

    const prevHtmlOverflow = html.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverflow = body.style.overflow
    const prevBodyOverscroll = body.style.overscrollBehavior
    const prevBodyHeight = body.style.height

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    body.style.height = '100%'

    return () => {
      html.style.overflow = prevHtmlOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overflow = prevBodyOverflow
      body.style.overscrollBehavior = prevBodyOverscroll
      body.style.height = prevBodyHeight
    }
  }, [isAuthPath])

  if (isAuthPath) {
    // Auth pages manage their own layout — no shell, no bottom nav.
    return <>{children}</>
  }

  return (
    <TourProvider>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden"
        style={{ background: 'var(--client-chrome-bg)' }}
      >
        <main
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          style={{
            paddingTop: isDashboard ? 0 : 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'calc(var(--client-bottom-nav-reserved) + 20px)',
            overflowAnchor: 'none',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'none',
          }}
        >
          {children}
        </main>
      </div>
      <BottomNav />
      <OnboardingTour />
      <PushPermissionPrompt />
    </TourProvider>
  )
}
