# Unified Dock Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le header + DockLeft + DockBottom par un seul dock unifié flottant en bas de l'écran avec 3 sections (navigation principale, navigation contextuelle, actions).

**Architecture:** Un composant `UnifiedDock` pill flottante (`fixed bottom-6 left-1/2 -translate-x-1/2`) avec `DockSectionA` (5 icônes permanentes), `DockSectionB` (items contextuels + ClientTabs), `DockSectionC` (actions injectées via `useDockConfig`). Une `ContextPill` flottante au-dessus affiche le breadcrumb actuel. Un `CommandPalette` slide-up gère la recherche et les filtres.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, Framer Motion, Lucide React, `usePathname` (next/navigation)

---

## Carte des fichiers

### Créer
```
components/layout/UnifiedDock/index.tsx
components/layout/UnifiedDock/UnifiedDock.tsx
components/layout/UnifiedDock/DockButton.tsx
components/layout/UnifiedDock/DockSectionA.tsx
components/layout/UnifiedDock/DockSectionB.tsx
components/layout/UnifiedDock/DockSectionC.tsx
components/layout/UnifiedDock/ContextPill.tsx
components/layout/UnifiedDock/CommandPalette.tsx
components/layout/UnifiedDock/useDockConfig.ts
components/layout/UnifiedDock/useDockScroll.ts
```

### Modifier
```
components/layout/DockContext.tsx          — ajouter commandPaletteOpen, setCommandPaletteOpen
components/layout/CoachShell.tsx           — supprimer TopBar + DockLeft + DockBottom, ajouter UnifiedDock
app/coach/organisation/page.tsx            — supprimer useSetTopBar, ajouter section Pilotage KPIs
app/coach/clients/page.tsx                 — supprimer useSetTopBar
app/coach/clients/[clientId]/profil/page.tsx
app/coach/clients/[clientId]/data/metriques/page.tsx
app/coach/clients/[clientId]/data/bilans/page.tsx
app/coach/clients/[clientId]/data/performances/page.tsx
app/coach/clients/[clientId]/data/morphopro/page.tsx
app/coach/clients/[clientId]/protocoles/nutrition/page.tsx
app/coach/clients/[clientId]/protocoles/entrainement/page.tsx
app/coach/clients/[clientId]/protocoles/cardio/page.tsx
app/coach/clients/[clientId]/protocoles/composition/page.tsx
app/coach/clients/[clientId]/bilans/[submissionId]/page.tsx
app/coach/assessments/page.tsx
app/coach/comptabilite/page.tsx
app/coach/formules/page.tsx
app/coach/settings/page.tsx
app/coach/programs/templates/page.tsx
app/coach/programs/templates/new/page.tsx
app/coach/programs/templates/[templateId]/assign/page.tsx
```

### Supprimer (après migration complète)
```
components/layout/DockLeft.tsx
components/layout/DockBottom.tsx
components/layout/TopBarContext.tsx
components/layout/useSetTopBar.tsx
components/layout/CoachHeader.tsx
components/layout/useDockBottom.ts
```

---

## Task 1 : Étendre DockContext

**Files:**
- Modify: `components/layout/DockContext.tsx`

- [ ] **Step 1 : Ajouter `commandPaletteOpen` au contexte**

Remplacer le contenu de `components/layout/DockContext.tsx` par :

```tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type OpenClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type DockContextType = {
  openClients: OpenClient[];
  activeClientId: string | null;
  openClient: (client: OpenClient) => void;
  closeClient: (clientId: string) => void;
  setActiveClient: (clientId: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
};

const DockContext = createContext<DockContextType>({
  openClients: [],
  activeClientId: null,
  openClient: () => {},
  closeClient: () => {},
  setActiveClient: () => {},
  commandPaletteOpen: false,
  setCommandPaletteOpen: () => {},
});

export function DockProvider({ children }: { children: ReactNode }) {
  const [openClients, setOpenClients] = useState<OpenClient[]>([]);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const openClient = useCallback((client: OpenClient) => {
    setOpenClients((prev) => {
      if (prev.find((c) => c.id === client.id)) return prev;
      return [...prev, client];
    });
    setActiveClientId(client.id);
  }, []);

  const closeClient = useCallback((clientId: string) => {
    setOpenClients((prev) => prev.filter((c) => c.id !== clientId));
    setActiveClientId((prev) => (prev === clientId ? null : prev));
  }, []);

  const setActiveClient = useCallback((clientId: string) => {
    setActiveClientId(clientId);
  }, []);

  return (
    <DockContext.Provider value={{
      openClients, activeClientId, openClient, closeClient, setActiveClient,
      commandPaletteOpen, setCommandPaletteOpen,
    }}>
      {children}
    </DockContext.Provider>
  );
}

export function useDock() {
  const context = useContext(DockContext);
  if (!context) throw new Error("useDock must be called within DockProvider");
  return context;
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected : 0 nouvelles erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/DockContext.tsx
git commit -m "feat(dock): extend DockContext with commandPaletteOpen state"
```

---

## Task 2 : Hook `useDockConfig`

**Files:**
- Create: `components/layout/UnifiedDock/useDockConfig.ts`

- [ ] **Step 1 : Créer le dossier et le hook**

```bash
mkdir -p /Users/user/Desktop/VIRTUS/components/layout/UnifiedDock
```

Créer `components/layout/UnifiedDock/useDockConfig.ts` :

