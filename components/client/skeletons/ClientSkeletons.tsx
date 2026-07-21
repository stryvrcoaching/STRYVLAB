import type { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

/**
 * Route-aware loading skeletons for the client PWA.
 * Never reuse the home "Bonjour" chrome outside `/client`.
 */

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-white/[0.06]", className)}
      aria-hidden
    />
  );
}

const PAGE_SHELL =
  "min-h-dvh bg-[var(--client-page-bg,#121212)] font-barlow overflow-x-hidden text-white";

/** Shared fixed top bar chrome matching ClientTopBar height token. */
function TopBarChrome({
  variant = "title",
}: {
  variant?: "title" | "tabs" | "metrics" | "session";
}) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-40 bg-[var(--client-chrome-bg,#0a0a0a)]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      aria-hidden
    >
      <div
        className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-2 px-3"
        style={{ height: "var(--client-top-bar-height, 56px)" }}
      >
        {variant === "tabs" ? (
          <>
            <div className="flex gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
              <Pulse className="h-8 w-16 rounded-lg" />
              <Pulse className="h-8 w-20 rounded-lg bg-white/[0.04]" />
              <Pulse className="h-8 w-16 rounded-lg bg-white/[0.04]" />
            </div>
            <Pulse className="h-8 w-8 rounded-xl bg-white/[0.05]" />
          </>
        ) : variant === "metrics" ? (
          <>
            <div className="flex gap-0.5 rounded-xl bg-white/[0.04] p-0.5">
              <Pulse className="h-8 w-[132px] rounded-lg" />
              <Pulse className="h-8 w-[92px] rounded-lg bg-white/[0.04]" />
              <Pulse className="h-8 w-[62px] rounded-lg bg-white/[0.04]" />
            </div>
            <Pulse className="h-9 w-9 shrink-0 rounded-xl bg-white/[0.05]" />
          </>
        ) : variant === "session" ? (
          <>
            <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
            <div className="flex flex-col items-center gap-1.5">
              <Pulse className="h-3 w-28 rounded-full bg-white/[0.08]" />
              <Pulse className="h-3.5 w-14 rounded-full bg-white/[0.05]" />
            </div>
            <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
          </>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Pulse className="h-9 w-9 shrink-0 rounded-xl bg-white/[0.05]" />
              <Pulse className="h-4 w-32 rounded-full bg-white/[0.08]" />
            </div>
            <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
          </>
        )}
      </div>
    </div>
  );
}

function Body({
  children,
  withTopBar = true,
  className,
}: {
  children: ReactNode;
  withTopBar?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col gap-3 px-4",
        withTopBar && "client-page-top",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Neutral fallback — used by root `/client/loading` so nested routes never flash home. */
export function ClientGenericSkeleton() {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement">
      <TopBarChrome variant="title" />
      <Body>
        <Pulse className="h-[88px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[120px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[100px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <div className="grid grid-cols-2 gap-3">
          <Pulse className="h-[120px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
          <Pulse className="h-[120px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        </div>
      </Body>
    </div>
  );
}

function DayPickerSkeleton({ selectedIndex = 3 }: { selectedIndex?: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: 7 }).map((_, index) => (
        <Pulse
          key={index}
          className={cn(
            "h-[70px] flex-1 rounded-[18px] bg-white/[0.035]",
            index === selectedIndex && "bg-white/[0.12]",
          )}
        />
      ))}
    </div>
  )
}

