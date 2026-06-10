"use client";

import { usePathname } from "next/navigation";

export type NavRowAItem = {
  id: string;
  label: string;
  href?: string;
  dropdown?: { id: string; label: string; href: string }[];
};

export type CTAConfig =
  | { type: "hidden" }
  | { type: "direct"; label: string; actionKey: string }
  | { type: "menu"; actions: { id: string; label: string; actionKey: string }[] };

export type NavConfig = {
  rowA: NavRowAItem[] | null;
  cta: CTAConfig;
};

export function useNavConfig(): NavConfig {
  const pathname = usePathname();

  // ── Accueil ──────────────────────────────────────────────────────────────
  if (pathname === "/dashboard") {
    return {
      rowA: null,
      cta: { type: "hidden" },
    };
  }

  // ── Liste clients ─────────────────────────────────────────────────────────
  if (pathname === "/coach/clients") {
    return {
      rowA: null,
      cta: {
        type: "direct",
        label: "+ Nouveau client",
        actionKey: "NEW_CLIENT",
      },
    };
  }

  // ── Client actif ──────────────────────────────────────────────────────────
  const clientMatch = pathname.match(/^\/coach\/clients\/([^/]+)(\/(.*))?$/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    const subPath = clientMatch[3] ?? "";

    const rowA: NavRowAItem[] = [
      { id: "profil", label: "Profil", href: `/coach/clients/${clientId}/profil` },
      {
        id: "data",
        label: "Data",
        dropdown: [
          { id: "metriques", label: "Métriques", href: `/coach/clients/${clientId}/data/metriques` },
          { id: "checkins", label: "Check-ins", href: `/coach/clients/${clientId}/data/checkins` },
          { id: "bilans", label: "Bilans", href: `/coach/clients/${clientId}/data/bilans` },
          { id: "performances", label: "Performances", href: `/coach/clients/${clientId}/data/performances` },
          { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/data/nutrition` },
          { id: "morphopro", label: "MorphoPro", href: `/coach/clients/${clientId}/data/morphopro` },
        ],
      },
      {
        id: "protocoles",
        label: "Protocoles",
        dropdown: [
          { id: "nutrition", label: "Nutrition Studio", href: `/coach/clients/${clientId}/protocoles/nutrition` },
          { id: "entrainement", label: "Workout Studio", href: `/coach/clients/${clientId}/protocoles/entrainement` },
          { id: "cardio", label: "Cardio", href: `/coach/clients/${clientId}/protocoles/cardio` },
          { id: "composition", label: "Composition", href: `/coach/clients/${clientId}/protocoles/composition` },
        ],
      },
    ];

    return { rowA, cta: { type: "hidden" } };
  }

  // ── Studio ────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/programs") || pathname.startsWith("/coach/assessments")) {
    return {
      rowA: [
        { id: "programmes", label: "Programmes", href: "/coach/programs/templates" },
        { id: "bilans", label: "Bilans", href: "/coach/assessments" },
        { id: "nutrition", label: "Nutrition", href: "/coach/programs/nutrition" },
      ],
      cta: { type: "hidden" },
    };
  }

  // ── Business ──────────────────────────────────────────────────────────────
  if (
    pathname.startsWith("/coach/comptabilite") ||
    pathname.startsWith("/coach/formules")
  ) {
    return {
      rowA: [
        { id: "comptabilite", label: "Comptabilité", href: "/coach/comptabilite" },
        { id: "formules", label: "Formules", href: "/coach/formules" },
      ],
      cta: { type: "hidden" },
    };
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/settings")) {
    return {
      rowA: [
        { id: "profil", label: "Profil", href: "/coach/settings" },
        { id: "preferences", label: "Préférences", href: "/coach/settings?tab=preferences" },
        { id: "notifications", label: "Notifications", href: "/coach/settings?tab=notifications" },
      ],
      cta: { type: "hidden" },
    };
  }

  // ── Défaut ────────────────────────────────────────────────────────────────
  return { rowA: null, cta: { type: "hidden" } };
}