```ts
"use client";

import { usePathname } from "next/navigation";
import {
  UserCircle, BarChart2, FileText, Activity, Scan,
  UtensilsCrossed, Dumbbell, Heart, Scale,
  Search, LayoutGrid, List, UserPlus, FilePlus,
  Upload, Download, Camera, CheckCircle, Plus,
  Edit2, Send, Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DockNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  hasPopover?: boolean;
};

export type DockAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  variant: "primary" | "secondary";
  /** Identifiant pour que la page puisse brancher un handler */
  actionKey: string;
  badge?: number;
  glowColor?: string;
  isActive?: boolean;
};

export type DockConfig = {
  sectionB: DockNavItem[];
  sectionC: DockAction[];
  breadcrumb: string | null;
};

/**
 * Retourne la config Section B + C selon la route active.
 * Les handlers réels (onClick) sont injectés par les pages via DockActionRegistry (Task 3).
 */
export function useDockConfig(): DockConfig {
  const pathname = usePathname();

  // ── Accueil ────────────────────────────────────────────────────────────────
  if (pathname === "/coach/organisation" || pathname === "/dashboard") {
    const isKanban = !pathname.includes("agenda");
    return {
      breadcrumb: null,
      sectionB: [
        { id: "kanban", label: "Vue Kanban", href: "/coach/organisation?tab=kanban", icon: LayoutGrid },
        { id: "agenda", label: "Vue Calendrier", href: "/coach/organisation?tab=agenda", icon: BarChart2 },
      ],
      sectionC: [
        {
          id: "add-task",
          label: isKanban ? "+ Tâche" : "+ Événement",
          icon: Plus,
          variant: "primary",
          actionKey: isKanban ? "ADD_TASK" : "ADD_EVENT",
        },
      ],
    };
  }

  // ── Lab : liste clients ────────────────────────────────────────────────────
  if (pathname === "/coach/clients") {
    return {
      breadcrumb: "Lab",
      sectionB: [
        { id: "all", label: "Tous", href: "/coach/clients", icon: UserCircle },
        { id: "active", label: "Actifs", href: "/coach/clients?status=active", icon: UserCircle },
        { id: "inactive", label: "Inactifs", href: "/coach/clients?status=inactive", icon: UserCircle },
        { id: "archived", label: "Archivés", href: "/coach/clients?status=archived", icon: UserCircle },
      ],
      sectionC: [
        { id: "search", label: "Recherche", icon: Search, variant: "secondary", actionKey: "OPEN_SEARCH" },
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
        { id: "new-client", label: "+ Nouveau client", icon: UserPlus, variant: "primary", actionKey: "NEW_CLIENT" },
      ],
    };
  }

  // ── Lab : client actif ─────────────────────────────────────────────────────
  const clientMatch = pathname.match(/^\/coach\/clients\/([^/]+)(\/(.*))?$/);
  if (clientMatch) {
    const clientId = clientMatch[1];
    const subPath = clientMatch[3] ?? "";

    const clientNavItems: DockNavItem[] = [
      { id: "profil", label: "Profil", href: `/coach/clients/${clientId}/profil`, icon: UserCircle },
      { id: "metriques", label: "Métriques", href: `/coach/clients/${clientId}/data/metriques`, icon: BarChart2 },
      { id: "bilans", label: "Bilans", href: `/coach/clients/${clientId}/data/bilans`, icon: FileText },
      { id: "performances", label: "Performances", href: `/coach/clients/${clientId}/data/performances`, icon: Activity },
      { id: "morphopro", label: "MorphoPro", href: `/coach/clients/${clientId}/data/morphopro`, icon: Scan },
      { id: "nutrition", label: "Nutrition", href: `/coach/clients/${clientId}/protocoles/nutrition`, icon: UtensilsCrossed, hasPopover: true },
      { id: "entrainement", label: "Entraînement", href: `/coach/clients/${clientId}/protocoles/entrainement`, icon: Dumbbell, hasPopover: true },
      { id: "cardio", label: "Cardio", href: `/coach/clients/${clientId}/protocoles/cardio`, icon: Heart, hasPopover: true },
      { id: "composition", label: "Composition", href: `/coach/clients/${clientId}/protocoles/composition`, icon: Scale, hasPopover: true },
    ];

    // Actions selon sous-route
    let sectionC: DockAction[] = [];
    let breadcrumb = "Lab";

    if (subPath.includes("profil")) {
      breadcrumb = "Profil";
      sectionC = [
        { id: "invite", label: "Inviter", icon: Send, variant: "secondary", actionKey: "INVITE_CLIENT" },
      ];
    } else if (subPath.includes("data/metriques")) {
      breadcrumb = "Métriques";
      sectionC = [
        { id: "add-metric", label: "+ Saisie", icon: Plus, variant: "primary", actionKey: "ADD_METRIC" },
        { id: "import", label: "Import CSV", icon: Upload, variant: "secondary", actionKey: "IMPORT_CSV" },
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
      ];
    } else if (subPath.includes("data/bilans")) {
      breadcrumb = "Bilans";
      sectionC = [
        { id: "new-bilan", label: "+ Bilan", icon: FilePlus, variant: "primary", actionKey: "NEW_BILAN" },
        { id: "send", label: "Envoyer", icon: Send, variant: "secondary", actionKey: "SEND_BILAN" },
      ];
    } else if (subPath.includes("data/performances")) {
      breadcrumb = "Performances";
      sectionC = [
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
        { id: "export", label: "Export", icon: Download, variant: "secondary", actionKey: "EXPORT" },
      ];
    } else if (subPath.includes("data/morphopro")) {
      breadcrumb = "MorphoPro";
      sectionC = [
        { id: "analyze", label: "Analyser", icon: Camera, variant: "primary", actionKey: "ANALYZE_MORPHO", glowColor: "rgba(139,92,246,0.4)" },
      ];
    } else if (subPath.includes("protocoles/nutrition")) {
      breadcrumb = "Nutrition";
      sectionC = [
        { id: "validate", label: "Valider protocole", icon: CheckCircle, variant: "primary", actionKey: "VALIDATE_PROTOCOL", glowColor: "rgba(31,138,101,0.4)" },
      ];
    } else if (subPath.includes("protocoles/entrainement")) {
      breadcrumb = "Entraînement";
      sectionC = [
        { id: "assign", label: "+ Assigner", icon: Plus, variant: "primary", actionKey: "ASSIGN_PROGRAM" },
        { id: "new", label: "+ Nouveau", icon: FilePlus, variant: "secondary", actionKey: "NEW_PROGRAM" },
      ];
    } else if (subPath.includes("protocoles/cardio")) {
      breadcrumb = "Cardio";
      sectionC = [
        { id: "validate", label: "Valider protocole", icon: CheckCircle, variant: "primary", actionKey: "VALIDATE_PROTOCOL", glowColor: "rgba(31,138,101,0.4)" },
      ];
    } else if (subPath.includes("protocoles/composition")) {
      breadcrumb = "Composition";
      sectionC = [
        { id: "validate", label: "Valider protocole", icon: CheckCircle, variant: "primary", actionKey: "VALIDATE_PROTOCOL", glowColor: "rgba(31,138,101,0.4)" },
      ];
    }

    return { breadcrumb, sectionB: clientNavItems, sectionC };
  }

  // ── Studio ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/programs") || pathname.startsWith("/coach/assessments")) {
    const isPrograms = pathname.startsWith("/coach/programs");
    const isAssessments = pathname.startsWith("/coach/assessments");

    let sectionC: DockAction[] = [];
    if (isPrograms && pathname.includes("/templates") && !pathname.includes("/new") && !pathname.includes("/edit") && !pathname.includes("/assign")) {
      sectionC = [
        { id: "search", label: "Recherche", icon: Search, variant: "secondary", actionKey: "OPEN_SEARCH" },
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
        { id: "new", label: "+ Nouveau", icon: Plus, variant: "primary", actionKey: "NEW_TEMPLATE" },
      ];
    } else if (isAssessments) {
      sectionC = [
        { id: "search", label: "Recherche", icon: Search, variant: "secondary", actionKey: "OPEN_SEARCH" },
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
        { id: "new", label: "+ Nouveau", icon: Plus, variant: "primary", actionKey: "NEW_ASSESSMENT" },
      ];
    }

    return {
      breadcrumb: "Studio",
      sectionB: [
        { id: "programmes", label: "Programmes", href: "/coach/programs/templates", icon: Dumbbell },
        { id: "bilans", label: "Bilans", href: "/coach/assessments", icon: FileText },
        { id: "nutrition", label: "Nutrition", href: "/coach/programs/nutrition", icon: UtensilsCrossed },
      ],
      sectionC,
    };
  }

  // ── Business ───────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/comptabilite") || pathname.startsWith("/coach/formules") || pathname.startsWith("/coach/organisation")) {
    let sectionC: DockAction[] = [];
    if (pathname.startsWith("/coach/comptabilite")) {
      sectionC = [
        { id: "search", label: "Recherche", icon: Search, variant: "secondary", actionKey: "OPEN_SEARCH" },
        { id: "view", label: "Vue", icon: LayoutGrid, variant: "secondary", actionKey: "TOGGLE_VIEW" },
        { id: "new", label: "+ Facture", icon: Plus, variant: "primary", actionKey: "NEW_INVOICE" },
      ];
    } else if (pathname.startsWith("/coach/formules")) {
      sectionC = [
        { id: "new", label: "+ Formule", icon: Plus, variant: "primary", actionKey: "NEW_FORMULA" },
      ];
    }

    return {
      breadcrumb: "Business",
      sectionB: [
        { id: "comptabilite", label: "Comptabilité", href: "/coach/comptabilite", icon: BarChart2 },
        { id: "formules", label: "Formules", href: "/coach/formules", icon: FileText },
        { id: "organisation", label: "Organisation", href: "/coach/organisation", icon: LayoutGrid },
      ],
      sectionC,
    };
  }

  // ── Mon compte ─────────────────────────────────────────────────────────────
  if (pathname.startsWith("/coach/settings")) {
    return {
      breadcrumb: "Mon compte",
      sectionB: [
        { id: "profil", label: "Profil", href: "/coach/settings", icon: UserCircle },
        { id: "preferences", label: "Préférences", href: "/coach/settings?tab=preferences", icon: Edit2 },
        { id: "notifications", label: "Notifications", href: "/coach/settings?tab=notifications", icon: FileText },
      ],
      sectionC: [],
    };
  }

  // ── Défaut ─────────────────────────────────────────────────────────────────
  return { breadcrumb: null, sectionB: [], sectionC: [] };
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected : 0 nouvelles erreurs.

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/useDockConfig.ts
git commit -m "feat(dock): add useDockConfig hook — central source of truth for B+C sections"
```