/** Séance — sélecteur hebdomadaire, séance du jour et raccourcis d'effort. */
export function ClientProgrammeSkeleton() {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement de la séance">
      <TopBarChrome variant="tabs" />
      <Body className="gap-4 px-5">
        <DayPickerSkeleton />
        <section className="rounded-[22px] border border-white/[0.06] bg-[#181818] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Pulse className="h-3.5 w-20 rounded-full bg-white/[0.08]" />
              <Pulse className="h-6 w-40 rounded-full bg-white/[0.1]" />
            </div>
            <Pulse className="h-10 w-10 rounded-xl bg-white/[0.06]" />
          </div>
          <Pulse className="mt-5 h-[132px] rounded-[18px] bg-white/[0.035]" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Pulse className="h-12 rounded-xl bg-white/[0.05]" />
            <Pulse className="h-12 rounded-xl bg-white/[0.05]" />
          </div>
        </section>
        <div className="grid grid-cols-3 gap-2">
          <Pulse className="h-[86px] rounded-[18px] bg-white/[0.04]" />
          <Pulse className="h-[86px] rounded-[18px] bg-white/[0.04]" />
          <Pulse className="h-[86px] rounded-[18px] bg-white/[0.04]" />
        </div>
      </Body>
    </div>
  )
}

function NutritionHeroSkeleton({ withHydration }: { withHydration: boolean }) {
  return (
    <section className="rounded-[22px] border border-white/[0.06] bg-[#181818] p-3">
      <div className="flex items-center justify-between gap-3">
        <Pulse className="h-3.5 w-24 rounded-full bg-white/[0.08]" />
        <Pulse className="h-3.5 w-16 rounded-full bg-white/[0.05]" />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Pulse className="h-1.5 rounded-full bg-white/[0.06]" />
            <Pulse className="h-3 w-8 rounded-full bg-white/[0.05]" />
          </div>
        ))}
      </div>
      {withHydration && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between gap-3">
            <Pulse className="h-3.5 w-20 rounded-full bg-white/[0.08]" />
            <Pulse className="h-7 w-16 rounded-lg bg-white/[0.05]" />
          </div>
          <Pulse className="mt-2.5 h-1.5 w-full rounded-full bg-white/[0.06]" />
        </div>
      )}
    </section>
  )
}

function NutritionRowsSkeleton({ planning = false }: { planning?: boolean }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <Pulse className="h-3.5 w-24 rounded-full bg-white/[0.08]" />
        <Pulse className="h-7 w-28 rounded-lg bg-white/[0.05]" />
      </div>
      {Array.from({ length: planning ? 2 : 3 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-[18px] border border-white/[0.06] bg-[#181818] p-3">
          <Pulse className="h-11 w-11 shrink-0 rounded-xl bg-white/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Pulse className="h-3.5 w-[62%] rounded-full bg-white/[0.1]" />
            <Pulse className="h-3 w-[42%] rounded-full bg-white/[0.05]" />
          </div>
          <Pulse className="h-7 w-7 shrink-0 rounded-lg bg-white/[0.05]" />
        </div>
      ))}
    </section>
  )
}

/** Nutrition suivi — jour, jauges compactes avec hydratation et repas loggés. */
export function ClientNutritionSkeleton() {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement du suivi nutritionnel">
      <TopBarChrome variant="tabs" />
      <Body>
        <DayPickerSkeleton />
        <NutritionHeroSkeleton withHydration />
        <Pulse className="h-[52px] rounded-[18px] border border-white/[0.06] bg-[#181818]" />
        <NutritionRowsSkeleton />
      </Body>
    </div>
  )
}

/** Nutrition plan — mêmes repères, uniquement les apports prévus et les repas planifiés. */
export function ClientNutritionPlanSkeleton() {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement du plan nutritionnel">
      <TopBarChrome variant="tabs" />
      <Body>
        <DayPickerSkeleton />
        <NutritionHeroSkeleton withHydration={false} />
        <NutritionRowsSkeleton planning />
      </Body>
    </div>
  )
}

