'use client'

import CoachShell from '@/components/layout/CoachShell'
import { usePathname } from 'next/navigation'
import { InternalDashboardNav } from '@/components/dashboard/InternalDashboardNav'
import { HelpModeProvider } from '@/components/dashboard/help-mode'

const INTERNAL_DASHBOARD_PATHS = new Set([
  '/dashboard/overview',
  '/dashboard/business',
  '/dashboard/product-feedback',
  '/dashboard/stryv-connect',
  '/dashboard/security',
  '/dashboard/ai-nutrition-ops',
])

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showInternalNav = pathname ? INTERNAL_DASHBOARD_PATHS.has(pathname) : false

  return (
    <CoachShell>
      <HelpModeProvider>
        {showInternalNav ? (
          <div className="sticky top-[72px] z-40 border-b border-white/[0.04] bg-[#121212]/95 px-3 py-3 backdrop-blur-xl sm:px-6">
            <div className="mx-auto max-w-[1520px]">
              <InternalDashboardNav />
            </div>
          </div>
        ) : null}
        <div className="min-w-0 overflow-x-clip [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:max-w-full">
          {children}
        </div>
      </HelpModeProvider>
    </CoachShell>
  )
}