---

## Task 3 : Hook `useDockScroll`

**Files:**
- Create: `components/layout/UnifiedDock/useDockScroll.ts`

- [ ] **Step 1 : Créer le hook**

```ts
"use client";

import { useEffect, useState } from "react";

/**
 * Retourne true si l'utilisateur scrolle vers le bas (pill contextuelle masquée).
 * Retourne false si scroll vers le haut ou en haut de page (pill visible).
 */
export function useDockScroll(): boolean {
  const [scrollingDown, setScrollingDown] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const handler = () => {
      const currentY = window.scrollY;
      setScrollingDown(currentY > lastY && currentY > 80);
      setLastY(currentY);
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [lastY]);

  return scrollingDown;
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/useDockScroll.ts
git commit -m "feat(dock): add useDockScroll hook for context pill visibility"
```

---

## Task 4 : Composant `DockButton`

**Files:**
- Create: `components/layout/UnifiedDock/DockButton.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DockButtonProps {
  tooltip: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  size?: "sm" | "md" | "lg";
  badge?: number;
  style?: React.CSSProperties;
  href?: string;
}

export function DockButton({
  tooltip,
  onClick,
  active,
  children,
  className,
  glowColor,
  size = "md",
  badge,
  style,
}: DockButtonProps) {
  const [hovered, setHovered] = useState(false);
  const sizeClass = size === "lg" ? "w-11 h-11" : size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <div className="relative flex flex-col items-center">
      {/* Tooltip */}
      <div className={cn(
        "absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap pointer-events-none transition-all duration-150 z-10",
        "bg-black/90 text-white/90 backdrop-blur-sm border border-white/[0.08]",
        "shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
        hovered ? "opacity-100 -translate-y-1" : "opacity-0 translate-y-0"
      )}>
        {tooltip}
      </div>

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative flex items-center justify-center rounded-xl transition-all duration-200 select-none",
          sizeClass,
          hovered ? "scale-110" : "scale-100",
          className
        )}
        style={{
          ...(active && glowColor ? { boxShadow: `0 0 12px ${glowColor}` } : {}),
          ...style,
        }}
      >
        {children}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#1f8a65] border-[1.5px] border-[#0a0a0a]" />
        )}
      </button>
    </div>
  );
}

/** Bouton avec icône Lucide + label texte (pour Section C actions) */
export function DockActionButton({
  label,
  icon: Icon,
  onClick,
  variant = "secondary",
  badge,
  glowColor,
  isActive,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  badge?: number;
  glowColor?: string;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]",
        variant === "primary"
          ? "bg-[#1f8a65] text-white hover:bg-[#217356]"
          : isActive
          ? "bg-[#1f8a65]/20 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30"
          : "bg-white/[0.06] text-white/50 border-[0.3px] border-white/[0.06] hover:bg-white/[0.09] hover:text-white/80"
      )}
      style={glowColor && variant === "primary" ? { boxShadow: `0 0 12px ${glowColor}` } : undefined}
    >
      <Icon size={13} strokeWidth={1.75} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/DockButton.tsx
git commit -m "feat(dock): add DockButton and DockActionButton components"
```