/** Profil, bilans, RDV, paiement, docs — title (+ optional back). */
export function ClientTitlePageSkeleton({ showBack = false }: { showBack?: boolean }) {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement">
      <div
        className="fixed inset-x-0 top-0 z-40 bg-[var(--client-page-bg,#0a0a0a)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        aria-hidden
      >
        <div
          className="mx-auto flex w-full max-w-[520px] items-center gap-2 px-3"
          style={{ height: "var(--client-top-bar-height, 56px)" }}
        >
          {showBack ? <Pulse className="h-9 w-9 shrink-0 rounded-xl bg-white/[0.05]" /> : null}
          <Pulse className="h-4 w-36 rounded-full bg-white/[0.08]" />
          <div className="flex-1" />
          <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
        </div>
      </div>
      <Body>
        <Pulse className="h-[64px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[88px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[88px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[88px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[120px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
      </Body>
    </div>
  );
}

export function ClientMetricsContentSkeleton() {
  return (
    <div className="space-y-3" aria-live="polite" aria-busy="true">
      <section className="rounded-[22px] border border-white/[0.06] bg-[#181818] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Pulse className="h-3.5 w-24 rounded-full bg-white/[0.08]" />
            <Pulse className="h-7 w-32 rounded-full bg-white/[0.1]" />
          </div>
          <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
        </div>
        <Pulse className="mt-5 h-[116px] rounded-[18px] bg-white/[0.035]" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Pulse className="h-10 rounded-xl bg-white/[0.05]" />
          <Pulse className="h-10 rounded-xl bg-white/[0.05]" />
          <Pulse className="h-10 rounded-xl bg-white/[0.05]" />
        </div>
      </section>
      <section className="rounded-[22px] border border-white/[0.06] bg-[#181818] p-4">
        <div className="flex items-center justify-between gap-3">
          <Pulse className="h-3.5 w-28 rounded-full bg-white/[0.08]" />
          <Pulse className="h-3 w-14 rounded-full bg-white/[0.05]" />
        </div>
        <div className="mt-4 space-y-3">
          <Pulse className="h-3 w-full rounded-full bg-white/[0.05]" />
          <Pulse className="h-3 w-[82%] rounded-full bg-white/[0.05]" />
          <Pulse className="h-3 w-[64%] rounded-full bg-white/[0.05]" />
        </div>
      </section>
      <section className="rounded-[22px] border border-white/[0.06] bg-[#181818] p-4">
        <Pulse className="h-3.5 w-20 rounded-full bg-white/[0.08]" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Pulse className="h-[72px] rounded-[18px] bg-white/[0.04]" />
          <Pulse className="h-[72px] rounded-[18px] bg-white/[0.04]" />
        </div>
      </section>
    </div>
  )
}

/** Suivi — données corporelles, repères d'évolution et détails contextuels. */
export function ClientMetricsSkeleton() {
  return (
    <div className={PAGE_SHELL} role="status" aria-label="Chargement du suivi">
      <TopBarChrome variant="tabs" />
      <Body>
        <ClientMetricsContentSkeleton />
      </Body>
    </div>
  )
}

/**
 * Full-screen session / flex workout logger.
 * No bottom-nav chrome — shellless routes.
 */
