"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  Layers,
  Briefcase,
  UserCircle,
} from "lucide-react";

const DOCK_LEFT_ITEMS = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    href: "/dashboard",
    match: (p: string) => p === "/dashboard",
  },
  {
    id: "lab",
    icon: FlaskConical,
    label: "Lab",
    href: "/coach/clients",
    match: (p: string) => p.startsWith("/coach/clients") || p.startsWith("/lab"),
  },
  {
    id: "templates",
    icon: Layers,
    label: "Templates",
    href: "/coach/programs/templates",
    match: (p: string) => p.startsWith("/coach/programs") || p.startsWith("/coach/assessments"),
  },
  {
    id: "business",
    icon: Briefcase,
    label: "Business",
    href: "/coach/comptabilite",
    match: (p: string) =>
      p.startsWith("/coach/comptabilite") ||
      p.startsWith("/coach/formules"),
  },
  {
    id: "compte",
    icon: UserCircle,
    label: "Mon compte",
    href: "/coach/settings",
    match: (p: string) => p.startsWith("/coach/settings"),
  },
] as const;

export default function DockLeft() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl px-2 py-3">
      {DOCK_LEFT_ITEMS.map(({ id, icon: Icon, label, href, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={id}
            href={href}
            title={label}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 group ${
              active
                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2 : 1.75} />
            {active && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#1f8a65]" />
            )}
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#0f0f0f] border-[0.3px] border-white/[0.06] rounded-lg text-[11px] font-medium text-white/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
              {label}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}