---

## Task 5 : `DockSectionA` — Navigation principale

**Files:**
- Create: `components/layout/UnifiedDock/DockSectionA.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FlaskConical, Layers, Briefcase, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DockButton } from "./DockButton";

const NAV_ITEMS = [
  {
    id: "accueil",
    label: "Accueil",
    icon: LayoutDashboard,
    href: "/coach/organisation",
    match: (p: string) => p === "/coach/organisation" || p === "/dashboard",
  },
  {
    id: "lab",
    label: "Lab",
    icon: FlaskConical,
    href: "/coach/clients",
    match: (p: string) => p.startsWith("/coach/clients"),
  },
  {
    id: "studio",
    label: "Studio",
    icon: Layers,
    href: "/coach/programs/templates",
    match: (p: string) => p.startsWith("/coach/programs") || p.startsWith("/coach/assessments"),
  },
  {
    id: "business",
    label: "Business",
    icon: Briefcase,
    href: "/coach/comptabilite",
    match: (p: string) =>
      p.startsWith("/coach/comptabilite") ||
      p.startsWith("/coach/formules") ||
      (p.startsWith("/coach/organisation") && !p.includes("?tab=kanban") && !p.includes("?tab=agenda")),
  },
  {
    id: "compte",
    label: "Mon compte",
    icon: UserCircle,
    href: "/coach/settings",
    match: (p: string) => p.startsWith("/coach/settings"),
  },
] as const;

export function DockSectionA() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 shrink-0">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        return (
          <DockButton
            key={item.id}
            tooltip={item.label}
            onClick={() => router.push(item.href)}
            active={active}
            glowColor="rgba(31,138,101,0.4)"
            className={cn(
              "border flex-col gap-0.5",
              active
                ? "bg-[#1f8a65]/20 border-[#1f8a65]/30 text-[#1f8a65]"
                : "bg-white/[0.06] border-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.09]"
            )}
          >
            <Icon size={15} strokeWidth={active ? 2 : 1.75} />
            <span className="text-[8px] font-medium leading-none">{item.label}</span>
          </DockButton>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/DockSectionA.tsx
git commit -m "feat(dock): add DockSectionA — 5 main navigation items"
```

---

## Task 6 : `DockSectionB` — Navigation contextuelle + ClientTabs

**Files:**
- Create: `components/layout/UnifiedDock/DockSectionB.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDock } from "@/components/layout/DockContext";
import { useDockConfig, type DockNavItem } from "./useDockConfig";

function NavItem({ item }: { item: DockNavItem }) {
  const pathname = usePathname();
  const router = useRouter();
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/") ||
    (item.href.includes("?") && pathname === item.href.split("?")[0]);

  return (
    <button
      onClick={() => router.push(item.href)}
      className={cn(
        "flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all duration-150 shrink-0",
        active
          ? "bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20"
          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
      )}
    >
      <Icon size={12} strokeWidth={1.75} />
      <span>{item.label}</span>
      {item.hasPopover && (
        <ChevronDown size={10} strokeWidth={2} className="opacity-50" />
      )}
    </button>
  );
}

function ClientTabs() {
  const { openClients, activeClientId, closeClient, setActiveClient } = useDock();
  const router = useRouter();

  if (openClients.length === 0) return null;

  function handleSelect(clientId: string) {
    setActiveClient(clientId);
    router.push(`/coach/clients/${clientId}/profil`);
  }

  function handleClose(e: React.MouseEvent, clientId: string) {
    e.stopPropagation();
    closeClient(clientId);
    if (activeClientId === clientId) router.push("/coach/clients");
  }

  const visibleClients = openClients.slice(0, 3);

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {visibleClients.map((client) => {
          const active = client.id === activeClientId;
          const initials = `${client.firstName[0] ?? ""}${client.lastName[0] ?? ""}`.toUpperCase();
          return (
            <button
              key={client.id}
              onClick={() => handleSelect(client.id)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all duration-150 shrink-0",
                active
                  ? "bg-[#1f8a65]/10 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/20"
                  : "bg-white/[0.04] text-white/50 border-[0.3px] border-white/[0.06] hover:text-white/80 hover:bg-white/[0.06]"
              )}
            >
              <span className={cn(
                "w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0",
                active ? "bg-[#1f8a65]/20 text-[#1f8a65]" : "bg-white/[0.08] text-white/40"
              )}>
                {initials}
              </span>
              <span>{client.firstName}</span>
              <span
                role="button"
                onClick={(e) => handleClose(e, client.id)}
                className="ml-0.5 text-white/30 hover:text-white/70 transition-colors"
              >
                <X size={10} strokeWidth={2} />
              </span>
            </button>
          );
        })}
      </div>
      {openClients.length > 0 && <div className="w-px h-6 bg-white/[0.07] shrink-0" />}
    </>
  );
}

export function DockSectionB() {
  const { sectionB } = useDockConfig();

  if (sectionB.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar px-1">
      <ClientTabs />
      {sectionB.map((item) => (
        <NavItem key={item.id} item={item} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/DockSectionB.tsx
git commit -m "feat(dock): add DockSectionB — contextual nav items + ClientTabs"
```