export function ClientSessionSkeleton() {
  return (
    <div
      className="min-h-dvh bg-[var(--client-page-bg,#0a0a0a)] font-barlow overflow-x-hidden text-white"
      role="status"
      aria-label="Chargement de la séance"
    >
      <header
        className="fixed inset-x-0 top-0 z-40 bg-[var(--client-page-bg,#0a0a0a)]"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        aria-hidden
      >
        <div className="flex items-center justify-between px-4 py-3">
          <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
          <div className="flex flex-col items-center gap-1.5">
            <Pulse className="h-3 w-28 rounded-full bg-white/[0.1]" />
            <Pulse className="h-3.5 w-12 rounded-full bg-white/[0.06]" />
          </div>
          <Pulse className="h-9 w-14 rounded-xl bg-white/[0.05]" />
        </div>
      </header>

      <div
        className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 72px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
        }}
      >
        {/* Progress strip */}
        <Pulse className="h-2 w-full rounded-full bg-white/[0.06]" />

        {/* Exercise blocks */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[22px] border border-white/[0.04] bg-[#09090a] p-4"
          >
            <div className="mb-3 flex items-center gap-3">
              <Pulse className="h-12 w-12 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Pulse className="h-3.5 w-[70%] rounded-full bg-white/[0.1]" />
                <Pulse className="h-3 w-24 rounded-full bg-white/[0.05]" />
              </div>
            </div>
            <div className="space-y-2">
              <Pulse className="h-11 w-full rounded-xl bg-white/[0.04]" />
              <Pulse className="h-11 w-full rounded-xl bg-white/[0.04]" />
              <Pulse className="h-11 w-full rounded-xl bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA chrome */}
      <div
        className="fixed inset-x-0 bottom-0 border-t border-white/[0.06] bg-[var(--client-page-bg,#0a0a0a)] px-4 pt-3"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))" }}
        aria-hidden
      >
        <Pulse className="mx-auto h-12 max-w-lg rounded-2xl bg-white/[0.08]" />
      </div>
    </div>
  );
}

/** Nutrition log / compose — full-screen capture flow. */
export function ClientLogFlowSkeleton() {
  return (
    <div
      className="min-h-dvh bg-[var(--client-page-bg,#0a0a0a)] font-barlow overflow-x-hidden text-white"
      role="status"
      aria-label="Chargement"
    >
      <div
        className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 0px))" }}
        aria-hidden
      >
        <Pulse className="h-9 w-9 rounded-xl bg-white/[0.05]" />
        <Pulse className="h-4 w-28 rounded-full bg-white/[0.08]" />
        <Pulse className="h-9 w-16 rounded-xl bg-white/[0.05]" />
      </div>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 pt-4">
        <Pulse className="h-[200px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[56px] rounded-2xl border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[56px] rounded-2xl border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[56px] rounded-2xl border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[120px] rounded-[22px] border border-white/[0.04] bg-[#09090a]" />
      </div>
    </div>
  );
}

/**
 * Home dashboard only — greeting chrome while data streams.
 * Must NOT be used as the root `/client` loading for nested routes.
 */
export function ClientHomeSkeleton({
  firstName,
}: {
  firstName?: string | null;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";
  const name = firstName?.trim();

  return (
    <div
      className="min-h-dvh bg-[var(--client-page-bg,#0a0a0a)]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom:
          "calc(var(--client-bottom-nav-reserved) + var(--client-bottom-nav-fade, 40px) + 16px)",
      }}
      role="status"
      aria-label="Chargement de l'accueil"
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4">
        <div className="flex items-center justify-between pt-2">
          <Pulse className="h-4 w-20 rounded-full bg-white/[0.08]" />
          <Pulse className="h-4 w-24 rounded-full bg-white/[0.05]" />
        </div>

        <div className="flex items-center gap-3 pb-2">
          <Pulse className="h-12 w-12 shrink-0 rounded-[20px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-semibold tracking-tight text-white">
              {greeting}
              {name ? (
                <>
                  , <span className="text-white/90">{name}</span>
                </>
              ) : (
                <span className="ml-2 inline-block h-4 w-24 animate-pulse rounded-full bg-white/[0.08] align-middle" />
              )}
            </p>
            <Pulse className="mt-1.5 h-3 w-28 rounded-full bg-white/[0.04]" />
          </div>
          <Pulse className="h-12 w-[88px] rounded-2xl bg-white/[0.05]" />
        </div>

        <Pulse className="h-[52px] rounded-[24px] bg-white/[0.04]" />
        <Pulse className="h-[100px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[140px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
        <Pulse className="h-[120px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
        <div className="grid grid-cols-2 gap-3">
          <Pulse className="h-[135px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
          <Pulse className="h-[135px] rounded-[24px] border border-white/[0.04] bg-[#09090a]" />
        </div>
      </div>
    </div>
  );
}
