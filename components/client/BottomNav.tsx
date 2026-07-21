"use client";

/**
 * Client bottom dock — visual DA mirrored from coach NavDock (NavRowB + NavCTA).
 * @see components/layout/NavDock/NavRowB.tsx
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFour,
  Barbell,
  ForkKnife,
  ChartLine,
  Plus,
  Drop,
  Coffee,
  Lightning,
  Phone,
  Heart,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useClientT } from "./ClientI18nProvider";
import { useTour } from "./TourContext";
import type { ClientDictKey } from "@/lib/i18n/clientTranslations";
import { useInboxUnreadCount } from "@/lib/client/useInboxUnreadCount";
import { warmNutritionFlows } from "@/lib/client/prefetch-nutrition-flows";
import { cn } from "@/app/lib/utils";

const QuickWaterModal = dynamic(
  () => import("@/components/client/QuickWaterModal"),
  { ssr: false },
);
const QuickCaffeineModal = dynamic(
  () => import("@/components/client/QuickCaffeineModal"),
  { ssr: false },
);
const FreeActivitySheet = dynamic(
  () => import("@/components/client/smart/FreeActivitySheet"),
  { ssr: false },
);
const LogPeriodSheet = dynamic(
  () => import("@/components/client/cycle/LogPeriodSheet"),
  { ssr: false },
);

/**
 * Coach DA (colors / surfaces) + client app scale (full-width, larger touch targets).
 * Plate: dock bg · border white/[0.06] · rounded-2xl — contrasts on darker page bg.
 */
const DOCK_CLASS =
  "flex h-16 w-full items-center gap-0 rounded-2xl border-[0.3px] border-white/[0.06] bg-[var(--client-dock-bg,#121212)] px-1.5";

/** Quick-actions plate — same surface as dock, size hugs content. */
const QUICK_ACTIONS_CLASS =
  "flex w-max max-w-full items-center gap-1 rounded-2xl border-[0.3px] border-white/[0.06] bg-[var(--client-dock-bg,#121212)] px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]";