---

## Task 7 : `DockSectionC` — Actions contextuelles

**Files:**
- Create: `components/layout/UnifiedDock/DockSectionC.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { useDockConfig } from "./useDockConfig";
import { DockActionButton } from "./DockButton";

/**
 * Registry global des handlers d'actions.
 * Les pages enregistrent leurs handlers via useDockActions().
 * Clé = actionKey défini dans useDockConfig.
 */
export const dockActionRegistry: Record<string, (() => void) | undefined> = {};

export function registerDockAction(key: string, handler: () => void) {
  dockActionRegistry[key] = handler;
}

export function unregisterDockAction(key: string) {
  delete dockActionRegistry[key];
}

export function DockSectionC() {
  const { sectionC } = useDockConfig();

  if (sectionC.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {sectionC.map((action) => (
        <DockActionButton
          key={action.id}
          label={action.label}
          icon={action.icon}
          variant={action.variant}
          badge={action.badge}
          glowColor={action.glowColor}
          isActive={action.isActive}
          onClick={() => dockActionRegistry[action.actionKey]?.()}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/DockSectionC.tsx
git commit -m "feat(dock): add DockSectionC with action registry pattern"
```

---

## Task 8 : Hook `useDockActions` (helper pour les pages)

**Files:**
- Create: `components/layout/UnifiedDock/useDockActions.ts`

Ce hook permet aux pages de brancher leurs handlers sur le registry sans se soucier du cleanup.

- [ ] **Step 1 : Créer le hook**

```ts
"use client";

import { useEffect } from "react";
import { registerDockAction, unregisterDockAction } from "./DockSectionC";

/**
 * Enregistre des handlers d'actions dock pour la durée de vie du composant.
 * Usage dans une page :
 *   useDockActions({ NEW_CLIENT: () => setShowModal(true), TOGGLE_VIEW: () => setView(v => ...) })
 */
export function useDockActions(actions: Record<string, () => void>) {
  useEffect(() => {
    Object.entries(actions).forEach(([key, handler]) => {
      registerDockAction(key, handler);
    });
    return () => {
      Object.keys(actions).forEach((key) => {
        unregisterDockAction(key);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/useDockActions.ts
git commit -m "feat(dock): add useDockActions hook for page-level action registration"
```

---

## Task 9 : `ContextPill` — Breadcrumb flottant

**Files:**
- Create: `components/layout/UnifiedDock/ContextPill.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useDockConfig } from "./useDockConfig";
import { useDockScroll } from "./useDockScroll";
import { useDock } from "@/components/layout/DockContext";

export function ContextPill() {
  const { breadcrumb } = useDockConfig();
  const scrollingDown = useDockScroll();
  const { openClients, activeClientId } = useDock();

  if (!breadcrumb) return null;

  const activeClient = openClients.find((c) => c.id === activeClientId);
  const label = activeClient
    ? `Lab › ${activeClient.firstName} ${activeClient.lastName} › ${breadcrumb}`
    : breadcrumb;

  return (
    <div className={cn(
      "fixed left-1/2 -translate-x-1/2 z-[59] transition-all duration-300",
      "bottom-[88px]", // dock height (64px) + gap (24px)
      scrollingDown ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"
    )}>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] backdrop-blur-sm border-[0.3px] border-white/[0.06]">
        <span className="text-[11px] text-white/50 font-medium whitespace-nowrap">
          {label}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/ContextPill.tsx
git commit -m "feat(dock): add ContextPill breadcrumb component"
```

---

## Task 10 : `CommandPalette`

**Files:**
- Create: `components/layout/UnifiedDock/CommandPalette.tsx`

