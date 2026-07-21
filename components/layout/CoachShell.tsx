"use client";

import { ReactNode, memo, useEffect, useState, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { TopBarProvider, useTopBarContent } from "@/components/layout/TopBarContext";
import { DockProvider } from "@/components/layout/DockContext";
import { NavDock } from "@/components/layout/NavDock";
import GlobalOrganizerButton from "@/components/layout/GlobalOrganizerButton";
import NotificationBell from "@/components/layout/NotificationBell";
import ClientPulseDashboard from "@/components/layout/ClientPulseDashboard";
import ActivationContinueBar from "@/components/dashboard/ActivationContinueBar";
import CoachLearningContinueBar from "@/components/dashboard/CoachLearningContinueBar";
import CoachPlanBadge from "@/components/coach/CoachPlanBadge";
import { createClient } from "@/utils/supabase/client";

// ─── FULLSCREEN PAGE CONTEXT ──────────────────────────────────────────────────
// Pages that need h-screen layout (e.g. program builder) call useSetFullscreenPage(true)

const FullscreenPageContext = createContext<{
  fullscreen: boolean
  setFullscreen: (v: boolean) => void
}>({ fullscreen: false, setFullscreen: () => {} })

export function useSetFullscreenPage(active: boolean) {
  const { setFullscreen } = useContext(FullscreenPageContext)
  useEffect(() => {
    setFullscreen(active)
    return () => setFullscreen(false)
  }, [active, setFullscreen])
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function TopBar({ firstName }: { firstName: string | null }) {
  const { left, right } = useTopBarContent();

  return (
    <header className="fixed top-4 right-4 left-4 z-50 flex h-14 items-center justify-between gap-4 rounded-2xl border-[0.3px] border-white/[0.06] bg-[#121212] px-5">
      <div className="flex-1 min-w-0">
        {left ?? (
          <div className="flex flex-col leading-tight">
            <p className="text-[9px] font-medium text-white/30 uppercase tracking-[0.14em]">Espace Coach</p>
            <p className="text-[13px] font-semibold text-white">{firstName ?? 'Coach'}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        <CoachPlanBadge />
        <ClientPulseDashboard />
        <GlobalOrganizerButton />
        <NotificationBell />
      </div>
    </header>
  );
}

// ─── CHILDREN WRAPPER ─────────────────────────────────────────────────────────
// Isolated so it does NOT subscribe to TopBarReadContext — only TopBar does.
// This prevents setTopBar calls from re-rendering the page subtree.

const PageContent = memo(function PageContent({ children, hideDock }: { children: ReactNode; hideDock: boolean }) {
  const { fullscreen } = useContext(FullscreenPageContext)
  // IMPORTANT: always render the same two-div depth regardless of fullscreen state.
  // Changing tree depth causes React to unmount+remount children, which triggers
  // useSetFullscreenPage cleanup (setFullscreen(false)) then re-mount effect
  // (setFullscreen(true)) in an infinite loop.
  return (
    <div className={fullscreen
      ? "h-screen bg-[#121212] pt-[88px] overflow-hidden flex flex-col"
      : `min-h-screen bg-[#121212] pt-[88px] ${hideDock ? 'pb-12' : 'pb-[138px]'}`
    }>
      <div className={fullscreen ? "flex-1 min-h-0 h-full" : undefined}>
        {children}
      </div>
    </div>
  );
});

// ─── SHELL INNER ─────────────────────────────────────────────────────────────

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [firstName, setFirstName] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const hideDock = pathname === '/dashboard/overview'
    || pathname === '/dashboard/business'
    || pathname === '/dashboard/product-feedback'
    || pathname === '/dashboard/stryv-connect'
    || pathname === '/dashboard/security'
    || pathname === '/dashboard/ai-nutrition-ops'

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const name = user?.user_metadata?.first_name ?? null
      setFirstName(name)
    })
  }, [])

  return (
    <FullscreenPageContext.Provider value={{ fullscreen, setFullscreen }}>
      <div className={fullscreen ? 'h-screen overflow-hidden bg-[#121212]' : 'min-h-screen bg-[#121212]'}>
        <TopBar firstName={firstName} />
        {/*
          Keeps scrolled content from ever reading above the floating top bar.
          The fade becomes fully opaque around the bar's midpoint (44px), while
          starting softly just below its lower edge (72px).
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-28"
          style={{
            background:
              'linear-gradient(to bottom, #121212 0px, #121212 44px, rgba(18, 18, 18, 0.98) 58px, rgba(18, 18, 18, 0.84) 72px, rgba(18, 18, 18, 0) 112px)',
          }}
        />
        {/* pt = top-4(16) + h-14(56) + gap-4(16) = 88px | pb = bottom-6(24) + rowB h-14(56) + rowA h-9(36) + gap-1.5(6) + gap(16) = 138px */}
        <PageContent hideDock={hideDock}>{children}</PageContent>
        {!fullscreen && !hideDock && <NavDock />}
        {!fullscreen && <ActivationContinueBar />}
        {!fullscreen && <CoachLearningContinueBar />}
      </div>
    </FullscreenPageContext.Provider>
  );
}

// ─── SHELL (export public) ────────────────────────────────────────────────────

export default function CoachShell({ children }: { children: ReactNode }) {
  return (
    <TopBarProvider>
      <DockProvider>
        <ShellInner>{children}</ShellInner>
      </DockProvider>
    </TopBarProvider>
  );
}
