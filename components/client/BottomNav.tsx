"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircle, Barbell, ForkKnife, ChartLine, Plus } from "@phosphor-icons/react";
import { useClientT } from "./ClientI18nProvider";
import { useTour } from "./TourContext";
import type { ClientDictKey } from "@/lib/i18n/clientTranslations";
import { useInboxUnreadCount } from "@/lib/client/useInboxUnreadCount";
import dynamic from "next/dynamic";

const QuickLogSheet = dynamic(() => import("@/components/client/QuickLogSheet"), { ssr: false });

const LEFT_NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client",           labelKey: "nav.chat",      Icon: ChatCircle },
  { href: "/client/programme", labelKey: "nav.programme", Icon: Barbell },
];
const RIGHT_NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client/nutrition", labelKey: "nav.nutrition", Icon: ForkKnife },
  { href: "/client/metrics",   labelKey: "nav.metrics",   Icon: ChartLine },
];

export default function BottomNav() {
  const pathname                = usePathname();
  const { t }                   = useClientT();
  const { highlightedNavIndex, highlightFAB } = useTour();
  const [logOpen, setLogOpen]   = useState(false);
  const { count: unreadCount } = useInboxUnreadCount();

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
      className="flex items-center justify-center flex-1 h-full"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Pill covering icon + label */}
      <div
        style={{
          position:       "relative",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            4,
          padding:        "8px 13px",
          borderRadius:   14,
          background:     active ? "rgba(255,255,255,0.10)" : "transparent",
          transition:     "background 220ms ease",
        }}
      >
        {/* Global unread badge */}
        {href === "/client" && unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1 min-w-[14px] h-[14px] px-[3px] rounded-full text-[8px] leading-[14px] text-center font-bold tabular-nums z-10"
            style={{ background: "#A67C52", color: "#080808" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        <Icon
          size={21}
          weight={active ? "fill" : "regular"}
          style={{
            color:      active ? "#e8e8e8" : "#4a4a4a",
            transition: "color 220ms ease",
            display:    "block",
          }}
        />

        <span
          className="font-barlow-condensed font-bold uppercase tracking-[0.14em] leading-none"
          style={{
            fontSize:   "8px",
            color:      active ? "#e8e8e8" : "#383838",
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
        className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pointer-events-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="pointer-events-auto w-full max-w-[520px] px-4 pb-3">
          <div
            className="flex items-center h-[70px] px-1"
            style={{
              background:            "rgba(12,12,12,0.94)",
              backdropFilter:        "blur(28px) saturate(160%)",
              WebkitBackdropFilter:  "blur(28px) saturate(160%)",
              borderRadius:          22,
              border:                "0.5px solid rgba(255,255,255,0.065)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.04) inset, " +
                "0 12px 40px rgba(0,0,0,0.65), " +
                "0 2px 8px rgba(0,0,0,0.4)",
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
                aria-label="Logger une série"
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
                    : "0.5px solid rgba(255,255,255,0.10)",
                  boxShadow: highlightFAB
                    ? "0 0 0 9999px rgba(0,0,0,0.80), 0 0 0 2px #f2f2f2, 0 2px 14px rgba(0,0,0,0.55)"
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