- [ ] **Step 1 : Créer le composant**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDockConfig } from "./useDockConfig";
import { useRouter } from "next/navigation";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const { sectionB } = useDockConfig();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = sectionB.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div className={cn(
        "fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[56] w-[480px]",
        "rounded-2xl border border-white/[0.08] bg-black/70 backdrop-blur-2xl",
        "shadow-[0_24px_60px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]",
        "animate-in slide-in-from-bottom-3 duration-200"
      )}>
        <div className="p-4 space-y-3">
          {/* Search input */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] focus-within:border-[#1f8a65]/30 transition-colors">
            <Search className="h-4 w-4 text-white/25 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 bg-transparent text-sm outline-none text-white/90 placeholder:text-white/25"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results */}
          {filtered.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest text-white/20 uppercase mb-2">Navigation</p>
              <div className="flex flex-wrap gap-1.5">
                {filtered.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { router.push(item.href); onClose(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 transition-all"
                    >
                      <Icon size={12} strokeWidth={1.75} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Commit**

```bash
git add components/layout/UnifiedDock/CommandPalette.tsx
git commit -m "feat(dock): add CommandPalette slide-up component"
```

---

## Task 11 : `UnifiedDock` — Composant principal + `index.tsx`

**Files:**
- Create: `components/layout/UnifiedDock/UnifiedDock.tsx`
- Create: `components/layout/UnifiedDock/index.tsx`

- [ ] **Step 1 : Créer `UnifiedDock.tsx`**

```tsx
"use client";

import { useDock } from "@/components/layout/DockContext";
import { DockSectionA } from "./DockSectionA";
import { DockSectionB } from "./DockSectionB";
import { DockSectionC } from "./DockSectionC";
import { ContextPill } from "./ContextPill";
import { CommandPalette } from "./CommandPalette";

export function UnifiedDock() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useDock();

  return (
    <>
      <ContextPill />

      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
        {/* Pill container */}
        <div className="relative flex items-center gap-2 px-3 h-14 rounded-2xl">
          {/* Background layer */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.025] to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center gap-2">
            {/* Section A */}
            <DockSectionA />

            {/* Separator */}
            <div className="w-px h-6 bg-white/[0.07] shrink-0" />

            {/* Section B */}
            <DockSectionB />

            {/* Separator (only if Section C has items) */}
            <div className="w-px h-6 bg-white/[0.07] shrink-0" />

            {/* Section C */}
            <DockSectionC />
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2 : Créer `index.tsx`**

```tsx
export { UnifiedDock } from "./UnifiedDock";
export { useDockActions } from "./useDockActions";
export type { DockAction, DockNavItem, DockConfig } from "./useDockConfig";
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 : Commit**

```bash
git add components/layout/UnifiedDock/UnifiedDock.tsx components/layout/UnifiedDock/index.tsx
git commit -m "feat(dock): add UnifiedDock main component and public index"
```

---

## Task 12 : Migration `CoachShell`

**Files:**
- Modify: `components/layout/CoachShell.tsx`

- [ ] **Step 1 : Remplacer CoachShell**

Remplacer le contenu de `components/layout/CoachShell.tsx` par :

```tsx
"use client";

import { ReactNode } from "react";
import { DockProvider } from "@/components/layout/DockContext";
import { UnifiedDock } from "@/components/layout/UnifiedDock";

function ShellInner({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#121212]">
      {/* pb-28 = dock height (56px) + bottom-6 (24px) + extra (24px) clearance */}
      <div className="min-h-screen bg-[#121212] pb-28">
        {children}
      </div>
      <UnifiedDock />
    </div>
  );
}

export default function CoachShell({ children }: { children: ReactNode }) {
  return (
    <DockProvider>
      <ShellInner>{children}</ShellInner>
    </DockProvider>
  );
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3 : Tester visuellement — lancer le serveur**

```bash
cd /Users/user/Desktop/VIRTUS && npm run dev
```

Ouvrir `http://localhost:3000/coach/clients` et vérifier :
- Dock visible en bas de l'écran ✓
- Section A : 5 icônes avec labels ✓
- Section B : items "Tous | Actifs | Inactifs | Archivés" ✓
- Section C : "Recherche | Vue | + Nouveau client" ✓
- Pill contextuelle "Lab" au-dessus du dock ✓
- Plus de header ni de dock gauche ✓

- [ ] **Step 4 : Commit**

```bash
git add components/layout/CoachShell.tsx
git commit -m "feat(dock): migrate CoachShell to UnifiedDock — remove header and side dock"
```

---

## Task 13 : Supprimer les anciens composants

**Files:**
- Delete: `components/layout/DockLeft.tsx`
- Delete: `components/layout/DockBottom.tsx`
- Delete: `components/layout/TopBarContext.tsx`
- Delete: `components/layout/useSetTopBar.tsx`
- Delete: `components/layout/CoachHeader.tsx`
- Delete: `components/layout/useDockBottom.ts`

- [ ] **Step 1 : Supprimer les fichiers**

```bash
cd /Users/user/Desktop/VIRTUS
rm components/layout/DockLeft.tsx
rm components/layout/DockBottom.tsx
rm components/layout/TopBarContext.tsx
rm components/layout/useSetTopBar.tsx
rm components/layout/CoachHeader.tsx
rm components/layout/useDockBottom.ts
```

- [ ] **Step 2 : Vérifier TypeScript — des erreurs sont attendues ici**

```bash
npx tsc --noEmit 2>&1 | grep "error" | head -30
```

Les erreurs attendues sont des imports cassés vers `useSetTopBar` dans les pages. On les traite dans les tâches suivantes.

- [ ] **Step 3 : Commit**

```bash
git add -A
git commit -m "chore(dock): remove legacy DockLeft, DockBottom, TopBarContext, useSetTopBar, CoachHeader, useDockBottom"
```

---

## Task 14 : Migration pages — supprimer `useSetTopBar` (Batch 1 : Lab)

**Files:**
- Modify: `app/coach/clients/page.tsx`
- Modify: `app/coach/clients/[clientId]/profil/page.tsx`
- Modify: `app/coach/clients/[clientId]/data/metriques/page.tsx`
- Modify: `app/coach/clients/[clientId]/data/bilans/page.tsx`
- Modify: `app/coach/clients/[clientId]/data/performances/page.tsx`
- Modify: `app/coach/clients/[clientId]/data/morphopro/page.tsx`
- Modify: `app/coach/clients/[clientId]/bilans/[submissionId]/page.tsx`

Pour chaque fichier de ce batch :

- [ ] **Step 1 : Supprimer l'import `useSetTopBar`**

Retirer la ligne :
```ts
import { useSetTopBar } from "@/components/layout/useSetTopBar";
```

- [ ] **Step 2 : Supprimer l'appel `useSetTopBar`**

Retirer la ligne qui ressemble à :
```ts
useSetTopBar(topBarLeft, topBarRight);
```
ou
```ts
useSetTopBar(left, right);
```

Supprimer aussi les variables `topBarLeft` et `topBarRight` (et leur `useMemo`) si elles ne sont plus utilisées ailleurs.

- [ ] **Step 3 : Brancher les actions dock avec `useDockActions`**

Dans `app/coach/clients/page.tsx`, ajouter :
```ts
import { useDockActions } from "@/components/layout/UnifiedDock";
```

Puis dans le composant (après les useState existants) :
```ts
useDockActions({
  OPEN_SEARCH: () => setSearch(""),   // focus la barre de recherche existante
  TOGGLE_VIEW: () => setViewMode((v) => v === "grid" ? "list" : "grid"),
  NEW_CLIENT: () => setShowNewClientModal(true), // ou le nom exact de l'état modal existant
});
```

> **Note :** Adapter les noms des setters aux états réels du composant. Ne pas créer de nouveaux états — brancher sur l'existant.

- [ ] **Step 4 : Vérifier TypeScript après chaque fichier**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | grep "error" | head -20
```

- [ ] **Step 5 : Commit**

```bash
git add app/coach/clients/
git commit -m "feat(dock): migrate Lab pages — remove useSetTopBar, wire useDockActions"
```

---

## Task 15 : Migration pages — `useSetTopBar` (Batch 2 : Protocoles)

**Files:**
- Modify: `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx`
- Modify: `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx`
- Modify: `app/coach/clients/[clientId]/protocoles/cardio/page.tsx`
- Modify: `app/coach/clients/[clientId]/protocoles/composition/page.tsx`

Pour chaque fichier :

- [ ] **Step 1 : Supprimer l'import et l'appel `useSetTopBar`** (même pattern que Task 14 Step 1-2)

- [ ] **Step 2 : Brancher `useDockActions` pour VALIDATE_PROTOCOL**

```ts
import { useDockActions } from "@/components/layout/UnifiedDock";

// Dans le composant :
useDockActions({
  VALIDATE_PROTOCOL: () => handleSave(), // adapter au nom réel du handler de save
});
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | grep "error" | head -20
```

- [ ] **Step 4 : Commit**

```bash
git add app/coach/clients/[clientId]/protocoles/
git commit -m "feat(dock): migrate Protocoles pages — remove useSetTopBar, wire VALIDATE_PROTOCOL"
```

---

## Task 16 : Migration pages — `useSetTopBar` (Batch 3 : Studio + Business + Settings)

**Files:**
- Modify: `app/coach/programs/templates/page.tsx`
- Modify: `app/coach/programs/templates/new/page.tsx`
- Modify: `app/coach/programs/templates/[templateId]/assign/page.tsx`
- Modify: `app/coach/assessments/page.tsx`
- Modify: `app/coach/comptabilite/page.tsx`
- Modify: `app/coach/formules/page.tsx`
- Modify: `app/coach/settings/page.tsx`

Pour chaque fichier :

- [ ] **Step 1 : Supprimer l'import et l'appel `useSetTopBar`** (même pattern que Task 14)

- [ ] **Step 2 : Brancher `useDockActions` selon la page**

`app/coach/programs/templates/page.tsx` :
```ts
useDockActions({
  OPEN_SEARCH: () => setSearchOpen(true),
  TOGGLE_VIEW: () => setViewMode((v) => v === "grid" ? "list" : "grid"),
  NEW_TEMPLATE: () => router.push("/coach/programs/templates/new"),
});
```

`app/coach/assessments/page.tsx` :
```ts
useDockActions({
  OPEN_SEARCH: () => setSearchOpen(true),
  TOGGLE_VIEW: () => setViewMode((v) => v === "grid" ? "list" : "grid"),
  NEW_ASSESSMENT: () => router.push("/coach/assessments/templates/new"),
});
```

`app/coach/comptabilite/page.tsx` :
```ts
useDockActions({
  OPEN_SEARCH: () => setSearchOpen(true),
  TOGGLE_VIEW: () => setViewMode((v) => v === "grid" ? "list" : "grid"),
  NEW_INVOICE: () => setShowNewInvoiceModal(true),
});
```

`app/coach/formules/page.tsx` :
```ts
useDockActions({
  NEW_FORMULA: () => setShowNewFormulaModal(true),
});
```

> **Note :** Adapter les noms des setters aux états réels de chaque composant. Si un état n'existe pas (ex: `searchOpen`), le créer en local dans le composant.

- [ ] **Step 3 : Vérifier TypeScript — 0 erreurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4 : Commit**

```bash
git add app/coach/programs/ app/coach/assessments/ app/coach/comptabilite/ app/coach/formules/ app/coach/settings/
git commit -m "feat(dock): migrate Studio + Business + Settings pages — remove useSetTopBar"
```

---

## Task 17 : Enrichissement page Cockpit (Organisation)

**Files:**
- Modify: `app/coach/organisation/page.tsx`

- [ ] **Step 1 : Supprimer `useSetTopBar`** (même pattern que tasks précédentes)

- [ ] **Step 2 : Ajouter la section Pilotage en haut de la page**

Après les imports existants, ajouter :

```tsx
import { TrendingUp, Users, FileText, AlertTriangle } from "lucide-react";
```

Ajouter ce composant dans le fichier (avant le composant principal) :

```tsx
function PilotageSection() {
  const [stats, setStats] = useState<{
    activeClients: number;
    mrr: number;
    pendingBilans: number;
    todayTasks: number;
    alerts: Array<{ type: "critical" | "urgent"; message: string }>;
  } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard/coach");
        if (!res.ok) return;
        const data = await res.json();
        setStats({
          activeClients: data.hero?.activeClients ?? 0,
          mrr: data.financial?.mrr ?? 0,
          pendingBilans: data.alerts?.filter((a: { type: string }) => a.type === "bilan_pending").length ?? 0,
          todayTasks: 0,
          alerts: (data.alerts ?? []).slice(0, 3),
        });
      } catch {}
    }
    load();
  }, []);

  if (!stats) return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[1,2,3,4].map(i => (
        <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );

  const kpis = [
    { label: "Clients actifs", value: stats.activeClients, icon: Users, color: "#1f8a65" },
    { label: "MRR", value: `${stats.mrr}€`, icon: TrendingUp, color: "#1f8a65" },
    { label: "Bilans en attente", value: stats.pendingBilans, icon: FileText, color: stats.pendingBilans > 0 ? "#f59e0b" : "#1f8a65" },
    { label: "Tâches aujourd'hui", value: stats.todayTasks, icon: AlertTriangle, color: "#1f8a65" },
  ];

  return (
    <div className="mb-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06]">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${kpi.color}20` }}>
                <Icon size={14} style={{ color: kpi.color }} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-base font-black text-white leading-none">{kpi.value}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alertes */}
      {stats.alerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {stats.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] ${
              alert.type === "critical"
                ? "bg-red-500/10 border-[0.3px] border-red-500/20 text-red-400"
                : "bg-amber-500/10 border-[0.3px] border-amber-500/20 text-amber-400"
            }`}>
              <AlertTriangle size={12} strokeWidth={2} />
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Puis dans le composant principal, ajouter `<PilotageSection />` en premier enfant du conteneur principal (avant les tabs Kanban/Agenda).

- [ ] **Step 3 : Brancher `useDockActions`**

```ts
import { useDockActions } from "@/components/layout/UnifiedDock";

// Dans le composant principal :
useDockActions({
  ADD_TASK: () => setShowAddTaskModal(true),   // adapter au handler existant
  ADD_EVENT: () => setShowAddEventModal(true), // adapter au handler existant
});
```

- [ ] **Step 4 : Vérifier TypeScript — 0 erreurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5 : Commit**

```bash
git add app/coach/organisation/page.tsx
git commit -m "feat(cockpit): add Pilotage section — KPIs + alerts on Organisation page"
```

---

## Task 18 : Tests visuels finaux + CHANGELOG

- [ ] **Step 1 : Test complet toutes routes**

Lancer le serveur et tester chaque route :

```bash
npm run dev
```

Checklist :
- [ ] `/coach/organisation` — Section B : Vue Kanban/Calendrier · Section C : + Tâche/Événement · PilotageSection visible
- [ ] `/coach/clients` — Section B : filtres statut · Section C : Recherche + Vue + Nouveau client
- [ ] `/coach/clients/[id]/profil` — Section B : 9 items nav client · Section C : Inviter
- [ ] `/coach/clients/[id]/data/metriques` — Section C : + Saisie + Import CSV + Vue
- [ ] `/coach/clients/[id]/data/bilans` — Section C : + Bilan + Envoyer
- [ ] `/coach/clients/[id]/data/morphopro` — Section C : Analyser (glow violet)
- [ ] `/coach/clients/[id]/protocoles/nutrition` — Section C : Valider protocole (glow vert)
- [ ] `/coach/programs/templates` — Section B : Programmes/Bilans/Nutrition · Section C : Recherche + Vue + Nouveau
- [ ] `/coach/comptabilite` — Section B : Comptabilité/Formules/Organisation · Section C : Recherche + Vue + Facture
- [ ] `/coach/settings` — Section B : Profil/Préférences/Notifications · Section C : vide
- [ ] ClientTabs : ouvrir 2 clients, vérifier tabs dans Section B
- [ ] ContextPill : visible sur toutes les routes sauf Accueil
- [ ] ContextPill : breadcrumb "Lab › Prénom Nom › Métriques" avec client actif
- [ ] Scroll : pill disparaît en scrollant vers le bas, réapparaît en scrollant vers le haut
- [ ] Tooltip : au hover sur Section A items
- [ ] Plus de DockLeft ni TopBar visibles

- [ ] **Step 2 : Vérifier TypeScript final — 0 erreurs**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3 : Mettre à jour CHANGELOG.md**

Ajouter en tête du fichier :

```markdown
## 2026-04-20

FEATURE: Unified Dock Navigation — remplace Header + DockLeft + DockBottom par dock unifié bottom (Sections A/B/C)
FEATURE: ContextPill — breadcrumb flottant au-dessus du dock avec hide/show au scroll
FEATURE: CommandPalette — palette recherche/filtres slide-up rattachée au dock
FEATURE: useDockConfig — hook central source de vérité pour navigation contextuelle et actions
FEATURE: useDockActions — hook pour brancher les handlers de pages sur la Section C
FEATURE: Cockpit — section Pilotage avec KPIs + alertes en haut de la page Organisation
REFACTOR: CoachShell — suppression TopBarProvider, DockLeft, DockBottom
CHORE: Supprimer DockLeft, DockBottom, TopBarContext, useSetTopBar, CoachHeader, useDockBottom
```

- [ ] **Step 4 : Commit final**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for Unified Dock Navigation"
```

---

## Récapitulatif des tâches

| # | Tâche | Fichiers |
|---|-------|---------|
| 1 | Étendre DockContext | `DockContext.tsx` |
| 2 | Hook useDockConfig | `UnifiedDock/useDockConfig.ts` |
| 3 | Hook useDockScroll | `UnifiedDock/useDockScroll.ts` |
| 4 | DockButton | `UnifiedDock/DockButton.tsx` |
| 5 | DockSectionA | `UnifiedDock/DockSectionA.tsx` |
| 6 | DockSectionB | `UnifiedDock/DockSectionB.tsx` |
| 7 | DockSectionC + registry | `UnifiedDock/DockSectionC.tsx` |
| 8 | useDockActions | `UnifiedDock/useDockActions.ts` |
| 9 | ContextPill | `UnifiedDock/ContextPill.tsx` |
| 10 | CommandPalette | `UnifiedDock/CommandPalette.tsx` |
| 11 | UnifiedDock + index | `UnifiedDock/UnifiedDock.tsx` + `index.tsx` |
| 12 | Migration CoachShell | `CoachShell.tsx` |
| 13 | Supprimer anciens composants | 6 fichiers supprimés |
| 14 | Migration pages Lab | 7 pages |
| 15 | Migration Protocoles | 4 pages |
| 16 | Migration Studio + Business + Settings | 7 pages |
| 17 | Enrichissement Cockpit | `organisation/page.tsx` |
| 18 | Tests visuels + CHANGELOG | — |