const NAV_ITEMS: {
  href: string;
  labelKey: ClientDictKey;
  Icon: React.ElementType;
  tourId: string;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: "/client",
    labelKey: "nav.home",
    Icon: SquaresFour,
    tourId: "dashboard",
    match: (p) => p === "/client",
  },
  {
    href: "/client/programme",
    labelKey: "nav.programme",
    Icon: Barbell,
    tourId: "workout",
    match: (p) => p.startsWith("/client/programme"),
  },
  {
    href: "/client/nutrition",
    labelKey: "nav.nutrition",
    Icon: ForkKnife,
    tourId: "nutrition",
    match: (p) => p.startsWith("/client/nutrition"),
  },
  {
    href: "/client/metrics",
    labelKey: "nav.metrics",
    Icon: ChartLine,
    tourId: "metrics",
    match: (p) => p.startsWith("/client/metrics"),
  },
  {
    href: "/client/rendez-vous",
    labelKey: "nav.appointments",
    // Video call cue: "book a session with my coach", not a generic calendar
    Icon: Phone,
    tourId: "appointments",
    match: (p) => p.startsWith("/client/rendez-vous"),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useClientT();
  const { highlightedNavIndex, highlightFAB } = useTour();
  const [logOpen, setLogOpen] = useState(false);
  // Accueil = home system signals only (not chat+nutrition total).
  // Nutrition = live day alerts + nutrition inbox (see getClientInboxUnreadCount).
  const { home: homeNavBadge, nutrition: nutritionNavBadge, workout: workoutNavBadge } =
    useInboxUnreadCount();

  const [cycleState, setCycleState] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<
    "water" | "caffeine-coffee" | "caffeine-tea" | "activity" | "cycle" | null
  >(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    fetch("/api/client/cycle/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.cycleState) setCycleState(data.cycleState);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    const prefetch = () => {
      for (const { href } of NAV_ITEMS) {
        if (href !== pathname) router.prefetch(href);
      }
      warmNutritionFlows(router);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetch, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(prefetch, 250);
    return () => window.clearTimeout(timeoutId);
  }, [pathname, router]);

  function badgeForHref(href: string): number {
    if (href === "/client") return homeNavBadge;
    if (href === "/client/programme") return workoutNavBadge;
    if (href === "/client/nutrition") return nutritionNavBadge;
    return 0;
  }

  const actions = [
    {
      key: "water" as const,
      Icon: Drop,
      label: "Eau",
      color: "#64b8e8",
      surface: "bg-[#64b8e8]/15 hover:bg-[#64b8e8]/22",
    },
    {
      key: "caffeine" as const,
      Icon: Coffee,
      label: "Caféine",
      color: "#b9865c",
      surface: "bg-[#b9865c]/15 hover:bg-[#b9865c]/22",
    },
    {
      key: "meal" as const,
      Icon: ForkKnife,
      label: "Repas",
      color: "#63ad85",
      surface: "bg-[#63ad85]/15 hover:bg-[#63ad85]/22",
    },
    {
      key: "activity" as const,
      Icon: Lightning,
      label: "Activité",
      color: "#d6ad45",
      surface: "bg-[#d6ad45]/15 hover:bg-[#d6ad45]/22",
    },
    ...(cycleState?.hasActiveCycle
      ? [{
          key: "cycle" as const,
          Icon: Heart,
          label: "Cycle",
          color: "#dc7384",
          surface: "bg-[#dc7384]/15 hover:bg-[#dc7384]/22",
        }]
      : []),
  ];

  const handleAction = (key: string) => {
    setLogOpen(false);
    if (key === "water") setActiveModal("water");
    else if (key === "caffeine") setActiveModal("caffeine-coffee");
    else if (key === "activity") setActiveModal("activity");
    else if (key === "cycle") setActiveModal("cycle");
    else if (key === "meal") router.push("/client/nutrition/log");
  };

  const keyboardTransform =
    keyboardOffset > 0 ? `translate3d(0, ${keyboardOffset}px, 0)` : undefined;

  // Lower on screen than coach bottom-6 — tokenized gap (≈12px + safe-area).
  const dockBottom = "var(--client-bottom-nav-gap)";

  return (
    <>
      {/*
        Solid under-dock mask — hard cut at the horizontal mid-line of the nav
        plate (not the top edge). Content above mid-bar stays visible until the
        opaque dock covers it; fully gone only under the lower half.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[35]"
        style={{
          height:
            "calc(var(--client-bottom-nav-gap) + (var(--client-bottom-nav-height) * 0.5))",
          background: "var(--client-page-bg, #0a0a0a)",
          transform: keyboardTransform,
        }}
      />

      {/* Dims the current page so quick actions remain isolated from page data. */}
      <AnimatePresence initial={false}>
        {logOpen && (
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[38] bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLogOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Floating dock — plate floats; content is masked only underneath */}
      <div
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3"
        style={{
          bottom: dockBottom,
          transform: keyboardTransform,
        }}
      >
        <div className="pointer-events-auto relative w-full max-w-[440px]">
          <AnimatePresence initial={false}>
            {logOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute right-1.5 bottom-full z-[59] mb-3 flex flex-col items-center gap-2 rounded-2xl border-[0.3px] border-white/[0.08] bg-[#121212]/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.5)] backdrop-blur-sm"
                role="menu"
                aria-label="Actions rapides"
              >
                {actions.map((act, index) => {
                  const Icon = act.Icon;
                  const reverseIndex = actions.length - 1 - index;
                  return (
                    <motion.div
                      key={act.key}
                      initial={{ opacity: 0, y: 16, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.8 }}
                      transition={{
                        duration: 0.16,
                        delay: reverseIndex * 0.03,
                        ease: "easeOut",
                      }}
                      className="flex"
                    >
                      <button
                        key={act.key}
                        type="button"
                        role="menuitem"
                        title={act.label}
                        aria-label={act.label}
                        onClick={() => handleAction(act.key)}
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[0.3px] border-white/[0.08] transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                          act.surface,
                        )}
                        style={{ color: act.color }}
                      >
                        <Icon size={20} weight="fill" aria-hidden />
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          <nav className={DOCK_CLASS} aria-label="Navigation principale">
            {NAV_ITEMS.map((item, index) => {
              const active =
                highlightedNavIndex === index || item.match(pathname);
              const Icon = item.Icon;
              const label = t(item.labelKey);
              const badge = badgeForHref(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  data-tour-id={item.tourId}
                  onMouseEnter={() => {
                    if (item.href !== pathname) router.prefetch(item.href);
                  }}
                  onTouchStart={() => {
                    if (item.href !== pathname) router.prefetch(item.href);
                  }}
                  className={cn(
                    "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
                    active
                      ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                      : "text-white/40 hover:bg-white/[0.04] hover:text-white/70",
                  )}
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Icon
                    size={20}
                    weight={active ? "fill" : "regular"}
                    aria-hidden
                  />
                  <span className="max-w-full truncate text-center text-[9px] font-medium leading-none">
                    {label}
                  </span>
                  {badge > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white/85 px-0.5 text-[8px] font-bold leading-none text-[#121212] tabular-nums">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}



            <button
              type="button"
              onClick={() => setLogOpen((v) => !v)}
              aria-label={t("common.add")}
              aria-expanded={logOpen}
              data-tour-fab="true"
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-[background-color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                highlightFAB
                  ? "bg-white text-[#121212] ring-4 ring-white/20"
                  : "bg-[#1f8a65] text-white hover:bg-[#217356]",
                logOpen && !highlightFAB && "bg-[#217356]",
              )}
            >
              <Plus
                size={20}
                weight="bold"
                aria-hidden
                className="transition-transform duration-200"
                style={{
                  transform: logOpen ? "rotate(45deg)" : "rotate(0deg)",
                }}
              />
            </button>
          </nav>
        </div>
      </div>

      <QuickWaterModal
        open={activeModal === "water"}
        onClose={() => {
          setActiveModal(null);
          setLogOpen(false);
        }}
      />

      <QuickCaffeineModal
        open={
          activeModal === "caffeine-coffee" || activeModal === "caffeine-tea"
        }
        defaultKind={activeModal === "caffeine-tea" ? "tea" : "coffee"}
        onClose={() => {
          setActiveModal(null);
          setLogOpen(false);
        }}
      />

      <FreeActivitySheet
        open={activeModal === "activity"}
        onClose={() => {
          setActiveModal(null);
          setLogOpen(false);
        }}
        onSaved={() => {
          setActiveModal(null);
          setLogOpen(false);
        }}
      />

      <LogPeriodSheet
        open={activeModal === "cycle"}
        cycleState={cycleState}
        onClose={() => {
          setActiveModal(null);
          setLogOpen(false);
        }}
        onUpdated={(newState) => {
          setCycleState(newState);
          setActiveModal(null);
          setLogOpen(false);
        }}
      />
    </>
  );
}
