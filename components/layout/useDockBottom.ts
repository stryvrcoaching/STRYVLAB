"use client";

import { usePathname } from "next/navigation";
import {
  BarChart2,
  ClipboardList,
  TrendingUp,
  Scan,
  Utensils,
  Dumbbell,
  CreditCard,
  Euro,
  Activity,
  ClipboardCheck,
  UserCircle,
  Bell,
  Settings,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DockBottomItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export function useDockBottom(): DockBottomItem[] {
  const pathname = usePathname();

  // Lab — client ouvert — Suivi
  if (pathname.includes("/coach/clients/") && pathname.includes("/data")) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "bilans", label: "Bilans", href: `/coach/clients/${clientId}/data/bilans`, icon: ClipboardList },
      { id: "metriques", label: "Métriques", href: `/coach/clients/${clientId}/data/metriques`, icon: BarChart2 },
      { id: "morphopro", label: "MorphoPro", href: `/coach/clients/${clientId}/data/morphopro`, icon: Scan },
      { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/data/nutrition`, icon: Utensils },
      { id: "performances", label: "Performances", href: `/coach/clients/${clientId}/data/performances`, icon: TrendingUp },
    ];
  }

  // Lab — client ouvert — Protocoles
  if (pathname.includes("/coach/clients/") && pathname.includes("/protocoles")) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/protocoles/nutrition`, icon: Utensils },
      { id: "entrainement", label: "Workout Studio", href: `/coach/clients/${clientId}/protocoles/entrainement`, icon: Dumbbell },
    ];
  }

  // Lab — client ouvert — page racine (profil)
  if (pathname.match(/^\/coach\/clients\/[^/]+\/(profil)?$/)) {
    const clientId = pathname.split("/coach/clients/")[1]?.split("/")[0];
    return [
      { id: "profil", label: "Profil", href: `/coach/clients/${clientId}/profil`, icon: UserCircle },
      { id: "data", label: "Suivi", href: `/coach/clients/${clientId}/data/bilans`, icon: BarChart2 },
      { id: "protocoles", label: "Protocoles", href: `/coach/clients/${clientId}/protocoles/nutrition`, icon: Layers },
    ];
  }

  // Lab — Data & Analyse
  if (pathname.includes("/lab/") && pathname.includes("/data")) {
    return [
      { id: "metriques", label: "Métriques", href: "", icon: BarChart2 },
      { id: "bilans", label: "Bilans", href: "", icon: ClipboardList },
      { id: "performances", label: "Performances", href: "", icon: TrendingUp },
      { id: "morphopro", label: "MorphoPro", href: "", icon: Scan },
    ];
  }

  // Lab — Protocoles
  if (pathname.includes("/lab/") && pathname.includes("/protocoles")) {
    return [
      { id: "nutrition", label: "Nutrition", href: "", icon: Utensils },
      { id: "entrainement", label: "Workout Studio", href: "", icon: Dumbbell },
    ];
  }

  // Business
  if (
    pathname.startsWith("/coach/comptabilite") ||
    pathname.startsWith("/coach/formules") ||
    pathname.startsWith("/coach/organisation")
  ) {
    return [
      { id: "comptabilite", label: "Comptabilité", href: "/coach/comptabilite", icon: Euro },
      { id: "formules", label: "Formules", href: "/coach/formules", icon: CreditCard },
      { id: "organisation", label: "Organisation", href: "/coach/organisation", icon: Activity },
    ];
  }

  // Templates
  if (pathname.startsWith("/coach/programs") || pathname.startsWith("/coach/assessments")) {
    return [
      { id: "programmes", label: "Programmes", href: "/coach/programs/templates", icon: Dumbbell },
      { id: "bilans", label: "Bilans", href: "/coach/assessments", icon: ClipboardCheck },
    ];
  }

  // Mon compte
  if (pathname.startsWith("/coach/settings")) {
    return [
      { id: "profil", label: "Profil", href: "/coach/settings", icon: UserCircle },
      { id: "preferences", label: "Préférences", href: "/coach/settings#preferences", icon: Settings },
      { id: "notifications", label: "Notifications", href: "/coach/settings#notifications", icon: Bell },
    ];
  }

  // Dashboard et autres — pas de dock bas
  return [];
}
