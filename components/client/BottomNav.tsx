"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SquaresFour, Barbell, ForkKnife, ChartLine, Plus } from "@phosphor-icons/react";
import { useClientT } from "./ClientI18nProvider";
import { useTour } from "./TourContext";
import type { ClientDictKey } from "@/lib/i18n/clientTranslations";
import { useInboxUnreadCount } from "@/lib/client/useInboxUnreadCount";
import dynamic from "next/dynamic";
import { warmNutritionFlows } from "@/lib/client/prefetch-nutrition-flows";

const QuickLogSheet = dynamic(() => import("@/components/client/QuickLogSheet"), { ssr: false });

const LEFT_NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client",           labelKey: "nav.home",      Icon: SquaresFour },
  { href: "/client/programme", labelKey: "nav.programme", Icon: Barbell },
];
const RIGHT_NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client/nutrition", labelKey: "nav.nutrition", Icon: ForkKnife },
  { href: "/client/metrics",   labelKey: "nav.metrics",   Icon: ChartLine },
];

export default function BottomNav() {
  const pathname                = usePathname();
  const router                  = useRouter();
  const { t }                   = useClientT();
  const { highlightedNavIndex, highlightFAB } = useTour();
  const [logOpen, setLogOpen]   = useState(false);
  const { count: unreadCount } = useInboxUnreadCount();

  useEffect(() => {
    const navHrefs = [...LEFT_NAV, ...RIGHT_NAV].map(({ href }) => href);
    const prefetch = () => {
      for (const href of navHrefs) {
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

  function prefetchHref(href: string) {
    if (href !== pathname) router.prefetch(href);
  }

  function isActive(href: string, idx: number, offset = 0) {
    const navIdx = offset + idx;
    if (highlightedNavIndex === navIdx) return true;
    if (href === "/client") return pathname === "/client";
    return pathname.startsWith(href);
  }

  const navItem = (
    href: string,
    labelKey: ClientDictKey,
    Icon: React.ElementType,
    active: boolean,
  ) => (
    <Link
      key={href}
      href={href}
      prefetch
      className="flex items-center justify-center flex-1 h-full"
      style={{ WebkitTapHighlightColor: "transparent" }}
      onMouseEnter={() => prefetchHref(href)}
      onTouchStart={() => prefetchHref(href)}
      onFocus={() => prefetchHref(href)}
    >
      {/* Pill covering icon + label */}
      <div
        data-tour-id={
          href === '/client'
            ? 'dashboard'
            : href === '/client/programme'
              ? 'workout'
              : href === '/client/nutrition'
                ? 'nutrition'
                : 'metrics'
        }
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: "8px 13px",
          borderRadius: 14,
          background: active ? "rgba(255,255,255,0.052)" : "transparent",
          border: active ? "0.5px solid rgba(255,255,255,0.04)" : "0.5px solid transparent",
          transition: "background 220ms ease, border-color 220ms ease",
        }}
      >


        <Icon
          size={21}
          weight={active ? "fill" : "regular"}
          style={{
            color:      active ? "#e8e8e8" : "#5d5d5d",
            transition: "color 220ms ease",
            display:    "block",
          }}
        />

        <span
          className="font-barlow-condensed font-bold uppercase tracking-[0.14em] leading-none"
          style={{
            fontSize:   "8px",
            color:      active ? "#cfcfcf" : "#4b4b4b",
            transition: "color 220ms ease",
          }}
        >
          {t(labelKey)}
        </span>
      </div>
    </Link>
  );

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.045)",
          background: "var(--client-chrome-bg)",
          boxShadow: "0 -10px 28px rgba(0,0,0,0.26)",
          paddingBottom: 0,
        }}
      >
        <div
          className="pointer-events-auto mx-auto w-full max-w-[520px]"
        >
          <div
            className="flex items-center h-[70px] px-2"
            style={{
              background: "transparent",
            }}
          >
            {/* Left tabs */}
            {LEFT_NAV.map(({ href, labelKey, Icon }, i) =>
              navItem(href, labelKey, Icon, isActive(href, i, 0))
            )}

            {/* Central FAB */}
            <div className="flex flex-col items-center justify-center flex-1 h-full">
              <button
                onClick={() => setLogOpen((v) => !v)}
                aria-label={t("common.add")}
                data-tour-fab="true"
                style={{
                  width:                  46,
                  height:                 46,
                  borderRadius:           14,
                  background:             "#f2f2f2",
                  display:                "flex",
                  alignItems:             "center",
                  justifyContent:         "center",
                  flexShrink:             0,
                  border:                 highlightFAB
                    ? "2px solid #f2f2f2"
                    : "0.5px solid rgba(255,255,255,0.06)",
                  boxShadow: highlightFAB
                    ? "0 0 0 3px rgba(242,242,242,0.16), 0 2px 14px rgba(0,0,0,0.55)"
                    : "0 2px 14px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.18) inset",
                  WebkitTapHighlightColor: "transparent",
                  position:               "relative",
                  zIndex:                 highlightFAB ? 61 : undefined,
                }}
                onPointerDown={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.transform  = "scale(0.87)";
                  el.style.boxShadow  = "0 1px 6px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.14) inset";
                }}
                onPointerUp={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.transform  = "scale(1)";
                  el.style.boxShadow  = "0 2px 14px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.18) inset";
                }}
                onPointerLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.transform  = "scale(1)";
                  el.style.boxShadow  = "0 2px 14px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.18) inset";
                }}
              >
                <Plus
                  size={18}
                  weight="bold"
                  style={{
                    color:      "#080808",
                    display:    "block",
                    transform:  logOpen ? "rotate(45deg)" : "rotate(0deg)",
                    transition: "transform 320ms cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
              </button>
            </div>

            {/* Right tabs */}
            {RIGHT_NAV.map(({ href, labelKey, Icon }, i) =>
              navItem(href, labelKey, Icon, isActive(href, i, 2))
            )}
          </div>
        </div>
      </nav>

      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
