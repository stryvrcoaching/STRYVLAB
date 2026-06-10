"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calculator,
  Dumbbell,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
  FileText,
  CreditCard,
  Euro,
  MessageSquareWarning,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Principal",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/dashboard",
        match: (p: string) => p === "/dashboard",
      },
      {
        icon: Users,
        label: "Clients",
        href: "/coach/clients",
        match: (p: string) => p.startsWith("/coach/clients"),
      },
      {
        icon: ClipboardList,
        label: "Bilans",
        href: "/coach/assessments",
        match: (p: string) => p.startsWith("/coach/assessments"),
      },
      {
        icon: MessageSquareWarning,
        label: "Inbox IA",
        href: "/coach/inbox",
        match: (p: string) => p.startsWith("/coach/inbox"),
      },
      {
        icon: Dumbbell,
        label: "Programmes",
        href: "/coach/programs/templates",
        match: (p: string) => p.startsWith("/coach/programs"),
      },
      {
        icon: CreditCard,
        label: "Formules",
        href: "/coach/formules",
        match: (p: string) => p.startsWith("/coach/formules"),
      },
      {
        icon: Euro,
        label: "Comptabilité",
        href: "/coach/comptabilite",
        match: (p: string) => p.startsWith("/coach/comptabilite"),
      },
      {
        icon: Activity,
        label: "Organisation",
        href: "/coach/organisation",
        match: (p: string) => p.startsWith("/coach/organisation"),
      },
    ],
  },
  {
    label: "Calculatrices Coach",
    items: [
      {
        icon: Calculator,
        label: "Toutes les calculatrices",
        href: "/outils",
        match: (p: string) => p === "/outils",
      },
      {
        icon: Dumbbell,
        label: "Macros & Calories",
        href: "/outils/macros",
        match: (p: string) => p.startsWith("/outils/macros"),
      },
      {
        icon: Activity,
        label: "1RM & Force",
        href: "/outils/1rm",
        match: (p: string) => p.startsWith("/outils/1rm"),
      },
      {
        icon: FileText,
        label: "% Masse grasse",
        href: "/outils/body-fat",
        match: (p: string) => p.startsWith("/outils/body-fat"),
      },
      {
        icon: Activity,
        label: "Zones cardio",
        href: "/outils/hr-zones",
        match: (p: string) => p.startsWith("/outils/hr-zones"),
      },
    ],
  },
  {
    label: "Compte",
    items: [
      {
        icon: Settings,
        label: "Mon compte",
        href: "/coach/settings",
        match: (p: string) => p.startsWith("/coach/settings"),
      },
    ],
  },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  const fetchInboxCount = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/inbox?summary=true");
      if (res.ok) {
        const data = await res.json();
        const pending = data.pending || {};
        const count = Object.values(pending).reduce((a: any, b: any) => a + b, 0) as number;
        setInboxCount(count);
      }
    } catch {}
  }, []);
  
  useEffect(() => {
    fetchInboxCount();
    const interval = setInterval(fetchInboxCount, 60000); // Polling toutes les minutes
    return () => clearInterval(interval);
  }, [fetchInboxCount]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside
      className={`fixed top-4 left-4 h-[calc(100vh-32px)] bg-[#181818] rounded-2xl flex flex-col z-50 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-52"
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 shrink-0 cursor-pointer ${
          isCollapsed ? "justify-center" : ""
        }`}
        onClick={() => !isCollapsed && router.push("/dashboard")}
      >
        <Image
          src="/images/logo.png"
          alt="STRYV"
          width={28}
          height={28}
          className="w-7 h-7 object-contain shrink-0"
        />
        {!isCollapsed && (
          <span className="font-unbounded font-semibold text-white tracking-tight text-[11px] leading-none">
            STRYV <span className="font-light text-white/40">lab</span>
            <br />
            <span
              className="font-normal text-white/35"
              style={{ fontSize: "9px" }}
            >
              Coach
            </span>
          </span>
        )}
      </div>

      {/* Séparateur */}
      <div className="h-px bg-white/[0.07] mx-3 shrink-0" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-5 no-scrollbar">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!isCollapsed && (
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em] px-2 mb-1.5">
                {section.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ icon: Icon, label, href, match }) => {
                const active = match(pathname);
                const disabled = href === "#";
                return (
                  <button
                    key={label}
                    onClick={() => !disabled && router.push(href)}
                    disabled={disabled}
                    title={isCollapsed ? label : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-150 ${
                      isCollapsed ? "justify-center" : "w-full"
                    } ${
                      active
                        ? "bg-white/[0.08] text-white"
                        : disabled
                          ? "text-white/20 cursor-not-allowed"
                          : "text-white/45 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    <Icon
                      size={14}
                      strokeWidth={active ? 2.25 : 1.75}
                      className="shrink-0"
                    />
                    {!isCollapsed && (
                      <>
                        <span className="text-[12px] font-medium truncate flex-1 flex items-center justify-between">
                          {label}
                          {label === "Inbox IA" && inboxCount > 0 && (
                            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ml-2 leading-none">
                              {inboxCount}
                            </span>
                          )}
                        </span>
                        {active && (
                          <ChevronRight
                            size={11}
                            className="shrink-0 text-white/30"
                          />
                        )}
                        {disabled && (
                          <span className="text-[8px] font-bold text-white/20">
                            Bientôt
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Séparateur */}
      <div className="h-px bg-white/[0.07] mx-3 shrink-0" />

      {/* Footer */}
      <div className="px-2 py-3 shrink-0 flex flex-col gap-0.5">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Développer" : "Réduire"}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-white/35 hover:text-white/70 hover:bg-white/[0.05] ${
            isCollapsed ? "justify-center" : "w-full"
          }`}
        >
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            className={`shrink-0 transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`}
          />
          {!isCollapsed && (
            <span className="text-[12px] font-medium">Réduire</span>
          )}
        </button>
        <button
          onClick={handleLogout}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-white/35 hover:text-red-400 hover:bg-red-950/20 ${
            isCollapsed ? "justify-center" : "w-full"
          }`}
          title={isCollapsed ? "Déconnexion" : undefined}
        >
          <LogOut size={14} strokeWidth={1.75} className="shrink-0" />
          {!isCollapsed && (
            <span className="text-[12px] font-medium">Déconnexion</span>
          )}
        </button>
      </div>
    </aside>
  );
}
