"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Users,
  Stack,
  Briefcase,
  UserCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { NavCTA } from "./NavCTA";
import type { CTAConfig } from "./useNavConfig";

const NAV_ITEMS = [
  {
    id: "accueil",
    label: "Accueil",
    icon: House,
    href: "/dashboard",
    match: (p: string) => p === "/dashboard",
  },
  {
    id: "lab",
    label: "Athlètes",
    icon: Users,
    href: "/coach/clients",
    match: (p: string) => p.startsWith("/coach/clients"),
  },
  {
    id: "studio",
    label: "Studio",
    icon: Stack,
    href: "/coach/programs/templates",
    match: (p: string) =>
      p.startsWith("/coach/programs") || p.startsWith("/coach/assessments"),
  },
  {
    id: "business",
    label: "Business",
    icon: Briefcase,
    href: "/coach/comptabilite",
    match: (p: string) =>
      p.startsWith("/coach/comptabilite") || p.startsWith("/coach/formules"),
  },
  {
    id: "compte",
    label: "Mon compte",
    icon: UserCircle,
    href: "/coach/settings",
    match: (p: string) => p.startsWith("/coach/settings"),
  },
] as const;

interface NavRowBProps {
  cta: CTAConfig;
}

export function NavRowB({ cta }: NavRowBProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 rounded-2xl px-3 h-14 border-[0.3px] border-white/[0.06] bg-[#121212]">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 h-9 transition-all duration-150 active:scale-95",
              active
                ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
            )}
          >
            <Icon
              size={16}
              weight={active ? "fill" : "regular"}
            />
            <span className="text-[8px] font-medium leading-none">{item.label}</span>
          </button>
        );
      })}

      {cta.type !== "hidden" && (
        <div className="mx-1 h-6 w-px shrink-0 bg-white/[0.07]" />
      )}

      <NavCTA cta={cta} />
    </div>
  );
}
